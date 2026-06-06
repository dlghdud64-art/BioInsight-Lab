/**
 * §11.373 (RED→GREEN) — QR 스캐너 검은화면
 *
 * 증상(호영님): QR 스캐너 검은화면. 거래명세서/라벨 카메라는 양호 → QR 경로만 실패.
 *   재오픈/다시시도 시 발현(비결정).
 *
 * Root cause (bug-hunter TR):
 *   H2-QR — stopScanner()↔start() race. html5-qrcode stop() resolve 후에도 내부
 *           video track 정리 미완 상태에서 새 start() getUserMedia → device 점유
 *           충돌 → start 는 형식상 resolve 하나 video 검은.
 *   H3-QR — start resolve = 성공 간주(setState "scanning") → videoWidth 0 이어도
 *           에러 미표시 = 검은화면 위장.
 *
 * Fix:
 *   - startingRef in-flight 가드(중복 start 차단).
 *   - stopScanner 후 yield → 이전 트랙 정리 틈 확보.
 *   - start resolve 후 video 활성(videoWidth) 점검 → 0 이면 에러(위장 금지).
 *
 * §11.349 와 동일 직렬화 논리(H 무관 안전). 시각 회귀는 단위테스트 한계 →
 * sentinel(readFileSync+regex) + 실기기 재오픈 smoke(ops 최종).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const QR = "src/components/inventory/QRScanner.tsx";

describe("§11.373 — start 직렬화 (H2 in-flight 가드)", () => {
  it("startingRef in-flight 가드 존재", () => {
    const src = read(QR);
    expect(src).toMatch(/startingRef/);
    // 진행 중이면 중복 start 차단
    expect(src).toMatch(/if \(startingRef\.current\)/);
  });
});

describe("§11.373 — 검은화면 위장 제거 (H3)", () => {
  it("start resolve 후 video 활성(videoWidth) 점검", () => {
    const src = read(QR);
    expect(src).toMatch(/videoWidth/);
  });

  it("video 비활성 시 scanning 위장 대신 error 처리", () => {
    const src = read(QR);
    // 위장 점검 실패 분기에서 error state + 안내 메시지
    expect(src).toMatch(/카메라 화면을 표시할 수 없습니다/);
  });
});

describe("§11.373b — 가시성 검증 + video 표시 강제 (검은화면 잔존 보강)", () => {
  it("verifyVideoActive 가 렌더 박스(getBoundingClientRect)까지 검증", () => {
    const src = read(QR);
    // intrinsic videoWidth 만으론 0높이/숨김 video 가 통과 → 실제 렌더 크기 확인
    expect(src).toMatch(/getBoundingClientRect/);
    expect(src).toMatch(/rect\.width > 0 && rect\.height > 0/);
  });

  it("html5-qrcode video 를 컨테이너에 강제로 채우는 CSS", () => {
    const src = read(QR);
    expect(src).toMatch(/\[&_video\]:!w-full/);
    expect(src).toMatch(/\[&_video\]:!h-full/);
    expect(src).toMatch(/\[&_video\]:!object-cover/);
  });
});

describe("§11.373d — html5-qrcode 내부 video autoplay/playsinline 주입 (iOS 검정 근본)", () => {
  it("start 후 DOM video 에 autoplay·playsinline setAttribute 주입", () => {
    const src = read(QR);
    expect(src).toMatch(/setAttribute\("autoplay", "true"\)/);
    expect(src).toMatch(/setAttribute\("playsinline", "true"\)/);
  });

  it("주입 후 play() 재호출(첫 프레임 트리거)", () => {
    const src = read(QR);
    expect(src).toMatch(/injectedVideo\.play\(\)/);
  });

  it("주입은 verifyVideoActive 검증 이전에 수행", () => {
    const src = read(QR);
    const injectIdx = src.indexOf('setAttribute("autoplay"');
    const verifyIdx = src.indexOf("const active = await verifyVideoActive(id)");
    expect(injectIdx).toBeGreaterThan(0);
    expect(verifyIdx).toBeGreaterThan(injectIdx);
  });
});

describe("§11.373 — 회귀 0 (기존 lifecycle 보존)", () => {
  it("stopScanner / mountedRef cleanup 보존", () => {
    const src = read(QR);
    expect(src).toMatch(/const stopScanner = useCallback/);
    expect(src).toMatch(/mountedRef\.current = false/);
    expect(src).toMatch(/await stopScanner\(\)/);
  });

  it("html5-qrcode 2단계 fallback(exact→loose environment) 보존", () => {
    const src = read(QR);
    expect(src).toMatch(/facingMode: \{ exact: "environment" \}/);
    expect(src).toMatch(/facingMode: "environment"/);
  });

  it("권한/NotReadable 에러 분기 보존", () => {
    const src = read(QR);
    expect(src).toMatch(/NotAllowedError/);
    expect(src).toMatch(/NotReadableError/);
  });
});
