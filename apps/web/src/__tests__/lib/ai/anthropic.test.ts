/**
 * apps/web/src/__tests__/lib/ai/anthropic.test.ts
 *
 * α-F-followup-anthropic-migration (ADR §11.26): generic Anthropic
 * Messages API wrapper. Throws typed errors so each caller can pick
 * its own fallback strategy (template fallback, error toast, etc.).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  callAnthropicMessage,
  AnthropicKeyMissingError,
  AnthropicHttpError,
  AnthropicEmptyContentError,
  ANTHROPIC_DEFAULT_MODEL,
  OPENAI_DEFAULT_MODEL,
} from "@/lib/ai/anthropic";

global.fetch = vi.fn();

describe("callAnthropicMessage (anthropic provider — default)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LABAXIS_AI_PROVIDER;
  });

  it("[1] no API key → AnthropicKeyMissingError", async () => {
    await expect(
      callAnthropicMessage({
        systemPrompt: "sys",
        userPrompt: "user",
      }),
    ).rejects.toBeInstanceOf(AnthropicKeyMissingError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("[2] ok response with text content → content + tokens + model", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "msg_test",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "hello world" }],
        model: ANTHROPIC_DEFAULT_MODEL,
        stop_reason: "end_turn",
        usage: { input_tokens: 42, output_tokens: 8 },
      }),
    } as unknown as Response);

    const r = await callAnthropicMessage({
      systemPrompt: "be brief",
      userPrompt: "say hi",
    });
    expect(r.content).toBe("hello world");
    expect(r.inputTokens).toBe(42);
    expect(r.outputTokens).toBe(8);
    expect(r.model).toBe(ANTHROPIC_DEFAULT_MODEL);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("[3] non-OK response → AnthropicHttpError with status", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "service unavailable",
    } as unknown as Response);

    try {
      await callAnthropicMessage({
        systemPrompt: "x",
        userPrompt: "y",
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AnthropicHttpError);
      expect((err as AnthropicHttpError).status).toBe(503);
    }
  });

  it("[4] ok response but content array empty → AnthropicEmptyContentError", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [],
        model: ANTHROPIC_DEFAULT_MODEL,
        usage: { input_tokens: 5, output_tokens: 0 },
      }),
    } as unknown as Response);

    await expect(
      callAnthropicMessage({ systemPrompt: "x", userPrompt: "y" }),
    ).rejects.toBeInstanceOf(AnthropicEmptyContentError);
  });

  it("[5] ok response but content[0].text empty string → AnthropicEmptyContentError", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "" }],
        model: ANTHROPIC_DEFAULT_MODEL,
        usage: { input_tokens: 5, output_tokens: 0 },
      }),
    } as unknown as Response);

    await expect(
      callAnthropicMessage({ systemPrompt: "x", userPrompt: "y" }),
    ).rejects.toBeInstanceOf(AnthropicEmptyContentError);
  });

  it("[6] non-text content type (tool_use etc) → AnthropicEmptyContentError", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "tool_use", id: "t1", name: "x", input: {} }],
        model: ANTHROPIC_DEFAULT_MODEL,
        usage: { input_tokens: 5, output_tokens: 0 },
      }),
    } as unknown as Response);

    await expect(
      callAnthropicMessage({ systemPrompt: "x", userPrompt: "y" }),
    ).rejects.toBeInstanceOf(AnthropicEmptyContentError);
  });

  it("[7] network error → re-thrown as Error (caller handles)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      callAnthropicMessage({ systemPrompt: "x", userPrompt: "y" }),
    ).rejects.toThrow("ECONNREFUSED");
  });

  it("[8] custom model override + custom maxTokens → forwarded to request body", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    let capturedBody: any = null;
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "ok" }],
          model: "claude-sonnet-4-6",
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      } as unknown as Response;
    });

    await callAnthropicMessage(
      {
        systemPrompt: "sys",
        userPrompt: "user",
        maxTokens: 200,
        temperature: 0.7,
      },
      { model: "claude-sonnet-4-6" },
    );

    expect(capturedBody.model).toBe("claude-sonnet-4-6");
    expect(capturedBody.max_tokens).toBe(200);
    expect(capturedBody.temperature).toBe(0.7);
    expect(capturedBody.system).toBe("sys");
    expect(capturedBody.messages).toEqual([
      { role: "user", content: "user" },
    ]);
  });

  it("[9] anthropic-version header is set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    let capturedHeaders: Record<string, string> = {};
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return {
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "ok" }],
          model: ANTHROPIC_DEFAULT_MODEL,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      } as unknown as Response;
    });

    await callAnthropicMessage({ systemPrompt: "x", userPrompt: "y" });

    expect(capturedHeaders["anthropic-version"]).toBe("2023-06-01");
    expect(capturedHeaders["x-api-key"]).toBe("sk-ant-test");
    expect(capturedHeaders["content-type"]).toBe("application/json");
  });
});

// ──────────────────────────────────────────────────────────
// Phase 6 — OpenAI provider branch via LABAXIS_AI_PROVIDER=openai
// ──────────────────────────────────────────────────────────

describe("callAnthropicMessage (openai provider via LABAXIS_AI_PROVIDER)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LABAXIS_AI_PROVIDER;
  });

  it("[10] LABAXIS_AI_PROVIDER=openai + no OPENAI_API_KEY → AnthropicKeyMissingError", async () => {
    process.env.LABAXIS_AI_PROVIDER = "openai";
    await expect(
      callAnthropicMessage({ systemPrompt: "x", userPrompt: "y" }),
    ).rejects.toBeInstanceOf(AnthropicKeyMissingError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("[11] LABAXIS_AI_PROVIDER=openai + ok response → choices[0].message.content + usage mapped", async () => {
    process.env.LABAXIS_AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-openai-test";
    let capturedUrl = "";
    let capturedBody: any = null;
    let capturedHeaders: Record<string, string> = {};
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        json: async () => ({
          id: "chatcmpl-test",
          object: "chat.completion",
          model: "gpt-4o-mini-2024-07-18",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "openai hello" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 33, completion_tokens: 12, total_tokens: 45 },
        }),
      } as unknown as Response;
    });

    const r = await callAnthropicMessage({
      systemPrompt: "be brief",
      userPrompt: "say hi",
    });

    expect(capturedUrl).toBe("https://api.openai.com/v1/chat/completions");
    expect(capturedBody.model).toBe(OPENAI_DEFAULT_MODEL);
    expect(capturedBody.max_tokens).toBe(1000); // default
    expect(capturedBody.messages).toEqual([
      { role: "system", content: "be brief" },
      { role: "user", content: "say hi" },
    ]);
    expect(capturedHeaders.authorization).toBe("Bearer sk-openai-test");
    // No anthropic-version header on this path.
    expect(capturedHeaders["anthropic-version"]).toBeUndefined();

    expect(r.content).toBe("openai hello");
    expect(r.inputTokens).toBe(33); // prompt_tokens → inputTokens
    expect(r.outputTokens).toBe(12); // completion_tokens → outputTokens
    expect(r.model).toBe("gpt-4o-mini-2024-07-18");
  });

  it("[12] LABAXIS_AI_PROVIDER=openai + non-OK → AnthropicHttpError with status", async () => {
    process.env.LABAXIS_AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-openai-test";
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => '{"error":{"message":"rate limit exceeded"}}',
    } as unknown as Response);

    try {
      await callAnthropicMessage({ systemPrompt: "x", userPrompt: "y" });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AnthropicHttpError);
      expect((err as AnthropicHttpError).status).toBe(429);
    }
  });

  it("[13] LABAXIS_AI_PROVIDER=openai + empty content → AnthropicEmptyContentError", async () => {
    process.env.LABAXIS_AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-openai-test";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ index: 0, message: { role: "assistant", content: "" } }],
        model: "gpt-4o-mini",
        usage: { prompt_tokens: 5, completion_tokens: 0 },
      }),
    } as unknown as Response);

    await expect(
      callAnthropicMessage({ systemPrompt: "x", userPrompt: "y" }),
    ).rejects.toBeInstanceOf(AnthropicEmptyContentError);
  });

  it("[14] foreign claude-* model on openai path → substituted with OPENAI_DEFAULT_MODEL", async () => {
    process.env.LABAXIS_AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-openai-test";
    let capturedBody: any = null;
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "ok" } }],
          model: OPENAI_DEFAULT_MODEL,
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      } as unknown as Response;
    });

    await callAnthropicMessage(
      { systemPrompt: "s", userPrompt: "u" },
      { model: ANTHROPIC_DEFAULT_MODEL },
    );

    // Caller's "claude-haiku-..." was swapped for the OpenAI default
    // because we're routed to the OpenAI endpoint.
    expect(capturedBody.model).toBe(OPENAI_DEFAULT_MODEL);
  });

  it("[15] explicit options.provider='openai' overrides env var", async () => {
    process.env.LABAXIS_AI_PROVIDER = "anthropic"; // env says anthropic
    process.env.OPENAI_API_KEY = "sk-openai-test";
    let capturedUrl = "";
    vi.mocked(fetch).mockImplementation(async (url) => {
      capturedUrl = String(url);
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "ok" } }],
          model: OPENAI_DEFAULT_MODEL,
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      } as unknown as Response;
    });

    await callAnthropicMessage(
      { systemPrompt: "s", userPrompt: "u" },
      { provider: "openai" }, // per-call override wins
    );

    expect(capturedUrl).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("[16] foreign gpt-* model on anthropic path → substituted with ANTHROPIC_DEFAULT_MODEL", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    let capturedBody: any = null;
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "ok" }],
          model: ANTHROPIC_DEFAULT_MODEL,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      } as unknown as Response;
    });

    await callAnthropicMessage(
      { systemPrompt: "s", userPrompt: "u" },
      { model: "gpt-4o" },
    );

    expect(capturedBody.model).toBe(ANTHROPIC_DEFAULT_MODEL);
  });
});
