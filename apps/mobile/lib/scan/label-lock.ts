/**
 * §11.380 Phase 3 — 라벨 검출 lock 상태머신 (순수 / 플랫폼·frame processor 무의존)
 *
 * ⚠️ 경계 (§11.375 교훈): 라이브 lock 은 "텍스트가 충분히 감지됨 → 촬영 권장" 신호일 뿐,
 *   라벨 진위/정합 판정이 아니다. 촬영 전 라이브 정합 판정은 false neg/pos 양방향으로
 *   구조적 불가. 라벨 진위는 OCR 후단 게이트(§11.378)가 단일 판정한다.
 *   여기서 locked = 햅틱/가이드색/촬영강조 신호 트리거에만 쓴다(막다른 길 금지: idle 여도 수동 촬영 가능).
 *
 * 디바운스: 연속 enterFrames 감지 → locked, 연속 exitFrames 미감지 → idle (양방향 깜빡임 방지).
 * 햅틱: idle→locked 전이 순간 1회만(연속 진동 금지).
 *
 * 순수 함수만 둔다(React/RN/VisionCamera import 금지) → vitest 단위 검증 가능.
 */

export type LockState = "idle" | "locked";

export interface LockConfig {
  /** resultText 길이 임계(라벨로 볼 최소 텍스트량). */
  minTextLength: number;
  /** 텍스트 블록 수 임계. */
  minBlocks: number;
  /** 연속 감지 N프레임 후 locked 전이(깜빡임 방지). */
  enterFrames: number;
  /** 연속 미감지 N프레임 후 idle 복귀. */
  exitFrames: number;
}

/** 디바이스 튜닝 전 기본값(실기기 QA 시 조정). */
export const DEFAULT_LOCK_CONFIG: LockConfig = {
  minTextLength: 12,
  minBlocks: 2,
  enterFrames: 3,
  exitFrames: 3,
};

export interface LockRuntime {
  state: LockState;
  /** 연속 감지 카운터. */
  hitStreak: number;
  /** 연속 미감지 카운터. */
  missStreak: number;
}

export function initialLockRuntime(): LockRuntime {
  return { state: "idle", hitStreak: 0, missStreak: 0 };
}

/** 프레임당 검출 요약(frame processor 가 resultText 길이/블록 수만 추출해 전달). */
export interface FrameSignal {
  textLength: number;
  blockCount: number;
}

/** 이 프레임이 "라벨처럼 보이는가"(텍스트량+블록수 임계). */
export function isLabelLike(sig: FrameSignal, cfg: LockConfig): boolean {
  return sig.textLength >= cfg.minTextLength && sig.blockCount >= cfg.minBlocks;
}

export interface LockStep {
  next: LockRuntime;
  /** idle→locked 전이 순간만 true (햅틱 1회 트리거). 그 외 항상 false. */
  haptic: boolean;
}

/**
 * 프레임 신호 1개를 받아 상태머신을 1스텝 전진.
 * - 반환 next 를 다음 호출에 다시 넣는다(누적 카운터 보존).
 * - haptic 은 전이 순간에만 true.
 */
export function stepLock(
  prev: LockRuntime,
  sig: FrameSignal,
  cfg: LockConfig = DEFAULT_LOCK_CONFIG,
): LockStep {
  const labelLike = isLabelLike(sig, cfg);

  let hitStreak = labelLike ? prev.hitStreak + 1 : 0;
  let missStreak = labelLike ? 0 : prev.missStreak + 1;
  let state = prev.state;
  let haptic = false;

  if (state === "idle" && hitStreak >= cfg.enterFrames) {
    state = "locked";
    haptic = true; // 전이 1회만
  } else if (state === "locked" && missStreak >= cfg.exitFrames) {
    state = "idle";
  }

  return { next: { state, hitStreak, missStreak }, haptic };
}
