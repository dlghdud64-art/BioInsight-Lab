/**
 * §11.380 Phase 2-impl — scan.tsx 카메라 expo-camera → VisionCamera v4 이전
 *
 * 카메라 레이어만 교체(검출 frame processor 는 Phase 3). 바코드 9종/촬영/torch/
 *   권한/포커스 lifecycle 이전 + expo-camera 완전 제거. §11.378 후단 게이트(Phase 1)
 *   및 §11.379 intent 분기 보존(회귀 0).
 *
 * sentinel(readFileSync+regex). 정성 QA(실기기)는 Mac/Apple Developer 시점.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", ".."); // apps/web
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const SCAN = "../mobile/app/scan.tsx";

describe("§11.380 Phase 2-impl — VisionCamera 이전", () => {
  it("expo-camera import/사용 완전 제거", () => {
    const src = read(SCAN);
    // import/사용 제거 검증(마이그레이션 설명 주석의 단어 언급은 허용).
    expect(src).not.toMatch(/from "expo-camera"/);
    expect(src).not.toMatch(/CameraView/);
    expect(src).not.toMatch(/useCameraPermissions/);
    expect(src).not.toMatch(/takePictureAsync/);
  });

  it("VisionCamera v4 API import + alias(lucide Camera 충돌 회피)", () => {
    const src = read(SCAN);
    expect(src).toMatch(/Camera as VisionCamera/);
    expect(src).toMatch(/useCameraDevice/);
    expect(src).toMatch(/useCameraPermission\b/);
    expect(src).toMatch(/useCodeScanner/);
    expect(src).toMatch(/from "react-native-vision-camera"/);
  });

  it("device('back') + 포커스 기반 isActive lifecycle", () => {
    const src = read(SCAN);
    expect(src).toMatch(/useCameraDevice\("back"\)/);
    expect(src).toMatch(/useIsFocused/);
    expect(src).toMatch(/isActive=\{isActive\}/);
    expect(src).toMatch(/isFocused && \(state === "scanning"/);
  });

  it("CodeScanner 바코드 9종(하이픈 표기) + burst 잠금", () => {
    const src = read(SCAN);
    expect(src).toMatch(/"ean-13"/);
    expect(src).toMatch(/"data-matrix"/);
    expect(src).toMatch(/onCodeScanned/);
    expect(src).toMatch(/scanLockRef/);
  });

  it("takePhoto + expo-file-system base64 → scanLabel(dataUri) 계약 유지", () => {
    const src = read(SCAN);
    expect(src).toMatch(/takePhoto\(/);
    expect(src).toMatch(/FileSystem\.readAsStringAsync/);
    expect(src).toMatch(/data:image\/jpeg;base64,/);
    expect(src).toMatch(/scanLabel\(dataUri\)/);
  });

  it("torch 'on'|'off' 매핑 + Camera self-closing(자식 없음)", () => {
    const src = read(SCAN);
    expect(src).toMatch(/torch=\{torch \? "on" : "off"\}/);
    expect(src).toMatch(/<VisionCamera/);
    // 구 CameraView 래핑 구조 제거(닫는 태그 없음)
    expect(src).not.toMatch(/<\/CameraView>/);
  });
});

describe("§11.380 Phase 2-impl — 회귀 0", () => {
  it("§11.378 후단 게이트 보존(productNameDirty / receiveBlocked / confirmLabelReceive 가드)", () => {
    const src = read(SCAN);
    expect(src).toMatch(/productNameDirty/);
    expect(src).toMatch(/receiveBlocked/);
    expect(src).toMatch(/lowConf && !productNameDirty/);
  });

  it("§11.379 intent 분기 + 상태머신 + 라벨 review 보존", () => {
    const src = read(SCAN);
    expect(src).toMatch(/intent === "receive_label"/);
    expect(src).toMatch(/"label-review"/);
    expect(src).toMatch(/confirmLabelReceive/);
  });
});
