/**
 * §pricing-enforce-p2 P2b — 라벨 스캔 월 카운터 enforce (호영님 2026-06-27)
 *
 * P1 이 plans.ts 에 maxLabelScansPerMonth(Free 10/이상 null) field 를 추가했으나 enforce 0(휴면).
 * 본 sentinel 은 라벨 스캔 월 한도를 실제 강제하도록 enforce + 카운트 SoT(LabelScanEvent) 를 검증한다.
 *   - prisma: LabelScanEvent 모델 + User.labelScanEvents 역관계
 *   - enforce-plan-limit: "labelScan" kind + maxLabelScansPerMonth 비교 + LabelScanEvent count
 *   - scan-label route: enforcePlanLimit("labelScan") 선제 차단(429) + 성공 시 LabelScanEvent 1건 insert
 * 회귀 0: quotes/inventory enforce·enforceAction RBAC·OCR lock(complete/fail) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const PLANS = read("lib/plans.ts");
const ENFORCE = read("lib/billing/enforce-plan-limit.ts");
const SCAN = read("app/api/inventory/scan-label/route.ts");
const SCHEMA = readFileSync(join(SRC, "..", "prisma", "schema.prisma"), "utf8");

describe("§pricing-enforce-p2 P2b — plans.ts 한도 (P1 land 재확인)", () => {
  it("maxLabelScansPerMonth Free 10 / 이상 null", () => {
    expect(PLANS).toMatch(/maxLabelScansPerMonth: 10/);
    expect(PLANS).toMatch(/maxLabelScansPerMonth: null/);
  });
});

describe("§pricing-enforce-p2 P2b — LabelScanEvent 카운트 SoT (schema)", () => {
  it("LabelScanEvent 모델 정의", () => {
    expect(SCHEMA).toMatch(/model LabelScanEvent \{/);
    expect(SCHEMA).toMatch(/userId\s+String/);
    expect(SCHEMA).toMatch(/@@index\(\[userId, createdAt\]\)/);
  });
  it("User.labelScanEvents 역관계", () => {
    expect(SCHEMA).toMatch(/labelScanEvents\s+LabelScanEvent\[\]/);
  });
});

describe("§pricing-enforce-p2 P2b — enforce labelScan kind", () => {
  it("PlanLimitKind 에 labelScan 포함", () => {
    expect(ENFORCE).toMatch(/PlanLimitKind = "quotes" \| "inventory" \| "labelScan"/);
  });
  it("labelScan 분기 — maxLabelScansPerMonth + LabelScanEvent count + null 통과", () => {
    expect(ENFORCE).toMatch(/kind === "labelScan"/);
    expect(ENFORCE).toMatch(/limits\.maxLabelScansPerMonth/);
    /* 🛑 승계 (§plan-limit-subject · 호영님 2026-09-10) — 이전 판본은 **통짜 문자열**을 핀했다:
     *     db.labelScanEvent.count({ where: { userId, createdAt: { gte: monthStart } } })
     *   그건 명제가 아니라 스냅샷이다(CLAUDE.md §sentinel 은 명제를 단언한다 · 바이트 층위).
     *   한도 주체가 개인 → **조직**으로 바뀌면서 `userId` 자리가 스코프 스프레드가 됐고,
     *   계약을 지키는 구현이 RED 가 됐다. 앵커를 새 문자열로 갈면 다음 변경에 또 깨진다.
     *
     *   원 명제를 이력에서 복원해 그것만 잠근다:
     *     **"라벨 스캔 사용량 = 이번 달(monthStart 이후) LabelScanEvent 건수"**
     *   누구 것을 세는가(개인/조직)는 이 파일의 명제가 아니다 —
     *   그 축은 `regression/plan-limit-subject.test.ts` 가 소유한다. */
    const call = /db\.labelScanEvent\.count\(\{\s*where:\s*\{[\s\S]{0,160}?createdAt:\s*\{\s*gte:\s*monthStart\s*\}/;
    expect(ENFORCE).toMatch(call);
  });
  it("KIND_LABEL labelScan 라벨", () => {
    expect(ENFORCE).toMatch(/labelScan: "라벨 스캔"/);
  });
});

