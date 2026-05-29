/**
 * §11.319 Phase 1 (RED) — capture-quality 휴리스틱 단위 테스트
 *
 * Boundary A (호영님 2026-05-29 확정): 캡처 품질 = 클라이언트 이미지 처리.
 *   audit/MutationAuditEvent(§11.290 Phase 5)와 영역 분리.
 *
 * 검증 대상 (플랫폼 무의존 순수 함수):
 *   - assessFrameQuality(frame, opts): 흐림(blur) + 조명(lighting) + 정합(alignment)
 *     → captureConfidence(0–1) + overall("good"|"warn"|"poor") + reasons[]
 *   - mapOcrConfidence(numeric|level): OCR 추출 신뢰도 → badge level (캡처 품질과 분리)
 *
 * Phase 1 범위: 흐림 + 조명만 gating. alignment 는 비차단(neutral). tilt 는 OUT.
 *
 * 이 시점에서 capture-quality.ts 는 미존재 → import 실패 = RED.
 */
import { describe, it, expect } from "vitest";
import {
  assessFrameQuality,
  mapOcrConfidence,
  type GrayscaleFrame,
} from "../capture-quality";

/* ── 합성 프레임 빌더 ── */

/** 균일(흐림) 프레임 — Laplacian 분산 ≈ 0 */
function uniformFrame(value: number, width = 16, height = 16): GrayscaleFrame {
  return { data: new Uint8Array(width * height).fill(value), width, height };
}

/** 체커보드(선명) 프레임 — high/low 교차로 Laplacian 분산 큼 */
function checkerFrame(
  hi: number,
  lo: number,
  width = 16,
  height = 16,
): GrayscaleFrame {
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = (x + y) % 2 === 0 ? hi : lo;
    }
  }
  return { data, width, height };
}

describe("§11.319 capture-quality — assessFrameQuality", () => {
  it("선명한(체커보드) + 적정 노출 프레임 → overall good, 흐림/조명 통과", () => {
    const q = assessFrameQuality(checkerFrame(200, 80));
    expect(q.blur.ok).toBe(true);
    expect(q.lighting.ok).toBe(true);
    expect(q.overall).toBe("good");
    expect(q.reasons).toHaveLength(0);
    expect(q.captureConfidence).toBeGreaterThanOrEqual(0);
    expect(q.captureConfidence).toBeLessThanOrEqual(1);
  });

  it("균일(흐림) 프레임 → blur.ok=false, reasons 에 흐림 키, overall warn/poor", () => {
    const q = assessFrameQuality(uniformFrame(128));
    expect(q.blur.ok).toBe(false);
    expect(q.reasons).toContain("흐림");
    expect(["warn", "poor"]).toContain(q.overall);
  });

  it("선명하지만 어두운 프레임 → lighting.ok=false, reasons 에 조명 키", () => {
    // 선명도는 유지(체커보드)하되 전체 휘도 낮춤 → 조명만 실패
    const q = assessFrameQuality(checkerFrame(40, 5));
    expect(q.blur.ok).toBe(true);
    expect(q.lighting.ok).toBe(false);
    expect(q.reasons).toContain("조명_어두움");
  });

  it("과노출(거의 흰색) 프레임 → lighting.ok=false, reasons 에 과노출 키", () => {
    const q = assessFrameQuality(uniformFrame(252));
    expect(q.lighting.ok).toBe(false);
    expect(q.reasons).toContain("조명_과노출");
  });

  it("흐림 + 어두움 동시 → overall poor (재촬영 강권)", () => {
    const q = assessFrameQuality(uniformFrame(8));
    expect(q.overall).toBe("poor");
    expect(q.captureConfidence).toBeLessThan(0.4);
  });

  it("opts.blurThreshold 로 임계값 주입 가능", () => {
    const sharp = checkerFrame(200, 80);
    const strict = assessFrameQuality(sharp, { blurThreshold: 1e9 });
    expect(strict.blur.ok).toBe(false); // 비현실적 임계값 → 모두 실패
  });

  it("alignment 는 Phase 1 에서 비차단(neutral) — overall 을 막지 않음", () => {
    const q = assessFrameQuality(checkerFrame(200, 80));
    // alignment 정보는 제공하되, ok=false 여도 흐림/조명 통과 시 good 유지
    expect(q.alignment).toBeDefined();
    expect(typeof q.alignment.score).toBe("number");
    expect(q.overall).toBe("good");
  });
});

describe("§11.319 capture-quality — mapOcrConfidence (OCR 신뢰도, 캡처와 분리)", () => {
  it("numeric ≥0.85 → high (run-ocr-pipeline 임계값 정합)", () => {
    expect(mapOcrConfidence(0.9)).toBe("high");
    expect(mapOcrConfidence(0.85)).toBe("high");
  });

  it("numeric ≥0.6 && <0.85 → medium", () => {
    expect(mapOcrConfidence(0.7)).toBe("medium");
    expect(mapOcrConfidence(0.6)).toBe("medium");
  });

  it("numeric <0.6 → low", () => {
    expect(mapOcrConfidence(0.3)).toBe("low");
    expect(mapOcrConfidence(0)).toBe("low");
  });

  it("이미 level 문자열이면 그대로 통과(idempotent)", () => {
    expect(mapOcrConfidence("high")).toBe("high");
    expect(mapOcrConfidence("medium")).toBe("medium");
    expect(mapOcrConfidence("low")).toBe("low");
  });
});

describe("§11.319 회귀 0 — 기존 OCR 계약 보존 명세", () => {
  it("capture-quality 는 순수 모듈(플랫폼/DOM 의존 import 금지)", () => {
    // 이 describe 는 capture-quality.ts 구현 시 DOM/RN import 가 새지 않도록
    // 하는 sentinel placeholder. Phase 1 GREEN 후 readFileSync 패턴으로 강화.
    expect(typeof assessFrameQuality).toBe("function");
    expect(typeof mapOcrConfidence).toBe("function");
  });
});
