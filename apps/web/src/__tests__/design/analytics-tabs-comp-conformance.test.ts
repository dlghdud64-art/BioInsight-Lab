/**
 * §analytics-tabs — 지출 분석 탭 개선 COMP 적합성 게이트 (축 B 배선)
 *
 * 🛑 **눈으로 확인하지 않는다.** COMP fixture 의 레이블·토큰을 고정하고
 *    **시안 실렌더 산출물**과 문자열/값 대조한다. 불일치 1건 = RED.
 *
 * 🛑 **축을 먼저 읽을 것.** 한쪽 GREEN 을 다른 쪽 GREEN 으로 읽는 것이
 *    이 저장소가 반복해서 만난 형태다.
 *
 *   ┌ 축 A — fixture 자기 무결성 + 비교기 정밀도 ────────────────────────────
 *   │  입력이 fixture 자신이다. 잠그는 것: fixture 내부 정합 + 비교기 탐지력.
 *   │  잠그지 **못하는** 것: 시안 정합 · 제품 화면 정합. 둘 다 아니다.
 *   ├ 축 B — fixture ↔ **시안 실렌더** (2026-08-16 배선) ───────────────────
 *   │  actual = `analytics-tabs-comp.render.json`
 *   │         = 시안 HTML 헤드리스 실렌더(Chromium 1194 · 뷰포트 4종 동일 실측).
 *   │  🛑 actual 은 **반드시 렌더 산출물**이다. fixture 를 fixture 로 대조하는
 *   │     자기참조 게이트를 만들지 않는다.
 *   │  잠그는 것: fixture 라벨·토큰이 **시안 렌더에 실재**한다(중복 개수까지).
 *   │  잠그지 **못하는** 것: **제품 화면 정합.** actual 은 시안이지 제품이 아니다.
 *   └ 축 C — fixture ↔ 제품 소스 ─── **analytics-tabs-impl-conformance.test.ts** (2026-08-16 배선)
 *      🔁 2026-08-16 갱신: 축 C 는 배선됐다. `page.tsx` authored 문자열 ↔ fixture
 *      `expect` 대조 20슬롯 GREEN. **본 파일의 잠금 범위는 그대로다** —
 *      여기의 actual 은 여전히 시안 렌더뿐이고, 아래 단언은 그 사실을 잠근다.
 *      ⚠️ 축 C 도 **렌더 박스·정렬은 잠그지 않는다**(입력원이 소스 문자열이다).
 *         히트 영역 44px · 밑줄 정렬 실측 2건은 세 축 어디에도 없다 — 미완이다.
 *
 * 🛑 **테스트 런타임에 렌더하지 않는다.** `.render.json` 은 `_analytics_comp_probe.mjs`
 *    로 **선도출**한 스냅샷이다. 시안이 바뀌면(source_sha256 변경) 프로브 재실행이
 *    **선행**이다 — 레포 밖 파일이라 in-test 재계산 불가.
 *
 * 등급 한계 — GREEN 은 무결 증명이 아니다:
 *   - 분리 계상(UI / labels[0] / annotation / doc_header)은 **분류 판단**에 의존한다(실측 아님)
 *   - 축 B 는 **스냅샷 대조**다. 시안이 바뀌면 스냅샷이 조용히 낡는다
 *   - md 잠금 2슬롯은 **명시적 제외**다 (아래 AXIS_B_EXCLUDED_SLOTS). 제외분은 이 축이 안 잡는다
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 게이트 자기검증 — 변이 6종 전부 RED 확인
 *   (2026-08-16 · 컨테이너 /tmp 격리 vitest 3.1.1 · 호영님 node_modules 미오염 · 확인 후 원복)
 *
 *   ① 렌더 라벨 1건 손상  1a.ui '종합 현황' → '종합 현황_CORRUPT'
 *        → RED ✅  2건 실패 [다중집합 완전 일치 · 중복 개수까지 일치]
 *   ② 중복 1건만 제거      1c.ui 에서 '지출 분석' 1건 삭제 (×3 → ×2)
 *        → RED ✅  3건 실패 [UI 텍스트 24 · 다중집합 완전 일치 · 중복 개수까지 일치]
 *        ⚠️ **Set 대조였다면 통과한다** — 유니크 집합(11종)이 그대로다. 다중집합이라야 잡힌다.
 *   ③ 노드 1건 삭제        text_nodes 40 → 39
 *        → RED ✅  1건 실패 [렌더 앵커 40]
 *   ④ 뷰포트 카운트 드리프트 viewports['3840'].text_nodes 40 → 39
 *        → RED ✅  1건 실패 [렌더 앵커 40 — 뷰포트별 라벨링으로 3840 이 지목된다]
 *   ⑤ 부분 로딩            text_node_total 40 → 20 · counts.ui_text 24 → 12 · 4뷰포트 20
 *        → RED ✅  2건 실패 [렌더 앵커 40 · 합 40]
 *        ⚠️ 대조 자체는 통과한다(섹션 ui 는 그대로). **앵커가 잡는다** — 앵커를 낮추면 위장된다.
 *   ⑥ 제외 목록 남용       AXIS_B_EXCLUDED_SLOTS 에 슬롯 1개 추가 (길이 2 → 3)
 *        → RED ✅  1건 실패 [제외 목록 길이 2]
 *   정상(무변이)           → GREEN ✅ 19/19 · **오탐 0**
 * ─────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect } from "vitest";
import fixture from "../fixtures/analytics-tabs-comp.json";
import renderFixture from "../fixtures/analytics-tabs-comp.render.json";

/* ── 타입 ────────────────────────────────────────────────────────────── */

