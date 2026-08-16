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
 * 🛑 **축을 먼저 읽을 것.** 이 파일은 성격이 다른 **두 축**을 병치한다.
 *    한쪽 GREEN 을 다른 쪽 GREEN 으로 읽는 것이 이 저장소가 반복해서 만난 형태다.
 *
 *   ┌ 축 A — fixture 자기 무결성 + 비교기 실증 ────────────────────────────
 *   │  입력이 fixture 자신이다(`compareLabels(exp, [...exp].reverse())`).
 *   │  잠그는 것: fixture 내부 정합 + 비교기의 탐지력/정밀도.
 *   │  잠그지 **못하는** 것: 시안 정합 · 제품 화면 정합. 둘 다 아니다.
 *   ├ 축 B — fixture ↔ **시안 실렌더** (2026-08-16 배선) ───────────────────
 *   │  입력이 `product-detail-comp.render.json` = 시안 HTML 헤드리스 실렌더
 *   │  텍스트노드 126 (Chromium 1194 · 뷰포트 390/1440/1920/3840 동일 실측).
 *   │  잠그는 것: fixture 112 가 **시안 렌더에 실재**한다(중복 개수까지).
 *   │  잠그지 **못하는** 것: **제품 화면 정합.** 이 축의 actual 은 시안이지 제품이 아니다.
 *   └───────────────────────────────────────────────────────────────────────
 *
 * ⛔ **아직 배선되지 않은 축 C — fixture ↔ 제품 화면.**
 *    §7.6 "적용 지점 = Phase 3/4/5 EXIT · Phase 6 전량 재대조" 가 요구하는 것은
 *    **구현된 화면**의 렌더 산출물이다. 그 축은 Next 앱 실행 + 시드 제품이 필요하며
 *    **본 파일에 없다.** 축 A·B 가 전부 GREEN 이어도 제품 화면은 한 번도 측정되지 않았다.
 *
 * 등급 한계 — GREEN 은 무결 증명이 아니다:
 *   - 대조 대상 109 는 `labels[0]` 제외라는 **분류 판단**에 의존한다(실측 아님)
 *   - 축 B 는 **스냅샷 대조**다. 시안 파일이 바뀌면 스냅샷이 조용히 낡는다 →
 *     `source_sha256` 불일치 시 **재도출이 선행**이어야 한다(레포 밖 파일이라 in-test 검증 불가)
 *   - colors 앵커는 fixture 자기 무결성 지표다(모집단이 렌더와 다름 — §comp-render-verification §2②)
 */
import { describe, it, expect } from "vitest";
import fixture from "../fixtures/product-detail-comp.json";
import renderFixture from "../fixtures/product-detail-comp.render.json";

type Section = { label_count: number; labels: string[]; colors: Record<string, number> };
const SECTIONS = fixture.sections as unknown as Record<string, Section>;
const ANCHOR = 112;

/** 축 B 입력 — 시안 실렌더 산출물(스냅샷). 제품 화면 아님. */
const RENDER = renderFixture as unknown as {
  source_sha256: string;
  total_text_nodes: number;
  non_ui_count: number;
  viewport_node_counts: Record<string, number>;
  non_ui_nodes: string[];
  text_nodes: string[];
};
const RENDER_ANCHOR = 126;

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

/* ─────────────────────────────────────────────────────────────
 * 축 B — fixture ↔ 시안 실렌더 (2026-08-16 배선)
 *
 *   여기서 처음으로 `compareLabels()` 의 actual 이 fixture 자신이 아니다.
 *   actual = 시안 HTML 헤드리스 실렌더 텍스트노드 126.
 *
 *   🛑 그럼에도 **제품 화면은 여전히 측정되지 않는다.** 이 축이 잠그는 명제는
 *      "fixture 112 는 시안에 실재한다" 이지 "제품이 시안대로 그려진다" 가 아니다.
 *      축 C(제품 화면) 배선 전에는 이 GREEN 을 시안 정합으로 읽지 말 것.
 * ───────────────────────────────────────────────────────────── */
