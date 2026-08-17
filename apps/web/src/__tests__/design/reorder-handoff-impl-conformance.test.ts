// @vitest-environment node
//
// 🛑 이 파일만 node 환경이다(프로젝트 기본값은 jsdom, vitest.config.ts:19).
//    입력원이 **소스 문자열 하나**임을 런타임 사실로 잠근다.
//    격리 러너는 vitest.config.ts 를 안 쓰므로 수치가 갈린다 — 정본은 프로젝트 러너다.
/**
 * §reorder-handoff — 재발주 → 견적 핸드오프 COMP 적합성 게이트 (**축 C 배선**)
 *
 * actual = **제품 소스의 authored 문자열**. 시안이 아니다.
 *   ┌ 축 A — fixture 자기 무결성 ───── reorder-handoff-comp-conformance.test.ts
 *   ├ 축 B — fixture ↔ 시안 실렌더 ─── 같은 파일 (.render.json)
 *   └ 축 C — fixture ↔ **제품 소스** ─ 이 파일 (2026-08-16 배선)
 *
 * 🛑 fixture 필드 지위 (CLAUDE.md §fixture 필드 지위 분리):
 *      정본 필드   `label` · `_시드종속.fixed`   ← 기계 검사는 이것만 쓴다
 *      작업지시 필드 (없음) — 이 fixture 에는 anchor 계열이 없어 오염 위험 0
 *
 * ── 4원칙 적용 표 (CLAUDE.md §정규식 sentinel — 빈칸이면 land 금지) ──
 *   ① 접두사 경계   이 파일: 문자열 검사는 `includes` 기반이라 속성 정규식 없음.
 *                   정규식을 쓰는 3곳(골격 대조)은 전부 리터럴 앵커 + 제한 창.
 *   ② 창 시작점     이 파일: 창은 표면 파일 **전체**다(슬라이스 없음). 부분 창 0.
 *   ③ 검출력 실증   변이 프로브 별도 실행 · 러너 = **프로젝트 vitest**.
 *                   🛑 무변이 baseline 이 GREEN 이 아니라 **RED it 1**(1c 미이행 3슬롯 묶음)이다.
 *                      검출 판정은 건수가 아니라 **어느 it 이 지목되는지**로 한다.
 *   ④ 대체 매칭     이 파일: 수치 전용 라벨("1"·"0"·"9"·"종")은 소스 어디서나 매칭되어
 *                   무효 단언이 된다 → NUMERIC_SEED 로 제외하고 축 B 병기.
 *                   형제 슬롯 전수 훑음: kpi.value 3 + qty.value 1 = 4건 전량.
 *
 * ── 커버리지 회계 (63슬롯) ──
 *   대조         47   구현 표면(1a·1b·1c·1d)에서 실 대조
 *   병합 축약    -6   3그룹(1a.banner evidence · 1b.item evidence · 1b.no_vendor body)
 *   제외 가1      5   순수 기호 — lucide 컴포넌트라 문자열 부재가 정상. 축 B 가 잡는다
 *   제외 수치     4   시드 값 — 축 B 가 잡는다
 *   미이행        3   md 명세 있으나 소스 부재. **RED** — 1c 문안 1(panel_title) + 신설 2
 *   대기열 이관    2   1d.card.origin · 1c.header.origin — 스키마 부재(§quote-source-field)
 *   🆕 도달 불가   1   1c.item.badge — 소스엔 있으나 항상 거짓인 게이트 안
 *   게이팅         0   🔁 2026-08-16 해제. 1c 는 라우트가 아니라 쿼리 패널이었다
 *   생략          1   1a.elision (시안 생략 표기, 제품 UI 아님)
 *
 * 🛑 이 축이 잠그지 못하는 것: 렌더 박스 · 정렬 · **도달성**.
 *    소스에 문자열이 있어도 항상 거짓인 게이트 안이면 렌더되지 않는다.
 *    실례 1c.item.badge — sourceMeta:null 게이트 안에서 GREEN 이었다(2026-08-16 발견).
 *
 * 🛑 제외 ≠ 삭제. 목록은 상수 + **길이 잠금**이고, 슬롯마다 **대체 축**을 병기한다.
 *    어느 축도 안 잡으면 그건 제외가 아니라 커버리지 구멍이다(2026-08-16 실측: 구멍 0).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import fixture from "../fixtures/reorder-handoff-comp.json";

const SRC_DIR = join(__dirname, "..", "..");
const p = (rel: string) => join(SRC_DIR, rel);
const read = (rel: string) => readFileSync(p(rel), "utf8");

/* ── 대상 표면 ─────────────────────────────────────────────────────────
 * 🛑 63슬롯은 **한 화면이 아니다.** 네 섹션이 각기 다른 표면을 겨냥한다.
 *    "63 전량 RED" 로 읽으면 45슬롯이 검사 밖에 남는다. */
