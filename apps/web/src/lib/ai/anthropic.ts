/**
 * apps/web/src/lib/ai/anthropic.ts
 *
 * Provider-agnostic LLM Messages-API wrapper. Despite the filename,
 * this module dispatches to either Anthropic or OpenAI based on the
 * `LABAXIS_AI_PROVIDER` env var. The filename is retained because
 * ~6 callers import from "@/lib/ai/anthropic"; renaming the module
 * would cascade into 6 test files plus 6 production files for zero
 * runtime benefit.
 *
 * Why this exists
 * ---------------
 * Phase 1–5 of #α-F-followup-anthropic-migration (ADR §11.26)
 * migrated the Messages-API surface (RFQ drafts, vendor email drafts,
 * search intent, translation, datasheet/protocol/quote extraction,
 * α-F rationale) from OpenAI to Anthropic Claude. Phase 6
 * (#α-F-followup-anthropic-billing-blocker) hit a Stripe
 * Link / 결제 플로우 정체 issue on Anthropic console and the credit
 * balance never funded — every Anthropic call returned HTTP 400
 * `invalid_request_error: "Your credit balance is too low to access
 * the Anthropic API."`. To unblock production without throwing the
 * Phase 1–5 work away, this wrapper now supports a 1-flag toggle
 * back to OpenAI; once Anthropic billing is restored, flip the env
 * var and traffic returns to Claude with zero code change.
 *
 * Provider resolution
 * -------------------
 * - `LABAXIS_AI_PROVIDER=anthropic` (default when unset) → Anthropic
 * - `LABAXIS_AI_PROVIDER=openai` → OpenAI Chat Completions API
 * - per-call `options.provider` overrides env (test injection)
 *
 * Embeddings (lib/ai/embeddings.ts) keep OpenAI permanently because
 * Anthropic has no embedding API — tracked as
 * `#α-F-followup-embedding-strategy`.
 *
 * Contract (unchanged across both providers)
 * ------------------------------------------
 * - Throws typed errors: AnthropicKeyMissingError, AnthropicHttpError,
 *   AnthropicEmptyContentError. Names retained for backward compat
 *   with the 6 callers that already match on these classes.
 * - Default model is provider-specific:
 *     anthropic → ANTHROPIC_DEFAULT_MODEL ("claude-haiku-4-5-20251001")
 *     openai    → OPENAI_DEFAULT_MODEL    ("gpt-4o-mini")
 * - When `options.model` is passed and looks foreign to the resolved
 *   provider (e.g. "claude-..." while routed to OpenAI), the wrapper
 *   substitutes the provider's default model rather than passing a
 *   nonsense identifier through. This keeps all 6 callers working
 *   without per-call provider awareness.
 * - `system` + single `user` message shape preserved on both paths.
 *   Multi-turn conversation is intentionally not exposed.
 * - `max_tokens` is REQUIRED by Anthropic (not OpenAI), defaulted to
 *   1000; callers tune per-prompt (rationale = 80, RFQ email = 2000).
 *
 * Anthropic Messages API
 * ----------------------
 *   POST https://api.anthropic.com/v1/messages
 *   Headers: x-api-key, anthropic-version: 2023-06-01, content-type
 *   Body:    { model, max_tokens, system, messages: [{ role, content }] }
 *   Response: { content: [{ type: "text", text }], model,
 *               usage: { input_tokens, output_tokens } }
 *
 * OpenAI Chat Completions API
 * ---------------------------
 *   POST https://api.openai.com/v1/chat/completions
 *   Headers: Authorization: Bearer <key>, content-type
 *   Body:    { model, max_tokens, temperature, messages: [
 *               { role: "system", content }, { role: "user", content } ] }
 *   Response: { choices: [{ message: { content } }], model,
 *               usage: { prompt_tokens, completion_tokens } }
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_API_VERSION = "2023-06-01";

/**
 * Default Anthropic model. Cheap + fast + sufficient for short /
 * single-line prompts that dominate this codebase.
 */
export const ANTHROPIC_DEFAULT_MODEL = "claude-haiku-4-5-20251001";

/**
 * Default OpenAI model. Equivalent tier to claude-haiku — used when
 * LABAXIS_AI_PROVIDER=openai. Was the v0 model for datasheet /
 * protocol extractors before the Anthropic migration.
 */
export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

const DEFAULT_MAX_TOKENS = 1000;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_TIMEOUT_MS = 15_000;

// ──────────────────────────────────────────────────────────
// Errors — names retained for backward compat with all 6 callers
// ──────────────────────────────────────────────────────────

export class AnthropicKeyMissingError extends Error {
  constructor() {
    super("LLM API key is not set");
    this.name = "AnthropicKeyMissingError";
  }
}

export class AnthropicHttpError extends Error {
  readonly status: number;
  readonly bodyText: string;
  constructor(status: number, bodyText: string) {
    super(`LLM API error ${status}`);
    this.name = "AnthropicHttpError";
    this.status = status;
    this.bodyText = bodyText;
  }
}

export class AnthropicEmptyContentError extends Error {
  constructor() {
    super("LLM response content was empty or non-text");
    this.name = "AnthropicEmptyContentError";
  }
}

// ──────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────

