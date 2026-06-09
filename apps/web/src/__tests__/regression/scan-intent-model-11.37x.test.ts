/**
 * §11.37x — 스캔 intent 모델 회귀 가드 (소싱 카메라 read-only / 자동차감 금지 / ScanHub 맥락 분리)
 *
 * Phase 0 TR(2026-06-09): handoff §1-1 우려(소싱 카메라 스마트입고 하드와이어 / 자동차감)는
 *   활성 §11.374~380 스캔 트랙이 이미 정합시킴. 본 가드는 그 정합 상태를 회귀 방지로 못 박는다.
 *   (갭 2건 — web 소싱 QR확인 진입·mobile 소싱 카메라 — 은 백로그, 결함 아님.)
 *
 * sandbox vitest 실행 불가 → 클로드코드 실제 실행 PASS 확정.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function readWeb(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
function readMobile(rel: string): string {
  return readFileSync(resolve(APP_WEB_ROOT, "../mobile", rel), "utf8");
}

const SEARCH = "src/app/_workbench/search/page.tsx";
const SCAN = "app/scan.tsx";
const LABEL = "src/components/inventory/LabelScannerModal.tsx";

describe("§11.37x — 소싱 카메라 = 라벨 스캔 검색(read), 입고 mutation 하드와이어 금지", () => {
  it("web 소싱 'AI 라벨 스캔' = onScanComplete(검색) wiring", () => {
    const src = readWeb(SEARCH);
    expect(src).toMatch(/<LabelScannerModal[\s\S]{0,400}onScanComplete=\{/);
  });

  it("소싱 LabelScannerModal 에 onDirectReceive(입고 mutation) 하드와이어 없음", () => {
    const src = readWeb(SEARCH);
    // LabelScannerModal 블록 안에 onDirectReceive prop 부재(소싱=검색 read 전용)
    expect(src).not.toMatch(/<LabelScannerModal[\s\S]{0,400}onDirectReceive=/);
  });

  it("onScanComplete 가 검색 실행(setSearchQuery/runSearch)으로 연결 — dead-end 아님", () => {
    const src = readWeb(SEARCH);
    expect(src).toMatch(/onScanComplete=\{[\s\S]{0,300}setSearchQuery\(/);
  });
});

describe("§11.37x — 자동차감 금지 (scan use_qr = 조회 후 명시 액션 선택)", () => {
  it("matched 후 handleAction = 명시 액션 switch(detail/receive/dispatch)", () => {
    const src = readMobile(SCAN);
    expect(src).toMatch(/handleAction/);
    expect(src).toMatch(/case "detail":/);
    expect(src).toMatch(/case "dispatch":/);
  });

  it("dispatch(차감)는 lot-dispatch surface 이동(자동차감 아님 — 명시 확인 단계)", () => {
    const src = readMobile(SCAN);
    expect(src).toMatch(/case "dispatch":[\s\S]{0,160}lot-dispatch/);
  });

  it("§11.379 ScanHub intent 수신 보존(receive_label/use_qr 맥락 분리)", () => {
    const src = readMobile(SCAN);
    expect(src).toMatch(/use_qr/);
    expect(src).toMatch(/receive_label/);
  });
});

describe("§11.37x — LabelScannerModal 맥락 분기(소싱 검색 vs 입고 conflation 제거)", () => {
  it("isSearchContext = !onDirectReceive 파생(검색/입고 맥락 구분)", () => {
    const src = readWeb(LABEL);
    expect(src).toMatch(/const isSearchContext = !onDirectReceive/);
    expect(src).toMatch(/const scanTitle = isSearchContext \? "라벨 스캔 검색" : "스마트 입고"/);
  });

  it("타이틀 3곳(업로드/Sheet/Dialog) scanTitle 분기 — '스마트 입고' 하드코딩 제거", () => {
    const src = readWeb(LABEL);
    const uses = (src.match(/\{scanTitle\}/g) || []).length;
    expect(uses).toBeGreaterThanOrEqual(3);
  });

  it("검색 맥락 CTA = '이 라벨로 검색'(입고 맥락은 '입고 완료' 유지)", () => {
    const src = readWeb(LABEL);
    expect(src).toMatch(/onDirectReceive \? "입고 완료" : "이 라벨로 검색"/);
  });

  it("회귀 0 — 입고 맥락(onDirectReceive) 게이트·CTA 보존", () => {
    const src = readWeb(LABEL);
    expect(src).toMatch(/onClick=\{onDirectReceive \? handleDirectReceive : handleApplyToForm\}/);
    expect(src).toMatch(/onDirectReceive && commitGate\.fieldMarks/);
  });

  it("소싱(search/page)은 onScanComplete만 — 자동 검색 맥락", () => {
    const src = readWeb(SEARCH);
    expect(src).toMatch(/<LabelScannerModal[\s\S]{0,400}onScanComplete=\{/);
    expect(src).not.toMatch(/<LabelScannerModal[\s\S]{0,400}onDirectReceive=/);
  });
});
