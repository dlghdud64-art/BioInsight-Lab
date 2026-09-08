/**
 * §billing-redesign P1: 사용량 계약: **enforce 와 화면이 같은 계산을 쓴다.**
 *
 * 왜 이 단언이 필요한가(재발 방지 대상 2건, 둘 다 실측):
 *   ① `/api/billing` 이 `quotesLimit: 10` 을 지어내 한 화면이 한도를 3 이라고도
 *      10 이라고도 말했다(2026-09-07 제거).
 *   ② 남아 있던 `new Date(new Date().setDate(1))` 은 **시각을 0으로 맞추지 않아**
 *      1일 오전 생성분이 화면 집계에서만 빠졌다. enforce 는 setHours(0,0,0,0) 까지 한다.
 *      같은 견적을 두 곳이 다르게 세는 상태였고, P1 이 계산을 한 곳으로 모아 닫았다.
 *
 * 계산식 정본은 `lib/billing/enforce-plan-limit.ts` 안에 둔다. 밖으로 빼지 않는다.
 *   기존 sentinel(label-scan-quota-p2b:49 등)이 그 파일의 계산식 문자열을 핀하고 있어,
 *   모듈을 옮기면 계약이 아니라 위치 때문에 RED 가 난다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

const ENFORCE = read("src/lib/billing/enforce-plan-limit.ts");
const ROUTE = read("src/app/api/billing/route.ts");

describe("§billing-redesign P1: 계산 단일점", () => {
  it("공용 계산 export 3종이 enforce-plan-limit **안에** 있다", () => {
    expect(ENFORCE).toMatch(/export function planLimitFor/);
    expect(ENFORCE).toMatch(/export function planUsageMonthStart/);
    expect(ENFORCE).toMatch(/export async function countUsageFor/);
  });

  it("월 기준점은 1일 00:00, 시각 절삭이 계산식에 있다", () => {
    expect(ENFORCE).toMatch(/monthStart\.setDate\(1\)/);
    expect(ENFORCE).toMatch(/monthStart\.setHours\(0, 0, 0, 0\)/);
  });

  it("enforcePlanLimit 은 공용 계산을 호출한다 (자체 count 재구현 0)", () => {
    const body = ENFORCE.slice(ENFORCE.indexOf("export async function enforcePlanLimit"));
    expect(body).toMatch(/planLimitFor\(kind, limits\)/);
    expect(body).toMatch(/countUsageFor\(kind, userId\)/);
    expect(body).not.toMatch(/db\.(quote|labelScanEvent|productInventory)\.count/);
  });

  it("/api/billing 은 4지표를 공용 계산으로 만든다", () => {
    expect(ROUTE).toMatch(/countUsageFor\("quotes", userId\)/);
    expect(ROUTE).toMatch(/countUsageFor\("inventory", userId\)/);
    expect(ROUTE).toMatch(/countUsageFor\("labelScan", userId\)/);
    expect(ROUTE).toMatch(/itemsUsed:/);
    expect(ROUTE).toMatch(/itemsLimit:/);
    expect(ROUTE).toMatch(/labelScansUsed:/);
    expect(ROUTE).toMatch(/labelScansLimit:/);
  });

  it("재고·스캔 한도는 PLAN_LIMITS 정본에서 온다 (PLAN_INFO 사본 아님)", () => {
    expect(ROUTE).toMatch(/PLAN_LIMITS\[currentPlan as SubscriptionPlan\]\.maxItems/);
    expect(ROUTE).toMatch(/PLAN_LIMITS\[currentPlan as SubscriptionPlan\]\.maxLabelScansPerMonth/);
  });

  it("지어낸 사용량·시각 미절삭 기준점이 라우트에 없다", () => {
    // 금지 대상은 **코드로서의 기준점**(`gte:` 인자). 재발 방지 설명 주석의 인용은 허용.
    /* 🛑 부정 단언은 **주석 제거본**에 건다 (2026-09-08 보강).
     *   이 블록의 원 주석이 이미 "재발 방지 설명 주석의 인용은 허용" 이라 적어 뒀는데,
     *   구현이 `ROUTE`(원문)를 봐서 그 의도가 지켜지지 않았다 — 라우트에 남긴
     *   재발 방지 설명 주석이 자기 단언에 걸렸다(2026-09-08 실측: 데모 분기를 제거하며
     *   그 사실을 주석으로 남기자 RED). 저장소에 같은 형태가 반복돼 규칙과 헬퍼가 이미 있다.
     *   → `stripComments` 를 통과시킨다. 보호 의도는 그대로 — **코드로서의** 기준점을 막는다. */
    const routeCode = stripComments(ROUTE);
    expect(routeCode).not.toMatch(/gte: new Date\(new Date\(\)\.setDate\(1\)\)/);
    expect(routeCode).not.toMatch(/quotesLimit: 10/);
  });
});
