/**
 * §11.276 #barcode-scan-fab-env-gate
 *   BarcodeScanFab production env-gated hide (호영님 P0: fake success 차단)
 *
 * Root cause:
 *   BarcodeScanFab 은 실제 카메라 없이 mock BOM 파서를 store 에 쓰는
 *   fake success 패턴. production 노출 시 운영 데이터 오염 위험.
 *
 * Fix (minimum diff, 1 file 1 spot):
 *   - NEXT_PUBLIC_FEATURE_BARCODE_SCAN_MOCK !== "true" early return null
 *   - dev/staging 에서 "true" 설정 시 기존 mock 흐름 보존
 *
 * canonical truth lock (§11.142):
 *   - §11.273a createPortal / mounted / useState / useEffect 보존
 *   - button aria-label "바코드 스캔" + lg:hidden + ScanLine 보존
 *   - phase 3-state: "idle" / "scanning" / "ready" 보존
 *   - handleAccept / handleRescan / reset 핸들러 보존
 *   - MOCK_REAGENTS 시약 catalog 보존
 *   - useSmartSourcingStore (setBomText / setActiveTab) wiring 보존
 *   - navigation "/dashboard/quotes?dock=intake&source=bom_import" 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FAB_PATH = resolve(
  __dirname,
  "../../components/layout/barcode-scan-fab.tsx"
);
const fab = readFileSync(FAB_PATH, "utf8");

describe("§11.276 #1 — env gate 적용 검증", () => {
  it("§11.276 trace marker comment 존재", () => {
    expect(fab).toMatch(/§11\.276/);
  });

  it("NEXT_PUBLIC_FEATURE_BARCODE_SCAN_MOCK env var 참조 존재", () => {
    expect(fab).toContain("NEXT_PUBLIC_FEATURE_BARCODE_SCAN_MOCK");
  });

  it("process.env gate + return null early exit 패턴 적용", () => {
    expect(fab).toMatch(
      /process\.env\.NEXT_PUBLIC_FEATURE_BARCODE_SCAN_MOCK[\s\S]{0,50}return null/
    );
  });

  it("env gate 가 !=='true' 조건으로 적용", () => {
    expect(fab).toContain(
      'process.env.NEXT_PUBLIC_FEATURE_BARCODE_SCAN_MOCK !== "true"'
    );
  });
});

describe("§11.276 #2 — §11.273a 구조 invariant 보존", () => {
  it("createPortal import 보존 (§11.273a stacking context 격리)", () => {
    expect(fab).toContain('import { createPortal } from "react-dom"');
  });

  it("mounted state + useEffect setMounted(true) 보존 (SSR hydration safety)", () => {
    expect(fab).toContain("mounted");
    expect(fab).toMatch(/setMounted\(true\)/);
  });

  it("useState import 보존", () => {
    expect(fab).toMatch(/import \{[\s\S]{0,60}useState[\s\S]{0,60}\} from "react"/);
  });

  it("useEffect import 보존", () => {
    expect(fab).toMatch(/import \{[\s\S]{0,60}useEffect[\s\S]{0,60}\} from "react"/);
  });

  it("mounted && createPortal(..., document.body) 패턴 보존", () => {
    expect(fab).toMatch(/mounted && createPortal/);
    expect(fab).toContain("document.body");
  });
});

describe("§11.276 #3 — button 및 phase state invariant 보존", () => {
  it("aria-label '바코드 스캔' 보존 (§11.142 한국어 정합)", () => {
    expect(fab).toContain('aria-label="바코드 스캔"');
  });

  it("onClick={openScanner} + lg:hidden 보존", () => {
    expect(fab).toContain("onClick={openScanner}");
    expect(fab).toContain("lg:hidden");
  });

  it("ScanLine icon import 보존", () => {
    expect(fab).toContain("ScanLine");
  });

  it("phase 3-state ('idle' / 'scanning' / 'ready') 보존", () => {
    expect(fab).toContain('"idle"');
    expect(fab).toContain('"scanning"');
    expect(fab).toContain('"ready"');
  });
});

describe("§11.276 #4 — 핸들러 및 store wiring invariant 보존", () => {
  it("handleAccept / handleRescan / reset 핸들러 보존", () => {
    expect(fab).toContain("handleAccept");
    expect(fab).toContain("handleRescan");
    expect(fab).toContain("const reset");
  });

  it("useSmartSourcingStore (setBomText / setActiveTab) wiring 보존", () => {
    expect(fab).toContain("useSmartSourcingStore");
    expect(fab).toContain("setBomText");
    expect(fab).toContain("setActiveTab");
  });

  it("MOCK_REAGENTS 시약 catalog 보존", () => {
    expect(fab).toContain("MOCK_REAGENTS");
    expect(fab).toContain("Taq DNA Polymerase");
  });

  it("navigation '/dashboard/quotes?dock=intake&source=bom_import' 보존", () => {
    expect(fab).toContain("/dashboard/quotes?dock=intake&source=bom_import");
  });
});
