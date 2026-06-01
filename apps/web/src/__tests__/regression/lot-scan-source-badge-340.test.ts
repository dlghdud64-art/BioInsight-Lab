/**
 * §11.340 (회귀) — Lot/유효기한 라벨 스캔 출처 배지 sentinel
 *
 * 진단: 라벨 파서(label-parser)가 이미 lotNo/expirationDate 파싱 + 폼 자동채움 + 수기 fallback.
 *   유일 gap = 출처 표시(§11.335 정책의 Lot 버전).
 * 보강: 스캔으로 채워졌고(scanFilled) 미수정 = "라벨 스캔 확인"(검증값), 수정/수기 = "수기 입력".
 *   웹 LabelScannerModal + 모바일 scan.tsx 둘 다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const REPO_ROOT = join(APP_WEB_ROOT, "..", "..");
function readWeb(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
function readRepo(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const MODAL = "src/components/inventory/LabelScannerModal.tsx";
const SCAN = "apps/mobile/app/scan.tsx";
const PARSER = "src/lib/ocr/label-parser.ts";

describe("§11.340 — 라벨 파서 Lot/유효기한 파싱(기존 보존)", () => {
  it("LabelParseResult 에 lotNo/expirationDate", () => {
    const src = readWeb(PARSER);
    expect(src).toMatch(/lotNo: string \| null/);
    expect(src).toMatch(/expirationDate: string \| null/);
  });
});

describe("§11.340 — 웹 출처 배지", () => {
  it("출처 추적 state(scanFilled/dirty)", () => {
    const src = readWeb(MODAL);
    expect(src).toMatch(/const \[lotScanFilled, setLotScanFilled\]/);
    expect(src).toMatch(/const \[lotDirty, setLotDirty\]/);
  });
  it("스캔 매핑 시 출처 기록 + updateField dirty 전환", () => {
    const src = readWeb(MODAL);
    expect(src).toMatch(/setLotScanFilled\(Boolean\(data\.parsed\.lotNo\)\)/);
    expect(src).toMatch(/if \(key === "lotNumber"\) setLotDirty\(true\)/);
  });
  it("출처 배지 헬퍼 + Lot/유효기한 배지 렌더", () => {
    const src = readWeb(MODAL);
    expect(src).toMatch(/라벨 스캔 확인/);
    expect(src).toMatch(/수기 입력/);
    expect(src).toMatch(/data-testid="lot-source-badge"/);
    expect(src).toMatch(/data-testid="expiry-source-badge"/);
  });
});

describe("§11.340 — 모바일 출처 배지", () => {
  it("출처 state + 매핑 기록 + dirty", () => {
    const src = readRepo(SCAN);
    expect(src).toMatch(/const \[lotScanFilled, setLotScanFilled\]/);
    expect(src).toMatch(/setLotScanFilled\(Boolean\(result\.parsed\.lotNo\)\)/);
    expect(src).toMatch(/if \(key === "lotNumber"\) setLotDirty\(true\)/);
  });
  it("배지 헬퍼 + 라벨 스캔 확인/수기 입력", () => {
    const src = readRepo(SCAN);
    expect(src).toMatch(/라벨 스캔 확인/);
    expect(src).toMatch(/수기 입력/);
  });
});

describe("§11.340 회귀 0 — 폼 자동채움/저장 보존", () => {
  it("웹 lotNumber/expirationDate 폼 채움 보존", () => {
    const src = readWeb(MODAL);
    expect(src).toMatch(/lotNumber: data\.parsed\.lotNo/);
    expect(src).toMatch(/expirationDate: data\.parsed\.expirationDate/);
  });
});
