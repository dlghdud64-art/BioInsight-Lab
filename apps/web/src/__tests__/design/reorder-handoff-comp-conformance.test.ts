/**
 * §reorder-handoff — 재발주 견적 핸드오프 COMP 적합성 게이트 (축 B)
 *
 * 🛑 **눈으로 확인하지 않는다.** fixture 의 레이블·개수를 고정하고
 *    **시안 실렌더 산출물**과 다중집합 대조한다. 불일치 1건 = RED.
 *
 * 🛑 **축을 먼저 읽을 것.** A 트랙(product-detail-comp-conformance.test.ts)과 같은 3축 구조다.
 *
 *   ┌ 축 A — fixture 자기 무결성 + 비교기 정밀도 ───────────────────────────
 *   │  입력이 fixture 자신이다. **이 파일에는 없다** — A 트랙 파일이 이미 실증했고,
 *   │  fixture↔fixture 대조를 하나 더 늘리는 것은 축 B 배선이 아니다.
 *   ├ 축 B — fixture ↔ **시안 실렌더** (2026-08-16 배선 · 이 파일) ─────────
 *   │  actual = `reorder-handoff-comp.render.json`
 *   │         = 시안 HTML(22.9MB) 헤드리스 실렌더 텍스트노드 **83**
 *   │           (Chromium 1194 · 뷰포트 390/1440/1920/3840 전부 83 실측).
 *   │  잠그는 것: fixture 63/12/8/1 이 **시안 렌더에 실재**한다(중복 개수까지).
 *   │  잠그지 **못하는** 것: **제품 화면 정합.** actual 은 시안이지 제품이 아니다.
 *   └───────────────────────────────────────────────────────────────────────
 *
 * ⛔ **아직 배선되지 않은 축 C — fixture ↔ 제품 화면.**
 *    축 A·B 가 전부 GREEN 이어도 제품 화면은 한 번도 측정되지 않았다.
 *    파일 최하단 `축 C 미배선` describe 가 그 '없음' 을 명시적으로 잠근다.
 *
 * ── 왜 `.render.json` 을 선도출해 커밋하는가 ────────────────────────────────
 *    시안이 22.9MB 다. 테스트 런타임에 매번 렌더하면(언팩 대기 + 6s × 4뷰포트)
 *    게이트가 못 쓰게 된다. 재도출 경로:
 *      node apps/web/_reorder_comp_probe.mjs \
 *        --file "<시안.html>" --out /tmp/probe.json \
 *        --render-out apps/web/src/__tests__/fixtures/reorder-handoff-comp.render.json
 *    🛑 시안 sha256 이 바뀌면 **재도출이 선행**이다(레포 밖 파일이라 in-test 재계산 불가).
 *
 * ── 게이트 자기검증 — 변이 5종 전부 RED 실측 (2026-08-16 · 컨테이너 격리 vitest 3.1.1) ──
 *    `.render.json` 사본만 변이시켜 이 파일 단독 실행. 확인 후 전부 원복(sha256 동일 확인).
 *      ① 렌더 라벨 1건 손상    1c `견적 요청 발송 준비` → `…_CORRUPT`        → RED 4 / 22
 *      ② 중복 1건만 제거       `RFQ-2608-B2K4`×2 중 1건을 `BCP × 9개` 로 치환
 *                              총계 83·63 유지 · **Set 는 59종 그대로**(실측)
 *                              → Set 대조였다면 **통과**한다. 다중집합이라 잡힌다  → RED 7 / 22
 *      ③ 노드 1건 삭제         `권장 발주 수량` 제거(83→82)                    → RED 7 / 22
 *      ④ 뷰포트 카운트 드리프트 viewport_text_node_counts["1920"] 83→82        → RED 1 / 22
 *      ⑤ 부분 로딩 위장        83→40 을 total·뷰포트·섹션까지 **일관되게** 낮춤 → RED 14 / 22
 *      ⑥ 정상(무변이)                                                          → GREEN 22 / 22 · 오탐 0
 *    ⚠️ ④ 는 단 1건만 RED 다 — 뷰포트 앵커는 다른 단언이 대신 잡아주지 않는다.
 *       `텍스트노드 앵커 83` it 을 지우면 뷰포트 드리프트가 **무검출**이 된다.
 *
 * 등급 한계 — GREEN 은 무결 증명이 아니다:
 *   - 축 B 는 **스냅샷 대조**다. 시안이 바뀌면 스냅샷이 조용히 낡는다(sha256 앵커로만 방어).
 *   - `1a.elision` 1슬롯은 프로덕션 라벨이 아니라 시안 축약 표기다(fixture `_분류판단`, 실측 아님).
 *   - colors 는 **fixture 자기 무결성 전용**이라 이 파일에서 렌더와 대조하지 않는다
 *     (렌더 computed 는 색 미지정 요소가 #000000 으로 잡혀 모집단이 다르다).
 */
