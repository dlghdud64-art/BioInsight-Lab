/**
 * §11.309d #smart-receiving-scanner-modal — Regression sentinel
 *
 * 호영님 P0 spec (2026-05-26) backend MVP Phase D:
 *   1. SmartReceivingScannerModal 컴포넌트 신규 — 카메라/갤러리 input + OCR +
 *      사용자 확인 form + smart-receiving API 호출
 *   2. Header.tsx (글로벌 진입점) placeholder → ScannerModal swap
 *   3. inventory-main.tsx (재고 탭 진입점) placeholder → ScannerModal swap +
 *      React Query invalidation
 *
 * 회귀 보호:
 *   - §11.308a SmartReceivingPlaceholderModal 컴포넌트 file 보존 (delete 0)
 *   - §11.308a-v2 Header isSmartReceivingOpen state / button 보존
 *   - §11.308a inventory-main.tsx mobile + desktop entry button 보존
 *   - §11.290 /api/quotes/parse-image route 변경 0 (caller만 새로 추가)
 *   - §11.309c /api/inventory/smart-receiving route 변경 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCANNER_PATH = "src/components/inventory/SmartReceivingScannerModal.tsx";
const HEADER_PATH = "src/components/dashboard/Header.tsx";
const PLACEHOLDER_PATH = "src/components/inventory/SmartReceivingPlaceholderModal.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.309d — SmartReceivingScannerModal 컴포넌트", () => {
  it("파일 존재", () => {
    expect(existsSync(join(REPO_ROOT, SCANNER_PATH))).toBe(true);
  });

  it("export SmartReceivingScannerModal", () => {
    const src = read(SCANNER_PATH);
    expect(src).toMatch(/export\s+function\s+SmartReceivingScannerModal/);
  });

  it("Props interface (open + onClose + onReceivingRegistered + organizationId)", () => {
    const src = read(SCANNER_PATH);
    expect(src).toMatch(/interface\s+SmartReceivingScannerModalProps/);
    expect(src).toMatch(/onReceivingRegistered\?:/);
    expect(src).toMatch(/organizationId\?:/);
  });

  it("Step state — upload / scanning / review / submitting / success / error", () => {
    const src = read(SCANNER_PATH);
    expect(src).toMatch(/type\s+ScanStep\s*=\s*["']upload["']\s*\|\s*["']scanning["']\s*\|\s*["']review["']\s*\|\s*["']submitting["']\s*\|\s*["']success["']\s*\|\s*["']error["']/);
  });

  it("File input → POST /api/quotes/parse-image (§11.290 OCR pipeline 재사용)", () => {
    const src = read(SCANNER_PATH);
    expect(src).toMatch(/csrfFetch\(["']\/api\/quotes\/parse-image["']/);
    expect(src).toMatch(/imageBase64:\s*base64/);
  });

  it("[입고 등록] → POST /api/inventory/smart-receiving (§11.309c API)", () => {
    const src = read(SCANNER_PATH);
    expect(src).toMatch(/csrfFetch\(["']\/api\/inventory\/smart-receiving["']/);
    expect(src).toMatch(/ocrJobId:\s*scanResult\.ocrMetadata\.jobId/);
    expect(src).toMatch(/confirmedData:/);
  });

  it("사용자 form 모든 필드 input (productName / brand / catalogNumber / lotNumber / expirationDate / receivedQuantity / receivedUnit / storageCondition / notes)", () => {
    const src = read(SCANNER_PATH);
    expect(src).toMatch(/id="srm-productName"/);
    expect(src).toMatch(/id="srm-brand"/);
    expect(src).toMatch(/id="srm-catalogNumber"/);
    expect(src).toMatch(/id="srm-lotNumber"/);
    expect(src).toMatch(/id="srm-expirationDate"/);
    // §11.348 수령 시맨틱 rename: quantity→receivedQuantity, unit→receivedUnit(발주 vs 수령 구분).
    expect(src).toMatch(/id="srm-receivedQuantity"/);
    expect(src).toMatch(/id="srm-receivedUnit"/);
    expect(src).toMatch(/id="srm-storageCondition"/);
    expect(src).toMatch(/id="srm-notes"/);
  });

  it("주요 CTA testid + dead button 0 (모든 CTA real handler wiring)", () => {
    const src = read(SCANNER_PATH);
    expect(src).toMatch(/data-testid="smart-receiving-upload-cta"/);
    expect(src).toMatch(/data-testid="smart-receiving-submit-cta"/);
    expect(src).toMatch(/data-testid="smart-receiving-success-close"/);
    expect(src).toMatch(/data-testid="smart-receiving-scanner-modal"/);
  });

  it("터치 영역 ≥ 44px (모바일 a11y)", () => {
    const src = read(SCANNER_PATH);
    expect(src).toMatch(/min-h-\[44px\]/);
  });

  it("ConfidenceBadge + ProviderBadge + CacheHitIndicator (§11.290 패턴)", () => {
    const src = read(SCANNER_PATH);
    expect(src).toMatch(/function\s+ConfidenceBadge/);
    expect(src).toMatch(/function\s+ProviderBadge/);
    expect(src).toMatch(/function\s+CacheHitIndicator/);
  });

  it("ScanLine icon (lucide-react)", () => {
    const src = read(SCANNER_PATH);
    expect(src).toMatch(/import\s*\{[^}]*ScanLine[^}]*\}\s*from\s*["']lucide-react["']/);
    expect(src).toMatch(/<ScanLine\s+className="h-5 w-5 text-emerald-600"/);
  });

  it("toast 성공/실패 알림 (§global-toast — 어댑터 경유)", () => {
    /* 🔄 재조준 (2026-08-21) — users-toast 와 동일 사유. sonner → @/lib/toast 어댑터.
     *    success/error 분기는 그대로 보존됐다 — 바뀐 것은 import 출처뿐이다. */
    const src = read(SCANNER_PATH);
    expect(src).toMatch(/import\s*\{\s*toast\s*\}\s*from\s*["']@\/lib\/toast["']/);
    expect(src).toMatch(/toast\.success/);
    expect(src).toMatch(/toast\.error/);
    expect(src).not.toMatch(/froms*["']sonner["']/);
  });

  it("input validation (productName + quantity > 0)", () => {
    const src = read(SCANNER_PATH);
    expect(src).toMatch(/!form\.productName\.trim\(\)/);
    expect(src).toMatch(/form\.receivedQuantity\s*<=\s*0/);
  });

  it("camera capture attribute (모바일 카메라 직접 호출)", () => {
    const src = read(SCANNER_PATH);
    expect(src).toMatch(/capture="environment"/);
    expect(src).toMatch(/accept="image\/\*"/);
  });
});