type SpecSlot = { id: string; md: string; anchor: string };
type FixtureSection = {
  label_count: number;
  labels: string[];
  colors: Record<string, number>;
  radius: number[];
  font_sizes: number[];
  annotation_excluded_count: number;
  spec_slots: SpecSlot[];
};
const FIX = fixture as unknown as {
  source_sha256: string;
  source_bytes: number;
  total_label_count: number;
  mockup_render_label_count: number;
  doc_header_excluded_count: number;
  sections: Record<string, FixtureSection>;
  spec_slots_공통: SpecSlot[];
  _md_override: Record<string, unknown>;
  _앵커: { render_text_node_count: number; render_element_count: number };
};

type RenderTab = {
  tag: string;
  text: string;
  authored_style: string;
  authored_border_bottom_width: string;
  authored_border_radius: string;
  authored_padding: string;
  authored_background: string;
  computed_border_bottom_width: string;
  computed_border_radius: string;
};
type RenderSection = {
  section_badge: string;
  eyebrow: string;
  ui: string[];
  ui_count: number;
  annotation_box: string[];
  annotation_excluded_count: number;
  radius: number[];
  font_sizes: number[];
  colors: Record<string, number>;
  colors_items: number;
  colors_sum: number;
  tab_row: RenderTab[] | null;
};
/** 축 B 입력 — 시안 실렌더 스냅샷. **제품 화면 아님.** */
const RENDER = renderFixture as unknown as {
  source: string;
  source_path: string;
  source_sha256: string;
  source_bytes: number;
  derived_at: string;
  engine: Record<string, string | number>;
  extraction: Record<string, string>;
  population: Record<string, string | number>;
  viewports_tested: number[];
  viewports: Record<string, { text_nodes: number; elements: number; element_count_document: number; pageError: number; consoleError: number }>;
  page_errors: number;
  text_node_total: number;
  text_nodes: string[];
  counts: { ui_text: number; eyebrow_labels0: number; annotation_excluded: number; doc_header_excluded: number; sum: number };
  doc_header: string[];
  sections: Record<string, RenderSection>;
};

const KEYS = ["1a", "1b", "1c"] as const;

/* ── 앵커 ────────────────────────────────────────────────────────────── */

const ANCHOR_FIXTURE_LABELS = 28;   // 정본 = 시안 실측 27 + 채택 1
const ANCHOR_MOCKUP_LABELS = 27;    // 시안 실측
const ANCHOR_TEXT_NODES = 40;       // 렌더 텍스트노드 (#dc-root 서브트리)
const ANCHOR_ELEMENTS = 65;         // 🛑 #dc-root 서브트리 모집단. document 전체는 81 — 대조 금지
const ANCHOR_ELEMENTS_DOCUMENT = 81;

/* 분리 계상 — 합계만 단언하면 축이 안 잡힌다. 각 항을 개별 단언한다. */
const ANCHOR_UI_TEXT = 24;
const ANCHOR_EYEBROW = 3;           // labels[0] = 시안 자체 라벨
const ANCHOR_ANNOTATION = 10;       // 섹션 배지 3 + 주석 박스 7
const ANCHOR_DOC_HEADER = 3;

