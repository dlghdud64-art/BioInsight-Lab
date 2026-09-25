/**
 * §po-ui-removed (2026-09-24 · 호영님 판정) · **발주 UI 는 삭제됐다. 숨김이 아니다.**
 *
 * ── 왜 ──
 * §po-seed-cutoff(09-22)에서 발주 화면의 시드를 끊고 **구조는 남겨** 미연결 안내를 뒀다.
 * 그 승인은 「나중에 다시 붙인다」 는 전제였는데, 시드를 통째로 지우면서 그 전제가 사라졌다(호영님).
 * 그리고 실측이 더 나왔다:
 *   · 라우트 5개가 그대로 배포되고 있었다(목록·생성·상세·발송·안내 컴포넌트).
 *   · 메뉴만 플래그로 가렸다 — `ENABLE_PURCHASING=false` 는 사이드바 링크만 숨긴다. **주소를 치면 열린다.**
 *   · **켜진 화면에서 발주로 가는 링크가 12곳** 남아 있었다. 그중 「입고 처리」 라벨이
 *     발주 목록으로 가는 것도 있었다(라벨과 목적지가 다른 형태).
 * 🛑 이건 어제 내가 세운 표준 점검(「꺼진 기능으로 가는 링크가 켜진 기능에 있는가」)을
 *    발주에는 **입고 2곳만** 적용하고 전수하지 않아서 남았다. 범위를 좁게 잡은 것이 원인이다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 발주 UI 라우트가 없다 (경로 부활 시 RED)
 *   ② 소스에 `/dashboard/purchase-orders` href·목적지 0 (주석은 제외 · 역계약)
 *   ③ 네비게이션(사이드바·모바일 시트)에 발주 항목 0 — 숨김 목록에 넣는 형태도 아니다
 *   ④ 살아 있는 화면의 옛 목적지는 **입고**로 옮겼다(감사 딥링크 · 예산 상세 · 구매 운영 CTA · 작업 큐)
 *   ⑤ 발주 전용 오버레이 마운트 0
 *
 * ── 범위 밖 (건드리지 않았다) ──
 *   API·DB 는 무변경이다. `Order` 테이블에 실제 주문 2건이 있고 알림이 거기서 나온다(호영님).
 *   지운 것은 **화면뿐**이다 — `/api/orders/**` · `/api/work-queue/**` 는 그대로다.
 *
 * ── 은퇴한 센티넬 5종 (지우기 전에 명제를 여기 복원한다 · CLAUDE.md §sentinel 은 명제를 단언한다) ──
 *   전부 **삭제된 `app/dashboard/purchase-orders/page.tsx` 하나만** 읽던 파일이라 명제의 대상이 없다.
 *   본문은 이 커밋의 직전 판까지 살아 있다.
 *     · po-actionable-row-quick-actions      PDF·이메일 quick action = 실 endpoint · vendorEmail 없으면 disabled
 *     · po-actionable-row-orderid-mutation   entityId→orderId resolve 후 mutation · null 이면 disabled + 사유 표기
 *     · po-triage-sections-sian              「지금 내 차례」 vs 「공급사 응답 대기」 분리 · count 는 canonical derive
 *     · po-issue-reminder-modals-sian        발행·리마인더 모달이 실 endpoint · 자동발송 예약 미도입 정직 표기
 *     · po-ai-canonical-input-sian           AI 분석 입력이 하드코딩이 아니라 실 금액·실 예산
 *   🔑 이 중 **살아 있는 명제**는 두 갈래이고, 둘 다 다른 곳이 이미 든다:
 *     ① dead button 0 · 가짜 success 0 · 하드코딩 count 0 → CLAUDE.md 전역 조항 + 각 라이브 표면 센티넬
 *     ② 그 화면이 부르던 **주문 API 는 살아 있어야 한다** → 아래 ⑥ 이 집합으로 잠근다
 *
 * ── 자기 한계 ──
 *   1. 렌더 도달 0 컴포넌트(action-ledger · ai-action-inbox · executive-summary-section ·
 *      operator-quick-actions)는 **링크만 끊었다.** 목적지를 새로 정하지 않았다 —
 *      그 화면들이 되살아날지 자체가 미정이라 새 목적지도 추측이 된다.
 *      존폐는 「렌더 도달 0 컴포넌트 전수」 큐(별건, 호영님 판정 ③).
 *   2. 복원 지점은 QUEUE_receiving-doc-readiness.md 에 적었다(본문 해시 포함).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { renderReachableSources } from "@/__tests__/_helpers/literal-data-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));
const SELF = `regression${sep}po-ui-removed.test.ts`;

/** src 전역(주석 제거본)에서 패턴을 쓰는 파일 목록 — 테스트·자기 자신 제외 */
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

