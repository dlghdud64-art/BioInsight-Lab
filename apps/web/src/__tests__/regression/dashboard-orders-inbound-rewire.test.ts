/**
 * §11.162 #dashboard-orders-inbound-rewire
 *
 * Source-level regression guard — `/dashboard/orders` redirect-only legacy page
 * 의 inbound caller 를 canonical destination 으로 rewire 검증.
 *
 * Caller intent 매핑 (Phase 0 audit 결과):
 *   - ORDER entity (Prisma Order model) → `/dashboard/purchase-orders` (canonical PO list)
 *   - 발주 전환 큐 navigation → `/dashboard/purchases?view=conversion-ready`
 *   - example/regex match → 변경 0 (legacy URL pattern 보존)
 *
 * deferred 까지 갔던 §11.160 cleanup 의 마지막 회수.
 *
 * §dashboard-dedup 진화(호영님 2026-06-28):
 *   dashboard quick-action 트림으로 "발주 전환"(r-po-conversion, conversion-ready
 *   네비) 제거 수용 — dashboard/page.tsx caller 소멸. 해당 it/REWIRED 항목 retire.
 *   나머지 caller(ORDER pathMap·AI inbox·ledger·budget·overlay)와 legacy 제거·PO
 *   landing 보존 가드는 불변. dashboard 가 더 이상 /dashboard/orders 로 가지 않음은
 *   아래 "legacy git tree 제거" 가드가 계속 강제(보호 공백 0).
 */

import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const APPS_WEB = resolve(__dirname, "../../..");
const REPO_ROOT = resolve(APPS_WEB, "../..");

