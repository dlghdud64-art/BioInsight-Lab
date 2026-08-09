/**
 * §enforcement-handle-close — enforceAction 핸들 마감 계약 (열거형 + ratchet)
 *
 * 배경 (2026-08-09 §product-detail-sourcing-v21 후속 실측):
 *   `enforceAction()` 이 돌려주는 핸들은 반드시 닫아야 한다.
 *     · `complete({beforeState, afterState})` — audit envelope 기록 + mutation lock 해제
 *     · `fail()`                              — lock 해제 (audit 미기록)
 *   닫지 않으면 두 가지가 동시에 깨진다:
 *     ① mutation lock 이 TTL(ACTIVE_MUTATION_TTL_MS = 5분)까지 잡혀 같은
 *        `${action}:${targetEntityId}` 재요청이 concurrent_mutation 으로 거부된다.
 *     ② 성공 audit 이 남지 않아 "누가 무엇을 바꿨는지" 추적이 불가능하다.
 *
 * 계약:
 *   E1. enforceAction 을 쓰는 route 는 핸들을 닫는다 — LEGACY 목록 밖에서 신규 누수 0.
 *       **하드코딩 파일 목록이 아니라 glob 수집**이라 새 route 도 자동으로 걸린다.
 *   E2. ratchet 은 조여지기만 한다 — LEGACY 항목이 고쳐지면 목록에서 빼야 통과한다.
 *       (목록이 stale 해지는 것을 구조적으로 막는다)
 *   E3. 핸들을 닫는 route 는 **예외 경로에서도** 닫는다 — catch 블록 안에 fail().
 *       early-return 만 막으면 정상 흐름은 깨끗한데 장애 상황에서만 누수가 남는다.
 *       실측 시점 75/75 충족 → RED 0 으로 일반 계약화.
 *   E4. 제품 쓰기 2 route 는 targetEntityId 를 실제 id 로 넘기고 before/after 를 남긴다.
 *
 * ⚠️ LEGACY ratchet: 실측 시점 149 route 중 74 route 가 핸들을 닫지 않았다.
 *    2026-08-09 배치 1(work-queue 7건) 처리 → **67 route** 남음.
 *    전수 교정은 별도 트랙(§enforcement-handle-close-sweep). 이 sentinel 은
 *    **새 누수만 차단**하고 기존분은 목록으로 고정한다 — 전면 단언은 즉시 72 RED 라
 *    baseline 을 오염시켜 판독 자체를 무력화한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const API_ROOT = join(WEB_ROOT, "src", "app", "api");

function collectRouteFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectRouteFiles(full, acc);
    else if (entry === "route.ts") acc.push(full);
  }
  return acc;
}

/** apps/web 기준 상대경로(슬래시 정규화) */
function rel(abs: string): string {
  return abs.slice(WEB_ROOT.length + 1).split(sep).join("/");
}

const ROUTES = collectRouteFiles(API_ROOT).map((f) => ({
  path: rel(f),
  src: readFileSync(f, "utf8"),
}));

const USES_ENFORCE = ROUTES.filter((r) => r.src.includes("enforceAction("));
const closesHandle = (src: string) => src.includes(".complete(") || src.includes(".fail(");
const UNCLOSED = USES_ENFORCE.filter((r) => !closesHandle(r.src)).map((r) => r.path);

/**
 * 2026-08-09 실측 기준 기존 누수 74건 → 배치 1(work-queue 7건) 처리 후 **67건**. **줄어들기만 한다.**
 * 여기에 새 경로를 추가하는 것은 회귀이며, 항목을 고쳤으면 이 목록에서 제거해야 한다.
 */
