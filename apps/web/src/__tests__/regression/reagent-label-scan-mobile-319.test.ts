/**
 * §11.319 Phase 2 (RED) — 모바일 시약 라벨 스캔(OCR) + 가이드 프레임 sentinel
 *
 * Boundary A (호영님 2026-05-29): 모바일 = OCR 라벨 촬영 플로우 + OCR 신뢰도
 *   기반 재촬영 권유(수동 캡처 중심). 클라이언트 흐림/조명 휴리스틱은 웹 전용.
 *   신규 dep 0. 가이드 프레임 UI 는 카메라 위 View 오버레이(프레임 픽셀 접근 불필요).
 *
 * 모바일은 자체 test runner 가 없어, 기존 패턴대로 web vitest 가 repo-root
 * 상대경로로 모바일 파일을 readFileSync + regex 검증한다 (CLAUDE.md sentinel).
 *
 * 이 시점에서 scan.tsx 의 OCR 모드 / capture-quality 모바일 복제 / scanLabel
 * helper / register prefill 확장이 미구현 → RED.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// REPO_ROOT 기존 sentinel 패턴은 apps/web 기준(3 up). 모바일 접근은 +2 up.
const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const REPO_ROOT = join(APP_WEB_ROOT, "..", "..");

function readRepo(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const SCAN_PATH = "apps/mobile/app/scan.tsx";
const CQ_MOBILE_PATH = "apps/mobile/lib/ocr/capture-quality.ts";
const USEAPI_PATH = "apps/mobile/hooks/useApi.ts";
const REGISTER_PATH = "apps/mobile/app/purchases/register.tsx";

describe("§11.319 Phase 2 — 모바일 capture-quality 복제", () => {
  it("apps/mobile/lib/ocr/capture-quality.ts 존재", () => {
    expect(existsSync(join(REPO_ROOT, CQ_MOBILE_PATH))).toBe(true);
  });

  it("복제 동기화 경고 주석 + 핵심 export 보유", () => {
    const src = readRepo(CQ_MOBILE_PATH);
    expect(src).toMatch(/DUPLICATED with apps\/web\/src\/lib\/ocr\/capture-quality\.ts/);
    expect(src).toMatch(/export function assessFrameQuality/);
    expect(src).toMatch(/export function mapOcrConfidence/);
  });

  it("순수 모듈 — RN/DOM import 금지", () => {
    const src = readRepo(CQ_MOBILE_PATH);
    expect(src).not.toMatch(/from ["']react-native["']/);
    expect(src).not.toMatch(/from ["']expo-/);
    expect(src).not.toMatch(/document\.|window\./);
  });
});

describe("§11.319 Phase 2 — useApi scanLabel helper", () => {
  it("scanLabel export + /api/inventory/scan-label POST", () => {
    const src = readRepo(USEAPI_PATH);
    expect(src).toMatch(/export async function scanLabel/);
    expect(src).toMatch(/\/api\/inventory\/scan-label/);
    expect(src).toMatch(/imageBase64/);
  });
});

describe("§11.319 Phase 2 — scan.tsx OCR 라벨 모드", () => {
  it("OCR 라벨 촬영/검토 상태 추가", () => {
    const src = readRepo(SCAN_PATH);
    expect(src).toMatch(/label-capture/);
    expect(src).toMatch(/label-review/);
  });

  it("바코드/라벨 모드 토글 노출", () => {
    const src = readRepo(SCAN_PATH);
    // 사용자 전환 UI — "라벨" 라벨 + 모드 state
    expect(src).toMatch(/라벨/);
    expect(src).toMatch(/scanMode|captureMode|mode === ["']label["']/);
  });

  it("takePhoto 로 촬영 후 scanLabel 호출 (§11.380 VisionCamera v4 이전)", () => {
    const src = readRepo(SCAN_PATH);
    expect(src).toMatch(/takePhoto/); // 구 expo takePictureAsync → VisionCamera takePhoto
    expect(src).toMatch(/scanLabel/);
    expect(src).toMatch(/base64/);
  });

  it("OCR 신뢰도 badge — mapOcrConfidence 사용", () => {
    const src = readRepo(SCAN_PATH);
    expect(src).toMatch(/mapOcrConfidence/);
    expect(src).toMatch(/신뢰도/);
  });

  it("저신뢰 시 재촬영 권유(비차단)", () => {
    const src = readRepo(SCAN_PATH);
    expect(src).toMatch(/재촬영/);
  });

  it("가이드 프레임 오버레이 + 라벨 안내 유지", () => {
    const src = readRepo(SCAN_PATH);
    // 코너 프레임 View 패턴 보존
    expect(src).toMatch(/border-t-4|border-l-4|가이드 프레임/);
    expect(src).toMatch(/라벨/);
  });

  it("편집 가능 폼 — 추출 필드 입력", () => {
    const src = readRepo(SCAN_PATH);
    // 최소 productName / lotNumber / expiration 편집 필드
    expect(src).toMatch(/productName/);
    expect(src).toMatch(/lotNo|lotNumber/);
  });

  it("입고 prefill — register/lot-receive 라우팅에 추출값 전달", () => {
    const src = readRepo(SCAN_PATH);
    expect(src).toMatch(/purchases\/register|inventory\/lot-receive/);
    // prefill 파라미터로 추출 데이터 전달
    expect(src).toMatch(/catalogNumber|lotNumber|productName/);
  });
});

describe("§11.319 Phase 2 — register prefill 확장(additive)", () => {
  it("QuickEntryForm 이 catalogNumber/quantity prefill 수신", () => {
    const src = readRepo(REGISTER_PATH);
    expect(src).toMatch(/catalogNumber\?:/);
    expect(src).toMatch(/quantity\?:/);
  });
});

describe("§11.319 Phase 2 — 회귀 0 (바코드 모드 보존)", () => {
  it("바코드 스캔 핵심 wiring 보존 (§11.380 VisionCamera CodeScanner)", () => {
    const src = readRepo(SCAN_PATH);
    // 구 expo handleBarCodeScanned/barcodeScannerSettings/onBarcodeScanned → VisionCamera useCodeScanner/codeScanner prop.
    expect(src).toMatch(/useCodeScanner/);
    expect(src).toMatch(/lookupInventory/);
    expect(src).toMatch(/codeScanner=\{/);
  });

  it("기존 상태/액션 분기 보존", () => {
    const src = readRepo(SCAN_PATH);
    expect(src).toMatch(/matched/);
    expect(src).toMatch(/unmatched/);
    expect(src).toMatch(/manual/);
    expect(src).toMatch(/useCameraPermission\b/); // 구 expo useCameraPermissions → VisionCamera useCameraPermission
  });

  it("매칭 성공 액션(입고/출고/라벨/위치) 보존", () => {
    const src = readRepo(SCAN_PATH);
    expect(src).toMatch(/lot-receive/);
    expect(src).toMatch(/lot-dispatch/);
    expect(src).toMatch(/lot-label/);
    expect(src).toMatch(/lot-location/);
  });
});
