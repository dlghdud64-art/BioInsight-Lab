/**
 * Block State Resolver — 단위 테스트
 *
 * 상태 우선순위: unavailable → loading → error → empty → ready
 * 불법 조합 회귀 방지 포함.
 */

import {
  resolveBlockState,
  resolveCompositeBlockState,
} from "@/lib/review-queue/ops-hub-block-states";
import type { OverviewSourceState } from "@/lib/review-queue/ops-hub-adapters";

function makeSource<T>(overrides: Partial<OverviewSourceState<T>> = {}): OverviewSourceState<T> {
  return {
    data: [] as unknown as T,
    isLoading: false,
    isError: false,
    isEmpty: false,
    error: undefined,
    lastUpdatedAt: null,
    ...overrides,
  };
}

describe("resolveBlockState", () => {
  it("returns unavailable when isDisabled is true", () => {
    const source = makeSource({ isLoading: true });
    expect(resolveBlockState(source, [], "alerts", true)).toBe("unavailable");
  });

  it("returns error when blockKey is in errorBlocks", () => {
    const source = makeSource();
    expect(resolveBlockState(source, ["alerts"], "alerts")).toBe("error");
  });

  it("returns error when source.isError is true", () => {
    const source = makeSource({ isError: true });
    expect(resolveBlockState(source, [], "alerts")).toBe("error");
  });

  it("returns loading when source.isLoading is true", () => {
    const source = makeSource({ isLoading: true });
    expect(resolveBlockState(source, [], "alerts")).toBe("loading");
  });

  it("returns empty when source.isEmpty is true", () => {
    const source = makeSource({ isEmpty: true });
    expect(resolveBlockState(source, [], "alerts")).toBe("empty");
  });

  it("returns ready when no issues", () => {
    const source = makeSource();
    expect(resolveBlockState(source, [], "alerts")).toBe("ready");
  });

  // ── 우선순위 검증 ──
  it("unavailable takes priority over loading", () => {
    const source = makeSource({ isLoading: true });
    expect(resolveBlockState(source, [], "alerts", true)).toBe("unavailable");
  });

  it("error in errorBlocks takes priority over loading", () => {
    const source = makeSource({ isLoading: true });
    expect(resolveBlockState(source, ["alerts"], "alerts")).toBe("error");
  });

  it("error takes priority over empty", () => {
    const source = makeSource({ isError: true, isEmpty: true });
    expect(resolveBlockState(source, [], "alerts")).toBe("error");
  });

  it("loading takes priority over empty", () => {
    const source = makeSource({ isLoading: true, isEmpty: true });
    expect(resolveBlockState(source, [], "alerts")).toBe("loading");
  });
});

describe("resolveCompositeBlockState", () => {
  it("returns error if any source has error", () => {
    const sources = [makeSource(), makeSource({ isError: true })];
    expect(resolveCompositeBlockState(sources, [], "workQueue", false)).toBe("error");
  });

  it("returns loading if any source is loading", () => {
    const sources = [makeSource(), makeSource({ isLoading: true })];
    expect(resolveCompositeBlockState(sources, [], "workQueue", false)).toBe("loading");
  });

  it("returns empty when dataIsEmpty is true", () => {
    const sources = [makeSource(), makeSource()];
    expect(resolveCompositeBlockState(sources, [], "workQueue", true)).toBe("empty");
  });

  it("returns ready when all fine", () => {
    const sources = [makeSource(), makeSource()];
    expect(resolveCompositeBlockState(sources, [], "workQueue", false)).toBe("ready");
  });

  it("unavailable overrides everything", () => {
    const sources = [makeSource({ isLoading: true, isError: true })];
    expect(resolveCompositeBlockState(sources, [], "workQueue", false, true)).toBe("unavailable");
  });
});

// ── 불법 조합 회귀 테스트 ──
describe("illegal state combination regression", () => {
  it("loading never coexists with ready", () => {
    const state = resolveBlockState(makeSource({ isLoading: true }), [], "alerts");
    expect(state).toBe("loading");
    expect(state).not.toBe("ready");
  });

  it("error never falls back to empty", () => {
    const state = resolveBlockState(makeSource({ isError: true, isEmpty: true }), [], "alerts");
    expect(state).toBe("error");
    expect(state).not.toBe("empty");
  });

  it("unavailable never shows retry logic", () => {
    const state = resolveBlockState(makeSource({ isError: true }), [], "alerts", true);
    expect(state).toBe("unavailable");
  });

  it("empty is distinct from unavailable", () => {
    const emptyState = resolveBlockState(makeSource({ isEmpty: true }), [], "alerts");
    const unavailableState = resolveBlockState(makeSource({ isEmpty: true }), [], "alerts", true);
    expect(emptyState).toBe("empty");
    expect(unavailableState).toBe("unavailable");
    expect(emptyState).not.toBe(unavailableState);
  });
});
