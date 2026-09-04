/**
 * §receiving-extracted-shape (호영님 2026-09-05) — extractedData 계약 unit.
 *
 * 사고: 같은 컬럼에 생산자마다 다른 스키마가 들어갔다.
 *   단품 → confirmedData(brand 있음) · 다품목 → line(brand 없음)
 *   §receiving-scan-source-merge C3 는 "extractedData 에 brand 가 있다" 고 **가정**했고
 *   그 가정을 검증할 수단이 없었다. prod 실측 3건의 키에 brand 가 아예 없었다.
 *
 * 그래서 잠그는 것은 brand 하나가 아니라 **공통 보장 필드 집합**이다.
 */

import { describe, it, expect } from "vitest";
import {
  buildExtractedData,
  vendorNameFromExtracted,
  EXTRACTED_SHAPE,
  EXTRACTED_COMMON_KEYS,
} from "@/lib/inventory/receiving-extracted-data";

describe("§receiving-extracted-shape — 두 경로가 같은 계약을 만족한다", () => {
  it("다품목(line)도 공통 키를 전부 갖는다 — 없으면 null (키 부재 금지)", () => {
    // prod 실측 형태: line 에는 brand·lotNumber·expirationDate 가 없었다.
    const out = buildExtractedData(EXTRACTED_SHAPE.MULTI, {
      productName: "PBS 완충액 (멸균)",
      catalogNumber: "PBS-1X-1L",
      quantity: 10,
      unit: "L",
      category: "REAGENT",
    });
    for (const k of EXTRACTED_COMMON_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(out, k), `공통 키 누락: ${k}`).toBe(true);
    }
    // 🔑 키가 없는 것과 값이 없는 것을 구분한다. 부재는 "이 경로엔 그 축이 없다" 로 오해된다.
    expect(out.brand).toBeNull();
    expect(out.lotNumber).toBeNull();
    expect(out.expirationDate).toBeNull();
    expect(out.shape).toBe("MULTI");
  });

  it("단품(confirmedData)도 같은 공통 키를 갖는다", () => {
    const out = buildExtractedData(EXTRACTED_SHAPE.SINGLE, {
      productName: "메탄올 (HPLC급)",
      brand: "한국시약",
      catalogNumber: "MeOH-4L",
      lotNumber: "MB2409A17",
      expirationDate: "2029-03-31",
      quantity: 6,
      unit: "EA",
      storageCondition: "실온",
    });
    for (const k of EXTRACTED_COMMON_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(out, k), `공통 키 누락: ${k}`).toBe(true);
    }
    expect(out.shape).toBe("SINGLE");
    expect(out.brand).toBe("한국시약");
    expect(out.lotNumber).toBe("MB2409A17");
  });

  it("원본 필드는 지우지 않는다 — 감사 추적용 추가 축 보존", () => {
    const out = buildExtractedData(EXTRACTED_SHAPE.SINGLE, {
      productName: "x",
      quantity: 1,
      storageCondition: "2~8°C",
      casNumber: "67-56-1",
      notes: "메모",
    });
    expect(out.storageCondition).toBe("2~8°C");
    expect(out.casNumber).toBe("67-56-1");
    expect(out.notes).toBe("메모");
  });

  it("shape 로 어느 화면에서 왔는지 판별된다 (읽는 쪽이 추측하지 않는다)", () => {
    expect(buildExtractedData(EXTRACTED_SHAPE.SINGLE, {}).shape).toBe("SINGLE");
    expect(buildExtractedData(EXTRACTED_SHAPE.MULTI, {}).shape).toBe("MULTI");
    expect(new Set(Object.values(EXTRACTED_SHAPE)).size).toBe(2);
  });
});

describe("§receiving-extracted-shape — 값 정규화", () => {
  it("빈 문자열·공백은 null 로 접는다 (없음과 빈값을 합친다)", () => {
    const out = buildExtractedData(EXTRACTED_SHAPE.MULTI, {
      productName: "  ",
      brand: "",
      catalogNumber: "  SF-022-50  ",
    });
    expect(out.productName).toBeNull();
    expect(out.brand).toBeNull();
    expect(out.catalogNumber).toBe("SF-022-50");
  });

  it("수량은 유한한 숫자만 — 문자열 수량은 null", () => {
    expect(buildExtractedData(EXTRACTED_SHAPE.MULTI, { quantity: 4 }).quantity).toBe(4);
    expect(buildExtractedData(EXTRACTED_SHAPE.MULTI, { quantity: "4" }).quantity).toBeNull();
    expect(buildExtractedData(EXTRACTED_SHAPE.MULTI, { quantity: NaN }).quantity).toBeNull();
  });

  it("payload 가 null/undefined 여도 계약을 지킨다", () => {
    for (const raw of [null, undefined]) {
      const out = buildExtractedData(EXTRACTED_SHAPE.SINGLE, raw);
      for (const k of EXTRACTED_COMMON_KEYS) {
        expect(Object.prototype.hasOwnProperty.call(out, k)).toBe(true);
      }
      expect(out.shape).toBe("SINGLE");
    }
  });
});

describe("§receiving-extracted-shape — C3 공급사명 파생", () => {
  it("brand 가 있으면 그 값, 없으면 null — 지어내지 않는다", () => {
    expect(vendorNameFromExtracted({ brand: "한국시약" })).toBe("한국시약");
    expect(vendorNameFromExtracted({ brand: null })).toBeNull();
    expect(vendorNameFromExtracted({ brand: "   " })).toBeNull();
    // prod 실측 형태(brand 키 자체가 없던 구 데이터)
    expect(vendorNameFromExtracted({ productName: "x", quantity: 1 })).toBeNull();
    expect(vendorNameFromExtracted(null)).toBeNull();
    expect(vendorNameFromExtracted("문자열")).toBeNull();
  });

  it("🛑 productName 을 공급사명으로 대신 쓰지 않는다", () => {
    // 대체 매칭 방지 — 품목명이 있다고 공급사를 아는 것이 아니다.
    expect(vendorNameFromExtracted({ productName: "PBS 완충액 (멸균)" })).toBeNull();
  });
});
