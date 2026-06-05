/**
 * §11.371-3 — 글로벌 스캔 허브(라벨/거래명세서/QR) sentinel
 *
 * root cause(차단 대상): Header 글로벌 "스마트입고" 버튼이 단품 라벨을
 *   거래명세서(quote) 파서(parse-image)로 보내 items:[] → 빈 폼.
 * 해결: 글로벌 단일 "스캔" 진입 → scan_hub picker → 입력유형 선택
 *   (label_scanner=라벨 / smart_receiving=거래명세서 / qr_scanner=QR).
 *
 * 본 sentinel 은 구현 GREEN 상태 contract + 회귀 0 을 강제한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const HEADER = "src/components/dashboard/Header.tsx";
const STORE = "src/lib/store/modal-store.ts";
const GLOBAL = "src/components/global-modal.tsx";
const HUB = "src/components/inventory/ScanHubModal.tsx";
const SMART = "src/components/inventory/SmartReceivingScannerModal.tsx";
const LABEL = "src/components/inventory/LabelScannerModal.tsx";
const HELPER = "src/lib/inventory/submit-label-receive.ts";
const INV = "src/app/dashboard/inventory/inventory-content.tsx";
const INVMAIN = "src/app/dashboard/inventory/inventory-main.tsx";
const SCANLABEL = "src/app/api/inventory/scan-label/route.ts";

describe("§11.371-3 — modal-store / global-modal 등록", () => {
  it("ModalType 에 scan_hub + smart_receiving 등록", () => {
    const src = read(STORE);
    expect(src).toMatch(/"scan_hub"/);
    expect(src).toMatch(/"smart_receiving"/);
  });

  it("global-modal registry: scan_hub→ScanHubContent, smart_receiving→SmartReceivingContent, label_scanner 보존", () => {
    const src = read(GLOBAL);
    expect(src).toMatch(/scan_hub:\s*{/);
    expect(src).toMatch(/m\.ScanHubContent/);
    expect(src).toMatch(/smart_receiving:\s*{/);
    expect(src).toMatch(/m\.SmartReceivingContent/);
    expect(src).toMatch(/m\.LabelScannerContent/);
  });
});

describe("§11.371-3 — ScanHub picker", () => {
  it("3 모드(label_scanner/smart_receiving/qr_scanner) + openModal wiring + testid", () => {
    const src = read(HUB);
    expect(src).toMatch(/data-testid="scan-hub"/);
    expect(src).toMatch(/type:\s*"label_scanner"/);
    expect(src).toMatch(/type:\s*"smart_receiving"/);
    expect(src).toMatch(/type:\s*"qr_scanner"/);
    expect(src).toMatch(/openModal\(o\.type\)/);
    expect(src).toMatch(/export function ScanHubContent/);
  });
});

describe("§11.371-3 — Header 글로벌 진입 전환", () => {
  it("스캔 버튼 → openModal('scan_hub'), 전용 testid", () => {
    const src = read(HEADER);
    expect(src).toMatch(/data-testid="header-scan-entry"/);
    expect(src).toMatch(/openModal\("scan_hub"\)/);
    expect(src).toMatch(/useOpenModal/);
  });
  it("SmartReceivingScannerModal 직접 import/렌더 + 로컬 state 제거", () => {
    const src = read(HEADER);
    expect(src).not.toMatch(/SmartReceivingScannerModal/);
    expect(src).not.toMatch(/isSmartReceivingOpen/);
  });
});

describe("§11.371-3 — SmartReceiving content-only 어댑터 + 카피 정정", () => {
  it("SmartReceivingContent export + _renderContentOnly", () => {
    const src = read(SMART);
    expect(src).toMatch(/export function SmartReceivingContent/);
    expect(src).toMatch(/_renderContentOnly/);
  });
  it("거짓 카피('거래명세서 또는 라벨') 제거 — 거래명세서 전용", () => {
    const src = read(SMART);
    expect(src).not.toMatch(/거래명세서 또는 라벨/);
    expect(src).not.toMatch(/거래명세서나 시약 라벨/);
  });
});

describe("§11.371-3 — 라벨 직접등록 영속화 단일점", () => {
  it("submit-label-receive helper: /api/inventory POST + invalidate, ok는 res.ok 일 때만", () => {
    const src = read(HELPER);
    expect(src).toMatch(/export async function submitLabelReceive/);
    expect(src).toMatch(/"\/api\/inventory"/);
    expect(src).toMatch(/queryKey:\s*\["inventories"\]/);
    expect(src).toMatch(/queryKey:\s*\["team-inventory"\]/);
    expect(src).toMatch(/if \(!res\.ok\)/);
  });
  it("LabelScannerContent: onDirectReceive 미주입 시 submitLabelReceive 기본 핸들러", () => {
    const src = read(LABEL);
    expect(src).toMatch(/submitLabelReceive/);
    expect(src).toMatch(/onDirectReceive\s*\?\?/);
  });
  it("inventory-content: 영속화 단일점(helper) 재사용", () => {
    const src = read(INV);
    expect(src).toMatch(/submitLabelReceive/);
    // 회귀: 재고 페이지 라벨 직접등록 진입 보존
    expect(src).toMatch(/LabelScannerModal/);
    expect(src).toMatch(/onDirectReceive=/);
  });
});

describe("§11.371-3 — 회귀 0", () => {
  it("거래명세서 경로 보존: inventory-main 에 SmartReceivingScannerModal 잔존", () => {
    const src = read(INVMAIN);
    expect(src).toMatch(/SmartReceivingScannerModal/);
  });
  it("§11.369-1 보존: scan-label 유니크 lock 키 + 이중 해제", () => {
    const src = read(SCANLABEL);
    expect(src).toMatch(/crypto\.randomUUID\(\)/);
    expect(src).not.toMatch(/targetEntityId:\s*'unknown'/);
    expect(src).toMatch(/enforcement\.complete\(\)/);
    expect(src).toMatch(/enforcement\?\.fail\(\)/);
  });
});
