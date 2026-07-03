/**
 * §cas-hazard-classification P2 (호영님 2026-07-04) — 정적 CAS→GHS 분류기 단위테스트.
 * canonical = hazardCodes. 미수록 CAS = "미분류(unknown)"(일반 오도 금지).
 */
import { describe, it, expect } from "vitest";
import {
  normalizeCas, classifyByCas, deriveHazardLevel, pictogramsFromHazardCodes, CAS_GHS_TABLE,
} from "@/lib/safety/cas-ghs-table";

describe("§cas-hazard P2 — normalizeCas", () => {
  it("유효 CAS 통과 / 공백 정규화", () => {
    expect(normalizeCas("7647-14-5")).toBe("7647-14-5");
    expect(normalizeCas("  7647-14-5 ")).toBe("7647-14-5");
  });
  it("무효 형식·null → null", () => {
    expect(normalizeCas("764714-5")).toBeNull();
    expect(normalizeCas(null)).toBeNull();
    expect(normalizeCas("")).toBeNull();
  });
});

describe("§cas-hazard P2 — classifyByCas", () => {
  it("수록 위험물질 매칭", () => {
    expect(classifyByCas("79-06-1").matched).toBe(true);
    expect(classifyByCas("79-06-1").hazardCodes).toContain("H350");
  });
  it("비위험(NaCl) = 매칭됨·빈 코드(미분류와 구분)", () => {
    const r = classifyByCas("7647-14-5");
    expect(r.matched).toBe(true);
    expect(r.hazardCodes).toEqual([]);
  });
  it("미수록·무효·null = 미매칭(미분류)", () => {
    expect(classifyByCas("99999-99-9").matched).toBe(false);
    expect(classifyByCas(null).matched).toBe(false);
  });
});

describe("§cas-hazard P2 — deriveHazardLevel (미분류 정직성)", () => {
  it("미분류(classified=false) → unknown (절대 low 아님)", () => {
    const lv = deriveHazardLevel({ classified: false, hazardCodes: [] });
    expect(lv).toBe("unknown");
    expect(lv).not.toBe("low");
  });
  it("등급 파생: critical / high / medium / low", () => {
    expect(deriveHazardLevel({ classified: true, hazardCodes: ["H350"] })).toBe("critical");
    expect(deriveHazardLevel({ classified: true, hazardCodes: ["H314"] })).toBe("high");
    expect(deriveHazardLevel({ classified: true, hazardCodes: ["H335"] })).toBe("medium");
    expect(deriveHazardLevel({ classified: true, hazardCodes: [] })).toBe("low");
  });
});

describe("§cas-hazard P2 — pictogramsFromHazardCodes", () => {
  it("H-code → GHS 픽토그램", () => {
    expect(pictogramsFromHazardCodes(["H314"])).toEqual(["corrosive"]);
    expect(pictogramsFromHazardCodes(["H225"])).toEqual(["flame"]);
    expect(pictogramsFromHazardCodes(["H350"])).toEqual(["health_hazard"]);
    expect(pictogramsFromHazardCodes(["H272"])).toEqual(["oxidizer"]);
    expect(pictogramsFromHazardCodes(["H400"])).toEqual(["environment"]);
  });
  it("접미문자(H361d) 정규화 후 매핑", () => {
    expect(pictogramsFromHazardCodes(["H361d"])).toEqual(["health_hazard"]);
  });
});

describe("§cas-hazard P2 — 표 무결성", () => {
  it("시작셋 36종 이상", () => {
    expect(Object.keys(CAS_GHS_TABLE).length).toBeGreaterThanOrEqual(36);
  });
  it("모든 key = 정규화된 CAS", () => {
    for (const k of Object.keys(CAS_GHS_TABLE)) expect(normalizeCas(k)).toBe(k);
  });
});
