/**
 * §11.373 / §11.373-web-QR-replace — QR 스캐너 검은화면 (라이브러리 교체)
 *
 * 경위:
 *   §11.373  html5-qrcode start 직렬화 + verifyVideoActive 위장제거.
 *   §11.373b verifyVideoActive 렌더박스 검증 + [&_video] CSS 강제.
 *   §11.373c LabelScanner <video> autoPlay → 검정 해소(직접 video 라 적중).
 *   §11.373d html5-qrcode 내부 video 에 start 후 autoplay 동적 주입 → prod 배포(d1fd6a1d)
 *            후에도 QR 검정 반복 = 주입 효과 없음(라이브러리가 만든 video 구조/타이밍 한계).
 *   → 교체: html5-qrcode → nimiq/qr-scanner. <video> 를 우리가 직접 렌더(autoPlay·playsInline·
 *            muted)해 라이브러리에 넘김 = §11.373c 와 동일 근본으로 iOS Safari 첫 프레임 보장.
 *
 * 시각/실제 카메라는 단위테스트 한계 → sentinel(readFileSync+regex) + iOS 실기기 smoke(ops 최종).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const QR = "src/components/inventory/QRScanner.tsx";
const PKG = "package.json";

describe("§11.373-web-QR-replace — qr-scanner 교체", () => {
  it("qr-scanner 동적 import (SSR/worker 안전) + html5-qrcode 미사용", () => {
    const src = read(QR);
    expect(src).toMatch(/import\("qr-scanner"\)/);
    expect(src).not.toMatch(/from ["']html5-qrcode["']/);
    expect(src).not.toMatch(/import\("html5-qrcode"\)/);
  });

  it("package.json: html5-qrcode 제거 + qr-scanner 추가", () => {
    const pkg = read(PKG);
    expect(pkg).toMatch(/"qr-scanner":/);
    expect(pkg).not.toMatch(/"html5-qrcode":/);
  });
});

describe("§11.373-web-QR-replace — <video> 직접 렌더(iOS 검정 근본 해결)", () => {
  it("video 에 autoPlay·playsInline·muted 직접 부착(우리가 렌더)", () => {
    const src = read(QR);
    const vb = src.slice(src.indexOf("<video"), src.indexOf("/>", src.indexOf("<video")) + 2);
    expect(vb).toMatch(/ref=\{videoRef\}/);
    expect(vb).toMatch(/autoPlay/);
    expect(vb).toMatch(/playsInline/);
    expect(vb).toMatch(/muted/);
  });

  it("QrScanner 에 videoRef 전달 + returnDetailedScanResult(result.data)", () => {
    const src = read(QR);
    expect(src).toMatch(/new QrScanner\(\s*videoRef\.current/);
    expect(src).toMatch(/returnDetailedScanResult: true/);
    expect(src).toMatch(/result\.data/);
    expect(src).toMatch(/preferredCamera: "environment"/);
  });
});

describe("§11.373 — 회귀 0 (보존 항목)", () => {
  it("start in-flight 직렬화 가드 보존", () => {
    const src = read(QR);
    expect(src).toMatch(/startingRef/);
    expect(src).toMatch(/if \(startingRef\.current\) return/);
  });

  it("정지/언마운트 시 destroy() 정리(stream·worker)", () => {
    const src = read(QR);
    expect(src).toMatch(/\.destroy\(\)/);
    expect(src).toMatch(/mountedRef\.current = false/);
  });

  it("권한/NotReadable 에러 분기 + 직접입력 전환 보존", () => {
    const src = read(QR);
    expect(src).toMatch(/NotAllowedError/);
    expect(src).toMatch(/NotReadableError/);
    expect(src).toMatch(/onSwitchToManual/);
  });

  it("ScanGuideFrame(showScanLine) + scanning 조건 보존(§11.374)", () => {
    const src = read(QR);
    expect(src).toMatch(/import \{ ScanGuideFrame \} from "\.\/ScanGuideFrame"/);
    expect(src).toMatch(/<ScanGuideFrame[^>]*showScanLine/);
    expect(src).toMatch(/state === "scanning"/);
  });
});
