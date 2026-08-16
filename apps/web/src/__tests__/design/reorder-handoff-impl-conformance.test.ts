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
 *                   🛑 무변이 baseline 이 GREEN 이 아니라 **RED 1**(④ 미이행)이다.
 *                      검출 판정은 건수가 아니라 **어느 it 이 지목되는지**로 한다.
 *   ④ 대체 매칭     이 파일: 수치 전용 라벨("1"·"0"·"9"·"종")은 소스 어디서나 매칭되어
 *                   무효 단언이 된다 → NUMERIC_SEED 로 제외하고 축 B 병기.
 *                   형제 슬롯 전수 훑음: kpi.value 3 + qty.value 1 = 4건 전량.
 *
 * ── 커버리지 회계 (63슬롯) ──
 *   대조         37   구현 표면(1a·1b·1d)에서 실 대조
 *   병합 축약    -6   3그룹(1a.banner evidence · 1b.item evidence · 1b.no_vendor body)
 *   제외 가1      5   순수 기호 — lucide 컴포넌트라 문자열 부재가 정상. 축 B 가 잡는다
 *   제외 수치     4   시드 값 — 축 B 가 잡는다
 *   미이행 ④      1   md 명세 있으나 소스 부재. **RED** — 게이팅 아님
 *   게이팅 1c    18   라우트 미존재. 자기무효화 앵커가 항상 활성
 *   생략          1   1a.elision (시안 생략 표기, 제품 UI 아님)
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
 * 🛑 63슬롯은 **한 화면이 아니다.** 1c 만 미구현이고 나머지는 실행 가능한 표면이다.
 *    "63 전량 RED" 로 읽으면 45슬롯이 검사 밖에 남는다. */
const SURFACES: Record<string, string[]> = {
  "1a": ["app/dashboard/inventory/inventory-content.tsx", "components/inventory/mobile-inventory-view.tsx"],
  "1b": ["components/inventory/ReorderReviewSheet.tsx", "components/inventory/inventory-reorder-blocked-sheet.tsx"],
  "1c": [], // 미구현 — 아래 게이팅
  "1d": ["components/quotes/mobile-quotes-view.tsx", "app/dashboard/quotes/page.tsx"],
};
const surface = (sec: string) => SURFACES[sec].map(read).join("\n");

/** 1c 대상 라우트. 존재하면 게이팅이 낡은 것이고, 아래 앵커가 RED 로 알린다. */
const PREPARE_ROUTE = "app/quotes/[rfqId]/prepare/page.tsx";

/* ── fixture 슬롯 ─────────────────────────────────────────────────── */
type Slot = { slot: string; label: string; elision?: unknown; _시드종속?: { seed: string; fixed: string | null } };
const FIX = fixture as unknown as { sections: Record<string, { slots: Slot[] }> };
const SLOTS: Array<Slot & { sec: string }> = Object.entries(FIX.sections).flatMap(([sec, s]) =>
  s.slots.map((x) => ({ ...x, sec })),
);
const bySlot = (id: string) => {
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
  { slot: "1c.nav.back", glyph: "‹", 대체축: "축 B ✅ (1c 는 미구현이라 축 C 대상도 아님)" },
] as const;

/** (④ 대체 매칭) 수치 전용 라벨. "1" 은 소스 어디서나 매칭되어 **무효 단언**이 된다. */
const NUMERIC_SEED = [
  { slot: "1a.kpi.total.value", label: "1", 대체축: "축 B ✅ · 값은 시드" },
  { slot: "1a.kpi.below_safety.value", label: "1", 대체축: "축 B ✅ · 값은 시드" },
  { slot: "1a.kpi.expiring.value", label: "0", 대체축: "축 B ✅ · 값은 시드" },
  { slot: "1b.qty.value", label: "9", 대체축: "축 B ✅ · 값은 시드" },
] as const;