const SURFACES: Record<string, string[]> = {
  "1a": ["app/dashboard/inventory/inventory-content.tsx", "components/inventory/mobile-inventory-view.tsx"],
  "1b": ["components/inventory/ReorderReviewSheet.tsx", "components/inventory/inventory-reorder-blocked-sheet.tsx"],
  /* 🔁 2026-08-16 정정 — 구 판정 "1c 미구현(라우트 0건)" 이 **틀렸다.**
   *    `existsSync(route)` 하나로 화면 유무를 판정했는데, 1c 는 라우트가 아니라
   *    **쿼리 패널**(`/dashboard/quotes?prepare=<id>`)로 구현돼 있다.
   *    🛑 라우트 존재 ≠ 화면 존재. 게이팅은 통과시키는 쪽이라 조용했다 —
   *       8건의 실 일치가 검사 밖에 있었고 6건의 미이행이 은폐됐다. */
  "1c": ["components/quotes/prepare/quote-prepare-panel.tsx"],
  "1d": ["components/quotes/mobile-quotes-view.tsx", "app/dashboard/quotes/page.tsx"],
};
const surface = (sec: string) => SURFACES[sec].map(read).join("\n");

/** 1c 진입 경로 — 라우트가 아니라 쿼리 패널이다. 라우트가 생기면 앵커가 RED 로 알린다. */
const PREPARE_PANEL = "components/quotes/prepare/quote-prepare-panel.tsx";
const PREPARE_ROUTE = "app/quotes/[rfqId]/prepare/page.tsx";

/* ── fixture 슬롯 ─────────────────────────────────────────────────── */
type Slot = { slot: string; label: string; elision?: unknown; _시드종속?: { seed: string; fixed: string | null } };
const FIX = fixture as unknown as { sections: Record<string, { slots: Slot[] }> };
const SLOTS: Array<Slot & { sec: string }> = Object.entries(FIX.sections).flatMap(([sec, s]) =>
  s.slots.map((x) => ({ ...x, sec })),
);
const bySlot = (id: string): Slot & { sec: string } => {
  const s = SLOTS.find((x) => x.slot === id);
  if (!s) throw new Error(`fixture 슬롯 없음: ${id}`);
  return s;
};

/* ── 제외 목록 — 삭제가 아니다. 길이 잠금 + 대체 축 병기 ───────────── */

/** (가1) 순수 기호. 소스는 lucide 컴포넌트를 쓰므로 문자열 부재가 **정상**이다. */
const EXCLUDED_GLYPH_ONLY = [
  { slot: "1a.banner.icon", glyph: "🛒", 대체축: "축 B (시안 정적 HTML 에 실재 — 2026-08-16 실측 ✅)" },
  { slot: "1b.close", glyph: "✕", 대체축: "축 B ✅" },
  { slot: "1b.qty.minus", glyph: "−", 대체축: "축 B ✅ (U+2212, ASCII 하이픈 아님)" },
  { slot: "1b.qty.plus", glyph: "＋", 대체축: "축 B ✅ (U+FF0B)" },
  { slot: "1c.nav.back", glyph: "‹", 대체축: "축 B ✅ (순수 기호 — lucide ChevronLeft)" },
] as const;

