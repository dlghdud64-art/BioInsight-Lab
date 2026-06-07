/**
 * §11.380 Phase 3 — 라벨 lock 상태머신 단위 검증 (실 import, 순수 로직)
 *
 * label-lock.ts 는 RN/VisionCamera 무의존 순수 모듈 → 실기기 없이 vitest 로 직접 검증.
 *   - enterFrames 연속 감지 후에만 locked + 햅틱 1회
 *   - locked 중 추가 감지엔 햅틱 재발생 0(연속 진동 금지)
 *   - exitFrames 연속 미감지 후 idle 복귀
 *   - 깜빡임(감지/미감지 교대)은 절대 locked 안 됨
 */
import { describe, it, expect } from "vitest";
import {
  initialLockRuntime,
  stepLock,
  isLabelLike,
  DEFAULT_LOCK_CONFIG,
  type LockRuntime,
  type FrameSignal,
} from "../../../../mobile/lib/scan/label-lock";

const HIT: FrameSignal = { textLength: 40, blockCount: 4 };
const MISS: FrameSignal = { textLength: 0, blockCount: 0 };
const cfg = DEFAULT_LOCK_CONFIG;

function run(seq: FrameSignal[]): { rt: LockRuntime; haptics: number } {
  let rt = initialLockRuntime();
  let haptics = 0;
  for (const s of seq) {
    const { next, haptic } = stepLock(rt, s, cfg);
    rt = next;
    if (haptic) haptics++;
  }
  return { rt, haptics };
}

describe("§11.380 — isLabelLike 임계", () => {
  it("텍스트량+블록수 둘 다 충족해야 라벨로 판정", () => {
    expect(isLabelLike({ textLength: 40, blockCount: 4 }, cfg)).toBe(true);
    expect(isLabelLike({ textLength: 5, blockCount: 4 }, cfg)).toBe(false); // 텍스트 부족
    expect(isLabelLike({ textLength: 40, blockCount: 1 }, cfg)).toBe(false); // 블록 부족
  });
});

describe("§11.380 — lock 전이 + 햅틱 1회", () => {
  it("enterFrames 미만 감지는 idle 유지(조기 locked 금지)", () => {
    const { rt, haptics } = run(Array(cfg.enterFrames - 1).fill(HIT));
    expect(rt.state).toBe("idle");
    expect(haptics).toBe(0);
  });

  it("enterFrames 연속 감지 → locked + 햅틱 정확히 1회", () => {
    const { rt, haptics } = run(Array(cfg.enterFrames).fill(HIT));
    expect(rt.state).toBe("locked");
    expect(haptics).toBe(1);
  });

  it("locked 이후 계속 감지돼도 햅틱 재발생 0(연속 진동 금지)", () => {
    const { rt, haptics } = run(Array(cfg.enterFrames + 10).fill(HIT));
    expect(rt.state).toBe("locked");
    expect(haptics).toBe(1);
  });
});

describe("§11.380 — idle 복귀 + 깜빡임 방지", () => {
  it("locked 후 exitFrames 연속 미감지 → idle", () => {
    const seq = [
      ...Array(cfg.enterFrames).fill(HIT),
      ...Array(cfg.exitFrames).fill(MISS),
    ];
    const { rt } = run(seq);
    expect(rt.state).toBe("idle");
  });

  it("exitFrames 미만 미감지는 locked 유지(조기 해제 금지)", () => {
    const seq = [
      ...Array(cfg.enterFrames).fill(HIT),
      ...Array(cfg.exitFrames - 1).fill(MISS),
    ];
    const { rt } = run(seq);
    expect(rt.state).toBe("locked");
  });

  it("감지/미감지 교대(깜빡임)는 절대 locked 안 됨 + 햅틱 0", () => {
    const seq: FrameSignal[] = [];
    for (let i = 0; i < 20; i++) seq.push(i % 2 === 0 ? HIT : MISS);
    const { rt, haptics } = run(seq);
    expect(rt.state).toBe("idle");
    expect(haptics).toBe(0);
  });

  it("재진입: idle 복귀 후 다시 enterFrames 감지 → 햅틱 또 1회(총 2회)", () => {
    const seq = [
      ...Array(cfg.enterFrames).fill(HIT),
      ...Array(cfg.exitFrames).fill(MISS),
      ...Array(cfg.enterFrames).fill(HIT),
    ];
    const { rt, haptics } = run(seq);
    expect(rt.state).toBe("locked");
    expect(haptics).toBe(2);
  });
});