/** 🔴 md 명세가 있는데 소스에 없다. **미구현이 아니라 미이행**이다 — 표면은 실행 가능하다. */
const UNIMPLEMENTED = [
  {
    slot: "1d.card.origin",
    md: "재발주 견적 핸드오프 흐름.md:38 — `재고관리 재발주안에서 생성 · 2026. 8. 1.` (연도 포함 표기 통일)",
    표면: "components/quotes/mobile-quotes-view.tsx (존재)",
    성격: "카드 origin 행 신설 필요. 소스 수정 대기 — 이 트랙 범위 밖",
  },
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

  it("🔴 미이행 목록 1건 — 늘어나면 RED (조용히 2·3건이 되지 않게)", () => {
    expect(UNIMPLEMENTED.length).toBe(1);
    for (const u of UNIMPLEMENTED) expect(u.md).toMatch(/\.md:/);
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

  it("🔴 미이행 — md 명세 있으나 소스 부재 (1d.card.origin · 소스 수정 대기)", () => {
    // 🛑 이 RED 는 **회귀가 아니다.** md(재발주 견적 핸드오프:38)가 카드 origin 행을
    //    `재고관리 재발주안에서 생성 · 2026. 8. 1.` 로 명세했는데 소스에 그 행이 없다.
    //    표면(mobile-quotes-view.tsx)은 실행 가능하므로 **게이팅 대상이 아니다** —
    //    라우트가 없어 검사를 못 도는 1c 와 성격이 다르다.
    //    origin 행이 생기면 이 it 이 자동으로 GREEN 이 된다.
    expect(hasLabel("1d", "1d.card.origin").probe).toBe("재고관리 재발주안에서 생성");
    expect(hasLabel("1d", "1d.card.origin").ok).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * 1c — 발송 준비 (미구현 · 라우트 게이팅)
 * ═══════════════════════════════════════════════════════════════════ */
describe("§reorder-handoff 축 C — 1c 발송 준비 (라우트 게이팅)", () => {
  const routeExists = existsSync(p(PREPARE_ROUTE));

  /** 🛑 항상 활성 — 게이팅 자체를 잠근다. 라우트가 생기면 이 it 이 RED 로 "게이팅이 낡았다" 고 알린다.
   *    화이트리스트가 아니라 3층(자기무효화)이다: 해제가 코드 판별형이다. */
  it("prepare 라우트 미존재 — 1c 게이팅이 유효한 근거", () => {
    expect(existsSync(p(PREPARE_ROUTE))).toBe(false);
  });

  it("게이팅 범위는 1c 18슬롯뿐 — 1a·1b·1d 45슬롯은 즉시 활성이다", () => {
    expect(SLOTS.filter((s) => s.sec === "1c")).toHaveLength(18);
    expect(SLOTS.filter((s) => s.sec !== "1c")).toHaveLength(45);
    expect(SURFACES["1c"]).toHaveLength(0);
    for (const sec of ["1a", "1b", "1d"]) expect(SURFACES[sec].length).toBeGreaterThan(0);
  });

  it.runIf(routeExists)("라우트 생성 시 — 1c 라벨 전량 대조", () => {
    const src = read(PREPARE_ROUTE);
    const missing: string[] = [];
    for (const s of SLOTS.filter((x) => x.sec === "1c")) {
      if (EXCLUDED_GLYPH_ONLY.some((e) => e.slot === s.slot)) continue;
      const probe = s._시드종속 ? s._시드종속.fixed : s.label;
      if (probe === null || probe === undefined) continue; // 전량 시드 — 값 대조 금지
      if (!src.includes(stripGlyphs(probe))) missing.push(`${s.slot} :: ${probe}`);
    }
    expect({ 미일치: missing }).toEqual({ 미일치: [] });
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

  it("커버리지 회계 — 63 = 대조 + 제외 + 미이행 + 게이팅 + 생략", () => {
    const total = SLOTS.length;
    const 게이팅 = SLOTS.filter((s) => s.sec === "1c").length;
    const 생략 = SLOTS.filter((s) => s.elision).length;
    const 제외 = EXCLUDED_GLYPH_ONLY.filter((e) => e.slot.slice(0, 2) !== "1c").length + NUMERIC_SEED.length;
    expect(total).toBe(63);
    expect(게이팅).toBe(18);
    expect(생략).toBe(1);
    expect(제외).toBe(8); // 가1 4(1c 제외분 1건 빼고) + 수치 4
    expect(UNIMPLEMENTED.length).toBe(1);
  });
});