describe("§11.309d — Header.tsx 글로벌 진입점 [SUPERSEDED §11.371-3 → global-modal registry]", () => {
  // §11.371-3: Header 스캔 진입은 인라인 모달(Placeholder/Scanner) → openModal("scan_hub") registry.
  //   Scanner 모달 렌더는 registry 소유. Header 는 인라인 모달/isSmartReceivingOpen 미보유.
  it("Header registry 진입 (openModal scan_hub) + 인라인 모달 부재", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/openModal\("scan_hub"\)/);
    expect(src).not.toMatch(/<SmartReceivingScannerModal/);
    expect(src).not.toMatch(/<SmartReceivingPlaceholderModal/);
  });

  it("스캔 button testid (header-scan-entry) + isSmartReceivingOpen state 은퇴", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/data-testid="header-scan-entry"/);
    expect(src).not.toMatch(/isSmartReceivingOpen/);
  });
});

describe("§11.309d — 재고 표면 swap [SUPERSEDED — §371-3 registry + §inventory-dead-file-cleanup]", () => {
  // §inventory-dead-file-cleanup 2차(2026-08-06): 원 describe 는 inventory-main(dead,
  //   importer 0) 의 인라인 Scanner swap·invalidation 을 잠갔음. 라이브는 scan_hub
  //   registry(global-modal lazy) 단일 경로 — 인라인 렌더 자체가 없다.
  //   Scanner 컴포넌트 계약(위 describe)과 registry 배선(371-3)은 별도 잠금 유지.
  it("global-modal registry 가 SmartReceivingScannerModal lazy 로드 (라이브 경로)", () => {
    const src = read("src/components/global-modal.tsx");
    expect(src).toMatch(/SmartReceivingScannerModal/);
  });
});

describe("§11.309d — PlaceholderModal 컴포넌트 파일 보존 (delete 0)", () => {
  it("SmartReceivingPlaceholderModal file 존재 (다른 future placeholder 재사용 가능)", () => {
    expect(existsSync(join(REPO_ROOT, PLACEHOLDER_PATH))).toBe(true);
  });

  it("PlaceholderModal export 변경 0", () => {
    const src = read(PLACEHOLDER_PATH);
    expect(src).toMatch(/export\s+function\s+SmartReceivingPlaceholderModal/);
  });
});
