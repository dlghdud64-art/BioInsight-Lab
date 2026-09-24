/**
 * §purchases-ui-removed (2026-09-24 · 호영님 판정) · **구매 운영 화면도 삭제됐다.**
 *
 * ── 왜 ──
 * 주문 알림을 눌러 어디로 가는지 보다가 나왔다(호영님 라이브):
 *   알림 → `/dashboard/purchases`(「구매 운영」). 사이드바 `PURCHASING_HIDDEN_HREFS` 가
 *   `/dashboard/purchase-orders` 와 `/dashboard/purchases` 를 **같은 플래그**로 숨기고 있었다.
 *   그 화면은 KPI 4개(발주 전환 대기 · 발주 승인 대기 · 발주 확정 · 공급사 응답 완료)가 전부 0이고,
 *   단계 표시의 끝이 「발주 전환」 이며, 회색 막대 위에 「발주 승인 대기」 뱃지를 단 미리보기 행이 있었다.
 *   **발주로 들어가는 입구 화면**이다. 발주를 지웠으니(§po-ui-removed) 같은 플래그·같은 결정으로 지운다.
 *   메뉴에서는 숨겨졌는데 알림이 링크로 사용자를 들여보내고 있었다 — 숨김은 입구를 막지 못한다.
 *
 * ── 삭제 전 실측 (prod 읽기 전용 SELECT · ref xhid…dhsw · 대조군 userCount 3 / orgCount 2) ──
 *   PurchaseRequest 0 · Team 0 · ReceivingDraft 0 · Quote 7 · Order 2
 *   `PurchaseOrder` 는 **Prisma 모델 자체가 없다** — 발주 화면은 DB 없이 시드 위에만 있었다.
 *   🛑 이 화면은 `request-approval` 의 **유일한 호출자**였다(자기 주석도 「견적→결재의 유일한 생성 지점」).
 *      삭제로 **결재 요청을 만들 수 있는 경로가 0** 이 된다. 소비자(admin/requests 승인·반려 ·
 *      approver-routing · 예산 결재 게이트)는 입력 없는 상태로 남는다. prod 0건이라 오늘 피해는 0.
 *      → teamId (가) 트랙은 진입점 소멸로 **종료**(호영님이 그 경우를 미리 지시).
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 라우트가 없다 (파일시스템 축 · 경로 부활 시 RED)
 *   ② 렌더 도달하는 자리에 `/dashboard/purchases` 목적지 0 (주석 제외 · 역계약)
 *   ③ 네비게이션 5곳에서 「구매 운영」 항목이 사라졌다 — 숨김 목록에 넣는 형태도 아니다
 *   ④ 옛 목적지는 견적·입고·지출 분석으로 옮겼다 (라이브 표면)
 *   ⑤ 주문 알림은 **견적 상세**로 간다 · 죽은 `?focus=` 파라미터도 함께 고쳤다
 *   ⑥ 숨김 게이팅 잔재 0 — 거를 대상이 없는 필터를 남기지 않는다
 *
 * ── 범위 밖 (건드리지 않았다) ──
 *   API·DB 무변경(호영님). `/api/work-queue/purchase-conversion/**` · `/api/request/**` 는 그대로다.
 *   모바일 자체 탭 `/(tabs)/purchases` 도 범위 밖 — 주문 알림 목적지 한 자리만 웹과 맞췄다.
 *
 * ── 자기 한계 ──
 *   1. ② 는 **따옴표로 감싼 목적지**만 본다. 정규식 리터럴 매처(`startsWith("/dashboard/purchases")`)는
 *      잡지 않는다 — `ontology-next-action-resolver` 가 그 형태로 남아 있고, 도달 불가 분기다.
 *      §po-ui-removed 의 `navigation-context` 예외와 같은 성격이라 같은 판단을 적용했다.
 *   2. 퍼블릭/문서 문구에 **발주 기능 주장**이 남아 있다 — `bioinsight-hero-section.tsx:225`
 *      「발주 · 승인 라인 및 연동」 · `support-center` role-2 「…발주를 처리합니다」.
 *      링크가 아니라 **제품 설명**이라 이번 축(링크 전수) 밖이다. 판정 대기.
 *   3. `ENABLE_PURCHASING` 플래그는 유지했다. 숨김 소비자는 0이 됐지만 다른 소비자
 *      (파이프라인 po 단계 · 확정 발주액 KPI · 재주문 시트 · quote-funnel · 대시보드 라벨)가 남아 있다.
 *      그 축은 「렌더 도달 0 전수」 와 함께 볼 일이다.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { renderReachableSources } from "@/__tests__/_helpers/literal-data-scan";

const SRC = join(__dirname, "..", "..");
const REPO = join(SRC, "..", "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));
const SELF = `regression${sep}purchases-ui-removed.test.ts`;

/** src 전역(주석 제거본)에서 패턴을 쓰는 파일 — 테스트·자기 자신 제외 */
function filesMatching(re: RegExp): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry.startsWith(".next") || entry === "__tests__") continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry) && !full.endsWith(SELF)) {
        if (re.test(stripComments(readFileSync(full, "utf8")))) {
          out.push(full.slice(SRC.length + 1).split(sep).join("/"));
        }
      }
    }
  };
  walk(SRC);
  return out.sort();
}

