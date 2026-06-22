/**
 * §label-scan-qc #label-scan-exp-default-and-badge — 호영님 P0 (QC팀장, 안전 직결).
 *
 * 라벨 스캔(재고 직접등록) 유효기간(EXP):
 *   1. EXP 디폴트 빈값 보장 — today 자동채움 0 (당일 만료 오등록 = 일탈 소지 방지).
 *      코드 확인: emptyFormData expirationDate "" + mapScanToForm `|| ""` (today 주입 경로 0).
 *   2. type=date 는 placeholder 미지원 → 빈값일 때 "직접 입력·오늘 자동 아님" 명시 안내.
 *   3. Lot/EXP 이중 배지 모순 완화: 녹색 "라벨 스캔 확인" + 빨강 "확인 필요" → yellow "확인 권장"
 *      (§11.302 검토 권고는 주의(yellow), 위험(red) 아님). commit 게이트(터치 강제)는 보존.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../components/inventory/LabelScannerModal.tsx"),
  "utf8",
);

describe("§label-scan-qc — EXP 디폴트 빈값 + 안내 (today 자동채움 금지)", () => {
  it("expirationDate 디폴트 빈값 (today 주입 0)", () => {
    expect(SRC).toContain('expirationDate: ""');
    expect(SRC).toContain('data.parsed.expirationDate || ""');
    expect(SRC).not.toMatch(/expirationDate:\s*[^"'\n]*new Date/);
  });

  it("EXP 빈값 시 직접 입력 안내 (오늘 자동 아님 명시)", () => {
    expect(SRC).toContain("오늘 날짜 자동 아님");
    expect(SRC).toMatch(/!formData\.expirationDate\s*&&/);
  });

  it("EXP 입력 type=text + placeholder (type=date auto-today 근본 제거, YYYY-MM 재시험일 수용)", () => {
    // 빈 type=date 가 모바일에서 오늘로 자동 채워지는 브라우저 동작을 원천 차단(SmartReceiving 과 동일 패턴).
    expect(SRC).toContain("예: 2026-12 또는 2026-12-31");
    expect(SRC).toMatch(/type="text"[\s\S]{0,80}expirationDate/);
  });
});

describe("§label-scan-qc — Lot/EXP 이중 배지 모순 완화", () => {
  it("needs-confirm 검토 권고 yellow(주의), red 과함 해소", () => {
    expect(SRC).toContain("· 확인 권장");
    expect(SRC).not.toContain('text-red-600">· 확인 필요');
  });

  it("commit 게이트(터치 강제) 보존 — needs-confirm 분기 유지", () => {
    expect(SRC).toContain('commitGate.fieldMarks.lot === "needs-confirm"');
    expect(SRC).toContain('commitGate.fieldMarks.expiry === "needs-confirm"');
  });
});
