/**
 * §inventory-dead-tabs-removed — 재고 화면의 죽은 탭 · 재입고 배선 · 재입고 라우트 제거 (호영님 판정 2026-09-26)
 *
 * 무엇이 문제였나
 *   `inventory-content.tsx` 에 `{false && (…)}` 블록이 3개(총 639줄) 있었고, 그 중 하나가
 *   inventory·history·alerts 3탭 + InventoryCard 그리드였다. 렌더가 0이라 「재입고 요청」 버튼을
 *   누를 수 있는 사용자가 없었다 — 그런데 그 블록에 값을 대는 `restock-status` 쿼리는 **살아 있었다.**
 *   화면을 열면 품목마다 `GET /api/inventory/[id]/restock-request` 가 나갔다.
 *   🔑 **렌더는 0인데 네트워크 비용은 실재했다.** 죽은 UI 가 비용을 안 쓴다는 가정이 틀렸던 자리다.
 *
 * 호영님 판정: 게이트를 걸지 말고 죽은 블록째 삭제한다.
 *   재실측 기준 — 재고 화면을 열었을 때 `restock-request` 요청 **0건**.
 *   남긴 것 — `PurchaseRequest` 모델 · approve/reject 라우트 · `/admin/requests`.
 *
 * 은퇴한 sentinel 2건 — 지우기 전에 명제를 여기에 복원한다(§sentinel 은 명제를 단언한다).
 *   ① `api/inventory/inventory-restock-request-org-scope.test.ts`
 *      명제: 재입고 요청 POST 의 ownership 은 `inventory.userId === session.user.id` **단독이 아니다** —
 *            isOwner OR isOrgMember(OrganizationMember) 이고 둘 다 false 면 403.
 *            GET 은 `requesterId: session.user.id` 로 self-scoped 라 drift 0.
 *            보존 항목: POST·GET 2 export · enforceAction 래핑 · teamMember 분기 · TeamRole.ADMIN 차단 ·
 *            purchaseRequest.create 경로.
 *      왜 은퇴 — 라우트 파일이 사라졌으므로 명제의 주체가 없다. 조직 축 일반형은
 *            `regression/org-session-authority.test.ts`(핸들러가 body 에서 조직을 읽는가)가 계속 본다.
 *   ② `inventory/inline-usage-gmp-fields-p3uia3-content.test.ts`
 *      명제: 차감 dialog 가 trackingMode 를 읽어 GMP/LOT 일 때 lot·operator·destination 을 모으고,
 *            추적 품목은 `[id]/use`, QUANTITY 는 legacy `/usage` 로 보낸다.
 *      왜 은퇴 — 그 dialog 는 InventoryCard 안에 있었고 InventoryCard 는 소비자 0 이 됐다.
 *      🔑 명제는 죽지 않았다 — **살아 있는 표면 2곳이 이어받는다**:
 *            `inventory/scan/page.tsx`   → `inventory/scan-gmp-usage-fields-p3uia.test.ts`
 *            `GlobalQRScannerModal.tsx`  → `inventory/qr-gmp-usage-fields-p3uia2.test.ts`
 *
 * ⚠️ HEAD 축 단언은 **이 커밋이 land 한 뒤** GREEN 이 된다. `git rm` 은 index 만 바꾸므로
 *    커밋 전 게이트에서는 HEAD 에 파일이 그대로 있다(§파일 삭제는 두 축을 둘 다 봐야 잡힌다).
 *    두 축을 다 단언하는 이유가 그 조항이다 — index 만 보면 커밋 뒤 회귀를 못 본다.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";

const WEB = join(__dirname, "..", "..", "..");
const REPO = join(WEB, "..", "..");
const read = (rel: string) => readFileSync(join(WEB, rel), "utf8");

/** 주석을 지운다 — 삭제 근거를 적은 주석이 그 자신의 부정 단언에 걸리지 않도록. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const CONTENT_REL = "src/app/dashboard/inventory/inventory-content.tsx";
const CONTENT = stripComments(read(CONTENT_REL));

const ROUTE_REL = "src/app/api/inventory/[id]/restock-request/route.ts";
const GAUGE_REL = "src/components/inventory/stock-lifespan-gauge.tsx";

function git(args: string[]): string {
  return execFileSync("git", ["--no-optional-locks", ...args], { cwd: REPO, encoding: "utf8" }).trim();
}

describe("§inventory-dead-tabs-removed · ① 죽은 블록 0", () => {
  it("`{false &&` 가 재고 화면에 없다", () => {
    /* 🛑 주석 제거본에 건다. 삭제 근거 주석이 이 문자열을 인용하고 있다. */
    expect(CONTENT).not.toMatch(/\{\s*false\s*&&/);
  });

  it("측정 대상이 실제로 그 파일이다 · 빈 문자열을 통과로 세지 않는다", () => {
    expect(CONTENT.length).toBeGreaterThan(100000);
    expect(CONTENT).toMatch(/function InventoryPageContent\(/);
  });
});

