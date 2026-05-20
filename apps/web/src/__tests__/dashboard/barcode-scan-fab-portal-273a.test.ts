/**
 * §11.273a #barcode-scan-fab-portal — BarcodeScanFab overlay createPortal 분리
 *   (sticky header stacking context 충돌 → document.body 직속 mount).
 *
 * 호영님 보고: 구매 운영 / 재고 관리 상단에 카메라 시뮬레이션 텍스트 잔여.
 * §11.271 DashboardHeader inline 이동 직후 발견.
 *
 * Root cause:
 *   sticky top-0 z-50 h-14 header 가 자체 stacking context 형성 →
 *   자식 motion.div fixed inset-0 z-[60] 의 viewport-fixed 가 sticky stacking
 *   안에 갇혀 h-14 cropping → bottom sheet 끝부분 (시뮬 텍스트) 잔류.
 *
 * Fix (minimum diff, 1 file):
 *   - createPortal(overlay, document.body) 로 overlay 분리
 *   - mounted state 추가 (hydration safety — SSR 시 document.body 부재)
 *   - button (trigger) 은 DashboardHeader inline 그대로 보존
 *
 * canonical truth lock:
 *   - button onClick / aria-label / ScanLine / lg:hidden 보존
 *   - motion.div / AnimatePresence / fixed inset-0 z-[60] 보존
 *   - phase state (idle → scanning → ready) / store wiring / handler 보존
 *   - MOCK_REAGENTS / handleAccept / handleRescan / reset 보존
 *   - navigation → /dashboard/quotes?dock=intake&source=bom_import 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FAB_PATH = resolve(
  __dirname,
  "../../components/layout/barcode-scan-fab.tsx"
);
const fab = readFileSync(FAB_PATH, "utf8");

describe("§11.273a #1 — createPortal overlay 분리", () => {
  it("§11.273a trace marker JSDoc 존재", () => {
    expect(fab).toMatch(/§11\.273a/);
  });

  it("createPortal import 추가 (react-dom)", () => {
    expect(fab).toContain("createPortal");
    expect(fab).toContain("react-dom");
  });

  it("overlay createPortal(…, document.body) 분리", () => {
    expect(fab).toMatch(/createPortal[\s\S]{0,1200}document\.body/);
  });

  it("AnimatePresence + motion.div 가 portal 안에 존재", () => {
    expect(fab).toMatch(
      /createPortal[\s\S]{0,50}\s*<AnimatePresence>/
    );
  });

  it("overlay fixed inset-0 z-\\[60\\] 보존", () => {
    expect(fab).toContain("fixed inset-0 z-[60]");
  });
});

describe("§11.273a #2 — mounted state (hydration safety)", () => {
  it("mounted useState 선언 존재", () => {
    expect(fab).toMatch(/const \[mounted, setMounted\] = useState\(false\)/);
  });

  it("useEffect → setMounted(true) (client-side 활성화)", () => {
    expect(fab).toMatch(/useEffect[\s\S]{0,100}setMounted\(true\)/);
  });

  it("mounted && createPortal 조건 — SSR 시 portal 차단", () => {
    expect(fab).toMatch(/mounted && createPortal/);
  });
});

describe("§11.273a #3 — button (trigger) 인라인 보존 invariant", () => {
  it("button onClick openScanner 보존", () => {
    expect(fab).toContain("onClick={openScanner}");
  });

  it("button aria-label 바코드 스캔 보존", () => {
    expect(fab).toContain('aria-label="바코드 스캔"');
  });

  it("ScanLine icon h-5 w-5 보존", () => {
    expect(fab).toContain('<ScanLine className="h-5 w-5"');
  });

  it("button relative inline-flex lg:hidden 보존 (§11.271 inline 정합)", () => {
    expect(fab).toMatch(/relative inline-flex[\s\S]{0,200}lg:hidden/);
  });
});

describe("§11.273a #4 — phase / store / handler / navigation invariant", () => {
  it("phase state (idle/scanning/ready) 보존", () => {
    expect(fab).toContain('"idle"');
    expect(fab).toContain('"scanning"');
    expect(fab).toContain('"ready"');
  });

  it("useSmartSourcingStore wiring 보존", () => {
    expect(fab).toContain("useSmartSourcingStore");
  });

  it("navigation → /dashboard/quotes?dock=intake&source=bom_import 보존", () => {
    expect(fab).toContain(
      '"/dashboard/quotes?dock=intake&source=bom_import"'
    );
  });

  it("handleAccept / handleRescan / reset handler 보존", () => {
    const content = fab;
    expect(content).toContain("handleAccept");
    expect(content).toContain("handleRescan");
    expect(content).toContain("const reset");
  });
});
