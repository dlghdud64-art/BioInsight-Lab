/**
 * §11.319 시약 라벨 스캔 — 캡처 품질 휴리스틱 (플랫폼 무의존 순수 모듈)
 *
 * Boundary A (호영님 2026-05-29 확정): 캡처 품질 = 클라이언트 이미지 처리.
 *   audit / MutationAuditEvent (§11.290 Phase 5) 와 영역 분리.
 *   captureConfidence(캡처 품질) ↔ mapOcrConfidence(OCR 추출 신뢰도) 명시 분리.
 *
 * 입력은 플랫폼 무의존 grayscale 휘도 버퍼(GrayscaleFrame). 플랫폼 어댑터가
 * RGB→luminance 변환을 담당한다:
 *   - web   : canvas getImageData → luminance → GrayscaleFrame
 *   - mobile: expo-camera takePictureAsync → downsample → luminance → GrayscaleFrame
 *
 * verdict 흐름 (호영님 spec):
 *   - good : 자동 캡처 허용
 *   - warn : 사용자 안내 후 수동 캡처 허용
 *   - poor : 캡처 차단 (재촬영 강권)
 *
 * ⚠️ DUPLICATED with apps/mobile/lib/ocr/capture-quality.ts
 * 변경 시 양쪽 동기화 필수. 향후 packages/shared 로 추출 예정 (§11.319 후속).
 *
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
  /** 정규화 점수 0–1 (높을수록 좋음). */
  score: number;
  /** 원시 측정값 (blur=Laplacian 분산, lighting=평균 휘도, alignment=중앙 ROI 집중도). */
  raw: number;
  /** 임계값 통과 여부. */
  ok: boolean;
}

export interface FrameQuality {
  blur: QualityMetric;
  lighting: QualityMetric;
  /** Phase 1: 비차단(neutral) — overall 을 막지 않음. */
  alignment: QualityMetric;
  /** 0–1 캡처 품질 집계 (OCR 추출 신뢰도와 별개). */
  captureConfidence: number;
  overall: QualityVerdict;
  /** 한국어 안내 키 (UI 토스트/배지 매핑용): "흐림" | "조명_어두움" | "조명_과노출". */
  reasons: string[];
}

export interface AssessOptions {
  /** Laplacian 분산 최소 임계값 (이상이면 선명). 기본 100. */
  blurThreshold?: number;
  /** 평균 휘도 하한 (미만이면 어두움). 기본 40. */
  minLighting?: number;
  /** 평균 휘도 상한 (초과면 과노출). 기본 215. */
  maxLighting?: number;
  /** captureConfidence 가중치: blur 비중 (나머지는 lighting). 기본 0.6. */
  blurWeight?: number;
  /** poor 판정 captureConfidence 하한. 기본 0.4. */
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

/** 완전 선명으로 간주하는 Laplacian 분산 기준 (score 정규화용). */
const GOOD_BLUR_VARIANCE = 500;
/** 이상적 평균 휘도 (중앙값). */
const IDEAL_LUMINANCE = 128;
/** 클리핑 판정 휘도 (어두움/밝음 극단). */
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

/**
 * variance-of-Laplacian (선명도). 3x3 Laplacian 커널을 내부 픽셀에 적용,
 * 응답값의 분산을 반환. 흐릴수록 0 에 수렴.
 */
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

/** 평균 휘도 + 클리핑 비율. */
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

/**
 * 정합(alignment) — 강한 그래디언트(엣지)가 중앙 ROI 에 얼마나 모여있는지.
 * 라벨이 프레임 중앙에 채워질수록 1 에 수렴. Phase 1 비차단.
 */
function alignmentScore(frame: GrayscaleFrame): number {
  const { width: w, height: h } = frame;
  if (w < 3 || h < 3) return 0;

  // 중앙 60% ROI
  const rx0 = Math.floor(w * 0.2);
  const rx1 = Math.ceil(w * 0.8);
  const ry0 = Math.floor(h * 0.2);
  const ry1 = Math.ceil(h * 0.8);

  let total = 0;
  let inside = 0;
  const edgeThreshold = 30; // |Laplacian| 강한 엣지 기준

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

/**
 * 프레임 캡처 품질 평가. 흐림 + 조명은 gating, alignment 는 Phase 1 비차단.
 */
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

  // ── 흐림 ──
  const variance = laplacianVariance(frame);
  const blurOk = variance >= blurThreshold;
  const blur: QualityMetric = {
    raw: variance,
    score: clamp01(variance / GOOD_BLUR_VARIANCE),
    ok: blurOk,
  };
  if (!blurOk) reasons.push("흐림");

  // ── 조명 ──
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

  // ── 정합 (비차단) ──
  const alignRaw = alignmentScore(frame);
  const alignment: QualityMetric = {
    raw: alignRaw,
    score: clamp01(alignRaw),
    ok: alignRaw >= 0.5,
  };

  // ── 집계 ──
  const captureConfidence = clamp01(
    blurWeight * blur.score + (1 - blurWeight) * lighting.score,
  );

  const failCount = (blurOk ? 0 : 1) + (lightingOk ? 0 : 1);
  let overall: QualityVerdict =
    failCount === 0 ? "good" : failCount === 2 ? "poor" : "warn";
  if (overall !== "poor" && captureConfidence < poorFloor) overall = "poor";
  // §11.375 — alignment 게이트(라벨 정합 진짜화). blur+조명만으론 키보드·잡동사니도 good
  //   (가짜 "양호" 신호 → 오입고 유발). 중앙 ROI 엣지 집중(alignment.ok) 미달 시 good→warn 격하:
  //   라벨이 프레임 중앙에 채워져야만 "양호". poor 는 유지(더 약화 안 함).
  if (overall === "good" && !alignment.ok) {
    overall = "warn";
    reasons.push("정합_미흡");
  }

  return { blur, lighting, alignment, captureConfidence, overall, reasons };
}

/* ── OCR 추출 신뢰도 (캡처 품질과 분리) ── */

export type OcrConfidenceLevel = "high" | "medium" | "low";

/**
 * OCR 추출 신뢰도 → badge level. run-ocr-pipeline 임계값 정합(≥0.85 high,
 * ≥0.6 medium). 이미 level 문자열이면 idempotent 통과.
 * ⚠️ captureConfidence(클라이언트 캡처 품질) 와 혼용 금지.
 */
export function mapOcrConfidence(
  value: number | OcrConfidenceLevel,
): OcrConfidenceLevel {
  if (value === "high" || value === "medium" || value === "low") return value;
  if (value >= 0.85) return "high";
  if (value >= 0.6) return "medium";
  return "low";
}