/** (④ 대체 매칭) 수치 전용 라벨. "1" 은 소스 어디서나 매칭되어 **무효 단언**이 된다. */
const NUMERIC_SEED = [
  { slot: "1a.kpi.total.value", label: "1", 대체축: "축 B ✅ · 값은 시드" },
  { slot: "1a.kpi.below_safety.value", label: "1", 대체축: "축 B ✅ · 값은 시드" },
  { slot: "1a.kpi.expiring.value", label: "0", 대체축: "축 B ✅ · 값은 시드" },
  { slot: "1b.qty.value", label: "9", 대체축: "축 B ✅ · 값은 시드" },
] as const;

/* ── 🆕 도달 불가 (2026-08-16) ────────────────────────────────────────
 * 소스에 문자열이 **있지만** 항상 거짓인 게이트 안이라 렌더되지 않는다.
 * 🛑 축 C 는 존재는 보지만 **도달은 못 본다.** GREEN 으로 세면 회계가 부풀려진다.
 *    `Render-Reachability`(dead file)의 **분기 단위 버전**이다.
 *
 * 전수 스캔 방법(2026-08-16): 4섹션 표면이 게이트로 쓰는 prop 중 호출부에서
 *   리터럴 `null`/`false` 로 넘어가는 것을 찾고, 그 게이트 블록 안의 fixture 라벨을 판정.
 * ⚠️ 스캔 한계 — 이걸 "전수" 로 읽지 말 것:
 *   · 리터럴 null 이 **어느 한 호출부에** 있으면 잡히지만, 다른 호출부가 실값을 넘기면 도달 가능하다.
 *     `sourceMeta` 는 호출부가 **1곳뿐**임을 별도 확인했다(QuotePreparePanel importer = page.tsx).
 *   · **계산식이지만 항상 거짓인** 게이트는 못 잡는다(리터럴이 아니므로).
 *   · 런타임 도달성은 결국 축이 다르다 — 실브라우저 측정만이 최종 판정이다. */
const UNREACHABLE = [
  {
    slot: "1c.item.badge",
    label: "재고관리에서 연동",
    gate: "quote.sourceMeta && ( … )  @ quote-prepare-panel.tsx:126",
    사유: "호출부(app/dashboard/quotes/page.tsx:4419)가 sourceMeta: null 하드코딩 — 분기가 열리지 않는다",
    해제: "§quote-source-field 가 Quote.sourceType 을 넣고 sourceMeta 를 채우면 도달 가능해진다",
  },
] as const;