import { describe, it, expect } from "vitest";
import fixture from "../fixtures/reorder-handoff-comp.json";
import renderFixture from "../fixtures/reorder-handoff-comp.render.json";

/* ── 앵커. 낮추면 로딩 실패가 '불일치 0' 으로 위장한다 ────────────────────── */
const ANCHOR_TEXT_NODES = 83;
const ANCHOR_UI = 63;
const ANCHOR_ANNOTATION = 12;
const ANCHOR_DOC = 8;
const ANCHOR_ATTR = 1;
const ANCHOR_ELEMENTS_BODY = 127;
const ANCHOR_ELEMENTS_DOCUMENT = 144;
const SOURCE_SHA256 =
  "30b5daae59172815729c8d4ffd7783e386269ef7df078802076a23ce3ab8e173";

type Slot = {
  slot: string;
  label: string;
  /** 아이콘 접두 슬롯 — 렌더 텍스트노드는 아이콘을 포함한다(label = 순수 텍스트). */
  _렌더원문?: string;
  icon?: string;
  elision?: boolean;
  _시드종속?: { seed: string; fixed: string | null; 패턴: string[]; 적용축: string };
};
type FixtureSection = {
  label_count: number;
  element_count: number;
  labels: string[];
  slots: Slot[];
  doc_labels: string[];
  annotation_excluded: string[];
  annotation_excluded_count: number;
};
type RenderSection = {
  ui_text: string[];
  doc_labels: string[];
  annotation_excluded: string[];
  element_count: number;
  authored_border_widths: Record<string, number>;
};

const SECTIONS = fixture.sections as unknown as Record<string, FixtureSection>;
const KEYS = Object.keys(SECTIONS); // 1a · 1b · 1c · 1d

/** 축 B 입력 — 시안 실렌더 스냅샷. **제품 화면 아님.** */
const RENDER = renderFixture as unknown as {
  _축: string;
  source_sha256: string;
  source_bytes: number;
  derived_at: string;
  page_errors: number;
  console_errors: number;
  text_node_total: number;
  element_count_body: number;
  element_count_document: number;
  ui_text_total: number;
  doc_label_total: number;
  annotation_excluded_total: number;
  attr_label_total: number;
  viewports_tested: number[];
  viewport_text_node_counts: Record<string, number>;
  viewport_element_counts_body: Record<string, number>;
  viewport_element_counts_document: Record<string, number>;
  authored_border_widths: Record<string, number>;
  sections: Record<string, RenderSection>;
  attr_labels: { section: string; tag: string; attr: string; value: string }[];
  text_nodes: string[];
};

/**
 * 🛑 다중집합(배열) 대조. **Set 대조 금지** — 중복이 사라져 줄어든 것이 통과로 읽힌다.
 *    이 시안의 실측 중복 4종(`1`·`안전재고 미달`·`RFQ-2608-B2K4`·`BCP × 9개`)이 정확히 그 형태다.
 */
