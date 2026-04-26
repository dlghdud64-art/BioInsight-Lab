/**
 * apps/web/src/__tests__/lib/ai/openai.test.ts
 *
 * Phase 3 (#α-F-followup-anthropic-migration, ADR §11.26): file is
 * still named after the historical OpenAI implementation but the
 * body now calls Anthropic via lib/ai/anthropic.ts. Mocks updated
 * to the Anthropic Messages API response shape. Function contracts
 * (analyzeSearchIntent / translateText) and their fallback
 * semantics are unchanged.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { analyzeSearchIntent, translateText } from "@/lib/ai/openai";

global.fetch = vi.fn();

describe("analyzeSearchIntent (Anthropic-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it("should use keyword fallback when Anthropic key is not set", async () => {
    const result = await analyzeSearchIntent("fallback PCR kit query");
    expect(result).toBeDefined();
    expect(result.category).toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("should call Anthropic API when ANTHROPIC_API_KEY is set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              category: "REAGENT",
              purpose: "PCR",
              properties: ["고순도"],
            }),
          },
        ],
        model: "claude-haiku-4-5-20251001",
        usage: { input_tokens: 50, output_tokens: 20 },
      }),
    } as unknown as Response);

    const result = await analyzeSearchIntent(
      "anthropic PCR kit query intent test",
    );

    expect(fetch).toHaveBeenCalled();
    expect(result.category).toBe("REAGENT");
    expect(result.purpose).toBe("PCR");
    expect(result.properties).toEqual(["고순도"]);
  });
});

describe("translateText (Anthropic-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it("should return original text when ANTHROPIC_API_KEY is not set", async () => {
    const result = await translateText(
      "anthropic-fallback greeting unique",
      "en",
      "ko",
    );
    expect(result).toBe("anthropic-fallback greeting unique");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("should call Anthropic API when key is set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "안녕하세요" }],
        model: "claude-haiku-4-5-20251001",
        usage: { input_tokens: 8, output_tokens: 5 },
      }),
    } as unknown as Response);

    const result = await translateText(
      "anthropic-key greeting unique",
      "en",
      "ko",
    );
    expect(fetch).toHaveBeenCalled();
    expect(result).toBe("안녕하세요");
  });

  it("should return original on non-OK response", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "server error",
    } as unknown as Response);

    const result = await translateText(
      "anthropic-non-ok unique greeting",
      "en",
      "ko",
    );
    expect(result).toBe("anthropic-non-ok unique greeting");
  });
});