/** 🔴 md 명세가 있는데 소스에 없다. **미구현이 아니라 미이행**이다 — 표면은 실행 가능하다. */
const UNIMPLEMENTED = [
  /* 🔁 2026-08-16 이관 — `1d.card.origin` 을 이 목록에서 **내렸다.**
   *
   *   이 목록의 정의는 "md 명세 있으나 **소스** 부재" 다.
   *   ④는 소스 부재가 아니라 **스키마 부재**였다 — 성격이 다르므로 같은 목록에 두면
   *   다음 세션이 카드 렌더만 고치러 간다(③↔④ 를 가른 것과 같은 이유).
   *
   *   실측: `Quote` 모델에 출처 축 **0건**. `CartItem` 에는 있다:
   *         CartItem.sourceType (MANUAL|REORDER|SEARCH) + sourceId
   *         → 카드 1행 문제가 아니라 **모델 간 축 불일치**다.
   *   `specialNotes` 문자열 조립은 그 부재를 우회한 흔적이고,
   *   역파싱 금지가 md 에 박혔으므로(1bb18679) 우회로는 닫혔다.
   *
   *   → 대기열 카드 §quote-source-field (docs/handoff/CARD_quote-source-field.md)
   *   🛑 되살림 경로: 스키마 트랙이 `Quote.sourceType` 을 넣으면
   *      `1d.card.origin` + `1c.header.origin` 을 **재등재**하고 길이 잠금 5 → 7,
   *      그리고 UNREACHABLE 의 `1c.item.badge` 를 실 대조로 승격한다(도달 가능해지므로).
   *      그게 정상 경로다 — 안 되돌리면 md 명세 3건이 영구히 잠금 밖에 남는다. */
  /* 🔁 2026-08-16 신규 등재 — 게이팅 해제로 **은폐가 풀린** 분.
   *    구 게이팅이 1c 18슬롯을 통째로 검사 밖에 뒀다. 해제 후 실측:
   *      이행 7 · 도달불가 1(item.badge) · 대기열 1(header.origin) · 미이행 5 · 전량시드 4 = 18
   *    미이행이 늘어난 것은 악화가 아니라 **은폐 해제**다. */
  { slot: "1c.item.evidence", md: "08-01 md §1c — `근거 자동 첨부`", 표면: PREPARE_PANEL, 성격: "근거 첨부 표기 부재" },
  { slot: "1c.vendor.panel_title", md: "08-01 md §1c — `받을 공급사를 지정하세요`", 표면: PREPARE_PANEL, 성격: "패널 제목 문안 불일치" },
  { slot: "1c.vendor.add_email", md: "08-01 md §1c line 29 — `이메일로 추가`", 표면: PREPARE_PANEL, 성격: "진입 버튼 부재" },
] as const;

/* ── 정규화 ─────────────────────────────────────────────────────────
 * 🛑 **단방향이다.** fixture 라벨에서만 기호를 벗기고 **소스는 원문 그대로** 본다.
 *    소스를 정규화하면 소스에 남은 기호 회귀를 못 잡는다. */
const GLYPHS = /[←-⇿①-⓿■-➿⬀-⯿＋−‹›\u{1F000}-\u{1FAFF}]/gu;
const stripGlyphs = (s: string) => s.replace(GLYPHS, "").replace(/\s+/g, " ").trim();

/* ── 대조 도우미 ───────────────────────────────────────────────────── */
const hasLabel = (sec: string, id: string) => {
  const s = bySlot(id);
  const probe = s._시드종속 ? s._시드종속.fixed : s.label;
  if (probe === null || probe === undefined) throw new Error(`정본 값 없음(전량 시드): ${id}`);
  return { probe, ok: surface(sec).includes(probe) };
};
const hasStripped = (sec: string, id: string) => {
  const probe = stripGlyphs(bySlot(id).label);
  return { probe, ok: surface(sec).includes(probe) };
};

/* ═══════════════════════════════════════════════════════════════════
 * 제외·미이행 목록 규율 — 길이 잠금
 * ═══════════════════════════════════════════════════════════════════ */
