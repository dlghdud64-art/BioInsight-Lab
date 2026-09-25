/**
 * §quotes-mobile-redesign — 견적 관리 모바일 리디자인 sentinel
 *
 * 호영님 P1 (2026-06-23):
 *   1. 퍼널 가로 1행 컴팩트 칩 + "발주 전환"(s5) ENABLE_PURCHASING 게이트 + 전 단계 0건 collapse.
 *   2. 모바일 카드 단일 고정 — 뷰 토글·컬럼 설정 데스크톱 전용(hidden md). effectiveViewMode.
 *   3. 필터 칩 0건 처리. wiring은 canonical 파생(quickStatus→deriveQuote/STATUS_PREDICATES→filteredQuotes).
 *
 * §quotes-quick-filter-4a P2 진화: MODE_CHIPS/setModeChip 단일선택 + priorityFilter/replyFilter/
 *   arrivalFilter popover facet 이 5칩 다중선택 빠른 필터(quickStatus:Set)로 대체됨. 신 UI 전체
 *   truth = quick-filter-4a-render.test.ts. "0건 disabled 사유" → "비활성 0건 숨김"(chipShow) 진화.
 *   canonical 파생 배선(deriveQuote/STATUS_PREDICATES/mineMatch/periodMatch)로 repoint.
 *
 * 검증 2축: (A) 게이트/구조 강제, (B) 회귀 0(발주 stage 소스·빠른 필터 canonical wiring 보존).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const FUNNEL = "src/components/quotes/quote-funnel.tsx";
const PAGE = "src/app/dashboard/quotes/page.tsx";

describe("§quotes-mobile-redesign — 퍼널 (A)", () => {
  it("s5 단계 부재 (ENABLE_PURCHASING 게이트 은퇴)", () => {
    const src = read(FUNNEL);
    /* 승계 §funnel-s5-removed (2026-09-25 · 호영님 판정) — **명제가 뒤집혔다**(라벨 이동이 아니다).
       §funnel-s5-producer 는 「생산자가 관리자 콘솔 1곳이니 지우지 않고 이름만 고친다」 였는데,
       호영님이 그 생산자도 지우기로 판정했다(§admin-order-create-removed) → PURCHASED 생산자 0.
       생산자가 만들 수 없는 값의 카운트는 표시하지 않는다.
       반대 명제는 regression/purchasing-residue-removed.test.ts ④ 가 든다. */
    expect(src).not.toMatch(/getFlag\("ENABLE_PURCHASING"\)/);
    expect(src).not.toMatch(/s\.key !== "s5"/);
  });
  it("전 단계 0건 collapse — '진행 중 견적 없음' 단일 라인", () => {
    const src = read(FUNNEL);
    expect(src).toMatch(/allZero/);
    expect(src).toMatch(/진행 중 견적 없음/);
  });
  it("모바일 압축 1행 유지 / 데스크탑 리치 (§quote-funnel-sian-restore — 2행 wrap·basis 폐지 보존)", () => {
    // §quote-funnel-sian-restore — 반응형: 모바일(<md) 압축 1행 칩 보존, 데스크탑(md+) 시안 리치(chevron 복원).
    const src = read(FUNNEL);
    expect(src).toMatch(/flex md:hidden items-stretch gap-2/); // 모바일 압축 분기 보존
    expect(src).toMatch(/hidden md:flex items-stretch/); // 데스크탑 리치 분기
    expect(src).not.toMatch(/flex-wrap md:flex-nowrap/);
    expect(src).not.toMatch(/basis-\[30%\]/);
  });
});

// §B2-C (호영님 2026-06-29) supersede — 모바일도 카드↔테이블 토글 honor(effectiveViewMode=viewMode).
//   토글 모바일 노출(flex), 컬럼 설정만 데스크탑 전용(hidden md:block), 모바일 압축 테이블은 visibleColumns 축소.
//   "모바일 카드 단일 고정"은 토글 노출로 supersede — 기본 카드(matchMedia 초기값)는 259b가 계속 잠금.
describe("§quotes-mobile-redesign — 모바일 뷰 토글(§B2-C 진화) (A)", () => {
  it("isMobile matchMedia + effectiveViewMode", () => {
    const src = read(PAGE);
    expect(src).toMatch(/matchMedia\("\(max-width: 767px\)"\)/);
    expect(src).toMatch(/effectiveViewMode/);
  });
  it("뷰 토글 모바일 노출(flex) + 컬럼 설정 데스크탑 전용(hidden md:block)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/relative flex items-center justify-end gap-1\.5 shrink-0/);
    expect(src).toMatch(/relative hidden md:block/);
    expect(src).toMatch(/effectiveViewMode === "table"/);
  });
});

describe("§quotes-mobile-redesign — 필터 칩 사유 (A)", () => {
  it("비활성 0건 칩 숨김 (§quotes-quick-filter-4a — 회색 침묵 대신 hide)", () => {
    // §quotes-quick-filter-4a P2 — "0건 disabled 사유 노출" → "비활성 0건 숨김"(chipShow) 로 진화.
    //   활성 칩은 항상 노출(해제 데드락 방지), 비활성+0건 칩만 hide.
    const src = read(PAGE);
    expect(src).toMatch(/if \(!active && count === 0\) return null/);
  });
});