function compareLabels(expected: string[], actual: string[]) {
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

const flatFx = (pick: (s: FixtureSection) => string[]) => KEYS.flatMap((k) => pick(SECTIONS[k]));
const flatRd = (pick: (s: RenderSection) => string[]) => KEYS.flatMap((k) => pick(RENDER.sections[k]));
const countIn = (arr: string[], s: string) => arr.filter((x) => x === s).length;

/* ═══════════════════════════════════════════════════════════════════════════
 * 축 B 전제 — 렌더 산출물 자기 정합 (부분 로딩·앵커 위장 방어)
 * ═══════════════════════════════════════════════════════════════════════════ */
describe("§reorder-handoff 축 B 전제 — 시안 실렌더 앵커", () => {
  it("텍스트노드 앵커 83 — 뷰포트 4종(390/1440/1920/3840) 전부 고정", () => {
    // 🛑 앵커 위장 방어. 부분 로딩(언팩 미완)은 노드 수가 줄어드는 형태로 온다 —
    //    총계를 같이 낮춰 놓으면 '불일치 0' 으로 통과한다. 여기서 절대값으로 못 박는다.
    expect(RENDER.text_node_total).toBe(ANCHOR_TEXT_NODES);
    expect(RENDER.text_nodes).toHaveLength(ANCHOR_TEXT_NODES);
    expect(RENDER.viewports_tested).toEqual([390, 1440, 1920, 3840]);
    const vps = Object.entries(RENDER.viewport_text_node_counts);
    expect(vps).toHaveLength(4);
    for (const [w, n] of vps) expect(n, `viewport ${w}`).toBe(ANCHOR_TEXT_NODES);
  });

  it("요소 앵커 — body 127 / document 144 · 뷰포트 4종 고정", () => {
    // 🛑 두 스코프를 섞지 않는다. 127 은 document.body, 144 는 document
    //    (html/head/meta/title/script/style 포함). 섞으면 17 만큼 조용히 어긋난다.
    expect(RENDER.element_count_body).toBe(ANCHOR_ELEMENTS_BODY);
    expect(RENDER.element_count_document).toBe(ANCHOR_ELEMENTS_DOCUMENT);
    for (const [w, n] of Object.entries(RENDER.viewport_element_counts_body)) {
      expect(n, `body @${w}`).toBe(ANCHOR_ELEMENTS_BODY);
    }
    for (const [w, n] of Object.entries(RENDER.viewport_element_counts_document)) {
      expect(n, `document @${w}`).toBe(ANCHOR_ELEMENTS_DOCUMENT);
    }
    // 화면 4개 요소 합(26+28+33+13=100)은 body 127 의 부분집합이다 — 섹션 누락 방어.
    const perScreen = KEYS.map((k) => RENDER.sections[k].element_count);
    expect(perScreen).toEqual([26, 28, 33, 13]);
    for (const k of KEYS) {
      expect(RENDER.sections[k].element_count, `${k} 요소 수`).toBe(SECTIONS[k].element_count);
    }
  });

  it("렌더 무결성 — pageError 0 · consoleError 0", () => {
    // 에러가 있었다면 노드 83 이 '정상' 이라는 근거가 무너진다.
    expect(RENDER.page_errors).toBe(0);
    expect(RENDER.console_errors).toBe(0);
  });

  it("도출 출처 앵커 — 시안 sha256 · bytes 가 스냅샷에 기록돼 있다", () => {
    // 레포 밖 파일이라 in-test 재계산 불가. 해시가 바뀌면 **재도출이 선행**이라는 계약을 잠근다.
    expect(RENDER.source_sha256).toBe(SOURCE_SHA256);
    expect(fixture.source_sha256).toBe(SOURCE_SHA256); // fixture 와 같은 시안에서 왔는가
    expect(RENDER.source_bytes).toBe(fixture.source_bytes);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 분리 계상 — **각 항을 개별 단언으로.** 합계만 단언하면 축이 안 잡힌다.
 *   83 = ui_text 63 + annotation_excluded 12 + doc_labels 8
 *   attr 1 은 텍스트노드 축 83 에 **포함되지 않는 별도 축**이다.
 * ═══════════════════════════════════════════════════════════════════════════ */
describe("§reorder-handoff 축 B — 분리 계상(개별 단언)", () => {
  it("① UI 텍스트 63 — phone frame 하위 텍스트노드", () => {
    expect(fixture.total_label_count).toBe(ANCHOR_UI);
    expect(flatFx((s) => s.labels)).toHaveLength(ANCHOR_UI);
    expect(RENDER.ui_text_total).toBe(ANCHOR_UI);
    expect(flatRd((s) => s.ui_text)).toHaveLength(ANCHOR_UI);
    // 섹션 분포까지 — 합계만 맞고 분포가 어긋나는 경우를 잡는다.
    expect(KEYS.map((k) => SECTIONS[k].labels.length)).toEqual([17, 20, 18, 8]);
    expect(KEYS.map((k) => RENDER.sections[k].ui_text.length)).toEqual([17, 20, 18, 8]);
  });

  it("② annotation_excluded 12 — 해설 카드. **0 처리 아님, 분리 계상**", () => {
    expect(fixture.annotation_excluded_count).toBe(ANCHOR_ANNOTATION);
    expect(flatFx((s) => s.annotation_excluded)).toHaveLength(ANCHOR_ANNOTATION);
    expect(RENDER.annotation_excluded_total).toBe(ANCHOR_ANNOTATION);
    expect(flatRd((s) => s.annotation_excluded)).toHaveLength(ANCHOR_ANNOTATION);
    expect(KEYS.map((k) => SECTIONS[k].annotation_excluded_count)).toEqual([3, 3, 3, 3]);
  });

  it("③ doc_labels 8 — 화면 좌상단 배지 행(position:absolute). 대조 제외 축", () => {
    expect(fixture.doc_label_count).toBe(ANCHOR_DOC);
    expect(flatFx((s) => s.doc_labels)).toHaveLength(ANCHOR_DOC);
    expect(RENDER.doc_label_total).toBe(ANCHOR_DOC);
    expect(flatRd((s) => s.doc_labels)).toHaveLength(ANCHOR_DOC);
  });

  it("④ attr 라벨 1 — 텍스트노드 축 83 에 **안 잡히는** 별도 축", () => {
    // 🛑 텍스트노드만 세면 `1c.vendor.search_input@attr` 슬롯은 존재하지 않는 것으로 읽힌다.
    expect(fixture.attr_label_count).toBe(ANCHOR_ATTR);
    expect(RENDER.attr_label_total).toBe(ANCHOR_ATTR);
    expect(RENDER.attr_labels).toHaveLength(ANCHOR_ATTR);
    const v = fixture.attr_labels[0].value;
    expect(RENDER.text_nodes).not.toContain(v); // ← 83 축에 없다는 것 자체가 근거
  });

  it("⑤ 합계 정합 83 = 63 + 12 + 8 · attr 1 은 이 합에 포함되지 않는다", () => {
    // 이 it 은 ①~④ 를 **대체하지 않는다**. 합계만 맞고 항이 서로 흘러간 경우를 위한 교차검증이다.
    expect(ANCHOR_UI + ANCHOR_ANNOTATION + ANCHOR_DOC).toBe(ANCHOR_TEXT_NODES);
    expect(RENDER.ui_text_total + RENDER.annotation_excluded_total + RENDER.doc_label_total)
      .toBe(RENDER.text_node_total);
    expect(ANCHOR_ATTR + ANCHOR_TEXT_NODES).not.toBe(ANCHOR_TEXT_NODES);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 축 B 본체 — fixture ↔ 시안 실렌더 다중집합 대조
 *   actual 은 **렌더 산출물**이다. fixture 를 fixture 와 비교하지 않는다.
 * ═══════════════════════════════════════════════════════════════════════════ */
describe("§reorder-handoff 축 B — fixture ↔ 시안 실렌더 대조", () => {
  it("UI 63 — 다중집합 완전 일치 (missing 0 · extra 0)", () => {
    const r = compareLabels(flatFx((s) => s.labels), flatRd((s) => s.ui_text));
    expect(r.missing, "시안 렌더에 없는 fixture 라벨").toEqual([]);
    expect(r.extra, "fixture 에 없는 시안 렌더 라벨").toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("UI 63 — 섹션별 다중집합 일치 (전량 통과 뒤에 섹션 간 이동이 숨는다)", () => {
    for (const k of KEYS) {
      const r = compareLabels(SECTIONS[k].labels, RENDER.sections[k].ui_text);
      expect(r.missing, `${k} missing`).toEqual([]);
      expect(r.extra, `${k} extra`).toEqual([]);
    }
  });

  it("annotation_excluded 12 — 다중집합 일치 (주석 축도 잠근다)", () => {
    const r = compareLabels(
      flatFx((s) => s.annotation_excluded),
      flatRd((s) => s.annotation_excluded),
    );
    expect(r.missing).toEqual([]);
    expect(r.extra).toEqual([]);
  });

  it("doc_labels 8 — 다중집합 일치", () => {
    const r = compareLabels(flatFx((s) => s.doc_labels), flatRd((s) => s.doc_labels));
    expect(r.missing).toEqual([]);
    expect(r.extra).toEqual([]);
  });

  it("텍스트노드 83 전량 — fixture 3축 합집합 ↔ 렌더 다중집합 일치", () => {
    const all = [
      ...flatFx((s) => s.labels),
      ...flatFx((s) => s.doc_labels),
      ...flatFx((s) => s.annotation_excluded),
    ];
    expect(all).toHaveLength(ANCHOR_TEXT_NODES);
    const r = compareLabels(all, RENDER.text_nodes);
    expect(r.missing).toEqual([]);
    expect(r.extra).toEqual([]);
  });

  it("중복 4종 — 개수까지 일치 (Set 대조였다면 통과했을 형태)", () => {
    // 실측 중복: `1`×2(1a KPI) · `안전재고 미달`×2(1a/1b) · `RFQ-2608-B2K4`×2(1c/1d) · `BCP × 9개`×2(1c/1d)
    const DUP = [["1", 2], ["안전재고 미달", 2], ["RFQ-2608-B2K4", 2], ["BCP × 9개", 2]] as const;
    const fxUi = flatFx((s) => s.labels);
    const rdUi = flatRd((s) => s.ui_text);
    for (const [s, n] of DUP) {
      expect(countIn(fxUi, s), `fixture ${s}`).toBe(n);
      expect(countIn(rdUi, s), `렌더 ${s}`).toBe(n);
    }
    // 중복 **종수** 자체도 앵커 — 새 중복이 생기면 위 표가 낡았다는 뜻이다.
    const m = new Map<string, number>();
    for (const s of rdUi) m.set(s, (m.get(s) ?? 0) + 1);
    expect([...m.values()].filter((v) => v > 1)).toHaveLength(DUP.length);
    // Set 로 접으면 63 → 59 로 줄어든다. 이 게이트가 Set 대조가 아님을 못 박는다.
    expect(new Set(rdUi).size).toBe(ANCHOR_UI - DUP.length);
  });

  it("slots 63 — 아이콘 접두 슬롯은 `_렌더원문` 으로 렌더 대조", () => {
    // label = 순수 텍스트 · icon = 별도 슬롯(2026-08-16 확정). 렌더 텍스트노드는 아이콘을 포함한다.
    const slots = KEYS.flatMap((k) => SECTIONS[k].slots);
    expect(slots).toHaveLength(ANCHOR_UI);
    const expected = slots.map((s) => s._렌더원문 ?? s.label);
    const r = compareLabels(expected, flatRd((s) => s.ui_text));
    expect(r.missing, "slots 에서 재구성한 라벨이 렌더에 없다").toEqual([]);
    expect(r.extra).toEqual([]);
    // 아이콘 슬롯 3건은 label 만으로는 렌더에 없다 — `_렌더원문` 없이는 대조가 깨진다.
    const iconSlots = slots.filter((s) => s.icon);
    expect(iconSlots).toHaveLength(3);
    for (const s of iconSlots) {
      expect(RENDER.text_nodes, `${s.slot} 원문`).toContain(s._렌더원문);
      expect(RENDER.text_nodes, `${s.slot} 아이콘 제거형`).not.toContain(s.label);
    }
  });

  it("attr 라벨 1 — 렌더 속성 축에서 placeholder 값 일치", () => {
    const fxAttr = fixture.attr_labels[0];
    const rdAttr = RENDER.attr_labels[0];
    expect(rdAttr.tag).toBe(fxAttr.tag);
    expect(rdAttr.attr).toBe(fxAttr.attr);
    expect(rdAttr.value).toBe(fxAttr.value);
    expect(rdAttr.value).toBe("공급사명·담당자 이메일 검색");
    expect(rdAttr.section).toBe("1c");
  });

  it("🔴 seed_dependent 11슬롯 — 축 B 는 **값 대조**. 형태 앵커로 풀지 않는다", () => {
    // `_대조규칙.seed_dependent.적용시점` = **축 C 한정**.
    // 시안은 고정 산출물이라 시드가 안 바뀐다 → 축 B 에서 값으로 비교하는 게 맞다.
    // 여기서 형태 앵커(정규식 '존재만 검사')로 풀면 63슬롯 중 11(17%)이 죽는다.
    const rule = fixture._대조규칙.seed_dependent;
    expect(rule.적용시점, "축 B 를 스킵 조건으로 쓰면 안 된다").toBe("축 C 한정");
    expect(rule.슬롯).toHaveLength(11);
    expect(rule._슬롯수).toBe(11);
    expect(rule._분모).toBe(ANCHOR_UI);

    const byId = new Map(KEYS.flatMap((k) => SECTIONS[k].slots).map((s) => [s.slot, s]));
    const rdUi = flatRd((s) => s.ui_text);
    for (const id of rule.슬롯) {
      const slot = byId.get(id);
      expect(slot, `슬롯 미존재: ${id}`).toBeDefined();
      expect(slot!._시드종속, `${id} 는 seed_dependent 여야 한다`).toBeDefined();
      expect(slot!._시드종속!.적용축, `${id} 적용축`).toBe("C 한정");
      const value = slot!._렌더원문 ?? slot!.label;
      // ← 값 대조. 정규식 아님.
      expect(countIn(rdUi, value), `${id} = ${value}`).toBeGreaterThan(0);
    }
    // 11슬롯이 실제로 검사 안에 남아 있다는 것 자체를 잠근다(스킵 회귀 방어).
    const checked = rule.슬롯.map((id) => byId.get(id)!._렌더원문 ?? byId.get(id)!.label);
    expect(new Set(checked).size).toBeGreaterThanOrEqual(9); // RFQ·품목명 각각 1쌍 중복
    expect(compareLabels(checked, rdUi).missing).toEqual([]);
  });

  it("forbidden 5종 — ui_text 축 **exact** 다중집합 0건 (substring 이면 오검출)", () => {
    // 🛑 부분 문자열 검사 금지. `바로 발주는 공급사·단가 확정 후 가능합니다` 는
    //    금지어 `바로 발주` 를 부분 문자열로 포함하는 **정상 라벨**이다.
    const rdUi = flatRd((s) => s.ui_text);
    for (const f of fixture.forbidden.labels) {
      expect(countIn(rdUi, f), `금지 라벨 exact: ${f}`).toBe(0);
    }
    // 오검출 실증 — substring 검사였다면 여기서 1건이 잡혀 정상 라벨이 RED 가 된다.
    expect(rdUi.filter((x) => x.includes("바로 발주"))).toEqual([
      "바로 발주는 공급사·단가 확정 후 가능합니다",
    ]);
    // 축 분리 실증 — 금지어는 annotation 축에는 **나온다**. 여기서 검사하면 오탐이다.
    const anno = flatRd((s) => s.annotation_excluded).join(" ");
    for (const f of ["바로 발주", "공급사 미정", "예상 금액", "견적 대기"]) {
      expect(anno, `annotation 축에는 있어야 한다: ${f}`).toContain(f);
    }
  });

  it("특수문자 17종 — ui_text 축 코드포인트 실측 일치 (ASCII 정규화 시 조용히 깨진다)", () => {
    // 🛑 모집단 축 주의: 이 표는 **ui_text 63** 기준이다. 83 전량으로 재면
    //    EM DASH 가 0 이 아니라 5(주석·문서 라벨) 로 잡혀 정상이 RED 가 된다.
    const spec = fixture._대조규칙.특수문자_실측 as Record<string, number>;
    const entries = Object.entries(spec);
    expect(entries).toHaveLength(17);
    const ui = flatRd((s) => s.ui_text).join("");
    const all = RENDER.text_nodes.join("");
    for (const [key, n] of entries) {
      const ch = key.split(" ")[1];
      expect(ch, `코드포인트 표 파싱 실패: ${key}`).toBeTruthy();
      expect(ui.split(ch).length - 1, `${key} @ui_text`).toBe(n);
    }
    // 축 혼동 실증 — EM DASH 는 UI 0 · 83 전량 5. 축을 안 가르면 여기서 갈린다.
    expect(ui.split("—").length - 1).toBe(0);
    expect(all.split("—").length - 1).toBe(5);
    // ASCII 오염 0
    expect(RENDER.text_nodes).not.toContain("-");
    expect(RENDER.text_nodes).not.toContain("+");
  });

  it("border-width — **authored 문자열** 축 (computed 는 정수 device px 로 스냅한다)", () => {
    // 실측(Chromium 1194 · DPR 1 · 1440px): authored `1.5px` → computed `1px`.
    // computed 로 재면 1c 의 1.5px 강조 보더 2건이 1px 로 접혀 **검사에서 사라진다**.
    expect(RENDER.authored_border_widths).toEqual({ "1px": 26, "1.5px": 2 });
    expect(KEYS.map((k) => RENDER.sections[k].authored_border_widths)).toEqual([
      { "1px": 5 },
      { "1px": 7 },
      { "1px": 10, "1.5px": 2 },
      { "1px": 4 },
    ]);
    // 소수 px 가 살아 있다는 것 자체가 authored 축임의 증거다.
    expect(Object.keys(RENDER.authored_border_widths)).toContain("1.5px");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * ⛔ 축 C — fixture ↔ 제품 화면. **미배선.**
 * ═══════════════════════════════════════════════════════════════════════════ */
describe("§reorder-handoff ⛔ 축 C 미배선", () => {
  it("🛑 축 C 미배선 명시 — 제품 화면 산출물은 이 파일에 없다", () => {
    // 이 단언은 '없음' 을 잠근다. 남겨두지 않으면 축 A·B GREEN 이 **제품 정합으로 읽힌다.**
    // 축 C 배선 시 이 it 을 실 대조로 **교체**할 것 —
    //   ① Next 앱 실행 + 시드 데이터로 /quotes/{rfqId}/prepare 등 4화면 렌더
    //   ② 그때는 `_대조규칙.seed_dependent.적용시점 = 축 C 한정` 이 발효 →
    //      11슬롯을 `_시드종속.패턴` 형태 앵커로 전환(축 B 의 값 대조는 그대로 둔다)
    expect(Object.keys(RENDER)).not.toContain("product_render_nodes");
    expect(RENDER._축, "렌더 산출물이 스스로 '제품 아님' 을 선언해야 한다").toContain("제품 화면이 아니다");
    expect(fixture._대조규칙.seed_dependent.적용시점).toBe("축 C 한정");
  });
});