describe("§7.6 축 B — fixture ↔ 시안 실렌더 대조", () => {
  it("렌더 앵커 126 — 뷰포트 4종(390/1440/1920/3840) 전부 동일", () => {
    // 앵커를 낮추면 부분 로딩(언팩 미완)이 '불일치 0' 으로 위장한다.
    expect(RENDER.total_text_nodes).toBe(RENDER_ANCHOR);
    expect(RENDER.text_nodes).toHaveLength(RENDER_ANCHOR);
    const vps = Object.values(RENDER.viewport_node_counts);
    expect(vps).toHaveLength(4);
    for (const n of vps) expect(n).toBe(RENDER_ANCHOR);
  });

  it("모집단 분해 126 = UI 라벨 112 + 非UI 14 (문서 메타·주석)", () => {
    // 측정 축 분리: UI 텍스트 / 시안 문서 라벨·주석을 **분리 계상**한다.
    expect(RENDER.non_ui_count).toBe(RENDER.non_ui_nodes.length);
    expect(RENDER.non_ui_count).toBe(RENDER_ANCHOR - ANCHOR);
  });

  it("fixture 112 ↔ 렌더 UI 노드 — 다중집합 완전 일치(missing 0 · extra 0)", () => {
    const all = Object.keys(SECTIONS).flatMap((k) => SECTIONS[k].labels);
    expect(all).toHaveLength(ANCHOR);
    // 렌더 126 에서 非UI 14 를 **다중집합으로** 제거 → 잔여가 UI 112 여야 한다.
    const pool = new Map<string, number>();
    for (const n of RENDER.text_nodes) pool.set(n, (pool.get(n) ?? 0) + 1);
    for (const n of RENDER.non_ui_nodes) {
      const c = pool.get(n) ?? 0;
      expect(c, `非UI 노드가 렌더에 없다: ${n}`).toBeGreaterThan(0);
      pool.set(n, c - 1);
    }
    const ui = [...pool.entries()].flatMap(([k, v]) => Array<string>(v).fill(k));
    expect(ui).toHaveLength(ANCHOR);
    const r = compareLabels(all, ui);
    expect(r.missing, "시안에 없는 fixture 라벨").toEqual([]);
    expect(r.extra, "fixture 에 없는 시안 UI 라벨").toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("중복 라벨 개수까지 일치 — 112 전량 기준 6종", () => {
    // Set 대조였다면 전부 1로 접혀 통과한다 — 다중집합이라야 잡는다.
    // ⚠️ 수치는 **112 전량(1a+1b+1c) 기준**이다. 인계문서의 `PBS-3×2` 는 1a 단면 수치 —
    //    같은 라벨을 섹션 축과 전량 축에서 다르게 세면 여기서 조용히 어긋난다.
    const count = (a: string[], s: string) => a.filter((x) => x === s).length;
    const all = Object.keys(SECTIONS).flatMap((k) => SECTIONS[k].labels);
    const DUP = [["PBS-3", 6], ["PBS-1A", 3], ["상세 ›", 3], ["Cat.No", 2], ["Cat.", 2], ["상세 보기", 2]] as const;
    for (const [s, n] of DUP) {
      expect(count(all, s), `fixture ${s}`).toBe(n);
      expect(count(RENDER.text_nodes, s), `렌더 ${s}`).toBe(n);
    }
    // 중복 종수 자체도 앵커 — 새 중복이 생기면 위 표가 낡았다는 뜻이다.
    const m = new Map<string, number>();
    for (const s of all) m.set(s, (m.get(s) ?? 0) + 1);
    expect([...m.values()].filter((v) => v > 1)).toHaveLength(DUP.length);
  });

  it("특수문자 3종 — 렌더에서도 보존, ASCII 오염 0", () => {
    expect(RENDER.text_nodes).toContain("−");   // U+2212
    expect(RENDER.text_nodes).toContain("＋");   // U+FF0B
    expect(RENDER.text_nodes).toContain("✕");   // U+2715
    expect(RENDER.text_nodes).not.toContain("-");
    expect(RENDER.text_nodes).not.toContain("+");
  });

  it("도출 출처 앵커 — 시안 sha256 이 스냅샷에 기록돼 있다", () => {
    // 레포 밖 파일이라 in-test 재계산 불가. 해시가 바뀌면 **재도출이 선행**이라는 계약만 잠근다.
    expect(RENDER.source_sha256).toBe(
      "6d98bd270f728714c2055c53beb90f4fd4e72ff65d58fd5e9c897d1e762543f5",
    );
  });

  it("🛑 축 C 미배선 명시 — 제품 화면 산출물은 이 파일에 없다", () => {
    // 이 단언은 '없음' 을 잠근다. 축 C 배선 시 이 it 을 실 대조로 **교체**할 것.
    // 남겨두면 축 A·B GREEN 이 제품 정합으로 오독된다(§7.6 적용 지점 = 구현 화면).
    expect(Object.keys(RENDER)).not.toContain("product_render_nodes");
  });
});
