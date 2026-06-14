/**
 * §11.372 #mobile-surface — 주변부(알림/더보기/설정) 모바일 반응형 fix sentinel.
 *
 *  ① 알림 패널 모바일 클리핑: 햄버거가 종 우측이라 종이 모바일 최우측이 아님 →
 *     absolute right-0 + 뷰포트폭이 왼쪽으로 overflow. 모바일 viewport 고정 전환.
 *  ② 더보기 시트 X 이중 렌더: shadcn 기본 Close + 커스텀 헤더 X 중복 → 기본만 숨김.
 *  ③ 설정 master-detail 세로 적층 → 모바일 drill-in(메뉴↔디테일 1뎁스).
 *
 * readFileSync + regex (CLAUDE.md sentinel 패턴). DB/mount 불요 lint-style 검증.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(__dirname, "../../", rel), "utf8");

const header = read("components/dashboard/Header.tsx");
const moreSheet = read("components/layout/bottom-nav-more-sheet.tsx");
const settings = read("app/dashboard/settings/page.tsx");

// ─────────────────────────────────────────────────────────────
// ① 알림 패널 — 모바일 viewport 고정, md+ trigger anchor 복원
// ─────────────────────────────────────────────────────────────
describe("§11.372 ① 알림 패널 모바일 클리핑", () => {
  it("모바일: viewport 고정(fixed left-3 right-3 top-14) — trigger 분리", () => {
    expect(header).toMatch(/fixed left-3 right-3 top-14/);
  });

  it("md+: 종 기준 absolute right-0 top-full 복원(데스크톱 무회귀)", () => {
    expect(header).toMatch(/md:absolute md:left-auto md:right-0 md:top-full/);
    expect(header).toMatch(/md:w-\[380px\]/);
  });

  it("회귀 차단: 폭만 맞추던 옛 클리핑 className(절대 right-0 + 100vw 단독) 제거", () => {
    // §11.359-2 의 불완전 패턴이 그대로 남아있으면 안 됨.
    expect(header).not.toMatch(
      /className="absolute right-0 top-full mt-2 w-\[calc\(100vw-1\.5rem\)\]/,
    );
  });

  it("회귀 0: 알림 canonical wiring 보존(메뉴 a11y/모두읽음/항목클릭/전체보기)", () => {
    expect(header).toMatch(/aria-label="알림 메뉴"/);
    expect(header).toMatch(/handleMarkAllRead/);
    expect(header).toMatch(/handleNotificationClick/);
    expect(header).toMatch(/buildNotificationText/);
    expect(header).toMatch(/전체 알림 보기/);
  });
});

// ─────────────────────────────────────────────────────────────
// ② 더보기 시트 — X 이중 렌더 제거(기본 Close 숨김, 커스텀 X 유지)
// ─────────────────────────────────────────────────────────────
describe("§11.372 ② 더보기 시트 X 이중 렌더", () => {
  it("SheetContent 인스턴스: 기본 Close(직계 button)만 숨김", () => {
    expect(moreSheet).toMatch(/\[&>button\]:hidden/);
  });

  it("회귀 0: a11y 우수한 커스텀 X(h-10 w-10, aria-label) 유지", () => {
    expect(moreSheet).toMatch(/aria-label="메뉴 닫기"/);
    expect(moreSheet).toMatch(/h-10 w-10/);
  });

  it("회귀 0: 시트 메뉴 wiring 보존(전체 메뉴/대시보드/발주/설정/로그아웃)", () => {
    expect(moreSheet).toMatch(/전체 메뉴/);
    expect(moreSheet).toMatch(/대시보드/);
    expect(moreSheet).toMatch(/href: "\/dashboard\/purchase-orders"/);
    expect(moreSheet).toMatch(/href: "\/dashboard\/settings"/);
    expect(moreSheet).toMatch(/로그아웃/);
  });
});

// ─────────────────────────────────────────────────────────────
// ③ 설정 — 모바일 drill-in(메뉴↔디테일), lg+ master-detail 유지
// ─────────────────────────────────────────────────────────────
describe("§11.372 ③ 설정 모바일 drill-in", () => {
  it("drill-in state(mobileDetail) 도입 + ChevronLeft import", () => {
    expect(settings).toMatch(/const \[mobileDetail, setMobileDetail\] = useState\(false\)/);
    expect(settings).toMatch(/ChevronLeft/);
  });

  it("nav: 모바일 디테일 진입 시 메뉴 숨김(lg+ 노출)", () => {
    expect(settings).toMatch(/mobileDetail && "hidden lg:block"/);
  });

  it("content: 모바일 메뉴 뷰에선 콘텐츠 숨김(lg+ 노출)", () => {
    expect(settings).toMatch(/!mobileDetail && "hidden lg:block"/);
  });

  it("nav 항목 탭 → activeSection + drill-in 동시 set", () => {
    expect(settings).toMatch(/setActiveSection\(item\.id\); setMobileDetail\(true\)/);
  });

  it("뒤로가기: lg:hidden + ChevronLeft + setMobileDetail(false) + '설정 메뉴'", () => {
    // 모바일 전용 뒤로가기 버튼: lg:hidden + onClick(메뉴 복귀) + 라벨.
    expect(settings).toMatch(/onClick=\{\(\) => setMobileDetail\(false\)\}/);
    expect(settings).toMatch(/lg:hidden inline-flex[\s\S]{0,400}설정 메뉴/);
  });

  it("deep-link(?tab=) 진입 시 모바일 drill-in 자동", () => {
    expect(settings).toMatch(/setActiveSection\("billing"\); setMobileDetail\(true\)/);
    expect(settings).toMatch(/setActiveSection\("notifications"\); setMobileDetail\(true\)/);
  });

  it("회귀 0: lg+ master-detail(flex-col lg:flex-row, lg:w-64) + 4 섹션 라벨 보존", () => {
    expect(settings).toMatch(/flex flex-col lg:flex-row/);
    expect(settings).toMatch(/lg:w-64 shrink-0/);
    expect(settings).toMatch(/운영자 및 워크스페이스/);
    expect(settings).toMatch(/보안 및 접근 제어/);
    expect(settings).toMatch(/알림 관리/);
    expect(settings).toMatch(/청구 및 구독/);
  });
});
