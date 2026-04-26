/**
 * apps/web/src/lib/ai/build-rationale.ts
 *
 * α-F (ADR §11.25). LLM-backed enrichment for the AI 선택안 rationale
 * line on /dashboard/purchases. Returns a short single-line rationale
 * (Korean, business tone) for one supplier option in the conversion
 * queue.
 *
 * Why this exists
 * ---------------
 * The resolver's `aiOptions[].rationale` was a v0 placeholder:
 *   ["회신 완료"] | ["회신 대기"]
 * Operationally meaningful for a coarse "responded vs not", but
 * doesn't convey *why* a specific supplier might be the right pick
 * (price, lead time, MOQ, recent reliability). This utility produces
 * a richer one-liner via OpenAI Chat (gpt-4o), saved to AiActionItem
 * with the new `RATIONALE_SUMMARY` AiActionType (§11.25 schema
 * migration). The resolver then prefers the persisted rationale when
 * available, falling back to the v0 placeholder when the LLM has not
 * been invoked yet.
 *
 * LabAxis principle alignment
 * ---------------------------
 * - Not a chatbot/assistant UI — output is a single-line metadata
 *   string rendered as `text-[10px] text-slate-400` next to existing
 *   resolver outputs. AI is read-only enrichment, not a conversation.
 * - Dead button / no-op ban — utility ALWAYS returns a string[]:
 *   either the LLM result, or the canonical placeholder. The caller
 *   never has to render an empty rationale.
 * - Canonical truth boundary — utility writes nothing to the
 *   conversion queue; the AiActionItem layer is the persistence
 *   surface and the resolver re-derives output from it.
 *
 * Failure modes (all map to placeholder fallback, no throw)
 * --------------------------------------------------------
 * - OPENAI_API_KEY unset → fallback
 * - non-2xx response       → fallback
 * - empty content          → fallback
 * - JSON parse failure     → fallback
 * - empty rationale array  → fallback
 * - network error / timeout→ fallback
 */

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const AI_MODEL = "gpt-4o";
const TIMEOUT_MS = 12_000; // shorter than quote-draft — single supplier, small prompt

export interface BuildRationaleInput {
  readonly supplierName: string;
  readonly replied: boolean;
  /** Optional vendor metadata; when present, prompt explains its impact. */
  readonly price?: number | null;
  readonly leadDays?: number | null;
  readonly moq?: number | null;
  /** Currency for `price` formatting. Defaults to "KRW". */
  readonly currency?: string;
  /** Quote-level context — short title and supplier count for relative judgment. */
  readonly context: {
    readonly quoteTitle: string;
    readonly totalSuppliers: number;
  };
}

export interface BuildRationaleResult {
  /** Short Korean one-liner(s). Always non-empty, never null. */
  readonly rationale: readonly string[];
  /** AI model id when LLM produced this; null on fallback. */
  readonly aiModel: string | null;
  readonly promptTokens: number;
  readonly completionTokens: number;
}

function placeholderFor(input: BuildRationaleInput): BuildRationaleResult {
  return {
    rationale: input.replied ? ["회신 완료"] : ["회신 대기"],
    aiModel: null,
    promptTokens: 0,
    completionTokens: 0,
  };
}

export async function buildRationale(
  input: BuildRationaleInput,
): Promise<BuildRationaleResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return placeholderFor(input);
  }

  const currency = input.currency ?? "KRW";
  const priceLine =
    input.price != null
      ? `단가: ${input.price.toLocaleString("ko-KR")} ${currency}`
      : "단가: 미공개";
  const leadLine =
    input.leadDays != null ? `납기: ${input.leadDays}일` : "납기: 미공개";
  const moqLine = input.moq != null ? `MOQ: ${input.moq}` : "";

  const systemPrompt = `당신은 바이오·제약 연구실의 구매 전문가입니다. 견적 후보 공급사 한 곳의 강점/약점을 한국어로 한 줄(20자 이내)로 요약합니다.

규칙:
1. 한 줄, 사실 기반, 형용사 최소화. 광고 톤 금지.
2. 회신 여부, 가격, 납기, MOQ, 공급사명 중 가장 의사결정에 도움되는 1-2개만 언급.
3. 챗봇처럼 사용자에게 말하지 마세요. 메타데이터 라벨처럼 짧게.
4. JSON 으로만 응답: { "rationale": ["짧은 한 줄"] }`;

  const userPrompt = `견적 제목: ${input.context.quoteTitle}
전체 후보 공급사 수: ${input.context.totalSuppliers}

대상 공급사: ${input.supplierName}
회신 여부: ${input.replied ? "회신 완료" : "회신 대기"}
${priceLine}
${leadLine}
${moqLine}`.trim();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 80, // single short sentence — anything more is a sign of bad prompt
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return placeholderFor(input);
    }

    const data: any = await response.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) {
      return placeholderFor(input);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return placeholderFor(input);
    }

    const rationale = Array.isArray(parsed.rationale)
      ? parsed.rationale.filter(
          (s: unknown): s is string => typeof s === "string" && s.length > 0,
        )
      : [];

    if (rationale.length === 0) {
      return placeholderFor(input);
    }

    const usage = data.usage ?? {};
    return {
      rationale,
      aiModel: AI_MODEL,
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
    };
  } catch {
    clearTimeout(timeoutId);
    return placeholderFor(input);
  }
}