describe("§inventory-dead-tabs-removed · ② 재입고 배선 0", () => {
  it("restock-request 경로를 부르는 자리가 없다", () => {
    expect(CONTENT).not.toMatch(/restock-request/);
  });

  it("restock-status 쿼리 · mutation · state 가 없다", () => {
    expect(CONTENT).not.toMatch(/restock-status/);
    expect(CONTENT).not.toMatch(/restockRequestMutation/);
    expect(CONTENT).not.toMatch(/restockRequestedIds/);
  });

  it("워킹트리 전체에서 그 경로를 부르는 소스가 없다", () => {
    /* 🛑 `git grep` 으로 묻지 않는다 — 그쪽은 **추적된 파일만** 본다. 새로 만든(미추적) 파일이
     *    그 경로를 불러도 GREEN 이었다(프로브 실측 1건). 질문은 "워킹트리에 있는가" 이므로
     *    워킹트리를 직접 걷는다(§질문에 맞는 축으로 잰다). */
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === "__tests__" || e.name === "node_modules") continue;
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(e.name)) continue;
        if (!readFileSync(p, "utf8").includes("restock-request")) continue;
        hits.push(relative(join(WEB, "src"), p).split("\\").join("/"));
      }
    };
    walk(join(WEB, "src"));
    /* inventory-content 는 삭제 근거 주석으로만 그 문자열을 갖는다(위 단언이 주석 제거본으로 0을 이미 봤다). */
    expect(hits.filter((f) => !f.endsWith("inventory-content.tsx"))).toEqual([]);
  });
});

describe("§inventory-dead-tabs-removed · ③ 라우트 부재(워킹트리 · index · HEAD 3축)", () => {
  it("워킹트리에 없다", () => {
    expect(existsSync(join(WEB, ROUTE_REL))).toBe(false);
  });

  it("index 에 없다", () => {
    expect(git(["ls-files", "--", "apps/web/" + ROUTE_REL])).toBe("");
  });

  it("HEAD 에 없다", () => {
    /* ⚠️ 이 단언은 이 커밋이 land 한 뒤 GREEN 이 된다(헤더 참조). */
    expect(git(["ls-tree", "-r", "--name-only", "HEAD", "--", "apps/web/" + ROUTE_REL])).toBe("");
  });

  it("남긴 것은 그대로 있다 · PurchaseRequest 모델 · approve/reject · /admin/requests", () => {
    expect(read("prisma/schema.prisma")).toMatch(/model PurchaseRequest \{/);
    expect(existsSync(join(WEB, "src/app/api/request/[id]/approve/route.ts"))).toBe(true);
    expect(existsSync(join(WEB, "src/app/api/request/[id]/reject/route.ts"))).toBe(true);
    expect(existsSync(join(WEB, "src/app/admin/requests/page.tsx"))).toBe(true);
  });
});

describe("§inventory-dead-tabs-removed · ④ 고아 컴포넌트 0", () => {
  it("InventoryCard · TeamInventoryCard · InventoryForm 선언이 없다", () => {
    for (const n of ["InventoryCard", "TeamInventoryCard", "InventoryForm"]) {
      expect(CONTENT).not.toMatch(new RegExp("function " + n + "\\("));
    }
  });

  it("stock-lifespan-gauge 는 파일도 import 도 없다", () => {
    expect(existsSync(join(WEB, GAUGE_REL))).toBe(false);
    expect(git(["ls-files", "--", "apps/web/" + GAUGE_REL])).toBe("");
    expect(CONTENT).not.toMatch(/stock-lifespan-gauge|StockLifespanGauge/);
  });
});

describe("§inventory-dead-tabs-removed · ⑤ 은퇴한 명제의 승계 표면이 살아 있다", () => {
  it("차감 GMP 는 scan · QR 두 표면에서 계속 측정된다", () => {
    /* 은퇴 sentinel ②의 명제가 갈 곳 — 승계처가 죽으면 이 자리에서 RED 다. */
    for (const rel of [
      "src/app/dashboard/inventory/scan/page.tsx",
      "src/components/inventory/GlobalQRScannerModal.tsx",
    ]) {
      const c = stripComments(read(rel));
      expect(c).toMatch(/requiredUsageFields\(trackingMode\)/);
      expect(c).toMatch(/\/api\/inventory\/\$\{[^}]+\}\/use/);
    }
    for (const rel of [
      "src/__tests__/inventory/scan-gmp-usage-fields-p3uia.test.ts",
      "src/__tests__/inventory/qr-gmp-usage-fields-p3uia2.test.ts",
    ]) {
      expect(existsSync(join(WEB, rel))).toBe(true);
    }
  });
});