const SOURCE_SHA256 = "8edc9f9b21eb37933bcd38a061d55422d1a9a3780daeff4ceb93f11d95aa0a4e";

/* ── 🔴 md 잠금 2슬롯 = 축 B 대조의 **명시적 예외** ─────────────────────
 *
 * C fixture 는 아래 2슬롯을 **md 기준으로 잠갔다.** 시안과 의도적으로 다르다.
 * 축 B 를 전량 대조하면 이 **의도된 차이가 RED 로 뜬다.**
 *
 * 🛑 제외는 **묵시가 아니라 명시**다. 목록을 상수로 두고 **길이(2)를 단언**한다.
 *    늘어나면 RED — 제외 남용 방어.
 * 🛑 두 슬롯은 **다른 종류의 불일치**다. 같이 묶어 읽으면 ②가 시안 위반으로 오독된다.
 */
const AXIS_B_EXCLUDED_SLOTS = [
  {
    id: "S14-tab-style-underline-desktop",
    section: "1c",
    md_override: "1c-tab-style-underline",
    kind: "시안이_md_위반",
    // ① **진짜 시안 위반.** md §2 line 32 는 탭 스타일 밑줄형 통일을 요구하는데
    //    시안 1c 는 칩형(radius 10px · padding 8px 15px · 선택 bg #2563eb · border-bottom 0)으로
    //    그렸다. fixture 는 md 를 정본으로 잠갔으므로(시안 파일은 수정하지 않음)
    //    fixture ↔ 시안 대조 시 의도된 차이가 난다. → 이 슬롯만 대조 제외.
    //    폐기근거: md §1 line 17 "칩 스타일 폐기 — 필터로 오인됨".
    //    모바일에서 칩을 버린 이유가 데스크톱에서 사라지지 않는다.
  },
  {
    id: "S3-tab-selected-token",
    section: "1b",
    md_override: "1b-tab-underline-2_5px",
    kind: "렌더_측정층_아티팩트",
    // ② **시안 위반이 아니다.** 시안 authored 는 `border-bottom: 2.5px` 로 md 와 **일치**한다.
    //    Chromium 이 border-width 를 정수 device px 로 스냅해 computed 가 2px 로 잡힐 뿐이다
    //    (deviceScaleFactor 1·2 양쪽 동일). 정본이 아닌 것은 시안이 아니라 **렌더 computed 값**이다.
    //    → border-width 계열은 **authored 문자열**로 검사한다. computed 로 검사하면 영구 RED.
  },
] as const;

/* ── 비교기 — 🛑 다중집합(배열). Set 대조 금지 ──────────────────────────
 * Set 으로 대조하면 중복이 접혀 **줄어든 것이 통과로 읽힌다.** */
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

/** 대조 대상 = labels[0](시안 자체 라벨 = eyebrow) 제외 — 분류 판단. 직전 fixture 형식 승계. */
const target = (k: string) => FIX.sections[k].labels.slice(1);

/**
 * 채택 delta — 정본 28 = 시안 실측 27 + `누적 시` 1건(1b 모바일 추가, md 미명세 보강).
 * 축 B 의 actual 은 시안이므로 **이 1건을 빼야** 시안 실측 축과 같은 모집단이 된다.
 * 🛑 상수로 명시한다. 대조 함수 안에서 조용히 필터링하면 다음 세션이 근거를 못 찾는다.
 */
const ADOPTED_NOT_IN_MOCKUP = [{ section: "1b", label: "누적 시" }] as const;
const mockupTarget = (k: string) => {
  const drop = ADOPTED_NOT_IN_MOCKUP.filter((a) => a.section === k).map((a) => a.label);
  const out = target(k);
  for (const d of drop) out.splice(out.indexOf(d), 1);
  return out;
};

const allSlots = (): SpecSlot[] => [
  ...KEYS.flatMap((k) => FIX.sections[k].spec_slots),
  ...FIX.spec_slots_공통,
];

/* ═══════════════════════════════════════════════════════════════════════
 * 축 B 입력 무결성 — 스냅샷이 **어느 시안의 실렌더인지** 잠근다
 * ═══════════════════════════════════════════════════════════════════════ */
