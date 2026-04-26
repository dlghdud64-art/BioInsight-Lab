/**
 * apps/web/src/lib/ai/anthropic.ts
 *
 * Generic Anthropic Messages API wrapper. Single source of truth for
 * how this codebase calls Anthropic Claude (request shape, error
 * taxonomy, default model, anthropic-version header).
 *
 * Why this exists (#α-F-followup-anthropic-migration, ADR §11.26)
 * --------------------------------------------------------------
 * Operator decision: migrate from OpenAI to Anthropic Claude for the
 * Messages API surface (RFQ drafts, vendor email drafts, search
 * intent analysis, translation, datasheet extraction, quote parsing,
 * α-F rationale). Anthropic does NOT provide an embedding API, so
 * vector embedding (lib/ai/embeddings.ts) keeps OpenAI — that is
 * tracked separately (`#α-F-followup-embedding-strategy`) and has
 * no surface here.
 *
 * Contract
 * --------
 * - Throws typed errors (AnthropicKeyMissingError, AnthropicHttpError,
 *   AnthropicEmptyContentError) so each caller picks its own fallback.
 *   Existing callers (build-rationale, quote-draft-generator, etc.)
 *   already have template fallbacks; they just need to catch the
 *   class.
 * - Default model is `claude-haiku-4-5-20251001` — cheap, fast, fine
 *   for pilot single-line / short prompt usage. Callers can override
 *   per-call via the second argument.
 * - `system` + single `user` message is the v0 shape. Multi-turn
 *   conversation is intentionally not exposed; it would invite the
 *   chatbot/assistant pattern LabAxis principles forbid.
 * - `max_tokens` is REQUIRED by Anthropic (unlike OpenAI). Default
 *   1000; callers tune per-prompt (e.g. rationale = 80, RFQ email
 *   draft = 2000).
 *
 * Anthropic Messages API reference
 * --------------------------------
 *   POST https://api.anthropic.com/v1/messages
 *   Headers:
 *     x-api-key: $ANTHROPIC_API_KEY
 *     anthropic-version: 2023-06-01
 *     content-type: application/json
 *   Body:
 *     { model, max_tokens, system, messages: [{ role, content }] }
 *   Response:
 *     { id, type, role, content: [{ type: "text", text }], model,
 *       stop_reason, usage: { input_tokens, output_tokens } }
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

/**
 * Default model. Cheap + fast + sufficient for short / single-line
 * prompts that dominate this codebase. Override per-call when a task
 * needs more reasoning (e.g. complex extraction → claude-sonnet-4-6).
 */
export const ANTHROPIC_DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const DEFAULT_MAX_TOKENS = 1000;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_TIMEOUT_MS = 15_000;

// ──────────────────────────────────────────────────────────
// Errors
// ──────────────────────────────────────────────────────────

export class AnthropicKeyMissingError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set");
    this.name = "AnthropicKeyMissingError";
  }
}

export class AnthropicHttpError extends Error {
  readonly status: number;
  readonly bodyText: string;
  constructor(status: number, bodyText: string) {
    super(`Anthropic API error ${status}`);
    this.name = "AnthropicHttpError";
    this.status = status;
    this.bodyText = bodyText;
  }
}

export class AnthropicEmptyContentError extends Error {
  constructor() {
    super("Anthropic response content was empty or non-text");
    this.name = "AnthropicEmptyContentError";
  }
}

// ──────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────

export interface AnthropicMessageRequest {
  /** System prompt (set as the top-level `system` field, not a message). */
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
  /** First text block from `content[]`. Non-text blocks → throws. */
  readonly content: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly model: string;
}

export interface AnthropicCallOptions {
  /** Override the default `claude-haiku-4-5-20251001`. */
  readonly model?: string;
  /** Override env-derived API key (test injection). */
  readonly apiKey?: string;
}

export async function callAnthropicMessage(
  request: AnthropicMessageRequest,
  options: AnthropicCallOptions = {},
): Promise<AnthropicMessageResult> {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicKeyMissingError();
  }

  const model = options.model ?? ANTHROPIC_DEFAULT_MODEL;
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

    // Anthropic returns content as an array. v0 expects the first
    // block to be a text block — anything else (tool_use, image, etc.)
    // is a contract mismatch for callers using prompt-only JSON output.
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