describe("§po-ui-removed · 발주 UI 는 삭제됐다", () => {
  it("① 발주 UI 라우트 0 (경로 부활 시 RED)", () => {
    for (const rel of [
      "app/dashboard/purchase-orders",
      "app/dashboard/purchase-orders/page.tsx",
      "app/dashboard/purchase-orders/new/page.tsx",
      "app/dashboard/purchase-orders/[poId]/page.tsx",
      "app/dashboard/purchase-orders/[poId]/dispatch/page.tsx",
      "app/dashboard/purchase-orders/_components/po-unwired-notice.tsx",
    ]) {
      expect(existsSync(join(SRC, rel)), `${rel}: 부활`).toBe(false);
    }
  });

  it("② 렌더 도달하는 자리에 발주 UI 목적지 0 (주석 제외 · 역계약)", () => {
    /* 축은 **렌더 도달**이다. 파일 전역으로 잡으면 도달 0 컴포넌트까지 걸려,
     * 「그 화면이 살아 있어야 하는가」 를 묻지 않고 목적지만 새로 지어내게 된다(호영님 판정 ③).
     * 도달 0 인 곳은 링크만 끊고 존폐는 큐로 넘겼다 — 자기 한계 1 참조. */
    const reachable = renderReachableSources(SRC);
    const offenders = [...reachable]
      .filter(([f, src]) => {
        const code = stripComments(src);
        /* 예외 1건 — navigation-context 의 **판별식**(`pathname.startsWith`)은 이동이 아니다.
         * 옛 링크로 들어온 경로를 모듈 미상으로 흘리지 않으려고 남긴다. 목적지(href·push)는 0이어야 한다. */
        if (f === "lib/ops-console/navigation-context.ts") {
          return /(href|push|Route|targetRoute)\s*[:(]\s*["'`]\/dashboard\/purchase-orders/.test(code);
        }
        return /["'`]\/dashboard\/purchase-orders/.test(code);
      })
      .map(([f]) => f)
      .sort();
    expect(offenders).toEqual([]);
    // 도달 0 인 자리에도 **끊긴 상태**는 유지한다(빈 문자열로 남긴 자리가 되살아나면 RED)
    expect(filesMatching(/href:\s*["'`]\/dashboard\/purchase-orders/)).toEqual([]);
  });

  it("③ 네비게이션에 발주 항목 0 (숨김 목록에 넣는 형태도 아니다)", () => {
    /* 🔁 승계 §purchases-ui-removed(2026-09-24) — 구매 운영도 삭제되면서 **숨김 목록 자체가 사라졌다.**
     *   원 명제는 「발주가 숨김 목록에 들어가는 형태도 아니다」 였는데, 이제 목록이 없으므로
     *   더 강한 형태로 단언한다: 그 이름들이 소스에 아예 없다. */
    const sidebar = code("app/_components/dashboard-sidebar.tsx");
    expect(sidebar).not.toMatch(/발주 관리/);
    expect(sidebar).not.toMatch(/PURCHASING_HIDDEN_HREFS/);
    const sheet = code("components/layout/bottom-nav-more-sheet.tsx");
    expect(sheet).not.toMatch(/label: "발주"/);
    expect(sheet).not.toMatch(/PURCHASING_HREFS/);
  });

  it("④ 살아 있는 화면의 옛 목적지는 입고로 옮겼다", () => {
    expect(code("app/dashboard/audit/page.tsx")).toMatch(/case "ORDER":\s*return "\/dashboard\/receiving";/);
    /* 🔁 승계 §budget-detail-redesign(2026-09-25 · 호영님 핸드오프) — 예산 상세의 빈 카드 3장과
     *    「견적 보기 · 입고 보기」 버튼 쌍이 할 일 카드 1장으로 바뀌었다. 원 명제 「예산 상세가 삭제된
     *    발주 화면으로 보내지 않는다」 는 그대로 단언하고, 목적지는 예산에 금액이 잡히는 실제 경로(견적 관리)다. */
    const budgetDetail = code("app/dashboard/budget/[id]/page.tsx");
    expect(budgetDetail).not.toMatch(/\/dashboard\/(purchase-orders|orders|purchases)\b/);
    expect(budgetDetail).toMatch(/<Link href="\/dashboard\/quotes">[\s\S]{0,300}?견적 관리로/);
    /* 🛑 은퇴 §purchases-ui-removed(2026-09-24) — 「구매 운영 CTA 가 입고로 간다」.
     *    그 화면도 삭제됐다. 같은 명제의 자리는 §purchases-ui-removed ④ 가 든다. */
    expect(code("components/dashboard/console/queue-detail-panel.tsx")).toMatch(/ORDER: "\/dashboard\/receiving"/);
  });

  it("⑤ 발주 전용 오버레이 마운트 0", () => {
    const shell = code("app/dashboard/_components/dashboard-shell.tsx");
    expect(shell).not.toMatch(/WorkbenchFullOverlay/);
    // 진행 오버레이는 주문 케이스 경로를 계속 다룬다(발주 분기만 제거)
    expect(shell).toMatch(/<WorkbenchProgressOverlay \/>/);
    /* 주문 케이스 추출은 그대로다. 경로 문자열은 정규식 리터럴 안에 있어 stripComments 가
     * 지우므로(주석 판별이 슬래시를 문다), 여기서는 **추출 구조**를 단언한다 —
     * 어차피 경로 문자열은 같은 줄 주석에도 있어 문자열 매칭으로는 명제가 안 선다. */
    const overlay = readFileSync(join(SRC, "components/dashboard/overlay/workbench-progress-overlay.tsx"), "utf8");
    expect(overlay).toMatch(/const orderMatch = routePath\.match\(/);
    expect(overlay).toMatch(/caseId: orderMatch\[1\]/);
  });

  it("⑥ API·DB 는 무변경 · 지운 것은 화면뿐이다", () => {
    /* 실제 주문 2건이 있고 알림이 거기서 나온다(호영님). 화면을 지운 김에 API 까지 따라 지우면 RED.
     * 개수가 아니라 **집합**을 고정한다(CLAUDE.md §개수는 명제가 아니다) — 하나가 빠지고
     * 하나가 늘어도 총계는 그대로라 구성 변화를 못 본다. */
    const routes = readdirSync(join(SRC, "app/api/orders"), { recursive: true } as never) as string[];
    const found = routes
      .map((p) => String(p).split(sep).join("/"))
      .filter((p) => p.endsWith("route.ts"))
      .sort();
    expect(found).toEqual([
      "[id]/generate-pdf/route.ts", // 은퇴한 po-actionable-row-* 가 잠그던 endpoint
      "[id]/po-document/route.ts",
      "[id]/route.ts",
      "[id]/send-email/route.ts",
      "by-quote/[quoteId]/route.ts",
      "draft/route.ts",
      "route.ts",
    ]);
    // 리마인더 초안 생성도 화면과 함께 지우지 않는다
    expect(existsSync(join(SRC, "app/api/ai-actions/generate/order-followup/route.ts"))).toBe(true);
  });
});
