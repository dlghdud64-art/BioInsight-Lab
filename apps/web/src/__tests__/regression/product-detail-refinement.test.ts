/**
 * §product-detail-refinement — 소싱 제품 상세 정보밀도·CTA 정리 (Phase 1 계약)
 *
 * 계획서: docs/plans/PLAN_product-detail-sourcing-refinement.md
 * 핸드오프: 소싱 제품 상세 핸드오프.md (2026-07-25)
 * 프로토타입: 소싱 제품 상세 개선 (단독).html → 토큰 실측 §0-B / yellow 환산 §0-C
 *
 * ⛔ 결정 교체 게이트 (호영님 승인 2026-07-25):
 *   D2 — PD-B / PD-C / PD-L 3개 결정을 교체한다.
 *   D5 — 색 토큰 = 프로토타입 amber hex 그대로(§0-B 8토큰).
 *        CEO 2026-06-21 §11.302 "완성도 = 시안 amber 톤(hex)" 예외 승인을 **승계**한다.
 *        §9 금지 대상은 Tailwind amber/orange **클래스** — 계약⑦ 이 0개를 계속 강제한다.
 *        ScanHubModal.tsx 의 동일 예외도 **무접촉**.
 *   D6 — buyer 권한 밖 3항목을 `정보 요청` 으로 수렴(dead button 0).
 *
 * 본 파일은 Phase 1 = RED. 전 계약이 현재 코드에서 FAIL 해야 정상이다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8");

/**
 * ⚠️ 본 계약 파일의 최대 결함원 — 2026-07-25 세션에서 **4회** 반복 발생.
 *
 *   `expect(SRC).not.toMatch(/삭제할 문구/)` 를 **원본 소스 전체**에 걸면, 그 문구를 언급한
 *   **주석까지 매칭**된다. 결과적으로 구현자는 코드가 아니라 **설명 주석을 지우거나 리워딩**해
 *   테스트를 통과시키게 된다 = 계약이 문서 품질을 깎아먹는다.
 *
 *   실제 사례: `더보기`(Phase 1 false-GREEN) · `#fbf0db`(3a) · `위험도`(3a, 주석 4곳 리워딩) ·
 *              `비교에 포함됨`/`견적함에 포함됨`(3b).
 *
 *   → **부정 단언(not.toMatch)은 반드시 `*_CODE`(주석 제거본)에 건다.**
 *      긍정 단언은 원본(`PAGE`/`COMP`/…)을 써도 무방하다.
 *      이제 주석은 "무엇을 왜 지웠는지" 를 계약 문구 그대로 적어도 안전하다.
 */
const stripComments = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "") // 블록 주석 + JSX {/* ... */}
    .replace(/^[ \t]*\/\/.*$/gm, ""); // 행 선두 라인 주석(URL 의 // 는 보존)
const PAGE = root("app/products/[id]/page.tsx");
const COMP = root("components/products/product-completeness.tsx");
const LIB = root("lib/product-detail/completeness.ts");
const CART = root("lib/quote/quote-cart-storage.ts");
const SAFETY = root("lib/utils/safety-visualization.ts");

/** 부정 단언 전용 — 주석 제거본. 삭제 대상 문구를 주석에 자유롭게 적을 수 있게 한다. */
const PAGE_CODE = stripComments(PAGE);
const COMP_CODE = stripComments(COMP);
const LIB_CODE = stripComments(LIB);
const CART_CODE = stripComments(CART);
const SAFETY_CODE = stripComments(SAFETY);

/* ─────────────────────────────────────────────────────────────
 * 계약 ① — 견적함 단일 품목 해제 (신규 mutation)
 *   현행 export = readQuoteCart / addToQuoteCart 2개뿐.
 *   해제 CTA 가 front-only 가 되지 않으려면 실 mutation 이 선행돼야 한다.
 * ───────────────────────────────────────────────────────────── */
