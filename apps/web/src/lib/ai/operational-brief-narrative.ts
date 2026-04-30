/**
 * §11.153 #operational-brief-anthropic-narrative
 *
 * facts → 한국어 1문장 narrative.
 *
 * 동작 분기:
 *   1) ANTHROPIC_API_KEY 부재 또는 OPERATIONAL_BRIEF_USE_LLM != "1" → deterministic facts 압축
 *      (graceful degradation, prod 비용 0)
 *   2) 위 두 조건 만족 → callAnthropicMessage (build-rationale §11.25 패턴 재사용)
 *
 * §11.142 lock 정합:
 *   - status / blocker / nextAction 같은 facts 는 caller 가 결정 (resolver-derived)
 *   - LLM 은 facts 를 "한국어 1문장 압축만" — status overwrite 0
 *   - LLM 호출 실패 시 자동 fallback to deterministic — caller error 0
 */

import { callAnthropicMessage } from "@/lib/ai/anthropic";

export interface BriefNarrativeFacts {
  status?: string | number | null;
  blocker?: string | number | null;
  nextAction?: string | number | null;
  [extra: string]: string | number | null | undefined;
}

// §11.165 — prompt-tune 강화 (few-shot + 운영 OS 톤 + status 원문 보존)
const SYSTEM_PROMPT = `당신은 LabAxis 운영 브리핑 narrative 작성기입니다.
입력 facts (status / blocker / nextAction) 를 한국어 1문장 (40자 이내) 으로 압축합니다.

원칙:
1. facts 원문 보존 강력 — status 값은 그대로 노출, 임의 단어 변경 0.
2. 추측 금지, 권유 금지 — facts 에 없는 정보 생성 0. facts 를 벗어나면 안 됩니다.
3. 한국어 어미 정합 — 평서형 "~입니다" 또는 명사형. 명령어 / 의문문 / 감탄문 금지.
4. LabAxis 운영 OS 톤 — 격식체. 영어 단어 최소화 (한국어 대응어 우선). 약어 금지.
5. 차단 없으면 차단 부분 생략.

예시 (입력 → narrative):

예시 1) facts: { status: "검토 필요", blocker: "차단 없음", nextAction: "공급사 회신 확인" }
→ "검토 필요 상태이며 다음 조치: 공급사 회신 확인입니다."

예시 2) facts: { status: "발주 가능", blocker: "공급사 미회신", nextAction: "재요청 발송" }
→ "발주 가능 상태, 차단: 공급사 미회신, 다음 조치: 재요청 발송입니다."

예시 3) facts: { status: "안정", blocker: "차단 없음", nextAction: "정상 운영" }
→ "안정 상태이며 정상 운영 중입니다."`;

function deterministicNarrative(facts: BriefNarrativeFacts): string {
  const parts: string[] = [];
  if (facts.status != null) parts.push(`현재 상태: ${facts.status}`);
  if (facts.blocker != null && facts.blocker !== "차단 없음") parts.push(`차단 — ${facts.blocker}`);
  if (facts.nextAction != null) parts.push(`다음 조치 — ${facts.nextAction}`);
  return parts.join(" · ");
}

/**
 * §11.167 — LLM 응답이 facts canonical token 을 보존하는지 검증.
 *
 * Why:
 *   - LLM (Anthropic) 이 prompt instruction 을 무시하고 status 를
 *     다른 단어로 hallucinate 할 수 있음 (예: "검토 필요" → "확인 중").
 *   - prompt level instruction (§11.165) 만으로는 hallucination 100% 차단 X.
 *   - test level RTC (§11.166 statusToken 검증) 와 동일 logic 을 prod 에서 강제.
 *
 * Validation:
 *   - facts.status 가 truthy 면 narrative 에 status 문자열 포함 필수.
 *   - blocker 가 "차단 없음" 외 truthy 면 narrative 에 blocker 문자열 포함 필수.
 *   - nextAction 은 LLM 이 동의어 사용 가능 (조치 표현 자유) — 검증 X.
 *
 * 실패 시 caller 가 deterministic fallback 호출.
 */
export function validateNarrativeFitness(narrative: string, facts: BriefNarrativeFacts): boolean {
  if (facts.status != null && facts.status !== "") {
    if (!narrative.includes(String(facts.status))) return false;
  }
  if (facts.blocker != null && facts.blocker !== "" && facts.blocker !== "차단 없음") {
    if (!narrative.includes(String(facts.blocker))) return false;
  }
  return true;
}

function isLlmEnabled(): boolean {
  if (process.env.OPERATIONAL_BRIEF_USE_LLM !== "1") return false;
  if (!process.env.ANTHROPIC_API_KEY && !process.env.LABAXIS_AI_PROVIDER) return false;
  return true;
}

/**
 * narrative 생성 — facts → 1문장.
 *
 * 외부 LLM 비용 없이 작동 가능 (default deterministic).
 * `OPERATIONAL_BRIEF_USE_LLM=1` 설정 시 Anthropic 호출 + 실패 시 fallback.
 */
export async function generateBriefNarrative(facts: BriefNarrativeFacts): Promise<string> {
  if (!isLlmEnabled()) {
    return deterministicNarrative(facts);
  }

  try {
    const userPrompt = `다음 facts 를 한국어 1문장으로 요약하세요:\n${JSON.stringify(facts, null, 2)}`;
    const result = await callAnthropicMessage({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 120,
      temperature: 0.2,
      timeoutMs: 8_000,
    });
    const trimmed = result.content.trim();
    // LLM 실패 또는 빈 결과 시 fallback
    if (!trimmed) return deterministicNarrative(facts);
    // §11.167 — LLM 응답이 canonical token 누락 시 fallback (hallucination 차단)
    if (!validateNarrativeFitness(trimmed, facts)) {
      console.warn("[operational-brief] LLM narrative fitness 실패 — deterministic fallback (token loss)");
      return deterministicNarrative(facts);
    }
    return trimmed;
  } catch (err) {
    console.warn("[operational-brief] LLM narrative 실패 — deterministic fallback", err);
    return deterministicNarrative(facts);
  }
}
