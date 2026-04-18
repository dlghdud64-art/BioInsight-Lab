import { describe, it, expect, beforeEach, vi } from "vitest";
import { analyzeSearchIntent, translateText } from "@/lib/ai/openai";

// fetch 모킹
global.fetch = vi.fn();

describe("OpenAI API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  describe("analyzeSearchIntent", () => {
    // NOTE: openai.ts 의 intentCache 는 모듈 레벨 singleton 이므로, 각 테스트에서 unique query 를 써서
    //       캐시 hit 로 fetch 가 스킵되는 것을 방지한다.
    it("should use fallback when API key is not set", async () => {
      const result = await analyzeSearchIntent("fallback PCR kit query");

      expect(result).toBeDefined();
      expect(result.category).toBeDefined();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should call OpenAI API when key is set", async () => {
      process.env.OPENAI_API_KEY = "test-key";

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: "REAGENT",
                  purpose: "PCR",
                  properties: ["고순도"],
                }),
              },
            },
          ],
        }),
      } as unknown as Response);

      const result = await analyzeSearchIntent("api-key PCR kit query");

      expect(fetch).toHaveBeenCalled();
      expect(result.category).toBe("REAGENT");
    });
  });

  describe("translateText", () => {
    // NOTE: translateText 의 fallback 계약은 "API key 없으면 원문 그대로 반환"(line 270~271)이며,
    //       catch 블록도 `return text` 로 일관(line 309). `[번역 필요]` placeholder 는 폐기된 구동작이다.
    // NOTE: translationCache 역시 모듈 singleton 이므로 각 테스트는 unique text 를 써서 캐시 hit 을 피한다.
    it("should return original text when API key is not set", async () => {
      const result = await translateText("fallback greeting", "en", "ko");

      expect(result).toBe("fallback greeting");
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should call OpenAI API when key is set", async () => {
      process.env.OPENAI_API_KEY = "test-key";

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "안녕하세요",
              },
            },
          ],
        }),
      } as unknown as Response);

      const result = await translateText("api-key greeting", "en", "ko");

      expect(fetch).toHaveBeenCalled();
      expect(result).toBe("안녕하세요");
    });
  });
});
