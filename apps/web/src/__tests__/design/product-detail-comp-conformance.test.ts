/**
 * §product-detail-refinement §7.6 — COMP 적합성 게이트
 *
 * 🛑 **눈으로 확인하지 않는다.** COMP fixture 의 레이블·토큰을 고정하고
 *    렌더 결과와 **문자열/값 대조**한다. 불일치 1건 = RED.
 *
 * 세 실증을 **같은 파일에 병치**한다 — 서로를 대체하지 못한다:
 *   ① corrupt→RED      탐지를 증명
 *   ② 오탐 0            정밀도를 증명 (corrupt→RED 단독 채택 금지)
 *   ③ 앵커 위장 방어    로딩 실패/부분 로딩을 증명 (§7.6 "출력 감소도 RED")
 *
 * 등급 한계 — GREEN 은 무결 증명이 아니다:
 *   - Phase 3~5 **미구현**이므로 지금은 **fixture 자기 무결성 + 비교기 실증**만 돈다
 *   - 렌더 대조는 `compareLabels()` 를 화면 산출물에 물리는 시점에 활성화된다
 *   - 대조 대상 109 는 `labels[0]` 제외라는 **분류 판단**에 의존한다(실측 아님)
 */
import { describe, it, expect } from "vitest";
import fixture from "../fixtures/product-detail-comp.json";

type Section = { label_count: number; labels: string[]; colors: Record<string, number> };
const SECTIONS = fixture.sections as unknown as Record<string, Section>;
const ANCHOR = 112;

/** 🛑 다중집합(배열) 대조. Set 대조 금지 — 중복이 사라져 줄어든 것이 통과로 읽힌다. */
export function compareLabels(expected: string[], actual: string[]) {
  const pool = new Map<string, number>();
  for (const a of actual) pool.set(a, (pool.get(a) ?? 0) + 1);
  const missing: string[] = [];
  for (const e of expected) {
    const n = pool.get(e) ?? 0;
    if (n === 0) missing.push(e);
    else pool.set(e, n - 1);
  }
  const extra = [...pool.entries()].flatMap(([k, v]) => Array<string>(v).fill(k));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

/** 대조 대상 = labels[0](시안 자체 라벨) 제외 — 분류 판단, 확정(호영님 2026-08-15) */
const target = (k: string) => SECTIONS[k].labels.slice(1);

describe("§7.6 COMP 적합성 게이트 — 비교기 실증", () => {
  it("① corrupt→RED — 레이블 하나만 바꿔도 떨어진다", () => {
    const exp = target("1a");
    const act = [...exp];
    act[5] = act[5] + "_CORRUPT";
    const r = compareLabels(exp, act);
    expect(r.ok).toBe(false);
    expect(r.missing).toHaveLength(1);
  });

  it("① corrupt→RED — 중복 레이블 1개 누락도 잡는다 (Set 대조였다면 통과했을 형태)", () => {
    const exp = target("1a");                      // "상세 ›" 3회 · "PBS-3" 2회
    const act = exp.filter((_, i) => i !== exp.indexOf("상세 ›"));
    expect(new Set(act).size).toBe(new Set(exp).size);   // Set 으로는 구분 불가
    expect(compareLabels(exp, act).ok).toBe(false);      // 다중집합은 잡는다
  });

  it("② 오탐 0 — 정상 렌더는 통과한다 (순서 무관)", () => {
    for (const k of Object.keys(SECTIONS)) {
      const exp = target(k);
      expect(compareLabels(exp, [...exp].reverse()).ok).toBe(true);
    }
  });

  it("③ 앵커 위장 방어 — 부분 로딩이 '불일치 0' 으로 통과하지 못한다", () => {
    const partial = { "1a": SECTIONS["1a"] };     // 1b·1c 유실 시나리오
    const sum = Object.values(partial).reduce((n, s) => n + s.labels.length, 0);
    expect(sum).not.toBe(ANCHOR);                 // ← 로딩 실패가 여기서 걸린다
    expect(compareLabels(target("1a"), target("1a")).ok).toBe(true);  // 대조만 보면 통과다
  });
});

describe("§7.6 fixture 자기 무결성", () => {
  it("앵커 112 — 섹션 합계와 일치", () => {
    const sum = Object.values(SECTIONS).reduce((n, s) => n + s.labels.length, 0);
    expect(fixture.total_label_count).toBe(ANCHOR);
    expect(sum).toBe(ANCHOR);
  });

  it("섹션별 label_count 가 실제 배열 길이와 일치", () => {
    for (const [k, s] of Object.entries(SECTIONS)) expect(s.labels.length, k).toBe(s.label_count);
  });

  it("대조 대상 109 — labels[0] 제외 (분류 판단)", () => {
    expect(Object.keys(SECTIONS).reduce((n, k) => n + target(k).length, 0)).toBe(109);
  });

  it("colors 앵커 — 항목 수 + 합계 둘 다", () => {
    const sum = (k: string) => Object.values(SECTIONS[k].colors).reduce((a, b) => a + b, 0);
    expect([Object.keys(SECTIONS["1a"].colors).length, sum("1a")]).toEqual([27, 103]);
    expect([Object.keys(SECTIONS["1b"].colors).length, sum("1b")]).toEqual([23, 51]);
    expect([Object.keys(SECTIONS["1c"].colors).length, sum("1c")]).toEqual([23, 57]);
  });

  it("특수문자 코드포인트 — ASCII 정규화 시 조용히 깨진다", () => {
    const l = SECTIONS["1c"].labels;
    expect(l).toContain("−");   // MINUS SIGN — 하이픈 아님
    expect(l).toContain("＋");   // FULLWIDTH PLUS — ASCII + 아님
    expect(l).toContain("✕");   // MULTIPLICATION X — x·× 아님
    expect(l).not.toContain("-");
    expect(l).not.toContain("+");
  });
});