export type LlmProvider = "anthropic" | "openai";

export interface AnthropicMessageRequest {
  /** System prompt. Set as Anthropic top-level `system`, or OpenAI system message. */
  readonly systemPrompt: string;
  /** Single user-turn content. Multi-turn is not exposed in v0. */
  readonly userPrompt: string;
  /** Default 1000. Anthropic requires this — no implicit cap. */
  readonly maxTokens?: number;
  /** Default 0.3 — biased toward deterministic / business-tone output. */
  readonly temperature?: number;
  /** Default 15s. Aborts the fetch via AbortController. */
  readonly timeoutMs?: number;
}

export interface AnthropicMessageResult {
  /** First text block from the response. Non-text content → throws. */
  readonly content: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly model: string;
}

export interface AnthropicCallOptions {
  /** Override the provider default model. Cross-provider model strings
   *  (e.g. claude-* on openai path) are auto-substituted with the
   *  provider's default. */
  readonly model?: string;
  /** Override env-derived API key (test injection). */
  readonly apiKey?: string;
  /** Override the LABAXIS_AI_PROVIDER env (test injection / explicit
   *  per-call routing). */
  readonly provider?: LlmProvider;
}

/**
 * Resolve the active LLM provider from env. Default `anthropic` so
 * Phase 1–5 intent is preserved when the env var is unset.
 */
function resolveProvider(): LlmProvider {
  const raw = (process.env.LABAXIS_AI_PROVIDER ?? "")
    .toLowerCase()
    .trim();
  if (raw === "openai") return "openai";
  if (raw === "anthropic") return "anthropic";
  return "anthropic";
}

/**
 * Public dispatch entry. Same signature/return as Phase 1 — the 6
 * existing callers (build-rationale, openai.ts, quote-draft-generator,
 * datasheet/protocol/quote-ai extractors) are unaffected.
 */
export async function callAnthropicMessage(
  request: AnthropicMessageRequest,
  options: AnthropicCallOptions = {},
): Promise<AnthropicMessageResult> {
  const provider = options.provider ?? resolveProvider();
  if (provider === "openai") {
    return callOpenAiPath(request, options);
  }
  return callAnthropicPath(request, options);
}

// ──────────────────────────────────────────────────────────
// Anthropic path (Phase 1 baseline)
// ──────────────────────────────────────────────────────────

async function callAnthropicPath(
  request: AnthropicMessageRequest,
  options: AnthropicCallOptions,
): Promise<AnthropicMessageResult> {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicKeyMissingError();
  }

  const requestedModel = options.model;
  // If caller passed an OpenAI-shaped model string while routed here,
  // fall back to ANTHROPIC_DEFAULT_MODEL rather than send a 404 model.
  const isForeignModel =
    !!requestedModel &&
    (requestedModel.startsWith("gpt-") || requestedModel.startsWith("o1"));
  const model =
    !requestedModel || isForeignModel ? ANTHROPIC_DEFAULT_MODEL : requestedModel;

  const maxTokens = request.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = request.temperature ?? DEFAULT_TEMPERATURE;
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userPrompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new AnthropicHttpError(response.status, bodyText);
    }

    const data: any = await response.json();

    const firstBlock = Array.isArray(data?.content) ? data.content[0] : null;
    if (
      !firstBlock ||
      firstBlock.type !== "text" ||
      typeof firstBlock.text !== "string" ||
      firstBlock.text.length === 0
    ) {
      throw new AnthropicEmptyContentError();
    }

    const usage = data.usage ?? {};
    return {
      content: firstBlock.text,
      inputTokens: typeof usage.input_tokens === "number" ? usage.input_tokens : 0,
      outputTokens:
        typeof usage.output_tokens === "number" ? usage.output_tokens : 0,
      model: typeof data.model === "string" ? data.model : model,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────
// OpenAI path (Phase 6 fallback)
// ──────────────────────────────────────────────────────────

async function callOpenAiPath(
  request: AnthropicMessageRequest,
  options: AnthropicCallOptions,
): Promise<AnthropicMessageResult> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AnthropicKeyMissingError();
  }

  const requestedModel = options.model;
  // If caller passed a Claude-shaped model string while routed here,
  // fall back to OPENAI_DEFAULT_MODEL.
  const isForeignModel =
    !!requestedModel && requestedModel.startsWith("claude-");
  const model =
    !requestedModel || isForeignModel ? OPENAI_DEFAULT_MODEL : requestedModel;

  const maxTokens = request.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = request.temperature ?? DEFAULT_TEMPERATURE;
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new AnthropicHttpError(response.status, bodyText);
    }

    const data: any = await response.json();

    const messageContent = data?.choices?.[0]?.message?.content;
    if (typeof messageContent !== "string" || messageContent.length === 0) {
      throw new AnthropicEmptyContentError();
    }

    const usage = data.usage ?? {};
    return {
      content: messageContent,
      // Map OpenAI's prompt_tokens/completion_tokens onto the Anthropic
      // input/output naming so caller persistence is provider-agnostic.
      inputTokens:
        typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : 0,
      outputTokens:
        typeof usage.completion_tokens === "number"
          ? usage.completion_tokens
          : 0,
      model: typeof data.model === "string" ? data.model : model,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
