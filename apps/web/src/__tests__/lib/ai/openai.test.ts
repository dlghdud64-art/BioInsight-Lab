import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { analyzeSearchIntent, translateText } from "@/lib/ai/openai";

// fetch 모킹
global.fetch = jest.fn();

describe("OpenAI API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  describe("analyzeSearchIntent", () => {
    it("should use fallback when API key is not set", async () => {
      const result = await analyzeSearchIntent("PCR kit");

      expect(result).toBeDefined();
      expect(result.category).toBeDefined();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should call OpenAI API when key is set", async () => {
      process.env.OPENAI_API_KEY = "test-key";
      
      (fetch as jest.Mock).mockResolvedValue({
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
      });

      const result = await analyzeSearchIntent("PCR kit");

      expect(fetch).toHaveBeenCalled();
      expect(result.category).toBe("REAGENT");
    });
  });

  describe("translateText", () => {
    it("should return placeholder when API key is not set", async () => {
      const result = await translateText("Hello", "en", "ko");

      expect(result).toContain("[번역 필요]");
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should call OpenAI API when key is set", async () => {
      process.env.OPENAI_API_KEY = "test-key";
      
      (fetch as jest.Mock).mockResolvedValue({
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
      });

      const result = await translateText("Hello", "en", "ko");

      expect(fetch).toHaveBeenCalled();
      expect(result).toBe("안녕하세요");
    });
  });
});
