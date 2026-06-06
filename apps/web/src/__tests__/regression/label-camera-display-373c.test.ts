/**
 * §11.373c (RED→GREEN) — 스마트입고(LabelScannerModal) 카메라 검은 프리뷰 보강
 *
 * 증상(호영님, 모바일 웹 labaxis.co.kr): 스마트입고 카메라가 검은 프리뷰 + "양호" 뱃지만
 *   표시. analyze()가 도는 것(양호 판정) = stream/readyState 정상 → 데이터는 흐르나 화면 검정
 *   = "표시"만 실패.
 *
 * 배포 정합(Vercel MCP): §11.349 직렬화(d89c3828)·§11.373 위장제거(eb596dc2)·§11.373b QR CSS
 *   (b7eafdf6) 전부 prod READY. 둘 다 배포됐는데 잔존 → §11.349(stream race 방지)는 표시 보장
 *   아님 + §11.373b CSS 는 QRScanner 전용 → LabelScanner <video> 표시 보강 누락이 진짜 원인.
 *
 * Root cause: <video> 가 playsInline·muted 만 있고 autoPlay 누락 → iOS Safari 첫 프레임 미렌더.
 * Fix: autoPlay 속성 명시(playsInline·muted 유지) + transform-gpu(GPU 합성 승격).
 *
 * 추정(autoPlay)은 iOS 실기기 의존 → 표시 검정 해소는 ops 실검증이 최종 게이트.
 * sentinel(readFileSync+regex)로 속성·CSS 존재 + §11.349 직렬화 회귀 0 만 검증.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const MODAL = "src/components/inventory/LabelScannerModal.tsx";

describe("§11.373c — LabelScanner 카메라 표시 보강", () => {
  it("video 에 autoPlay·playsInline·muted 3속성 동시 존재", () => {
    const src = read(MODAL);
    // video 엘리먼트 블록에 3속성 모두
    const videoBlock = src.slice(src.indexOf("<video"), src.indexOf("/>", src.indexOf("<video")) + 2);
    expect(videoBlock).toMatch(/autoPlay/);
    expect(videoBlock).toMatch(/playsInline/);
    expect(videoBlock).toMatch(/muted/);
  });

  it("video 표시 합성 보강(transform-gpu) + 채움 클래스 유지", () => {
    const src = read(MODAL);
    expect(src).toMatch(/className="w-full h-full object-cover transform-gpu"/);
  });
});

describe("§11.373c — 회귀 0 (§11.349 직렬화·획득 보존)", () => {
  it("§11.349 in-flight 직렬화(acquiringRef + getRearCameraStream) 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/acquiringRef/);
    expect(src).toMatch(/getRearCameraStream/);
  });

  it("video srcObject 바인딩 + play() 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/videoRef\.current\.srcObject = stream/);
    expect(src).toMatch(/videoRef\.current\.play\(\)/);
  });

  it("analyze 품질 판정(양호/캡처) 경로 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/const analyze = \(\)/);
    expect(src).toMatch(/video\.readyState/);
  });
});