const LEGACY_UNCLOSED: readonly string[] = [
  "src/app/api/activity-logs/route.ts",
  "src/app/api/admin/canary-control/route.ts",
  "src/app/api/admin/seed/route.ts",
  "src/app/api/ai/bom-parse/route.ts",
  "src/app/api/ai/budget-anomaly/route.ts",
  "src/app/api/ai/impact-analysis/route.ts",
  "src/app/api/ai/safety-check/route.ts",
  "src/app/api/ai-actions/generate/order-followup/route.ts",
  "src/app/api/ai-actions/generate/quote-draft/route.ts",
  "src/app/api/ai-actions/generate/reorder-suggestions/route.ts",
  "src/app/api/ai-actions/generate/vendor-email-draft/route.ts",
  "src/app/api/analytics/recommendation-metrics/route.ts",
  "src/app/api/analytics/search-history/route.ts",
  "src/app/api/analytics/track/route.ts",
  "src/app/api/analytics/user-behavior/route.ts",
  "src/app/api/billing/portal/route.ts",
  "src/app/api/billing/route.ts",
  "src/app/api/cart/route.ts",
  "src/app/api/compliance-links/route.ts",
  "src/app/api/compliance-links/[id]/route.ts",
  "src/app/api/dashboard/layout/route.ts",
  "src/app/api/datasheet/extract/route.ts",
  "src/app/api/datasheet/extract-pdf/route.ts",
  "src/app/api/datasheet/extract-url/route.ts",
  "src/app/api/export/presets/route.ts",
  "src/app/api/ingestion/route.ts",
  "src/app/api/inventory/alerts/send/route.ts",
  "src/app/api/inventory/auto-reorder/route.ts",
  "src/app/api/inventory/import/preview/route.ts",
  "src/app/api/inventory/import/route.ts",
  "src/app/api/inventory/[id]/restock-request/route.ts",
  "src/app/api/organizations/[id]/subscription/route.ts",
  "src/app/api/po-candidates/route.ts",
  "src/app/api/products/compare/route.ts",
  "src/app/api/products/[id]/embedding/route.ts",
  "src/app/api/products/[id]/safety-extract/route.ts",
  "src/app/api/products/[id]/usage/route.ts",
  "src/app/api/products/[id]/view/route.ts",
  "src/app/api/protocol/bom/route.ts",
  "src/app/api/protocol/extract/route.ts",
  "src/app/api/protocol/extract-pdf-text/route.ts",
  "src/app/api/protocol/extract-text/route.ts",
  "src/app/api/purchases/import/preview/route.ts",
  "src/app/api/purchases/import/route.ts",
  "src/app/api/purchases/import-file/route.ts",
  "src/app/api/quotes/cost-optimization/route.ts",
  "src/app/api/quotes/generate-english/route.ts",
  "src/app/api/quotes/optimize-combination/route.ts",
  "src/app/api/quotes/parse-image/route.ts",
  "src/app/api/quotes/parse-pdf/route.ts",
  "src/app/api/recommendations/feedback/route.ts",
  "src/app/api/recommendations/optimized/route.ts",
  "src/app/api/reviews/[id]/route.ts",
  "src/app/api/safety/spend/map/route.ts",
  "src/app/api/sds/[id]/apply/route.ts",
  "src/app/api/sds/[id]/extract/route.ts",
  "src/app/api/sds/[id]/signed-url/route.ts",
  "src/app/api/search/intent/route.ts",
  "src/app/api/shared-lists/bulk/route.ts",
  "src/app/api/shared-lists/route.ts",
  "src/app/api/shared-lists/[publicId]/route.ts",
  "src/app/api/templates/route.ts",
  "src/app/api/templates/[id]/route.ts",
  "src/app/api/translate/route.ts",
  "src/app/api/vendor/billing/route.ts",
  "src/app/api/vendor/premium/route.ts",
  "src/app/api/vendor/requests/[id]/respond/route.ts",
];

describe("§enforcement-handle-close E1 — 신규 lock 누수 0 (열거형)", () => {
  it("수집이 실제로 동작한다 (공허 GREEN 방지)", () => {
    // route 를 못 찾으면 아래 단언들이 전부 공허하게 통과한다.
    expect(ROUTES.length).toBeGreaterThan(100);
    expect(USES_ENFORCE.length).toBeGreaterThan(50);
  });

  it("enforceAction 을 쓰면서 핸들을 닫지 않는 신규 route 0", () => {
    const legacy = new Set(LEGACY_UNCLOSED);
    const fresh = UNCLOSED.filter((p) => !legacy.has(p));
    // 실패 시 메시지에 경로가 그대로 뜬다 — 어느 route 가 누수인지 즉시 보인다.
    expect(fresh).toEqual([]);
  });
});

describe("§enforcement-handle-close E2 — ratchet 은 조여지기만 한다", () => {
  it("고쳐진 LEGACY 항목은 목록에서 제거돼야 한다 (stale 목록 방지)", () => {
    const stillUnclosed = new Set(UNCLOSED);
    const alreadyFixed = LEGACY_UNCLOSED.filter((p) => !stillUnclosed.has(p));
    expect(alreadyFixed).toEqual([]);
  });
});

describe("§enforcement-handle-close E3 — 예외 경로도 닫는다", () => {
  it("핸들을 닫는 route 는 catch 블록 안에서 fail() 을 호출한다", () => {
    const closed = USES_ENFORCE.filter((r) => closesHandle(r.src));
    const missing = closed
      .filter((r) => {
        const catchBlocks = r.src.match(/catch\s*\([^)]*\)\s*\{[\s\S]{0,600}?\}/g) ?? [];
        return !catchBlocks.some((b) => b.includes(".fail("));
      })
      .map((r) => r.path);
    expect(missing).toEqual([]);
  });
});

