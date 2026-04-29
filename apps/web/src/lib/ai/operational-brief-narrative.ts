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

const SYSTEM_PROMPT = `당신은 LabAxis 운영 브리핑 narrative 작성기입니다.
입력으로 받은 facts (현재 상태, 차단, 다음 조치) 를 한국어 1문장 (40자 이내) 으로 압축하세요.
원칙:
- 사실(facts) 만 압축. 추측/조언 금지.
- "현재 상태"는 그대로 노출. 임의 변경 금지.
- 문장 어미: 평서형 ("~입니다" 또는 명사형). 명령어 금지.
- 차단 없으면 차단 부분 생략.`;

function deterministicNarrative(facts: BriefNarrativeFacts): string {
  const parts: string[] = [];
  if (facts.status != null) parts.push(`현재 상태: ${facts.status}`);
  if (facts.blocker != null && facts.blocker !== "차단 없음") parts.push(`차단 — ${facts.blocker}`);
  if (facts.nextAction != null) parts.push(`다음 조치 — ${facts.nextAction}`);
  return parts.join(" · ");
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
    return trimmed;
  } catch (err) {
    console.warn("[operational-brief] LLM narrative 실패 — deterministic fallback", err);
    return deterministicNarrative(facts);
  }
}