function gitTrackedFiles(pattern: string): string[] {
  try {
    const out = execSync(`git ls-tree -r --name-only HEAD -- "${pattern}"`, {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    return out.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// §dashboard-dedup — dashboard/page.tsx "발주 전환 recommendedAction" 항목 retire
//   (quick-action 트림으로 caller 소멸).
const REWIRED_FILES: { path: string; label: string }[] = [
  { path: "src/app/dashboard/budget/[id]/page.tsx",                              label: "budget detail 발주 보기 Link" },
  { path: "src/components/dashboard/action-ledger.tsx",                          label: "Fast-Track navigation" },
  { path: "src/components/dashboard/ai-action-inbox.tsx",                        label: "AI action approve href" },
  { path: "src/components/dashboard/console/queue-detail-panel.tsx",             label: "ORDER pathMap" },
  { path: "src/components/dashboard/work-queue-console.tsx",                     label: "ORDER pathMap" },
  { path: "src/components/dashboard/overlay/workbench-progress-overlay.tsx",     label: "workbenchHref fallback" }, // §po-ui-removed(2026-09-24 · 호영님 판정): fallback 이 입고로
];

describe("§11.162 dashboard/orders inbound rewire", () => {
  it("ORDER entity 매핑 caller 가 /dashboard/receiving 사용", () => {
    /* 승계 §po-ui-removed(2026-09-24 · 호영님 판정) — 이 파일의 명제는 「레거시 /dashboard/orders 로 보내지 않고 canonical 로 보낸다」 다.
     *   canonical 목적지가 발주 목록 → 입고 관리로 바뀌었을 뿐 명제는 그대로다. */
    // queue-detail-panel + work-queue-console 의 ORDER pathMap 검증
    const queueDetailSrc = readFileSync(
      resolve(APPS_WEB, "src/components/dashboard/console/queue-detail-panel.tsx"),
      "utf8",
    );
    expect(queueDetailSrc).toMatch(/ORDER:\s*["']\/dashboard\/receiving["']/);
    const consoleSrc = readFileSync(
      resolve(APPS_WEB, "src/components/dashboard/work-queue-console.tsx"),
      "utf8",
    );
    expect(consoleSrc).toMatch(/ORDER:\s*["']\/dashboard\/receiving["']/);
  });

  it("dashboard 가 더 이상 /dashboard/orders 로 발주 전환 navigate 안 함 (§dashboard-dedup 트림)", () => {
    const dashboardSrc = readFileSync(
      resolve(APPS_WEB, "src/app/dashboard/page.tsx"),
      "utf8",
    );
    // 발주 전환 quick-action 제거 — 레거시 /dashboard/orders href 부재(회귀 가드)
    expect(dashboardSrc).not.toMatch(/r-po-conversion[\s\S]{0,200}href:\s*["']\/dashboard\/orders["']/);
    expect(dashboardSrc).not.toMatch(/href:\s*["']\/dashboard\/orders["']/);
  });

  it("AI action approveHref + ledger Fast-Track + budget 보기 가 레거시 /dashboard/orders 로 가지 않는다", () => {
    /* 승계 §po-ui-removed(2026-09-24 · 호영님 판정) — ai-action-inbox · action-ledger 는 **렌더 도달 0** 이라 새 목적지를
     *   추측하지 않고 링크만 끊었다(§po-ui-removed 자기 한계 1). 남는 명제는 부정 쪽이다:
     *   레거시 /dashboard/orders 로는 절대 보내지 않는다. 예산 상세는 라이브라 입고로 옮겼다. */
    const aiInboxSrc = readFileSync(
      resolve(APPS_WEB, "src/components/dashboard/ai-action-inbox.tsx"),
      "utf8",
    );
    expect(aiInboxSrc).not.toMatch(/approveHref:\s*["']\/dashboard\/orders["']/);

    const ledgerSrc = readFileSync(
      resolve(APPS_WEB, "src/components/dashboard/action-ledger.tsx"),
      "utf8",
    );
    expect(ledgerSrc).not.toMatch(/href:\s*`?\/dashboard\/orders`?/);

    const budgetSrc = readFileSync(
      resolve(APPS_WEB, "src/app/dashboard/budget/[id]/page.tsx"),
      "utf8",
    );
    expect(budgetSrc).not.toMatch(/href="\/dashboard\/orders"/);
    // 🔁 §budget-detail-redesign(2026-09-25) — 「입고 보기」 버튼이 할 일 카드의 「견적 관리로」 로 바뀌었다.
    //    명제(레거시 발주 목적지 0)는 유지 · 삭제된 발주 화면 전부로 넓혀 단언한다.
    expect(budgetSrc).not.toMatch(/\/dashboard\/(purchase-orders|purchases)\b/);
    expect(budgetSrc).toMatch(/\/dashboard\/quotes/);
  });

  it("workbench-progress-overlay fallback 이 /dashboard/receiving 사용", () => {
    /* 승계 §po-ui-removed(2026-09-24 · 호영님 판정) — fallback 목적지가 발주 목록에서 입고로.
     *   명제(레거시 /dashboard/orders 로 떨어지지 않고 canonical 로 간다)는 불변. */
    const overlaySrc = readFileSync(
      resolve(APPS_WEB, "src/components/dashboard/overlay/workbench-progress-overlay.tsx"),
      "utf8",
    );
    // workbenchHref fallback 이 변경됨
    expect(overlaySrc).toMatch(/workbenchHref\s*=\s*overlayRoutePath\s*\?\?\s*["']\/dashboard\/receiving["']/);
  });

  it("dashboard/orders/page.tsx redirect-only legacy git tree 에서 제거", () => {
    // git ls-tree path 인자는 prefix match — 폴더명 그대로 사용
    const tracked = gitTrackedFiles("apps/web/src/app/dashboard/orders");
    expect(tracked).toEqual([]);
  });

  /* 🛑 은퇴 §po-ui-removed(2026-09-24 · 호영님 판정) — 「회귀 0: /dashboard/purchase-orders 페이지 보존」.
   *    세 번째 뒤집힌 명제다(앞의 둘: 사이드바 NavItem 보존 · more-sheet 발주 라우트 보존).
   *    그 화면을 보존하라는 전제가 철회됐고, 이제 **git tree 에 없어야** 한다.
   *    반대 명제는 regression/po-ui-removed.test.ts ① 이 파일시스템 축으로 든다.
   *
   * ⚠️ 이 단언은 **커밋 전 게이트에 안 보였다.** `git ls-tree` 는 워킹트리가 아니라 **HEAD** 를 읽는다 —
   *    `git rm` 으로 스테이징만 된 상태에서는 HEAD 에 파일이 그대로 있어 GREEN 이었고,
   *    커밋이 HEAD 를 옮긴 **뒤에야** RED 가 됐다. 파일 삭제를 게이트로 재려면
   *    파일시스템 축(existsSync)과 git 축을 **둘 다** 봐야 한다. */
  it("회귀 0: git tree 축도 발주 landing 이 사라진 것을 본다", () => {
    const tracked = gitTrackedFiles("apps/web/src/app/dashboard/purchase-orders");
    expect(tracked).toEqual([]);
  });
});

// REWIRED_FILES 는 caller 인벤토리 문서 — 각 it 가 개별 파일을 직접 검증.
void REWIRED_FILES;
