/**
 * §vendor-token-length — 생성기 ↔ 검증기 왕복 sentinel (2026-08-18 프로덕션 실측 회귀)
 *
 * 잠그는 것: generateVendorRequestToken() 출력이 isValidVendorRequestToken() 을 통과한다.
 *   실측: 생성 43자 · 검증 {48} 고정 → 견적/입고 회신 링크 전부 400 "Invalid token format".
 * 잠그지 못하는 것: 라우트 배선(별도 348a1/348a2 sentinel) · 실브라우저 렌더.
 */
import { describe, it, expect } from "vitest";
import {
  generateVendorRequestToken,
  isValidVendorRequestToken,
} from "@/lib/api/vendor-request-token";

describe("§vendor-token-length — 생성기/검증기 왕복", () => {
  it("🛑 생성 토큰 100개 전부 검증 통과", () => {
    for (let i = 0; i < 100; i++) {
      const t = generateVendorRequestToken();
      expect(t.length).toBeGreaterThanOrEqual(43);
      expect(t.length).toBeLessThanOrEqual(48);
      expect(isValidVendorRequestToken(t)).toBe(true);
    }
  });

  it("프로덕션 실발급 토큰(43자) 통과 · 42자/49자/비허용 문자 거부", () => {
    expect(isValidVendorRequestToken("5tJw-7fB-VqFMfNDI0qzvPAZLwSLZyPeFqwn6IqAyvQ")).toBe(true);
    expect(isValidVendorRequestToken("a".repeat(42))).toBe(false);
    expect(isValidVendorRequestToken("a".repeat(48))).toBe(true);
    expect(isValidVendorRequestToken("a".repeat(49))).toBe(false);
    expect(isValidVendorRequestToken("a".repeat(42) + "+")).toBe(false);
  });
});
