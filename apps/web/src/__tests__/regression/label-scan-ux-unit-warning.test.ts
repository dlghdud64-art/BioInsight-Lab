/**
 * #label-scan-ux (재지시) — 규격 단위 드롭다운 + 인식 품질 경고 상단 일관화.
 *
 * 호영님 지적(2026-07-10): §label-scan-ux 부분 반영.
 *  1. packUnit "CAPSULES" free-text 고정 → controlled vocabulary 드롭다운. 두 모달 모두.
 *  2. LabelScannerModal 흐릿·재촬영 경고가 폼 아래(하단) → 폼 위(상단)로, Cat 가드와 동일 상단 존.
 *
 * 추출 엔진(선명 라벨 저신뢰)은 별트랙(§label-scan-extraction) — 본 sentinel 범위 아님.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { normalizePackUnit, PACK_UNIT_OPTIONS } from "@/lib/inventory/pack-unit-options";

const WEB = join(__dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(WEB, rel), "utf8");
const LABEL = "src/components/inventory/LabelScannerModal.tsx";
const SMART = "src/components/inventory/SmartReceivingScannerModal.tsx";

describe("#label-scan-ux — 단위 controlled vocabulary (normalize 로직)", () => {
  it("라벨 추출 단위 자동 매핑: 500g → g", () => {
    expect(normalizePackUnit("500g")).toBe("g");
  });
  it("대소문자·동의어 매핑: G/grams/ml/CAPSULES", () => {
    expect(normalizePackUnit("G")).toBe("g");
    expect(normalizePackUnit("grams")).toBe("g");
    expect(normalizePackUnit("100 mL")).toBe("mL");
    expect(normalizePackUnit("ml")).toBe("mL");
    expect(normalizePackUnit("CAPSULES")).toBe("capsule");
  });
  it("미지 단위는 빈 문자열(사용자 선택 유도, 가짜 기본값 0)", () => {
    expect(normalizePackUnit("")).toBe("");
    expect(normalizePackUnit("blah")).toBe("");
  });
  it("vocab에 질량·부피·개수 그룹 존재", () => {
    const groups = new Set(PACK_UNIT_OPTIONS.map((o) => o.group));
    expect(groups.has("mass")).toBe(true);
    expect(groups.has("volume")).toBe(true);
    expect(groups.has("count")).toBe(true);
  });
});

describe("#label-scan-ux — packUnit 드롭다운 전환 (CAPSULES 고정 제거)", () => {
  it("LabelScannerModal: CAPSULES free-text placeholder 제거", () => {
    expect(read(LABEL)).not.toContain('placeholder="CAPSULES"');
  });
  it("SmartReceivingScannerModal: CAPSULES free-text placeholder 제거", () => {
    expect(read(SMART)).not.toContain('placeholder="CAPSULES / mL"');
  });
  it("두 모달 모두 controlled vocab Select 소비", () => {
    expect(read(LABEL)).toContain("PACK_UNIT_OPTIONS");
    expect(read(LABEL)).toContain("normalizePackUnit(formData.packUnit)");
    expect(read(SMART)).toContain("PACK_UNIT_OPTIONS");
    expect(read(SMART)).toContain("normalizePackUnit(form.packUnit)");
  });
});

describe("#label-scan-ux — 인식 품질 경고 상단 일관화 (LabelScannerModal)", () => {
  it("흐릿 저신뢰 경고가 규격 폼 필드보다 위(상단)", () => {
    const src = read(LABEL);
    const warn = src.indexOf("일부 값이 흐릿하게 인식됐어요");
    const form = src.indexOf("규격 (통 1개의 함량)");
    expect(warn).toBeGreaterThan(0);
    expect(warn).toBeLessThan(form);
  });
  it("재촬영 CTA가 규격 폼 필드보다 위(상단)", () => {
    const src = read(LABEL);
    const retry = src.indexOf("다른 각도로 한 번 더 촬영");
    const form = src.indexOf("규격 (통 1개의 함량)");
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThan(form);
  });
  it("품질 경고가 Cat.No. 가드와 같은 상단 존(가드 이후)", () => {
    const src = read(LABEL);
    const cat = src.indexOf("식별 정보(Cat.No.) 부족");
    const warn = src.indexOf("일부 값이 흐릿하게 인식됐어요");
    expect(warn).toBeGreaterThan(cat);
  });
  it("경고 블록 중복 삽입 0(이동, 복제 아님)", () => {
    const src = read(LABEL);
    expect((src.match(/일부 값이 흐릿하게 인식됐어요/g) || []).length).toBe(1);
  });
});