describe("§pricing-enforce-p2 P2b — scan-label 라우트 배선", () => {
  it("enforcePlanLimit/PlanLimitError import + labelScan 선제 차단 429", () => {
    expect(SCAN).toMatch(/import \{ enforcePlanLimit, PlanLimitError \} from "@\/lib\/billing\/enforce-plan-limit"/);
    /* §invite-flow Phase 2-8 승계 — 3번째 인자(조직) 허용. 보호의도는 "labelScan 한도를 잰다" 이지
     * 인자 개수가 아니다. 아래 위치 단언(enforce < enforceAction)이 "OCR 비용 前" 을 계속 잠근다. */
    expect(SCAN).toMatch(/enforcePlanLimit\(session\.user\.id, "labelScan"(, [A-Za-z0-9_]+)?\)/);
    expect(SCAN).toMatch(/instanceof PlanLimitError/);
    expect(SCAN).toMatch(/status:\s*429/);
  });
  it("성공 시 LabelScanEvent 1건 insert (카운트 SoT)", () => {
    /* 승계 (§plan-limit-subject · 2026-09-10): `userId` 만 쓰던 판본에서 **조직도 함께** 쓴다.
     *   명제는 "성공 스캔 1건이 카운트 SoT 에 남는다" 이고, 이제 그 카운트가 조직 기준이므로
     *   조직 열이 **명제의 일부**가 됐다 — 안 쓰면 조직 스코프 count 가 항상 0 이라
     *   한도가 무한이 된다. 두 필드를 각각 단언한다(OR 로 묶지 않는다). */
    const start = SCAN.indexOf("db.labelScanEvent.create(");
    expect(start).toBeGreaterThan(-1);
    const block = SCAN.slice(start, SCAN.indexOf("});", start));
    expect(block).toMatch(/userId:\s*session\.user\.id/);
    expect(block).toMatch(/organizationId:\s*activeOrganizationId/);
  });

  it("🔑 스캔 라우트가 조직을 **한 번만** 해석한다 (한도와 기록이 같은 조직)", () => {
    /* 두 번 해석하면 "한도는 org-A · 기록은 org-B" 가 조용히 성립한다.
     *   §plan-limit-subject 의 enforce 쪽 단언과 같은 명제의 라우트 축이다. */
    const resolves = SCAN.match(/resolveActiveOrganizationId\(|resolveOrganizationIdForMutation\(/g) ?? [];
    expect(resolves.length, `조직 해석 호출이 ${resolves.length}회`).toBe(1);
    const resolveIdx = SCAN.search(/const activeOrganizationId = await resolve/);
    const enforceIdx = SCAN.search(/enforcePlanLimit\(session\.user\.id, "labelScan"/);
    const createIdx = SCAN.indexOf("db.labelScanEvent.create(");
    expect(resolveIdx).toBeGreaterThan(-1);
    expect(enforceIdx).toBeGreaterThan(resolveIdx);
    expect(createIdx).toBeGreaterThan(resolveIdx);
  });
  it("enforce 가 OCR 비용 前(enforceAction 前) 배치", () => {
    /* 🛑 `indexOf(<정확한 2인자 문자열>)` 로 세면 안 된다 — 인자가 하나 늘면 **-1** 이 되고
     *   `-1 < anything` 이라 **공허하게 통과**한다. 위치 잠금이 죽은 채 GREEN 이 뜬다.
     *   실제로 §invite-flow Phase 2-8 에서 3번째 인자(조직)를 추가하자 그 상태가 됐다(실측).
     *   → 정규식으로 찾고, **찾았다는 사실 자체를 먼저 단언**한다. */
    const enforceIdx = SCAN.search(/enforcePlanLimit\(session\.user\.id, "labelScan"/);
    const actionIdx = SCAN.indexOf("enforcement = enforceAction");
    expect(enforceIdx).toBeGreaterThan(-1);
    expect(actionIdx).toBeGreaterThan(-1);
    expect(enforceIdx).toBeLessThan(actionIdx);
  });
});

describe("§pricing-enforce-p2 P2b — 회귀 0", () => {
  it("quotes/inventory enforce 보존", () => {
    expect(ENFORCE).toMatch(/db\.quote\.count/);
    expect(ENFORCE).toMatch(/db\.productInventory\.count/);
    expect(ENFORCE).not.toMatch(/db\.order\.count/);
  });
  it("scan-label enforceAction RBAC + OCR lock 보존", () => {
    expect(SCAN).toMatch(/enforceAction\(\{/);
    /* 승계 (§audit-org-required · 2026-09-11): complete() 는 조직 인자를 필수로 받는다.
     *   명제는 "성공 경로에서 complete 로 lock 을 푼다" 이지 "인자 없이 부른다" 가 아니다. */
    expect(SCAN).toMatch(/enforcement\.complete\(\{\s*organizationId:/);
    expect(SCAN).toMatch(/enforcement\?\.fail\(\)/);
  });
});
