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
} from "@/lib/ai/anthropic";

global.fetch = vi.fn();

describe("callAnthropicMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
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