describe("§refinement 계약① — removeFromQuoteCart 실 mutation", () => {
  it("단일 품목 제거 함수 export", () => {
    expect(CART).toMatch(/export function removeFromQuoteCart\(/);
  });
  it("read → filter → write 경로(스키마 무변경)", () => {
    expect(CART).toMatch(/QUOTE_CART_STORAGE_KEY/);
    expect(CART).toMatch(/removeFromQuoteCart[\s\S]{0,600}?\.filter\(/);
  });
  it("제거 후 quote-cart-changed 이벤트 발행(트레이·레일 동기화)", () => {
    expect(CART).toMatch(/removeFromQuoteCart[\s\S]{0,900}?quote-cart-changed/);
  });
  it("미존재 id 안전(throw 금지) — 결과 반환형 존재", () => {
    expect(CART).toMatch(/removeFromQuoteCart[\s\S]{0,600}?return\s*\{/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * 계약 ② — 체크리스트 역할별 액션 매트릭스 (D6)
 *   6항목 전부 액션 보유. buyer 에게 편집 라벨 노출 = FAIL. disabled = FAIL.
 * ───────────────────────────────────────────────────────────── */
describe("§refinement 계약② — 체크리스트 6항목 × 역할 분기", () => {
  it("액션 매핑이 파생 계층에 존재(컴포넌트 하드코딩 금지)", () => {
    expect(LIB).toMatch(/actionKind|ACTION_BY_FIELD|resolveCompletenessAction/);
  });
  it("역할 분기 존재(buyer / ADMIN·SUPPLIER)", () => {
    expect(COMP).toMatch(/canEditSpec|canEdit|role/);
  });
  it("buyer 에게 편집 라벨 미노출(권한 밖 3항목 = 정보 요청 수렴)", () => {
    expect(COMP).toMatch(/정보 요청/);
    expect(COMP).toMatch(/canEdit[\s\S]{0,400}?스펙 편집/);
    expect(COMP).toMatch(/canEdit[\s\S]{0,400}?안전 정보 편집/);
  });
  it("disabled 버튼 금지(액션 없으면 버튼을 만들지 않는다)", () => {
    expect(COMP_CODE).not.toMatch(/disabled(=\{true\}|\s*[/>])/);
  });
  it("6항목 2열 그리드 + 진행 바", () => {
    expect(COMP).toMatch(/grid-cols-2/);
    expect(COMP).toMatch(/등록이 필요한 정보/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * 계약 ③ — 데이터 0건 섹션 = 접힌 한 줄 + 액션 (PD-L 교체)
 *   현행: 빈 상세 스펙 카드를 buyer 에게 숨김. 핸드오프: 접힘 행으로 노출.
 * ───────────────────────────────────────────────────────────── */
describe("§refinement 계약③ — 접힘 행(공용 컴포넌트 3회 사용)", () => {
  it("공용 CollapsedRow 존재", () => {
    expect(PAGE).toMatch(/CollapsedRow/);
  });
  it("PD-L 숨김 게이트 폐기(buyer 에게도 미등록 사실 노출)", () => {
    expect(PAGE_CODE).not.toMatch(/\(product\.specification \|\| product\.regulatoryCompliance \|\| canEditSpec\) &&/);
  });
  it("행1 상세 스펙 · 미등록 · 정보 요청", () => {
    expect(PAGE).toMatch(/상세 스펙[\s\S]{0,300}?미등록[\s\S]{0,300}?정보 요청/);
  });
  it("행2 등록된 SDS 문서 · 0건 · SDS 업로드", () => {
    expect(PAGE).toMatch(/등록된 SDS 문서[\s\S]{0,300}?0건[\s\S]{0,300}?SDS 업로드/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * 계약 ④ — 담김 상태 주 CTA = 견적 요청서 만들기
 *   현행: inQuoteCart 여도 파란 대형 버튼이 주 CTA, 클릭 시 toast 만(이동 0) = no-op.
 * ───────────────────────────────────────────────────────────── */
describe("§refinement 계약④ — 우측 패널 CTA 위계", () => {
  it("담김 시 주 CTA 라벨 = 견적 요청서 만들기", () => {
    expect(PAGE).toMatch(/견적 요청서 만들기/);
  });
  it("주 CTA 목적지 = /dashboard/quotes (하단 트레이와 동일)", () => {
    expect(PAGE).toMatch(/견적 요청서 만들기[\s\S]{0,400}?\/dashboard\/quotes|\/dashboard\/quotes[\s\S]{0,400}?견적 요청서 만들기/);
  });
  it("담김 칩 한 줄 + 해제(배지 2개 분리 폐기)", () => {
    expect(PAGE).toMatch(/견적함·비교함에 담김/);
    expect(PAGE).toMatch(/해제/);
    expect(PAGE_CODE).not.toMatch(/비교에 포함됨/);
    expect(PAGE_CODE).not.toMatch(/견적함에 포함됨/);
  });
  it("해제가 실 mutation 호출(front-only success 금지)", () => {
    expect(PAGE).toMatch(/removeFromQuoteCart/);
  });
  it("담김 상태에서 toast-only 분기 폐기(no-op 제거)", () => {
    expect(PAGE_CODE).not.toMatch(/이미 견적함에 있습니다/);
  });
  it("보조 2분할 = 비교 검토 · 재고 조회(별도 stock-mini 카드 흡수)", () => {
    expect(PAGE).toMatch(/비교 검토/);
    expect(PAGE).toMatch(/재고 조회/);
    expect(PAGE_CODE).not.toMatch(/재고 현황을 <b[^>]*>재고 조회<\/b>로 확인하세요/);
  });
  it("다크 맞춤 견적 카드 폐기 → 푸터 텍스트 링크(/support 보존)", () => {
    expect(PAGE_CODE).not.toMatch(/from-gray-900 to-gray-800/);
    expect(PAGE).toMatch(/href="\/support"/);
  });
  it("가격 영역 = 견적 후 확정 1줄(3행 반복 테이블 폐기)", () => {
    expect(PAGE).toMatch(/견적 후 확정/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * 계약 ⑤ — 미등록 경고 3중 분산 → 1곳 (PD-C 교체)
 * ───────────────────────────────────────────────────────────── */
describe("§refinement 계약⑤ — 중복 경고 제거", () => {
  it("MSDS 미등록 배너 폐기(상단 체크리스트로 통합)", () => {
    expect(PAGE_CODE).not.toMatch(/MSDS\/SDS 미등록/);
  });
  it("위험도 칩에서 MSDS 병기 문구 제거", () => {
    expect(PAGE_CODE).not.toMatch(/위험도: \{safetyLevel\.label\} · MSDS/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * 계약 ⑥ — 규제 포털 상시 2 + 더보기 (접힘 행 3번째)
 * ───────────────────────────────────────────────────────────── */
describe("§refinement 계약⑥ — 규제 포털 축소", () => {
  it("버튼 grid 폐기 → 접힘 행 + 텍스트 링크", () => {
    expect(PAGE_CODE).not.toMatch(/grid-cols-2 md:grid-cols-2 lg:grid-cols-3/);
  });
  // ⚠️ Phase 1 gate 에서 false-GREEN 발견(2026-07-25) — 구 단언 `toMatch(/더보기/)` +
  //    `toMatch(/국내 규제기관 포털/)` 는 **컴플라이언스 링크 섹션의 기존 더보기(L862,
  //    showMoreComplianceLinks)** 와 기존 제목 문자열에 각각 매칭돼 구현 없이 통과했다.
  //    → 규제 포털 **전용** 식별자로 교체. 근접도 단언 필수.
  it("상시 2개 화이트리스트 = mfds · kchem 명시 고정", () => {
    expect(PAGE).toMatch(/REG_PORTAL_ALWAYS|"mfds"[\s\S]{0,120}?"kchem"/);
  });
  it("규제 포털 전용 더보기 상태(컴플라이언스 더보기와 별개 식별자)", () => {
    expect(PAGE).toMatch(/showMoreRegPortal|showAllRegPortal|regPortalExpanded/);
  });
  it("규제 포털이 CollapsedRow 로 렌더(카드 아님)", () => {
    expect(PAGE).toMatch(/CollapsedRow[\s\S]{0,400}?국내 규제기관 포털|국내 규제기관 포털[\s\S]{0,400}?CollapsedRow/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * 계약 ⑦ — 색 토큰 = 프로토타입 amber hex (D5, §0-C)
 *   hex amber = CEO 2026-06-21 §11.302 예외 승인 **승계**(철회 아님).
 *   금지 대상은 Tailwind amber/orange **클래스** — 이건 계속 0개여야 한다.
 *   대비: 텍스트 4.75~8.75 전부 AA / 바 fill 3.07 비텍스트 통과(§0-C).
 * ───────────────────────────────────────────────────────────── */
const AMBER_SET = [
  "#fffbeb", // 카드 bg (amber-50)
  "#fde68a", // 카드 border (amber-200)
  "#92400e", // 제목·퍼센트 (amber-800) 6.84
  "#fef3c7", // 진행 바 track (amber-100)
  "#d97706", // 진행 바 fill (amber-600) 3.07
  "#78350f", // 항목 텍스트 (amber-900) 8.75
  "#b45309", // 불릿·액션 라벨 (amber-700) 4.84
  "#a16207", // 하단 안내문 (yellow-700) 4.75
];
// 구 완성도 토큰 — 프로토타입 세트로 갱신되어 잔존 0 이어야 한다.
const LEGACY_HEX = ["#fbf0db", "#f0dcae", "#92610c", "#dd9011", "#f3e1b5"];

describe("§refinement 계약⑦ — 프로토타입 amber hex 정합(§0-C)", () => {
  it("§0-B amber 8토큰 전수 사용", () => {
    for (const hex of AMBER_SET) {
      expect(COMP).toMatch(new RegExp(hex));
    }
  });
  it("구 완성도 hex 잔존 0(프로토타입 세트로 갱신)", () => {
    for (const hex of LEGACY_HEX) {
      expect(COMP_CODE).not.toMatch(new RegExp(hex));
    }
  });
  it("상세 페이지에서 MSDS 배너 hex 동반 소멸(배너 삭제 결과)", () => {
    for (const hex of ["#fbf0db", "#f0dcae"]) {
      expect(PAGE_CODE).not.toMatch(new RegExp(hex));
    }
  });
  it("Tailwind amber/orange 클래스 0 유지(app-wide-amber-removed 가드 정합)", () => {
    // ⛔ hex 예외는 승계하되 클래스 금지는 불변. 이 단언을 완화하지 말 것.
    expect(COMP_CODE).not.toMatch(/-amber-\d|-orange-\d/);
    expect(PAGE_CODE).not.toMatch(/-amber-\d|-orange-\d/);
  });
  it("빨강 금지 보존(§11.302)", () => {
    expect(COMP_CODE).not.toMatch(/bg-red-|text-red-|border-red-/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * 회귀 0 — 본 트랙이 건드리지 않아야 하는 것
 * ───────────────────────────────────────────────────────────── */
describe("§refinement — 회귀 0(canonical truth 무접촉)", () => {
  it("완성도 분모 8필드 고정 보존(PD-B 계산 로직 불변)", () => {
    for (const k of [
      "catalogNumber", "specification", "regulatoryCompliance", "grade",
      "manufacturer", "usageDescription", "storageCondition", "msdsUrl",
    ]) {
      expect(LIB).toMatch(new RegExp(`key: "${k}"`));
    }
    expect(LIB).toMatch(/const total = COMPLETENESS_FIELDS\.length/);
    expect(LIB).toMatch(/known \/ total/);
  });
  it("100% 시 배지 숨김 보존", () => {
    expect(COMP).toMatch(/if \(pct >= 100\) return null/);
  });
  it("quote-cart 스키마 키 불변", () => {
    expect(CART).toMatch(/QUOTE_CART_STORAGE_KEY = "quote-cart-storage-v2"/);
    expect(CART).toMatch(/export function addToQuoteCart\(/);
    expect(CART).toMatch(/export function readQuoteCart\(/);
  });
  it("규제 링크 소스·면책 보존", () => {
    expect(PAGE).toMatch(/getRegulationLinksForProduct\(/);
    expect(PAGE).toMatch(/<Disclaimer type="safety"/);
  });
  it("완성도 컴포넌트 진입점 보존", () => {
    // ⚠️ 구 단언 `/<ProductCompleteness product=\{product\}/` 는 태그명과 prop 이 **한 줄 단일 공백**일 때만
    //    통과해, prop 이 늘어 여러 줄로 포맷되자 회귀로 오탐했다(2026-07-25). 서식 결합 제거.
    expect(PAGE).toMatch(/<ProductCompleteness[\s\S]{0,300}?product=\{product\}/);
  });
  it("PD-K 히어로 썸네일 보존(본 트랙 무접촉)", () => {
    expect(PAGE).toMatch(/w-20 h-20 md:w-24 md:h-24/);
  });
  // Phase 1 gate 후 추가 — 계약⑥ false-GREEN 의 원인이었던 별 블록을 명시 보존 대상으로 격리.
  it("컴플라이언스 링크 섹션 보존(규제 포털과 별 블록 — 본 트랙 무접촉)", () => {
    expect(PAGE).toMatch(/showMoreComplianceLinks/);
    expect(PAGE).toMatch(/filterComplianceLinksForProduct/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * 계약 ⑧ — D8 배선 + 미분류 고지 (D7 철회 후)
 *
 *   ⛔ **D7(체크리스트 위험도 행) 철회 — 2026-07-26.**
 *      전제가 틀렸다. "칩을 지우면 미분류가 사라진다" 고 봤으나, **히어로 키팩트가 이미
 *      `안전 위험도: 미분류` 를 표시**하고 있었다(`getProductSafetyLevel` → label "미분류").
 *      canonical 규칙(미분류를 '일반'으로 오도 금지)은 거기서 충족된다. 체크리스트 행은 중복이었고,
 *      계약⑤가 없애려던 "미등록 경고 다중 분산" 을 오히려 하나 더 늘렸다.
 *      게다가 위험도는 `casNo` 파생값이라 **사용자가 채울 수 없다** — 액션 불가능한 항목을
 *      결손 목록에 넣은 것 자체가 범주 오류(실측: 314/314 전 제품 노출 = 변별력 0).
 *      → 아래는 D7 단언을 **히어로 고지 보존 단언으로 교체**한다. 은폐 0 은 히어로가 책임진다.
 *
 *   저작 독립: 구현자(호영님 세션)가 아닌 계획 측에서 작성. self-grading 회피.
 *
 *   D7 = 위험도 분류는 완성도 8필드가 **아니다**. `classified === false`(미분류)일 때만
 *        체크리스트에 표시 전용 행으로 뜬다. 계약⑤가 위험도 칩을 지우므로, 이 행이
 *        안 뜨면 **미분류 상태가 화면에서 완전 소멸**한다
 *        (`safety-decision-engine`: `false=미분류(unknown): level=LOW 라도 '일반' 오도 금지`).
 *
 *   ⚠️ 무성 실패 경로 A — COMP 의 `classified` 는 **optional prop** 이고
 *      `undefined 면 위험도 행 없음`. PAGE 가 전달을 빠뜨리면 위험도가 조용히 사라지고
 *      COMP 단위 테스트는 전부 통과한다. → **PAGE 전달 여부를 여기서 잠근다.**
 *
 *   D8 = 항목 수는 데이터 파생. 프로토타입의 `6` 은 샘플 제품값 → 리터럴 금지.
 * ───────────────────────────────────────────────────────────── */
describe("§refinement 계약⑧ — D7 위험도 행 · D8 동적 카운트", () => {
  it("미분류 고지가 히어로 키팩트에 보존(은폐 0 의 유일한 책임 지점)", () => {
    expect(PAGE).toMatch(/getProductSafetyLevel\(/);
    expect(PAGE).toMatch(/안전 위험도/);
  });
  it("미분류 라벨이 canonical 헬퍼에서 나온다(인라인 하드코딩 금지)", () => {
    expect(SAFETY).toMatch(/level: "unknown"[\s\S]{0,200}?label: "미분류"/);
  });
  it("체크리스트에 위험도 행 부재(D7 철회 — 액션 불가능 항목 금지)", () => {
    expect(LIB_CODE).not.toMatch(/HAZARD_ACTION|위험도 분류/);
    expect(COMP_CODE).not.toMatch(/classified/);
    expect(PAGE_CODE).not.toMatch(/classified=\{/);
  });
  it("D8: 항목 수 리터럴 하드코딩 금지(프로토타입 6 = 샘플값)", () => {
    expect(COMP_CODE).not.toMatch(/등록이 필요한 정보 \(6\)|등록이 필요한 정보 6개/);
    expect(COMP).toMatch(/등록이 필요한 정보 \(\{[\s\S]{0,40}?length\}\)/);
  });

  /* ⚠️ 무성 실패 경로 B — dead button.
   *    COMP: privileged 의 spec_edit/safety_edit 는 href 가 없다.
   *    `useLink = !!href && !(canEdit && handler)` 이므로 handler 미전달 시
   *    useLink=false → `<button onClick={undefined}>` = **동작 없는 버튼**.
   *    ADMIN 에게만 발현하고 buyer 경로 테스트로는 안 잡힌다. */
  it("PAGE 가 편집 핸들러 3종을 배선(미배선 = ADMIN 대상 dead button)", () => {
    expect(PAGE).toMatch(/onSpecEdit=\{/);
    expect(PAGE).toMatch(/onSafetyEdit=\{/);
    expect(PAGE).toMatch(/onSdsUpload=\{/);
  });
  it("COMP: 핸들러 부재 시 button 대신 요청 링크로 폴백(dead button 0 최종 방어)", () => {
    expect(COMP).toMatch(/handler\s*\?|!!handler|handler\s*&&|handler\s*!==\s*undefined/);
  });
  it("PAGE 가 role 을 전달(미전달 시 전원 buyer 고정 = 편집 경로 소멸)", () => {
    expect(PAGE).toMatch(/<ProductCompleteness[\s\S]{0,400}?role=\{/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * 계약 ⑨ — 3b 선결: 해제의 상태 정합 (계약④가 못 잡는 2건)
 *   계약④는 `removeFromQuoteCart` 호출 여부만 본다. 아래 둘은 그걸 통과하고도 깨진다.
 * ───────────────────────────────────────────────────────────── */
describe("§refinement 계약⑨ — 해제 상태 정합", () => {
  it("해제가 비교함까지 정리(칩 문구 = 견적함·비교함에 담김)", () => {
    // 견적함만 지우면 칩은 사라지는데 비교함엔 남는다 = 표시와 실제 불일치.
    expect(PAGE).toMatch(/removeFromQuoteCart[\s\S]{0,600}?(compare|비교)/i);
  });
  it("해제 후 담김 상태 재평가(quote-cart-changed 구독)", () => {
    // 재읽기가 없으면 지웠는데도 주 CTA 가 `견적 요청서 만들기` 로 남는다 = front-only 의 거울상.
    expect(PAGE).toMatch(/addEventListener\("quote-cart-changed"|quote-cart-changed[\s\S]{0,200}?setInQuoteCart/);
  });
});
