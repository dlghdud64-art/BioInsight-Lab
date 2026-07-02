/**
 * §11.379 Phase 1 (RED) — 모바일 스캔 IA 입고/사용 2분류 sentinel.
 *
 * web ScanHubModal(canonical, scan-hub-ia-379.test.ts)을 native 로 포팅.
 *   진입: 홈 quickAction → ScanHubSheet(RN bottom sheet, 신규 route 0) 선행.
 *   2그룹: 입고 스캔(재고+) = 라벨 직접등록 / 재고 사용(재고−) = QR 차감.
 *   intent param(receive_label | use_qr) → scan.tsx 토글 기본값·액션 우선순위 정렬.
 *
 * 명세서(smart_receiving)는 native OCR 미구현 → 본 hub 미노출(dead button 회피, §11.380 분리).
 * OCR 무효입력 게이트 = §11.375 별 트랙.
 *
 * 모바일 자체 runner 0 → web vitest 가 repo-root 상대경로로 readFileSync + regex
 * (CLAUDE.md sentinel, §11.319 패턴 동일).
 *
 * 이 시점에서 ScanHubSheet 미존재 + 홈 직진입 + scan.tsx intent 미수신 → RED.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const REPO_ROOT = join(APP_WEB_ROOT, "..", "..");
function readRepo(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const HUB_PATH = "apps/mobile/components/ScanHubSheet.tsx";
const HOME_PATH = "apps/mobile/app/(tabs)/index.tsx";
const SCAN_PATH = "apps/mobile/app/scan.tsx";

describe("§11.379 Phase 1 — ScanHubSheet(native) 존재·2그룹", () => {
  it("apps/mobile/components/ScanHubSheet.tsx 존재", () => {
    expect(existsSync(join(REPO_ROOT, HUB_PATH))).toBe(true);
  });

  it("입고 스캔 / 재고 사용 2섹션 헤더", () => {
    const src = readRepo(HUB_PATH);
    expect(src).toMatch(/입고 스캔/);
    expect(src).toMatch(/재고 사용/);
  });

  it("입고 그룹 = 라벨(receive_label), 사용 그룹 = QR(use_qr)", () => {
    const src = readRepo(HUB_PATH);
    expect(src).toMatch(/receive_label/);
    expect(src).toMatch(/use_qr/);
    expect(src).toMatch(/라벨 직접등록/);
    expect(src).toMatch(/QR/);
  });

  it("QR 카드는 '재고 사용'(차감) 의미 — 조회 전용 라벨 금지", () => {
    const src = readRepo(HUB_PATH);
    expect(src).toMatch(/차감|사용/);
    // web canonical 과 동일하게 "재고조회" 단독 라벨로 회귀 금지
    expect(src).not.toMatch(/title:\s*["']QR 재고조회["']/);
  });
});

describe("§11.379 Phase 1 — dead button 0 (명세서 미노출)", () => {
  it("smart_receiving(명세서)는 native hub 미노출 — §11.380 분리", () => {
    const src = readRepo(HUB_PATH);
    expect(src).not.toMatch(/smart_receiving/);
    expect(src).not.toMatch(/거래명세서|명세서 입고/);
  });
});

describe("§11.379 Phase 1 — 카드 wiring (no-op 0)", () => {
  it("각 카드 onPress = router.push(/scan, {intent})", () => {
    const src = readRepo(HUB_PATH);
    expect(src).toMatch(/router\.push/);
    expect(src).toMatch(/pathname:\s*["']\/scan["']/);
    expect(src).toMatch(/intent/);
  });

  it("hub testid 노출", () => {
    const src = readRepo(HUB_PATH);
    expect(src).toMatch(/scan-hub/);
  });
});

describe("§11.379 Phase 1 — 홈 진입 hub 선행", () => {
  it("홈이 ScanHubSheet 사용(직진입 push('/scan') 대체)", () => {
    const src = readRepo(HOME_PATH);
    expect(src).toMatch(/ScanHubSheet/);
  });
});

describe("§11.379 Phase 1 — scan.tsx intent 수신", () => {
  it("useLocalSearchParams 로 intent 수신", () => {
    const src = readRepo(SCAN_PATH);
    expect(src).toMatch(/useLocalSearchParams/);
    expect(src).toMatch(/intent/);
  });

  it("intent → 초기 scanMode 기본값 매핑(receive_label=label, use_qr=barcode)", () => {
    const src = readRepo(SCAN_PATH);
    expect(src).toMatch(/receive_label/);
    expect(src).toMatch(/use_qr/);
  });
});

describe("§11.379 — 회귀 0 (scan.tsx 기존 보존)", () => {
  it("barcode/label 토글 보존", () => {
    const src = readRepo(SCAN_PATH);
    expect(src).toMatch(/setScanMode/);
    expect(src).toMatch(/scanMode === "barcode"/);
  });

  it("카메라 권한 fallback 보존 (§11.380 VisionCamera hasPermission)", () => {
    const src = readRepo(SCAN_PATH);
    expect(src).toMatch(/hasPermission/); // 구 expo permission.granted → VisionCamera hasPermission
    expect(src).toMatch(/수동 검색/);
  });

  it("label-review OCR 상태머신 보존", () => {
    const src = readRepo(SCAN_PATH);
    expect(src).toMatch(/state === "label-review"/);
    expect(src).toMatch(/confirmLabelReceive/);
  });

  it("차감 게이트(dispatch → lot-dispatch) 보존 — front-only 차감 0", () => {
    const src = readRepo(SCAN_PATH);
    expect(src).toMatch(/case "dispatch"/);
    expect(src).toMatch(/lot-dispatch/);
  });
});
