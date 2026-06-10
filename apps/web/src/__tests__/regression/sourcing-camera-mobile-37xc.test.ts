/**
 * §11.37x(c) — mobile 소싱 카메라 (라벨→제품 검색, read-only) sentinel
 *
 * 호영님 승인 (2026-06-11): §11.37x 백로그 ① — web/mobile 비대칭 해소.
 *   (tabs)/search 에 카메라 진입 → scan.tsx 신규 intent `sourcing_label`
 *   (라벨 OCR/GS1 재사용) → 라벨 검토에서 "이 라벨로 검색" → 검색 복귀.
 *
 * 제품 제약:
 *   - read-only: 소싱 맥락에서 입고/차감 mutation 0 (자동차감 금지)
 *   - ScanHub 비복제: 진입 = (tabs)/search 한정, ScanHubSheet 무변경
 *   - same-canvas: 신규 페이지 0 (scan.tsx·search.tsx 재사용)
 *   - 기존 intent(receive_label/use_qr)·§11.374~380 게이트 회귀 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const RESOLVE = "../mobile/lib/scan/sourcing-search-resolve.ts";
const SCAN = "../mobile/app/scan.tsx";
const SEARCH = "../mobile/app/(tabs)/search.tsx";
const SCANHUB = "../mobile/components/ScanHubSheet.tsx";

describe("§11.37x(c) — c-2 resolve 순수함수", () => {
  it("resolveSourcingSearchQuery export + 순수성 (네트워크/mutation 0)", () => {
    const src = read(RESOLVE);
    expect(src).toMatch(/export function resolveSourcingSearchQuery/);
    expect(src).not.toMatch(/apiClient|axios|fetch\(/);
  });

  it("catalogNumber 우선 → productName 폴백 → null (빈 검색 차단)", () => {
    const src = read(RESOLVE);
    expect(src).toMatch(/catalogNumber/);
    expect(src).toMatch(/productName/);
    expect(src).toMatch(/return null/);
  });

  it("GTIN 은 검색 query 미사용 (카탈로그 GTIN 필드 부재 — 표시용 한정 주석)", () => {
    const src = read(RESOLVE);
    expect(src).toMatch(/GTIN/);
    expect(src).not.toMatch(/q\s*=\s*.*gtin|gtin.*\?\?\s*null\s*\)/i);
  });
});

describe("§11.37x(c) — c-3 scan.tsx sourcing_label 분기", () => {
  it("intent sourcing_label → label 모드 진입", () => {
    const src = read(SCAN);
    expect(src).toMatch(/sourcing_label/);
    expect(src).toMatch(/intent === "receive_label" \|\| intent === "sourcing_label"/);
  });

  it("commit 분기: 검색 복귀 (read-only — 입고 게이트 선행 우회 + return)", () => {
    const src = read(SCAN);
    expect(src).toMatch(/resolveSourcingSearchQuery/);
    expect(src).toMatch(/pathname:\s*"\/\(tabs\)\/search"/);
  });

  it("CTA 분기: '이 라벨로 검색' (소싱) vs 기존 입고 CTA 보존", () => {
    const src = read(SCAN);
    expect(src).toMatch(/이 라벨로 검색/);
    expect(src).toMatch(/입고 처리로 이동/);
    expect(src).toMatch(/신규 등록으로 이동/);
  });

  it("read-only: sourcing 분기 내 mutation 라우트 미호출 (검색 복귀가 lot-receive 앞 return)", () => {
    const src = read(SCAN);
    // sourcing 분기(검색 복귀)가 handleLabelCommit 의 입고/등록 라우팅보다 앞에 위치
    const sourcingIdx = src.indexOf('pathname: "/(tabs)/search"');
    const receiveIdx = src.indexOf('pathname: "/inventory/lot-receive"');
    expect(sourcingIdx).toBeGreaterThan(-1);
    expect(receiveIdx).toBeGreaterThan(-1);
    expect(sourcingIdx).toBeLessThan(receiveIdx);
  });
});

describe("§11.37x(c) — c-3 (tabs)/search.tsx 진입 + 복귀 수신", () => {
  it("카메라 진입: /scan?intent=sourcing_label push (44px 터치)", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/intent=sourcing_label|intent:\s*"sourcing_label"/);
    expect(src).toMatch(/router\.push/);
  });

  it("스캔 복귀 q 파라미터 수신 → 자동 검색", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/useLocalSearchParams/);
    expect(src).toMatch(/runSearch|handleSearch/);
  });
});

describe("§11.37x(c) — 회귀 0: 기존 스캔 트랙·ScanHub 보존", () => {
  it("기존 intent 분기 보존 (receive_label·use_qr)", () => {
    const src = read(SCAN);
    expect(src).toMatch(/receive_label/);
    expect(src).toMatch(/intent === "use_qr"/);
  });

  it("GS1 datamatrix 입고 분기 보존 (§gs1-datamatrix)", () => {
    const src = read(SCAN);
    expect(src).toMatch(/gs1\.isGs1 && \(gs1\.lotNo \|\| gs1\.expirationDate\)/);
    expect(src).toMatch(/gs1_datamatrix_capture/);
  });

  it("use_qr 액션 5종 보존 (detail·receive·dispatch·label·location)", () => {
    const src = read(SCAN);
    for (const a of ['case "detail"', 'case "receive"', 'case "dispatch"', 'case "label"', 'case "location"']) {
      expect(src).toContain(a);
    }
  });

  it("§11.378 입고 차단 게이트 보존 (receiveBlocked — 제품명·저신뢰·critical)", () => {
    const src = read(SCAN);
    expect(src).toMatch(/receiveBlocked/);
    expect(src).toMatch(/lowConf && !productNameDirty/);
    expect(src).toMatch(/criticalUnconfirmed/);
  });

  it("ScanHubSheet 비복제 — sourcing_label 미노출 (재고 운영 canonical 유지)", () => {
    const src = read(SCANHUB);
    expect(src).not.toMatch(/sourcing_label/);
    expect(src).toMatch(/receive_label/);
    expect(src).toMatch(/use_qr/);
  });

  it("기존 검색 UI 보존 (제품 검색 헤더·API 경로)", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/제품 검색/);
    expect(src).toMatch(/\/api\/mobile\/products\/search/);
  });
});
