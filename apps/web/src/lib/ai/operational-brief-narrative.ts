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
import { incrementCacheStat } from "@/lib/ai/operational-brief-cache-metrics";
import { logBriefInjectionAudit } from "@/lib/ai/operational-brief-injection-audit";

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
 * §11.170 — prompt injection pattern detection.
 *
 * facts value 가 user-controlled (예: blockerReason 이 vendor 회신 / operator
 * 입력) 시 prompt injection 위험. LLM 에 전달 전 위험 패턴 detect.
 *
 * 감지 패턴 (보수적 deny-list):
 *   - "ignore" / "previous instructions" / "you are" / "system:" / "</system>"
 *   - "무시하" / "지시" / "출력하세요" + dangerous 키워드 결합
 *   - newline + 명령어 패턴 (`\n\n` + instruction keyword)
 *   - 비정상 토큰 (`<|`, `[INST]`, JSON 종료 후 추가 instruction)
 *
 * 감지 시 LLM 호출 skip + deterministic fallback (status 원문 그대로 유지).
 */
const INJECTION_PATTERNS: readonly { name: string; re: RegExp }[] = [
  { name: "ignore_previous_instructions_en", re: /ignore\s+(previous|prior|all)\s+(instruction|prompt|message)/i },
  { name: "role_hijack_en", re: /you\s+are\s+(now\s+)?a\s+different/i },
  { name: "system_tag_inject", re: /<\/?system>/i },
  { name: "system_role_marker", re: /\bsystem\s*:\s*/i },
  { name: "anthropic_pipe_token", re: /<\|.*?\|>/ },
  { name: "inst_token", re: /\[INST\]|\[\/INST\]/i },
  { name: "ignore_instructions_kr", re: /이전\s*지시\s*무시/ },
  { name: "system_command_kr", re: /시스템\s*명령/ },
  { name: "output_directive_kr", re: /다음을\s*출력하세요/ },
  { name: "newline_instruction_marker", re: /\n\n\s*(instruction|명령|지시)\s*[:：]/i },
];

/**
 * §11.171 — injection 감지 시 매칭된 pattern name 반환 (audit log metadata 용).
 * 매칭 0건 시 null.
 */
export function detectPromptInjectionPattern(facts: BriefNarrativeFacts): string | null {
  for (const [k, v] of Object.entries(facts)) {
    if (v == null) continue;
    const s = String(v);
    for (const { name, re } of INJECTION_PATTERNS) {
      if (re.test(s)) return `${name}@${k}`;
    }
  }
  return null;
}

export function detectPromptInjection(facts: BriefNarrativeFacts): boolean {
  return detectPromptInjectionPattern(facts) !== null;
}

/**
 * §11.170 — facts value sanitization (LLM 호출 전).
 * newline / control chars 제거 + per-field length cap.
 *   - newline → space (single line 강제, prompt 분리자 사용 차단)
 *   - control chars (\x00-\x1F) → 제거
 *   - per-field length cap (status 80자 / blocker 200자 / nextAction 200자)
 */
const FIELD_LENGTH_CAP: Record<string, number> = {
  status: 80,
  blocker: 200,
  nextAction: 200,
};

export function sanitizeFacts(facts: BriefNarrativeFacts): BriefNarrativeFacts {
  const out: BriefNarrativeFacts = {};
  for (const [k, v] of Object.entries(facts)) {
    if (v == null) {
      out[k] = v;
      continue;
    }
    if (typeof v === "number") {
      out[k] = v;
      continue;
    }
    let s = String(v).replace(/[\x00-\x1F]+/g, " ");
    const cap = FIELD_LENGTH_CAP[k] ?? 200;
    if (s.length > cap) s = s.slice(0, cap);
    out[k] = s;
  }
  return out;
}

/**
 * §11.169 — narrative 길이 cap.
 *   prompt level (§11.165) 가 "40자 이내" 명시했으나 LLM 이 무시 가능.
 *   lib level 에서 60자 cap (40자 + 여유 + 어미 가변성 흡수) 강제.
 *   초과 시 운영자 가시성 + UX 부담 위험 — fallback 처리.
 */
export const NARRATIVE_LENGTH_CAP = 60;

/**
 * §11.167 — LLM 응답이 facts canonical token 을 보존하는지 검증.
 * §11.169 — 추가로 길이 cap 검증 (60자 이내).
 *
 * Why:
 *   - LLM (Anthropic) 이 prompt instruction 을 무시하고 status 를
 *     다른 단어로 hallucinate 할 수 있음 (예: "검토 필요" → "확인 중").
 *   - prompt level instruction (§11.165) 만으로는 hallucination + length 100% 차단 X.
 *   - test level RTC (§11.166 statusToken 검증) 와 동일 logic 을 prod 에서 강제.
 *
 * Validation:
 *   - 길이 ≤ 60자 (NARRATIVE_LENGTH_CAP) 필수.
 *   - facts.status 가 truthy 면 narrative 에 status 문자열 포함 필수.
 *   - blocker 가 "차단 없음" 외 truthy 면 narrative 에 blocker 문자열 포함 필수.
 *   - nextAction 은 LLM 이 동의어 사용 가능 (조치 표현 자유) — 검증 X.
 *
 * 실패 시 caller 가 deterministic fallback 호출.
 */
export function validateNarrativeFitness(narrative: string, facts: BriefNarrativeFacts): boolean {
  // §11.169 — length cap (UX 부담 + LLM verbosity 차단)
  if (narrative.length > NARRATIVE_LENGTH_CAP) return false;
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
  // §11.170 — facts sanitize (newline / control chars / length cap)
  const safe = sanitizeFacts(facts);

  // §11.170 — injection pattern detect → LLM skip + deterministic fallback
  // (prompt injection 차단의 first quality gate. fitness_fail 누적해 admin 가시화)
  // §11.171 — 감지 시 audit log persistence (보안 감사성).
  const injectionPattern = detectPromptInjectionPattern(safe);
  if (injectionPattern !== null) {
    incrementCacheStat("fitness_fail");
    console.warn(`[operational-brief] prompt injection 감지 (${injectionPattern}) — deterministic fallback`);
    // audit log fire-and-forget — caller/lib 동작 영향 0
    logBriefInjectionAudit({ pattern: injectionPattern, factsKeys: Object.keys(safe) });
    return deterministicNarrative(safe);
  }

  if (!isLlmEnabled()) {
    return deterministicNarrative(safe);
  }

  try {
    const userPrompt = `다음 facts 를 한국어 1문장으로 요약하세요:\n${JSON.stringify(safe, null, 2)}`;
    const result = await callAnthropicMessage({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 120,
      temperature: 0.2,
      timeoutMs: 8_000,
    });
    const trimmed = result.content.trim();
    // LLM 실패 또는 빈 결과 시 fallback
    if (!trimmed) return deterministicNarrative(safe);
    // §11.167 — LLM 응답이 canonical token 누락 시 fallback (hallucination 차단)
    // §11.168 — fitness pass/fail metric 누적 (drift 모니터링)
    if (!validateNarrativeFitness(trimmed, safe)) {
      incrementCacheStat("fitness_fail");
      console.warn("[operational-brief] LLM narrative fitness 실패 — deterministic fallback (token loss)");
      return deterministicNarrative(safe);
    }
    incrementCacheStat("fitness_pass");
    return trimmed;
  } catch (err) {
    console.warn("[operational-brief] LLM narrative 실패 — deterministic fallback", err);
    return deterministicNarrative(safe);
  }
}