describe("§reorder-handoff 축 C — 목록 규율(제외 남용 방어)", () => {
  it("(가1) 순수 기호 제외 5건 — 늘어나면 RED", () => {
    expect(EXCLUDED_GLYPH_ONLY.length).toBe(5);
    for (const e of EXCLUDED_GLYPH_ONLY) {
      expect(bySlot(e.slot).label).toContain(e.glyph);
      expect(e.대체축).toMatch(/축 B/); // 🛑 대체 축이 없으면 제외가 아니라 커버리지 구멍이다
    }
  });

  it("(④) 수치 전용 시드 제외 4건 — 늘어나면 RED", () => {
    expect(NUMERIC_SEED.length).toBe(4);
    for (const n of NUMERIC_SEED) {
      expect(bySlot(n.slot).label).toBe(n.label);
      expect(/^[0-9]+$/.test(n.label)).toBe(true); // 수치 전용임이 자기검증된다
      expect(n.대체축).toMatch(/축 B/);
    }
  });

  it("🆕 도달 불가 목록 1건 — 늘어나면 RED · 게이트가 열리면 RED(자기무효화)", () => {
    expect(UNREACHABLE.length).toBe(1);
    for (const u of UNREACHABLE) {
      // 라벨이 소스에 **실재**해야 한다 — 없으면 도달불가가 아니라 미이행이다
      expect(surface(u.slot.slice(0, 2))).toContain(u.label);
      expect(u.해제).toMatch(/quote-source-field/);
    }

    /* 🛑 자기무효화 — 게이트가 열리면(sourceMeta 가 리터럴 null 이 아니게 되면) RED.
     *    "도달 가능해졌으니 실 대조로 승격하라" 를 알린다. 화이트리스트가 아니라 3층이다. */
    const callSite = read("app/dashboard/quotes/page.tsx");
    expect(callSite.length).toBeGreaterThan(1000); // 무효 단언 방어
    expect(callSite).toMatch(/sourceMeta:\s*null/);
  });

  it("🔴 미이행 목록 3건 — 늘어나면 RED (조용히 4·5건이 되지 않게)", () => {
    expect(UNIMPLEMENTED.length).toBe(3); // 1c 3건. em dash 2건 이행(커밋 A) · origin 2건 대기열
    for (const u of UNIMPLEMENTED) expect(u.md).toMatch(/md/); // 근거 md 병기 필수
    // 🛑 축 구분: **슬롯 축 7** ≠ **it 축 2**(1d 1건 + 1c 6건 묶음 1건).
    //    "RED 7" 로 세면 vitest 출력과 안 맞는다. 이 저장소가 반복해서 만난 축 혼동이다.
    expect(UNIMPLEMENTED.filter((u) => u.slot.startsWith("1c."))).toHaveLength(3);
    // 🛑 1d 는 0 이어야 한다 — 스키마 트랙이 되살릴 때 1 로 올린다(길이 잠금 6 → 7)
    expect(UNIMPLEMENTED.filter((u) => u.slot.startsWith("1d."))).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * 1a — 재고 관리 (구현됨)
 * ═══════════════════════════════════════════════════════════════════ */
describe("§reorder-handoff 축 C — 1a 재고 관리", () => {
  it("헤더 3슬롯", () => {
    for (const id of ["1a.header.title", "1a.header.subtitle"]) expect(hasLabel("1a", id).ok).toBe(true);
    expect(hasStripped("1a", "1a.header.cta_add").ok).toBe(true); // (가2) `＋ 재고 등록` → `재고 등록`
  });

  it("KPI 라벨 3슬롯 (값 3건은 NUMERIC_SEED 제외)", () => {
    for (const id of ["1a.kpi.total.label", "1a.kpi.below_safety.label", "1a.kpi.expiring.label"])
      expect(hasLabel("1a", id).ok).toBe(true);
    expect(hasLabel("1a", "1a.kpi.total.unit").ok).toBe(true);
  });

  it("재발주 배너 — 제목(시드 fixed)과 CTA", () => {
    expect(hasLabel("1a", "1a.banner.title").probe).toBe("재발주 검토 권장");
    expect(hasLabel("1a", "1a.banner.title").ok).toBe(true);
    expect(hasLabel("1a", "1a.banner.cta").ok).toBe(true);
  });

  it("배너 근거 — 병합 대조(시안 span 분할은 표시 구조이지 문안 계약이 아니다)", () => {
    // _병합: 1a.banner.evidence_prefix + evidence_qty + evidence_suffix
    // 소스는 `현재 <b>{qty}{unit}</b> · 안전재고 {n} 대비 {gap} 부족` 로 조립한다.
    expect(["1a.banner.evidence_prefix", "1a.banner.evidence_qty", "1a.banner.evidence_suffix"].map(
      (id) => bySlot(id).slot,
    )).toHaveLength(3);
    // 창 폭은 **실측치**다(추정 금지). 2026-08-16: 현재→안전재고 149자 · 안전재고→부족 102자.
    // JSX 의 <b> span + 템플릿 리터럴이 사이를 벌린다. 여유 포함 240/200.
    expect(surface("1a")).toMatch(/현재[\s\S]{0,240}?안전재고[\s\S]{0,200}?부족/);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * 1b — 재발주안 요약 시트 (구현됨)
 * ═══════════════════════════════════════════════════════════════════ */
describe("§reorder-handoff 축 C — 1b 재발주안 요약", () => {
  it("칩·제목 (가2 기호 분리)", () => {
    expect(hasStripped("1b", "1b.chip.ai").ok).toBe(true); // `✦ AI 권장` → `AI 권장`
    expect(hasStripped("1b", "1b.sheet.title").ok).toBe(true); // `🛒 재발주안 요약` → `재발주안 요약`
    expect(hasLabel("1b", "1b.chip.below_safety").ok).toBe(true);
  });

  it("수량 스테퍼 — 라벨과 근거 골격 (± 2건은 가1 제외, 값은 수치 시드)", () => {
    expect(hasLabel("1b", "1b.qty.label").ok).toBe(true);
    // 1b.qty.basis 는 md `근거 항목별 노출`(재고 관리 델타:15)의 시드 렌더 결과다.
    // 소스는 템플릿 조립이므로 **골격**으로 대조한다 — 값 대조는 축 B 몫.
    expect(surface("1b")).toMatch(/부족 \{[\s\S]{0,80}?리드타임 소비 \{/);
  });

  it("품목 근거 — 병합 대조", () => {
    // _병합: 1b.item.evidence_prefix(시드 fixed `부족`) + evidence_qty + evidence_suffix
    expect(hasLabel("1b", "1b.item.evidence_prefix").probe).toBe("부족");
    expect(surface("1b")).toMatch(/현재[\s\S]{0,120}?부족/);
    expect(surface("1b")).toMatch(/보관 위치/);
  });

  it("공급사 없음 안내 — 3조각 병합(소스는 한 문장)", () => {
    // _병합: 1b.no_vendor.body_1 + body_2 + body_3
    // 🛑 body_2·3 개별 통과는 오탐이 아니라 정탐이었다 — 합친 문장의 부분 문자열로 실재한다.
    expect(hasLabel("1b", "1b.no_vendor.title").ok).toBe(true);
    expect(surface("1b")).toMatch(/초안을 만든 뒤[\s\S]{0,80}?공급사 지정 화면으로 이동/);
  });

  it("CTA 3슬롯 — 보조 CTA 는 md 정본 문안", () => {
    expect(hasLabel("1b", "1b.cta.primary").ok).toBe(true);
    expect(hasLabel("1b", "1b.cta.note").ok).toBe(true);
    // md 2곳(재발주 견적 핸드오프:22 · 소싱 견적 담기:35) + 시안 일치. 소스에 `먼저` 가 빠져 있었다.
    expect(hasLabel("1b", "1b.cta.secondary").probe).toBe("공급사 소싱에서 먼저 찾기");
    expect(hasLabel("1b", "1b.cta.secondary").ok).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * 1d — 견적 관리 (구현됨 · 미이행 1건 포함)
 * ═══════════════════════════════════════════════════════════════════ */
describe("§reorder-handoff 축 C — 1d 견적 관리", () => {
  it("헤더 2슬롯", () => {
    for (const id of ["1d.header.title", "1d.header.subtitle"]) expect(hasLabel("1d", id).ok).toBe(true);
  });

  it("카드 pill·CTA (가2 기호 분리)", () => {
    expect(hasStripped("1d", "1d.card.pill_stage").ok).toBe(true); // `● 발송 대기` → `발송 대기`
    expect(hasStripped("1d", "1d.card.cta").ok).toBe(true); // `공급사 지정하고 발송 →`
    expect(hasLabel("1d", "1d.card.pill_action").ok).toBe(true);
  });

  /* 🔁 2026-08-16 대기열 이관 — 구 계약은 이 슬롯을 **미이행 RED** 로 두었다.
   *   실측 결과 소스 부재가 아니라 **스키마 부재**다(`Quote` 에 출처 축 0건).
   *   md 는 조건절로 정합화됐다(1bb18679): 출처 미상이면 표기를 생략한다.
   *   → 지금 표기가 없는 것은 **현행 정합**이지 결함이 아니다. RED 를 내리는 근거다. */
  it("origin 2슬롯 — 대기열 이관(스키마 부재) · 되살림 앵커", () => {
    // 출처 축이 없으므로 표기 부재가 현행 정합이다 (md 조건절 1bb18679)
    expect(hasLabel("1d", "1d.card.origin").ok).toBe(false);
    /* 🔁 1c.header.origin 합류 — 같은 vm · 같은 Quote 레코드 · 같은 출처 축 부재.
     *    차이는 렌더 배선 유무뿐이고 패널은 배선돼 있다(sourceMeta 조립)
     *    → 스키마가 들어오면 자동 이행된다. 미이행이 아니라 대기열이다. */
    expect(hasLabel("1c", "1c.header.origin").ok).toBe(false);

    /* 🛑 자기무효화 앵커 — `Quote.sourceType` 이 생기면 이 단언이 RED 로
     *    "대기열에서 내려올 때다" 를 알린다. 화이트리스트가 아니라 3층이다.
     *    §quote-source-field 가 스키마를 넣으면 UNIMPLEMENTED 길이 6 → 7 로 되돌린다. */
    const schema = readFileSync(join(SRC_DIR, "..", "prisma", "schema.prisma"), "utf8");
    const quoteModel = schema.slice(schema.indexOf("model Quote {"), schema.indexOf("model QuoteTemplate"));
    expect(quoteModel.length).toBeGreaterThan(100); // 슬라이스가 실제로 잡혔는지(무효 단언 방어)
    expect(quoteModel).not.toMatch(/source(Type|Kind|Id)\s/);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * 1c — 발송 준비 (미구현 · 라우트 게이팅)
 * ═══════════════════════════════════════════════════════════════════ */
describe("§reorder-handoff 축 C — 1c 발송 준비 (게이팅 해제 · 즉시 활성)", () => {
  /* 🔁 은퇴→승계 (2026-08-16)
   *   구 앵커: `prepare 라우트 미존재 — 1c 게이팅이 유효한 근거`
   *            → **전제가 틀렸다.** 라우트 부재를 화면 부재로 읽었다.
   *   신 앵커: 진입 경로를 잠근다. 목적("경로가 바뀌면 알린다")은 그대로 유효하므로
   *            폐기가 아니라 **재조준**이다. */
  it("prepare 화면 = 쿼리 패널 — 진입 경로 잠금", () => {
    expect(existsSync(p(PREPARE_PANEL))).toBe(true);
    // `?prepare=<id>` 진입 배선이 실재한다(리스트 → 패널 복귀 경로)
    expect(read("components/quotes/mobile-quotes-view.tsx")).toMatch(/\?prepare=|prepare=\$\{/);
    // 🛑 라우트가 나중에 생기면 진입 경로가 둘이 된다 — 그때 이 앵커가 RED 로 알린다
    expect(existsSync(p(PREPARE_ROUTE))).toBe(false);
  });

  it("게이팅 0 — 63슬롯 전량이 검사 대상이다", () => {
    expect(SLOTS.filter((s) => s.sec === "1c")).toHaveLength(18);
    for (const sec of ["1a", "1b", "1c", "1d"]) expect(SURFACES[sec].length).toBeGreaterThan(0);
  });

  it("1c 라벨 대조 — 미이행분은 UNIMPLEMENTED 가 따로 잠근다", () => {
    const src = surface("1c");
    const known = new Set<string>([
      ...UNIMPLEMENTED.map((u) => u.slot),
      ...UNREACHABLE.map((u) => u.slot), // 도달불가 — 소스엔 있으나 렌더 안 됨. 별도 it 이 잠근다
      "1c.header.origin", // 대기열 이관 — 되살림 앵커가 잠근다
    ]);
    const missing: string[] = [];
    for (const s of SLOTS.filter((x) => x.sec === "1c")) {
      if (EXCLUDED_GLYPH_ONLY.some((e) => e.slot === s.slot)) continue;
      if (known.has(s.slot)) continue; // 미이행 등재분 — 아래 별도 it 이 RED 로 지목
      const probe = s._시드종속 ? s._시드종속.fixed : s.label;
      if (probe === null || probe === undefined) continue; // 전량 시드 — 값 대조 금지
      if (!src.includes(stripGlyphs(probe))) missing.push(`${s.slot} :: ${probe}`);
    }
    expect({ 미일치: missing }).toEqual({ 미일치: [] });
  });

  it("🔴 1c 미이행 3건 — 게이팅 해제로 드러난 분 (은폐 해제)", () => {
    const src = surface("1c");
    const still: string[] = [];
    for (const u of UNIMPLEMENTED.filter((x) => x.slot.startsWith("1c."))) {
      const s = bySlot(u.slot);
      const probe = s._시드종속 ? s._시드종속.fixed : s.label;
      if (probe && !src.includes(stripGlyphs(probe))) still.push(`${u.slot} :: ${probe}`);
    }
    expect({ 미이행_잔존: still }).toEqual({ 미이행_잔존: [] });
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * 이 축이 잠그지 못하는 것
 * ═══════════════════════════════════════════════════════════════════ */
describe("§reorder-handoff 축 C — 잠그지 못하는 것 (등급 한계 명시)", () => {
  it("🛑 입력원은 소스 문자열뿐이다 — 렌더 박스·정렬·시드 값은 이 축이 안 잡는다", () => {
    expect(typeof (globalThis as unknown as { document?: unknown }).document).toBe("undefined");
    expect(typeof surface("1a")).toBe("string");
  });

  it("커버리지 회계 — 63 = 대조 + 제외 + 미이행 + 대기열 + 도달불가 + 생략 (게이팅 0)", () => {
    const total = SLOTS.length;
    const 생략 = SLOTS.filter((s) => s.elision).length;
    const 제외 = EXCLUDED_GLYPH_ONLY.length + NUMERIC_SEED.length;
    const 대기열 = 2; // 1d.card.origin · 1c.header.origin — 스키마 부재. §quote-source-field
    const 도달불가 = UNREACHABLE.length; // 1c.item.badge

    expect(total).toBe(63);
    expect(생략).toBe(1);
    expect(제외).toBe(9); // 가1 5(1c 포함 — 게이팅 해제로 1c 도 대상이다) + 수치 4
    expect(UNIMPLEMENTED.length).toBe(3);
    expect(도달불가).toBe(1);

    // 🛑 게이팅 0 — 2026-08-16 해제. 어떤 섹션도 검사 밖에 없다
    for (const sec of ["1a", "1b", "1c", "1d"]) expect(SURFACES[sec].length).toBeGreaterThan(0);

    // 회계가 닫히는지 — 잔여가 실 대조분이다
    const 대조 = total - 생략 - 제외 - UNIMPLEMENTED.length - 대기열 - 도달불가;
    expect(대조).toBe(47);
    // 회계 닫힘: 63 = 47 + 9 + 3 + 2 + 1 + 1
    expect(대조 + 제외 + UNIMPLEMENTED.length + 대기열 + 도달불가 + 생략).toBe(63);
  });
});