describe("§purchases-ui-removed · 구매 운영 화면도 삭제됐다", () => {
  it("① 라우트 0 (경로 부활 시 RED)", () => {
    for (const rel of ["app/dashboard/purchases", "app/dashboard/purchases/page.tsx"]) {
      expect(existsSync(join(SRC, rel)), `${rel}: 부활`).toBe(false);
    }
  });

  it("② 렌더 도달하는 자리에 구매 운영 목적지 0 (주석 제외 · 역계약)", () => {
    const reachable = renderReachableSources(SRC);
    const offenders = [...reachable]
      .filter(([f, src]) => {
        const c = stripComments(src);
        /* 예외 1건 — ontology 의 **판별식**(`pathname.startsWith`)은 이동이 아니다.
         * §po-ui-removed 의 navigation-context 와 같은 성격. 목적지(href·push·route)는 0이어야 한다. */
        if (f === "lib/ontology/contextual-action/ontology-next-action-resolver.ts") {
          return /(href|push|Route|targetRoute)\s*[:(]\s*["'`]\/dashboard\/purchases/.test(c);
        }
        return /["'`]\/dashboard\/purchases/.test(c);
      })
      .map(([f]) => f)
      .sort();
    expect(offenders).toEqual([]);
    // 도달 0 인 자리에도 **끊긴 상태**를 유지한다
    expect(filesMatching(/href:\s*["'`]\/dashboard\/purchases/)).toEqual([]);
    expect(filesMatching(/href="\/dashboard\/purchases/)).toEqual([]);
  });

  it("③ 네비게이션 5곳에 「구매 운영」 항목 0", () => {
    /* 🛑 경로를 OR 로 묶지 않는다 — 한 곳만 남아도 입구는 열린다. 각각 단언한다. */
    for (const rel of [
      "app/_components/dashboard-sidebar.tsx",
      "app/_components/main-header.tsx",
      "app/_components/bioinsight-hero-section.tsx",
      "components/auth/user-menu.tsx",
      "app/_workbench/search/page.tsx",
    ]) {
      expect(code(rel), `${rel}: 구매 운영 항목 잔존`).not.toMatch(/\/dashboard\/purchases/);
    }
    // 하단 탭 — 「구매」 탭이 입고로 **고정**됐다(플래그 스왑이 아니다)
    const nav = code("components/layout/bottom-nav.tsx");
    expect(nav).toMatch(/label: "입고", href: "\/dashboard\/receiving"/);
    expect(nav).not.toMatch(/RECEIVING_TAB/);
    expect(nav).not.toMatch(/ENABLE_PURCHASING/);
  });

  it("④ 살아 있는 화면의 옛 목적지는 견적·입고·지출 분석으로 옮겼다", () => {
    expect(code("app/dashboard/audit/page.tsx")).toMatch(
      /case "PURCHASE_REQUEST":\s*return "\/dashboard\/quotes";/,
    );
    expect(code("components/dashboard/console/queue-detail-panel.tsx")).toMatch(
      /PURCHASE_REQUEST: "\/dashboard\/quotes"/,
    );
    expect(code("components/dashboard/work-queue-console.tsx")).toMatch(
      /PURCHASE_REQUEST: "\/dashboard\/quotes"/,
    );
    expect(code("app/dashboard/inventory/inventory-content.tsx")).toMatch(/입고 반영/);
    expect(code("components/dashboard/CategorySpendingWidget.tsx")).toMatch(
      /drillDownHref = "\/dashboard\/analytics\/category"/,
    );
    expect(code("app/dashboard/reports/page.tsx")).toMatch(/\/dashboard\/analytics\/monthly/);
    expect(code("app/dashboard/reports/mobile-report-view.tsx")).toMatch(
      /\/dashboard\/analytics\/category/,
    );
  });

  it("⑤ 주문 알림은 견적 상세로 간다 · 죽은 focus 파라미터도 고쳤다", () => {
    /* 🛑 `focus` 는 소스 전체에서 **읽는 곳이 0**이었다(견적 화면은 `selected`·`prepare` 를 읽는다).
     *    그래서 옛 링크들은 상세를 열지 못하고 목록에만 떨어뜨렸다. 같은 창의 형제 슬롯이라 함께 고쳤다. */
    for (const [label, rel] of [
      ["web", "lib/notifications/event-category-map.ts"],
    ] as const) {
      const c = code(rel);
      const start = c.indexOf("export function buildNotificationHref");
      expect(start, `${label}: href 빌더 없음`).toBeGreaterThan(-1);
      const body = c.slice(start);
      expect(body, `${label}: 구매 운영 잔존`).not.toMatch(/\/dashboard\/purchases/);
      expect(body, `${label}: 죽은 focus 파라미터`).not.toMatch(/\?focus=/);
      expect(body, `${label}: selected 미사용`).toMatch(/\?selected=\$\{encodeURIComponent/);
      // ORDER 분기가 quoteId 를 읽는다
      const oi = body.indexOf('case "ORDER"');
      expect(oi, `${label}: ORDER 분기 없음`).toBeGreaterThan(-1);
      const next = body.indexOf('case "COMPARE"', oi);
      expect(body.slice(oi, next), `${label}: ORDER 가 quoteId 미사용`).toMatch(/meta\.quoteId/);
    }
    // 모바일 — 주문 한 자리만 맞췄다(자체 탭은 범위 밖)
    const mob = stripComments(readFileSync(join(REPO, "apps/mobile/lib/event-category-map.ts"), "utf8"));
    const mi = mob.indexOf('case "ORDER"');
    const mnext = mob.indexOf('case "COMPARE"', mi);
    expect(mob.slice(mi, mnext)).toMatch(/meta\.quoteId/);
    expect(mob.slice(mi, mnext)).not.toMatch(/\(tabs\)\/purchases/);
  });

  it("⑥ 숨김 게이팅 잔재 0 (거를 대상이 없는 필터는 남기지 않는다)", () => {
    for (const [rel, token] of [
      ["app/_components/dashboard-sidebar.tsx", /PURCHASING_HIDDEN_HREFS/],
      ["components/layout/bottom-nav-more-sheet.tsx", /PURCHASING_HREFS/],
      ["components/layout/bottom-nav-more-sheet.tsx", /itemVisible/],
    ] as const) {
      expect(code(rel), `${rel}: ${token} 잔존`).not.toMatch(token);
    }
    // 더보기 시트 — 라우트가 없던 「발주 전환 큐」(/dashboard/orders) 항목도 제거
    expect(code("components/layout/bottom-nav-more-sheet.tsx")).not.toMatch(/\/dashboard\/orders/);
    expect(existsSync(join(SRC, "app/dashboard/orders")), "/dashboard/orders 부활").toBe(false);
  });

  it("⑦ API·DB 는 무변경 · 지운 것은 화면뿐이다", () => {
    for (const rel of [
      "app/api/work-queue/purchase-conversion/route.ts",
      "app/api/orders/route.ts",
    ]) {
      expect(existsSync(join(SRC, rel)), `${rel}: API 는 유지`).toBe(true);
    }
  });
});
