/**
 * §11.319 시약 라벨 스캔 — 캡처 품질 휴리스틱 (플랫폼 무의존 순수 모듈)
 *
 * ⚠️ DUPLICATED with apps/web/src/lib/ocr/capture-quality.ts
 * 변경 시 양쪽 동기화 필수. 향후 packages/shared 로 추출 예정 (§11.319 후속).
 *
 * Boundary A (호영님 2026-05-29 확정): 캡처 품질 = 클라이언트 이미지 처리.
 * DOM / React Native API 를 import 하지 말 것 (순수 함수 유지).
 */

/* ── 타입 ── */

/** 플랫폼 무의존 입력: 0–255 휘도, row-major (width*height === data.length). */
export interface GrayscaleFrame {
  data: Uint8Array | Uint8ClampedArray | number[];
  width: number;
  height: number;
}

export type QualityVerdict = "good" | "warn" | "poor";

export interface QualityMetric {
  score: number;
  raw: number;
  ok: boolean;
}

export interface FrameQuality {
  blur: QualityMetric;
  lighting: QualityMetric;
  alignment: QualityMetric;
  captureConfidence: number;
  overall: QualityVerdict;
  reasons: string[];
}

export interface AssessOptions {
  blurThreshold?: number;
  minLighting?: number;
  maxLighting?: number;
  blurWeight?: number;
  poorConfidenceFloor?: number;
}

/* ── 상수 ── */

const DEFAULTS = {
  blurThreshold: 100,
  minLighting: 40,
  maxLighting: 215,
  blurWeight: 0.6,
  poorConfidenceFloor: 0.4,
} as const;

const GOOD_BLUR_VARIANCE = 500;
const IDEAL_LUMINANCE = 128;
const DARK_CLIP = 5;
const BRIGHT_CLIP = 250;

/* ── 유틸 ── */

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function at(frame: GrayscaleFrame, x: number, y: number): number {
  return frame.data[y * frame.width + x] as number;
}

function laplacianVariance(frame: GrayscaleFrame): number {
  const { width: w, height: h } = frame;
  if (w < 3 || h < 3) return 0;

  const responses: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const lap =
        4 * at(frame, x, y) -
        at(frame, x - 1, y) -
        at(frame, x + 1, y) -
        at(frame, x, y - 1) -
        at(frame, x, y + 1);
      responses.push(lap);
    }
  }
  if (responses.length === 0) return 0;

  let sum = 0;
  for (const r of responses) sum += r;
  const mean = sum / responses.length;

  let varSum = 0;
  for (const r of responses) {
    const d = r - mean;
    varSum += d * d;
  }
  return varSum / responses.length;
}

function luminanceStats(frame: GrayscaleFrame): {
  mean: number;
  clipFraction: number;
} {
  const n = frame.width * frame.height;
  if (n === 0) return { mean: 0, clipFraction: 1 };

  let sum = 0;
  let clipped = 0;
  for (let i = 0; i < n; i++) {
    const v = frame.data[i] as number;
    sum += v;
    if (v <= DARK_CLIP || v >= BRIGHT_CLIP) clipped++;
  }
  return { mean: sum / n, clipFraction: clipped / n };
}

function alignmentScore(frame: GrayscaleFrame): number {
  const { width: w, height: h } = frame;
  if (w < 3 || h < 3) return 0;

  const rx0 = Math.floor(w * 0.2);
  const rx1 = Math.ceil(w * 0.8);
  const ry0 = Math.floor(h * 0.2);
  const ry1 = Math.ceil(h * 0.8);

  let total = 0;
  let inside = 0;
  const edgeThreshold = 30;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const lap = Math.abs(
        4 * at(frame, x, y) -
          at(frame, x - 1, y) -
          at(frame, x + 1, y) -
          at(frame, x, y - 1) -
          at(frame, x, y + 1),
      );
      if (lap >= edgeThreshold) {
        total++;
        if (x >= rx0 && x < rx1 && y >= ry0 && y < ry1) inside++;
      }
    }
  }
  if (total === 0) return 0;
  return inside / total;
}

/* ── 메인 ── */

export function assessFrameQuality(
  frame: GrayscaleFrame,
  opts: AssessOptions = {},
): FrameQuality {
  const blurThreshold = opts.blurThreshold ?? DEFAULTS.blurThreshold;
  const minLighting = opts.minLighting ?? DEFAULTS.minLighting;
  const maxLighting = opts.maxLighting ?? DEFAULTS.maxLighting;
  const blurWeight = opts.blurWeight ?? DEFAULTS.blurWeight;
  const poorFloor = opts.poorConfidenceFloor ?? DEFAULTS.poorConfidenceFloor;

  const reasons: string[] = [];

  const variance = laplacianVariance(frame);
  const blurOk = variance >= blurThreshold;
  const blur: QualityMetric = {
    raw: variance,
    score: clamp01(variance / GOOD_BLUR_VARIANCE),
    ok: blurOk,
  };
  if (!blurOk) reasons.push("흐림");

  const { mean, clipFraction } = luminanceStats(frame);
  const tooDark = mean < minLighting;
  const tooBright = mean > maxLighting;
  const lightingOk = !tooDark && !tooBright && clipFraction < 0.5;
  const lightingScore = clamp01(
    1 - Math.min(1, Math.abs(mean - IDEAL_LUMINANCE) / IDEAL_LUMINANCE) - clipFraction,
  );
  const lighting: QualityMetric = {
    raw: mean,
    score: lightingScore,
    ok: lightingOk,
  };
  if (tooDark) reasons.push("조명_어두움");
  if (tooBright) reasons.push("조명_과노출");

  const alignRaw = alignmentScore(frame);
  const alignment: QualityMetric = {
    raw: alignRaw,
    score: clamp01(alignRaw),
    ok: alignRaw >= 0.5,
  };

  const captureConfidence = clamp01(
    blurWeight * blur.score + (1 - blurWeight) * lighting.score,
  );

  const failCount = (blurOk ? 0 : 1) + (lightingOk ? 0 : 1);
  let overall: QualityVerdict =
    failCount === 0 ? "good" : failCount === 2 ? "poor" : "warn";
  if (overall !== "poor" && captureConfidence < poorFloor) overall = "poor";

  return { blur, lighting, alignment, captureConfidence, overall, reasons };
}

/* ── OCR 추출 신뢰도 (캡처 품질과 분리) ── */

export type OcrConfidenceLevel = "high" | "medium" | "low";

export function mapOcrConfidence(
  value: number | OcrConfidenceLevel,
): OcrConfidenceLevel {
  if (value === "high" || value === "medium" || value === "low") return value;
  if (value >= 0.85) return "high";
  if (value >= 0.6) return "medium";
  return "low";
}
