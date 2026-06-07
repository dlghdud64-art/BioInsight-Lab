/**
 * §11.380 Phase 2-PoC — VisionCamera dev build config sentinel
 *
 * VisionCamera frame processor(ML Kit 라벨 검출)는 커스텀 네이티브 모듈 →
 *   Expo Go 불가, dev build 필수. config 3종이 갖춰져야 새 dev build 가 frame
 *   processor 를 포함한다:
 *   - babel: react-native-worklets-core/plugin (frame processor worklet 컴파일)
 *   - app.json plugins: react-native-vision-camera (권한/네이티브 링크)
 *   - eas.json: development 프로파일(developmentClient) — 기존 보존 확인
 *
 * sentinel(readFileSync+regex). 최종 검증은 실기기 dev build(호영님).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", ".."); // apps/web
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const BABEL = "../mobile/babel.config.js";
const APP_JSON = "../mobile/app.json";
const EAS_JSON = "../mobile/eas.json";

describe("§11.380 Phase 2 — VisionCamera config", () => {
  it("babel: worklets-core plugin 등록", () => {
    const src = read(BABEL);
    expect(src).toMatch(/react-native-worklets-core\/plugin/);
    // 기존 nativewind preset 보존(회귀 0)
    expect(src).toMatch(/nativewind\/babel/);
  });

  it("app.json: react-native-vision-camera plugin + 권한 문구", () => {
    const src = read(APP_JSON);
    expect(src).toMatch(/"react-native-vision-camera"/);
    expect(src).toMatch(/"enableCodeScanner":\s*true/);
    expect(src).toMatch(/카메라 접근이 필요합니다/);
  });

  it("eas.json: development 프로파일(devClient) 보존 — 회귀 0", () => {
    const src = read(EAS_JSON);
    expect(src).toMatch(/"development"/);
    expect(src).toMatch(/"developmentClient":\s*true/);
  });

  it("eas.json: dev 빌드 Sentry source map 자동 업로드 비활성(SENTRY_ORG 없어 fail-loud 회피)", () => {
    const src = read(EAS_JSON);
    // @sentry/react-native/expo 가 dev build 시 sentry-cli 업로드 시도 → org 없으면 Xcode fail.
    //   dev env 에서만 비활성(prod 무관).
    expect(src).toMatch(/"SENTRY_DISABLE_AUTO_UPLOAD":\s*"true"/);
  });

  it("app.json: 기존 expo-camera/expo-router plugin 보존(Phase 2-impl 이전엔 병존)", () => {
    const src = read(APP_JSON);
    expect(src).toMatch(/"expo-router"/);
    expect(src).toMatch(/"expo-camera"/);
  });
});