describe("§enforcement-handle-close E4 — 제품 쓰기 route 마감 품질", () => {
  const SAFETY = "src/app/api/products/[id]/safety/route.ts";
  const SPEC = "src/app/api/products/[id]/specification/route.ts";
  const get = (p: string) => ROUTES.find((r) => r.path === p)!.src;

  it.each([SAFETY, SPEC])("%s — targetEntityId 하드코딩 'unknown' 금지", (p) => {
    // 'unknown' 이면 lock 키가 전 제품 공용이 되어 한 제품 편집이 전체를 막고,
    // audit envelope 도 대상 제품을 잃는다.
    expect(get(p)).not.toMatch(/targetEntityId:\s*['"]unknown['"]/);
    expect(get(p)).toMatch(/targetEntityId:\s*id\b/);
  });

  it.each([SAFETY, SPEC])("%s — complete() 에 beforeState/afterState 기록", (p) => {
    const src = get(p);
    expect(src).toMatch(/\.complete\(\{[\s\S]{0,400}?beforeState/);
    expect(src).toMatch(/\.complete\(\{[\s\S]{0,600}?afterState/);
    expect(src).toMatch(/beforeState:\s*\{[\s\S]{0,200}?productId/);
  });

  it.each([SAFETY, SPEC])("%s — 권한 거부 경로에서 fail() 호출", (p) => {
    expect(get(p)).toMatch(/enforcement\.fail\(\);[\s\S]{0,300}?status:\s*403/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * E5 — §enforcement-handle-close-sweep 배치 1 (work-queue 7 route)
 *
 * ⛔ 실측으로 뒤집힌 전제 (2026-08-09):
 *   착수 지시는 "핸들 닫기 + targetEntityId 교정은 한 묶음, 분리 금지" 였다.
 *   그러나 §11.369-3 이후 `deriveConcurrencyKey` 는
 *       `${action}:${routePath}:${targetEntityId !== 'unknown' ? targetEntityId : userId}`
 *   이므로 'unknown' 은 **전역 공용 키가 아니라 per-user fallback** 이다.
 *   → route 간 충돌은 routePath 가 이미 막고 있고, 남는 것은
 *     "같은 사용자 + 같은 route" 재호출 차단(= 의도된 double-submit 보호)뿐이다.
 *   따라서 targetEntityId 교정은 **실제 대상 엔티티가 있는 route 에만** 적용한다.
 *   대상이 없는 route 에 억지 id 를 넣으면 double-submit 보호가 사라진다(회귀).
 * ───────────────────────────────────────────────────────────── */
describe("§enforcement-handle-close-sweep 배치1 — work-queue", () => {
  const WQ = (p: string) => `src/app/api/work-queue/${p}/route.ts`;
  const get = (p: string) => ROUTES.find((r) => r.path === WQ(p))!.src;

  /** 대상 엔티티가 body 에 실재 → per-resource lock 이 가능한 route */
  const ENTITY_ROUTES = [
    "assignment",
    "daily-review",
    "ops-execute",
    "cadence-governance",
    "bottleneck-remediation",
  ];
  /** POST() 인자가 없는 사용자 트리거 전역 sync → 'unknown'(userId fallback)이 정확한 의미 */
  const SYNC_ROUTES = ["compare-sync", "ops-sync"];

  it.each(ENTITY_ROUTES)("%s — targetEntityId 하드코딩 'unknown' 금지", (p) => {
    expect(get(p)).not.toMatch(/targetEntityId:\s*['"]unknown['"]/);
  });

  it.each(ENTITY_ROUTES)("%s — 핸들은 대상 id 확정 후 생성(검증 400 이 lock 보다 앞)", (p) => {
    const src = get(p);
    expect(src.indexOf("await request.json()")).toBeLessThan(src.indexOf("enforceAction({"));
  });

  it.each(SYNC_ROUTES)("%s — 'unknown' 유지 + 사유가 코드에 남아 있다", (p) => {
    const src = get(p);
    expect(src).toMatch(/targetEntityId:\s*['"]unknown['"]/);
    // 억지 id 로 '교정' 하려는 다음 사람을 막는다 — 사유가 사라지면 결정이 유실된다.
    expect(src).toMatch(/userId fallback|전역 sync/);
  });

  it("ops-execute — 내부 catch(execError) 도 fail() 로 닫는다", () => {
    // 내부 catch 는 자체 return 하므로 외부 catch 를 거치지 않는다.
    expect(get("ops-execute")).toMatch(/catch \(execError\)[\s\S]{0,900}?enforcement\.fail\(\)/);
  });

  it.each([...ENTITY_ROUTES, ...SYNC_ROUTES])("%s — complete() 로 audit 을 남긴다", (p) => {
    expect(get(p)).toMatch(/enforcement\.complete\(\{[\s\S]{0,300}?beforeState/);
  });
});