describe("§analytics-tabs 축 B 입력 — 렌더 스냅샷 무결성", () => {
  it("도출 출처 앵커 — fixture 와 .render.json 이 같은 시안(sha256 · bytes)을 가리킨다", () => {
    // 레포 밖 파일이라 in-test 재계산 불가. 해시가 바뀌면 **프로브 재실행이 선행**이라는 계약을 잠근다.
    expect(RENDER.source_sha256).toBe(SOURCE_SHA256);
    expect(FIX.source_sha256).toBe(SOURCE_SHA256);
    expect(RENDER.source_bytes).toBe(FIX.source_bytes);
    expect(RENDER.derived_at).toBe("2026-08-16");
  });

  it("렌더 앵커 40 — 뷰포트 4종(390/1440/1920/3840) 전부 동일 · pageError 0", () => {
    // 앵커를 낮추면 부분 로딩(언팩 미완)이 '불일치 0' 으로 위장한다.
    expect(RENDER.viewports_tested).toEqual([390, 1440, 1920, 3840]);
    const vps = Object.entries(RENDER.viewports);
    expect(vps).toHaveLength(4);
    for (const [w, v] of vps) {
      expect(v.text_nodes, `vp ${w} 텍스트노드`).toBe(ANCHOR_TEXT_NODES);
      expect(v.elements, `vp ${w} 요소(#dc-root)`).toBe(ANCHOR_ELEMENTS);
      expect(v.pageError, `vp ${w} pageError`).toBe(0);
    }
    expect(RENDER.page_errors).toBe(0);
    expect(RENDER.text_node_total).toBe(ANCHOR_TEXT_NODES);
    expect(RENDER.text_nodes).toHaveLength(ANCHOR_TEXT_NODES);
    expect(FIX._앵커.render_text_node_count).toBe(ANCHOR_TEXT_NODES);
  });

  it("🛑 모집단 앵커 — 전 요소 65 는 #dc-root 서브트리다. document 81 과 대조 금지", () => {
    // 65 vs 81 의 차 16 = 번들러 로딩 UI. 모집단을 안 적으면 다음 세션이 81 을 불일치로 읽는다.
    expect(FIX._앵커.render_element_count).toBe(ANCHOR_ELEMENTS);
    expect(RENDER.population.element_count_root).toBe(ANCHOR_ELEMENTS);
    expect(RENDER.population.element_count_document).toBe(ANCHOR_ELEMENTS_DOCUMENT);
    expect(ANCHOR_ELEMENTS_DOCUMENT - ANCHOR_ELEMENTS).toBe(16);
    // 모집단 표기가 스냅샷 안에 **문자열로 남아 있어야** 한다 (다음 세션 오독 방어)
    expect(String(RENDER.population.text_nodes)).toContain("#dc-root");
    expect(String(RENDER.population.elements)).toContain("#dc-root");
    expect(String(RENDER.population._document_주의)).toContain("대조 금지");
    // 렌더 산출물이어야 한다 — 정적 추출/수기 입력이면 여기서 걸린다
    expect(String(RENDER.engine.executable)).toContain("chrome");
    expect(RENDER.extraction.walker).toContain("TreeWalker");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 분리 계상 — 🛑 합계만 단언하면 축이 안 잡힌다. **각 항을 개별 단언**한다.
 *   UI 24 + labels[0] 3 + annotation 10 + doc_header 3 = 40
 * ═══════════════════════════════════════════════════════════════════════ */
describe("§analytics-tabs 축 B 분리 계상 — 4항 개별 단언", () => {
  it("① UI 텍스트 24 — 시안 실측 라벨 27 에서 labels[0] 3 을 뺀 값", () => {
    const sum = KEYS.reduce((n, k) => n + RENDER.sections[k].ui.length, 0);
    expect(sum).toBe(ANCHOR_UI_TEXT);
    for (const k of KEYS) expect(RENDER.sections[k].ui_count, k).toBe(RENDER.sections[k].ui.length);
    expect(KEYS.map((k) => RENDER.sections[k].ui.length)).toEqual([7, 8, 9]);
    expect(ANCHOR_UI_TEXT + ANCHOR_EYEBROW).toBe(ANCHOR_MOCKUP_LABELS);
  });

  it("② labels[0] 시안 자체 라벨(eyebrow) 3 — 대조 대상 아님", () => {
    const eyebrows = KEYS.map((k) => RENDER.sections[k].eyebrow);
    expect(eyebrows.filter(Boolean)).toHaveLength(ANCHOR_EYEBROW);
    // 렌더 eyebrow 가 fixture labels[0] 과 같아야 분류 판단이 성립한다
    for (const k of KEYS) expect(RENDER.sections[k].eyebrow, k).toBe(FIX.sections[k].labels[0]);
  });

  it("③ annotation_excluded 10 = 섹션 배지 3 + 주석 박스 7", () => {
    const badges = KEYS.map((k) => RENDER.sections[k].section_badge);
    expect(badges).toEqual(["1a", "1b", "1c"]);
    const boxes = KEYS.reduce((n, k) => n + RENDER.sections[k].annotation_box.length, 0);
    expect(badges).toHaveLength(3);
    expect(boxes).toBe(7);
    expect(badges.length + boxes).toBe(ANCHOR_ANNOTATION);
    // fixture 의 섹션별 계상과도 일치해야 한다 (1a 3 · 1b 3 · 1c 4)
    for (const k of KEYS) {
      expect(RENDER.sections[k].annotation_excluded_count, k).toBe(FIX.sections[k].annotation_excluded_count);
    }
    // ⚠️ 주석에는 시안 생성 파이프라인 오염 문자열이 들어 있다. **fixture 에 안 들어가야 한다.**
    //    실제 식별자는 `activeTab` 이다 — `sc-camel-active-tab` 은 오염이지 코드 심볼이 아니다.
    const anno = KEYS.flatMap((k) => RENDER.sections[k].annotation_box).join(" ");
    expect(anno).toContain("sc-camel-active-tab");
    const fixtureLabels = KEYS.flatMap((k) => FIX.sections[k].labels).join(" ");
    expect(fixtureLabels).not.toContain("sc-camel-active-tab");
    expect(KEYS.flatMap((k) => RENDER.sections[k].ui).join(" ")).not.toContain("sc-camel-active-tab");
  });

  it("④ doc_header 3 — 섹션 밖 시안 문서 제목(배지 + 제목 + 부제)", () => {
    expect(RENDER.doc_header).toHaveLength(ANCHOR_DOC_HEADER);
    expect(RENDER.counts.doc_header_excluded).toBe(ANCHOR_DOC_HEADER);
    expect(FIX.doc_header_excluded_count).toBe(ANCHOR_DOC_HEADER);
    expect(RENDER.doc_header[0]).toBe("1");
  });

  it("합 40 — 4항 개별 앵커의 합이 렌더 총량과 일치 (합계 단독 채택 금지)", () => {
    expect(RENDER.counts.ui_text).toBe(ANCHOR_UI_TEXT);
    expect(RENDER.counts.eyebrow_labels0).toBe(ANCHOR_EYEBROW);
    expect(RENDER.counts.annotation_excluded).toBe(ANCHOR_ANNOTATION);
    expect(RENDER.counts.doc_header_excluded).toBe(ANCHOR_DOC_HEADER);
    expect(ANCHOR_UI_TEXT + ANCHOR_EYEBROW + ANCHOR_ANNOTATION + ANCHOR_DOC_HEADER).toBe(ANCHOR_TEXT_NODES);
    expect(RENDER.counts.sum).toBe(ANCHOR_TEXT_NODES);
    expect(RENDER.counts.sum).toBe(RENDER.text_node_total);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 축 B 본대조 — fixture 라벨 ↔ 시안 실렌더 UI 텍스트 (다중집합)
 * ═══════════════════════════════════════════════════════════════════════ */
describe("§analytics-tabs 축 B — fixture ↔ 시안 실렌더 다중집합 대조", () => {
  it("정본 28 = 시안 실측 27 + 채택 1('누적 시' 1b 모바일 추가)", () => {
    const sum = KEYS.reduce((n, k) => n + FIX.sections[k].labels.length, 0);
    expect(FIX.total_label_count).toBe(ANCHOR_FIXTURE_LABELS);
    expect(sum).toBe(ANCHOR_FIXTURE_LABELS);
    expect(FIX.mockup_render_label_count).toBe(ANCHOR_MOCKUP_LABELS);
    expect(ADOPTED_NOT_IN_MOCKUP).toHaveLength(ANCHOR_FIXTURE_LABELS - ANCHOR_MOCKUP_LABELS);
    // 채택 라벨은 1b 시안에 **없고** 1c 시안에는 **있다** — 이게 채택의 근거다
    expect(RENDER.sections["1b"].ui).not.toContain("누적 시");
    expect(RENDER.sections["1c"].ui).toContain("누적 시");
    expect(FIX.sections["1b"].labels).toContain("누적 시");
  });

  it("🛑 다중집합 완전 일치 — 섹션별 missing 0 · extra 0", () => {
    for (const k of KEYS) {
      const r = compareLabels(mockupTarget(k), RENDER.sections[k].ui);
      expect(r.missing, `${k} — 시안 렌더에 없는 fixture 라벨`).toEqual([]);
      expect(r.extra, `${k} — fixture 에 없는 시안 렌더 라벨`).toEqual([]);
      expect(r.ok, k).toBe(true);
    }
    // 전량 축으로도 한 번 더 — 섹션 간 라벨 이동이 섹션별 대조에서 상쇄되지 않도록
    const exp = KEYS.flatMap((k) => mockupTarget(k));
    const act = KEYS.flatMap((k) => RENDER.sections[k].ui);
    expect(exp).toHaveLength(ANCHOR_UI_TEXT);
    expect(act).toHaveLength(ANCHOR_UI_TEXT);
    expect(compareLabels(exp, act)).toEqual({ ok: true, missing: [], extra: [] });
  });

  it("중복 개수까지 일치 — Set 대조였다면 통과할 형태를 잡는다", () => {
    const count = (a: string[], s: string) => a.filter((x) => x === s).length;
    const act = KEYS.flatMap((k) => RENDER.sections[k].ui);
    const exp = KEYS.flatMap((k) => mockupTarget(k));
    const DUP = [
      ["지출 분석", 3],
      ["종합 현황", 3],
      ["공급사 의존도", 3],
      ["이상 지출 감지", 3],
      ["📄 AI 리포트 예시", 3],
      ["✨ AI 리포트 생성", 3],
      ["LabAxis", 2],
    ] as const;
    for (const [s, n] of DUP) {
      expect(count(exp, s), `fixture ${s}`).toBe(n);
      expect(count(act, s), `렌더 ${s}`).toBe(n);
    }
    // Set 으로 접으면 24 → 11 로 줄어든다. 그 축에서는 중복 1건 유실이 안 보인다.
    expect(new Set(act).size).toBe(11);
    expect(act).toHaveLength(ANCHOR_UI_TEXT);
    // 중복 종수 자체도 앵커 — 새 중복이 생기면 위 표가 낡았다는 뜻이다
    const m = new Map<string, number>();
    for (const s of act) m.set(s, (m.get(s) ?? 0) + 1);
    expect([...m.values()].filter((v) => v > 1)).toHaveLength(DUP.length);
  });

  it("특수문자 · em dash 범위 — 정규화되면 대조가 조용히 깨진다", () => {
    const ui = KEYS.flatMap((k) => RENDER.sections[k].ui);
    expect(ui).toContain("📄 AI 리포트 예시");           // 이모지 U+1F4C4 — 텍스트 대체 금지
    expect(ui).toContain("✨ AI 리포트 생성");            // U+2728
    expect(ui).toContain("AI 리포트 생성 · 완료된 발주 1건 이상 필요"); // 가운뎃점 U+00B7
    // em dash 금지 범위 = **화면 노출 라벨**. UI 24 에 0건이어야 한다.
    for (const s of ui) expect(s, `UI 라벨 em dash: ${s}`).not.toContain("—");
    // 반면 시안 자체 라벨 · 문서 헤더 · 주석은 적용 범위 **밖** — 여기엔 남아 있는 게 정상이다
    expect(KEYS.map((k) => RENDER.sections[k].eyebrow).join(" ")).toContain("—");
    expect(RENDER.doc_header.join(" ")).toContain("—");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 토큰 3축 — fixture 기록값 ↔ 독립 재렌더
 *   colors : fixture 자기 무결성 전용(렌더 computed 와 모집단이 다름) — 선언 토큰 축으로만 대조
 *   radius : **전 요소** 측정 (텍스트노드 부모만 재면 컨테이너 radius 를 놓친다)
 *   border-width : **authored 문자열** 검사 (computed 는 영구 RED)
 * ═══════════════════════════════════════════════════════════════════════ */
describe("§analytics-tabs 축 B — 토큰 3축", () => {
  it("radius — 섹션 래퍼 전 요소 authored 측정, 3섹션 일치", () => {
    for (const k of KEYS) expect(RENDER.sections[k].radius, k).toEqual(FIX.sections[k].radius);
    // 배지 radius 7px 은 프레임 밖(섹션 배지)에 있다 — 프레임만 재면 놓친다
    expect(RENDER.sections["1a"].radius).toContain(7);
    expect(RENDER.sections["1c"].radius).toContain(99); // '누적 시' 배지 pill
  });

  it("font_sizes — 3섹션 일치 (authored 값. computed 는 상속 16px 이 모집단을 오염시킨다)", () => {
    for (const k of KEYS) expect(RENDER.sections[k].font_sizes, k).toEqual(FIX.sections[k].font_sizes);
    expect(RENDER.sections["1c"].font_sizes).toContain(9.5); // '누적 시' 배지
    expect(RENDER.extraction.radius_font).toContain("authored");
  });

  it("colors — 항목 수 + 합계 둘 다 앵커 (fixture 자기 무결성 지표)", () => {
    const sum = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);
    const ANCH = { "1a": [12, 25], "1b": [13, 22], "1c": [11, 28] } as const;
    for (const k of KEYS) {
      expect([Object.keys(FIX.sections[k].colors).length, sum(FIX.sections[k].colors)], k).toEqual([...ANCH[k]]);
      expect([RENDER.sections[k].colors_items, RENDER.sections[k].colors_sum], k).toEqual([...ANCH[k]]);
      expect(RENDER.sections[k].colors, k).toEqual(FIX.sections[k].colors);
    }
    // 3자리 shorthand 확장 규칙이 살아 있어야 한다 — 안 그러면 #fff 와 #ffffff 가 갈린다
    expect(RENDER.extraction.colors).toContain("shorthand");
    expect(Object.keys(RENDER.sections["1a"].colors)).not.toContain("#fff");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 🔴 md 잠금 2슬롯 — 축 B 대조의 **명시적 예외**
 * ═══════════════════════════════════════════════════════════════════════ */
describe("§analytics-tabs 축 B — md 잠금 2슬롯 명시적 예외", () => {
  it("🛑 제외 목록 길이 2 — 늘어나면 RED (제외 남용 방어)", () => {
    expect(AXIS_B_EXCLUDED_SLOTS).toHaveLength(2);
    // 제외 슬롯은 fixture 에 **실재**해야 한다 — 오타/낡은 id 로 조용히 제외되지 않도록
    const ids = allSlots().map((s) => s.id);
    for (const ex of AXIS_B_EXCLUDED_SLOTS) expect(ids, ex.id).toContain(ex.id);
    // 제외 근거는 fixture `_md_override` 에 **등재**돼 있어야 한다
    const overrideKeys = Object.keys(FIX._md_override).filter((k) => !k.startsWith("_"));
    expect(overrideKeys).toHaveLength(2);
    expect([...AXIS_B_EXCLUDED_SLOTS].map((e) => e.md_override).sort()).toEqual([...overrideKeys].sort());
    // 두 슬롯은 **다른 종류**의 불일치다 — 같은 kind 로 묶으면 ②가 시안 위반으로 오독된다
    expect(new Set(AXIS_B_EXCLUDED_SLOTS.map((e) => e.kind)).size).toBe(2);
    // 제외분 외에는 전량 대조 대상이다
    expect(allSlots().length - AXIS_B_EXCLUDED_SLOTS.length).toBe(20 - 2);
  });

  it("제외 ① S14 — 시안 1c 가 실제로 칩형임을 렌더가 증명한다 (진짜 시안 위반)", () => {
    // 이 단언은 **제외를 자기무효화**한다. 시안이 밑줄형으로 고쳐지면 여기서 RED 가 나고
    // "제외가 낡았다 — 목록에서 빼라" 는 신호가 된다. 제외가 영구 면죄부가 되지 않게 한다.
    const tabs = RENDER.sections["1c"].tab_row;
    expect(tabs, "1c 탭 행 미검출").not.toBeNull();
    for (const t of tabs!) {
      expect(t.authored_border_radius, t.text).toBe("10px");   // 칩 토큰
      expect(t.authored_padding, t.text).toBe("8px 15px");
      expect(t.computed_border_radius, t.text).toBe("10px");
      // 밑줄 longhand 0건. ⚠️ 비선택 칩은 `border: 1px solid` 축약을 쓰므로
      //    computed borderBottomWidth 는 1px 이다 — 그건 칩 테두리이지 밑줄이 아니다.
      expect(t.authored_style, t.text).not.toContain("border-bottom");
    }
    expect(tabs![0].authored_background).toContain("rgb(37, 99, 235)"); // 선택 = 칩 bg #2563eb
    // fixture 는 정반대(밑줄형)로 잠겨 있다 — 그래서 축 B 대조에서 뺀다
    const s14 = allSlots().find((s) => s.id === "S14-tab-style-underline-desktop")!;
    expect(String((s14 as unknown as { expect: string }).expect)).toContain("밑줄형");
    expect(s14.md).toContain("§2 line 32");
  });

  it("제외 ② S3 — authored 2.5px = md 일치. computed 2px 은 측정층 아티팩트 (시안 위반 아님)", () => {
    const sel = RENDER.sections["1b"].tab_row?.[0];
    expect(sel, "1b 선택 탭 미검출").toBeDefined();
    // 🛑 **authored 문자열** 검사. 시안은 md(2.5px)를 지켰다.
    expect(sel!.authored_border_bottom_width).toBe("2.5px");
    expect(sel!.authored_style).toContain("border-bottom: 2.5px solid rgb(37, 99, 235)");
    // 🛑 computed 는 Chromium 이 정수 device px 로 스냅한 값이다 — 이걸로 검사하면 영구 RED
    expect(sel!.computed_border_bottom_width).toBe("2px");
    expect(parseFloat(sel!.authored_border_bottom_width)).not.toBe(
      parseFloat(sel!.computed_border_bottom_width),
    );
    // fixture 잠금값도 2.5px — 값은 같고 **근거가 다르다**(시안이 틀린 게 아니라 렌더 측정이 틀렸다)
    const s3 = allSlots().find((s) => s.id === "S3-tab-selected-token")!;
    const s3exp = (s3 as unknown as { expect: { border_bottom: string; font_size: number } }).expect;
    expect(s3exp.border_bottom).toBe("2.5px solid #2563eb");
    expect(String(s3exp.border_bottom)).toContain(sel!.authored_border_bottom_width);
    // 같은 슬롯의 authored 검사 가능한 나머지 토큰은 시안과 일치한다 (제외는 두께 축에 한정)
    expect(sel!.authored_style).toContain(`font-size: ${s3exp.font_size}px`);
    expect(sel!.authored_style).toContain("margin-bottom: -1px");
    // 스냅샷 규격에 authored 검사 계약이 문자열로 남아 있어야 한다
    expect(RENDER.extraction.border_width).toContain("authored");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * ⛔ 이 파일이 잠그지 **못하는** 것 — 축 C 는 별도 파일이 진다
 * ═══════════════════════════════════════════════════════════════════════ */
describe("§analytics-tabs — 이 파일의 축 경계(제품 산출물 0건)", () => {
  it("🛑 이 파일의 actual 은 시안 렌더뿐이다 — 제품 산출물 0건(축 C 는 impl 파일이 진다)", () => {
    // 이 단언은 '없음' 을 잠근다. 축 C 실 대조는 analytics-tabs-impl-conformance.test.ts.
    // 남겨두면 축 A·B GREEN 이 제품 정합으로 오독된다 — §7.6 적용 지점은 **구현 화면**이다.
    expect(Object.keys(RENDER)).not.toContain("product_render_nodes");
    expect(Object.keys(RENDER)).not.toContain("product_source_sha256");
    // actual 의 출처는 시안 HTML 이다. 제품 소스를 가리키면 축이 뒤섞인 것이다.
    expect(RENDER.source).toContain(".html");
    expect(String(RENDER.source_path)).not.toContain("apps/web/src");
    expect(String(RENDER.source_path)).not.toContain("page.tsx");
    expect(JSON.stringify(RENDER.engine)).not.toContain("next");
    // spec_slots 의 anchor 는 전부 page.tsx 를 가리킨다 = 축 C 대상이다.
    // 그 축은 **여기서 한 번도 실행되지 않는다.**
    expect(allSlots().every((s) => s.anchor.includes("page.tsx"))).toBe(true);
  });
});
