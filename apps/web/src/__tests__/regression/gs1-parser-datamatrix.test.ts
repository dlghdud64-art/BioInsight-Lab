/**
 * §gs1-datamatrix Phase 1 — GS1 element string 파서 단위 검증 (실 import, 순수 로직)
 *
 * gs1-parser.ts 는 RN/DOM 무의존 순수 모듈 → 실기기 없이 vitest 직접 검증.
 *   - AI 01 GTIN / 17 유효기간 / 10 Lot / 21 Serial / 11 생산일
 *   - FNC1(\x1d) 가변 AI 종료, 고정길이 AI 길이표
 *   - 괄호 HRI 양식 / YYMMDD→ISO / DD=00→YYYY-MM / 미지 AI graceful / 비GS1 isGs1=false
 *
 * Phase 1 범위: 파서만(배선 X). GTIN→제품매칭은 범위 밖(표시용).
 */
import { describe, it, expect } from "vitest";
import { parseGs1 } from "../../../../mobile/lib/scan/gs1-parser";

const GS = "\x1d"; // FNC1

describe("§gs1 — 표준 raw (FNC1)", () => {
  it("01 GTIN + 17 expiry + 10 lot (lot 말단)", () => {
    const r = parseGs1("010880612345678917261231" + "10ABC123");
    expect(r.gtin).toBe("08806123456789");
    expect(r.expirationDate).toBe("2026-12-31");
    expect(r.lotNo).toBe("ABC123");
    expect(r.isGs1).toBe(true);
  });

  it("가변 lot(10) 먼저 + FNC1 종료 후 고정 expiry(17)", () => {
    const r = parseGs1("0108806123456789" + "10LOT1" + GS + "17261231");
    expect(r.gtin).toBe("08806123456789");
    expect(r.lotNo).toBe("LOT1");
    expect(r.expirationDate).toBe("2026-12-31");
  });

  it("21 serial + 11 생산일", () => {
    const r = parseGs1("0108806123456789" + "11240115" + "21SER9" );
    expect(r.productionDate).toBe("2024-01-15");
    expect(r.serial).toBe("SER9");
  });
});

describe("§gs1 — 괄호 HRI 양식", () => {
  it("(01)(17)(10) 정규화 파싱", () => {
    const r = parseGs1("(01)08806123456789(17)261231(10)LOT9");
    expect(r.gtin).toBe("08806123456789");
    expect(r.expirationDate).toBe("2026-12-31");
    expect(r.lotNo).toBe("LOT9");
  });
});

describe("§gs1 — 날짜 변환", () => {
  it("DD=00 → YYYY-MM (일 미상)", () => {
    const r = parseGs1("17260100");
    expect(r.expirationDate).toBe("2026-01");
  });
  it("YY 50~99 → 19YY (GS1 규칙)", () => {
    const r = parseGs1("17991231");
    expect(r.expirationDate).toBe("1999-12-31");
  });
  it("잘못된 월 → null", () => {
    const r = parseGs1("17261331"); // 13월
    expect(r.expirationDate).toBeNull();
  });
});

describe("§gs1 — graceful / 비GS1", () => {
  it("비GS1 문자열 → isGs1 false, 전부 null", () => {
    const r = parseGs1("hello world");
    expect(r.isGs1).toBe(false);
    expect(r.gtin).toBeNull();
    expect(r.lotNo).toBeNull();
  });
  it("null/빈 입력 graceful", () => {
    expect(parseGs1(null).isGs1).toBe(false);
    expect(parseGs1("").isGs1).toBe(false);
  });
  it("선두 FNC1(심볼로지) 제거 후 파싱", () => {
    const r = parseGs1(GS + "0108806123456789" + "10L1");
    expect(r.gtin).toBe("08806123456789");
    expect(r.lotNo).toBe("L1");
  });
});