describe("§quotes-mobile-redesign — 회귀 0 (B)", () => {
  it("발주 전환 stage 정의 보존(되살리기용)", () => {
    const src = read(FUNNEL);
    /* 승계 §approval-gate-single-source · §funnel-s5-producer (2026-09-25 · 호영님 판정) — 라벨만 참인 것으로 옮겼다.
       s4 「승인/예외」 는 결재가 열렸을 때만 참이라 판정 함수 뒤로(기본 「선정 대기」).
       s5 「발주 전환」 은 지운 기능 이름이고 그 버킷은 PURCHASED 라 「입고 대기」 다.
       명제(s5 단계 정의가 되살리기용으로 보존된다)는 불변. 판정축은 regression/approval-gate-single-source.test.ts ⑥⑦⑧ 가 든다. */
    expect(src).not.toMatch(/label: "입고 대기"/);
    expect(src).not.toMatch(/key: "s5"/);
  });
  it("빠른 필터 canonical wiring 보존 (구 MODE_CHIPS/setModeChip 대체)", () => {
    // §quotes-quick-filter-4a P2 — MODE_CHIPS/setModeChip 제거(의도). filteredQuotes 는
    //   quickStatus/deriveQuote/STATUS_PREDICATES canonical 파생으로 필터.
    const src = read(PAGE);
    // MODE_CHIPS.map/setModeChip 라이브 참조 제거 확인(잔여 MODE_CHIPS 문자열은 주석 1건뿐).
    expect(src).not.toMatch(/MODE_CHIPS\.map/);
    expect(src).not.toMatch(/setModeChip/);
    expect(src).toMatch(/QUICK_CHIP_META\.map/);
    expect(src).toMatch(/onClick=\{\(\) => toggleQuickStatus\(meta\.key\)\}/);
  });
  it("카드 본문 예상금액(canonical 회신가) 노출 보존", () => {
    const src = read(PAGE);
    expect(src).toMatch(/회신 \$\{responseCount\}건 \(가격 미기재\)|건 수신/);
  });
});

describe("§quotes-quick-filter-4a — 5칩 빠른 필터(구 popover 대체)", () => {
  it("빠른 필터 상태 진화 (구 priorityFilter/replyFilter/arrivalFilter popover facet 제거)", () => {
    // §quotes-quick-filter-4a P2 — popover 다축 facet state 제거(의도). Set 기반 빠른 필터로 대체.
    const src = read(PAGE);
    expect(src).not.toMatch(/priorityFilter/);
    expect(src).not.toMatch(/replyFilter/);
    expect(src).not.toMatch(/arrivalFilter/);
    expect(src).toMatch(/quickStatus/);
    expect(src).toMatch(/quickMine/);
    expect(src).toMatch(/quickPeriod/);
  });
  it("canonical 파생 배선(deriveQuote/STATUS_PREDICATES/mine/period) — 가짜 0", () => {
    const src = read(PAGE);
    expect(src).toMatch(/deriveQuote\(qf, now\)/);
    expect(src).toMatch(/mineMatch\(qf, currentUserId\)/);
    expect(src).toMatch(/periodMatch\(quickPeriod, d\)/);
    expect(src).toMatch(/STATUS_PREDICATES\[k\]\(qf, d\)/);
  });
  it("5칩 신호등 라벨 (구 3-facet popover 그룹 라벨 대체)", () => {
    // §quotes-quick-filter-4a P2 — 우선순위/회신상태/견적상태 popover facet → 5 신호등 칩.
    const src = read(PAGE);
    expect(src).toContain("마감 임박");
    expect(src).toContain("회신 정체");
    expect(src).toContain("발송 대기");
  });
  it("대상/기간 + 빠른 필터 라벨 (내 담당·마감 기간·빠른 필터·초기화)", () => {
    const src = read(PAGE);
    expect(src).toContain("빠른 필터");
    expect(src).toContain("내 담당");
    expect(src).toContain("마감 기간");
    expect(src).toContain("초기화");
  });
  it("상태 Select 제거(빠른 필터로 대체) — <Select 미사용", () => {
    /* §order-entry-rewire P3-1 재조준 (호영님 승인 2026-08-22 · §11.259c 와 동형).
     * 결정("상태 필터 Select 드롭다운 → 5칩 빠른 필터")은 무변경. 창만 파일 전역 →
     * 필터 영역 슬라이스로 정정한다. 전역 창은 주문 접수 다이얼로그의 예산 선택 Select
     * (다른 표면 · 폼 입력 축)까지 잡았고, native <select> 는 check-no-native-select.sh
     * 가 CI block 이라 실질 대안이 없어 두 게이트가 배타 충돌했다.
     * 창 시작점은 여는 앵커(`검색 + 필터` 주석)부터 — §4원칙 ②. */
    expect(read(PAGE)).not.toMatch(/검색 \+ 필터[\s\S]{0,6000}<Select\b/);
  });
});
