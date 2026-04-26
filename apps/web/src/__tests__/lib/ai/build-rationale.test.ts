/**
 * apps/web/src/__tests__/lib/ai/build-rationale.test.ts
 *
 * α-F (ADR §11.25 / §11.26 Anthropic migration). LLM-backed
 * enrichment for the AI 선택안 rationale line. Utility ALWAYS
 * returns a string[] — never throws — so the resolver never has to
 * decide between "rationale" vs "no rationale". On every failure
 * mode (no key / network / non-OK / parse error / empty content)
 * it falls back to the canonical placeholder per the supplier's
 * reply state.
 *
 * Mock pattern (Anthropic):
 *   POST https://api.anthropic.com/v1/messages
 *   response: { content: [{ type: "text", text: "..." }],
 *               model: "claude-haiku-...", usage: { input_tokens, output_tokens } }
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildRationale } from "@/lib/ai/build-rationale";
import { ANTHROPIC_DEFAULT_MODEL } from "@/lib/ai/anthropic";

global.fetch = vi.fn();

describe("buildRationale (Anthropic)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it("[1] no API key → fallback to placeholder, no fetch call", async () => {
    const r = await buildRationale({
      supplierName: "Thermo Fisher Scientific",
      replied: true,
      context: { quoteTitle: "Trypsin order", totalSuppliers: 3 },
    });
    expect(r.rationale).toEqual(["회신 완료"]);
    expect(r.aiModel).toBeNull();
    expect(r.promptTokens).toBe(0);
    expect(r.completionTokens).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("[2] no API key + replied=false → fallback '회신 대기'", async () => {
    const r = await buildRationale({
      supplierName: "Sigma",
      replied: false,
      context: { quoteTitle: "x", totalSuppliers: 2 },
    });
    expect(r.rationale).toEqual(["회신 대기"]);
  });

  it("[3] API ok → returns LLM rationale + token counts + model", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              rationale: ["가장 빠른 납기와 합리적 가격"],
            }),
          },
        ],
        model: ANTHROPIC_DEFAULT_MODEL,
        usage: { input_tokens: 120, output_tokens: 18 },
      }),
    } as unknown as Response);

    const r = await buildRationale({
      supplierName: "Thermo Fisher Scientific",
      replied: true,
      price: 45000,
      leadDays: 5,
      context: { quoteTitle: "Trypsin order", totalSuppliers: 3 },
    });
    expect(r.rationale).toEqual(["가장 빠른 납기와 합리적 가격"]);
    expect(r.aiModel).toBe(ANTHROPIC_DEFAULT_MODEL);
    expect(r.promptTokens).toBe(120);
    expect(r.completionTokens).toBe(18);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("[4] non-2xx response → fallback to placeholder", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "service unavailable",
    } as unknown as Response);

    const r = await buildRationale({
      supplierName: "X",
      replied: true,
      context: { quoteTitle: "y", totalSuppliers: 1 },
    });
    expect(r.rationale).toEqual(["회신 완료"]);
    expect(r.aiModel).toBeNull();
  });

  it("[5] ok response but empty content array → fallback", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [],
        model: ANTHROPIC_DEFAULT_MODEL,
        usage: { input_tokens: 5, output_tokens: 0 },
      }),
    } as unknown as Response);

    const r = await buildRationale({
      supplierName: "X",
      replied: false,
      context: { quoteTitle: "y", totalSuppliers: 1 },
    });
    expect(r.rationale).toEqual(["회신 대기"]);
  });

  it("[6] ok response but text is invalid JSON → fallback", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "not valid json {" }],
        model: ANTHROPIC_DEFAULT_MODEL,
        usage: { input_tokens: 5, output_tokens: 5 },
      }),
    } as unknown as Response);

    const r = await buildRationale({
      supplierName: "X",
      replied: true,
      context: { quoteTitle: "y", totalSuppliers: 1 },
    });
    expect(r.rationale).toEqual(["회신 완료"]);
  });

  it("[7] ok response but rationale missing or empty array → fallback", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          { type: "text", text: JSON.stringify({ rationale: [] }) },
        ],
        model: ANTHROPIC_DEFAULT_MODEL,
        usage: { input_tokens: 5, output_tokens: 5 },
      }),
    } as unknown as Response);

    const r = await buildRationale({
      supplierName: "X",
      replied: false,
      context: { quoteTitle: "y", totalSuppliers: 1 },
    });
    expect(r.rationale).toEqual(["회신 대기"]);
  });

  it("[8] network error → fallback (no throw)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    const r = await buildRationale({
      supplierName: "X",
      replied: true,
      context: { quoteTitle: "y", totalSuppliers: 1 },
    });
    expect(r.rationale).toEqual(["회신 완료"]);
    expect(r.aiModel).toBeNull();
  });
});
