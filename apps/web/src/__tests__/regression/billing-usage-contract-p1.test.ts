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
    /* 승계 (§plan-limit-subject · 2026-09-10): 인자 이름이 `userId` → `scope` 로 바뀌었다.
     *   명제는 "**공용 계산을 부른다**" 이지 인자 이름이 아니다. */
    expect(body).toMatch(/countUsageFor\(kind, [A-Za-z0-9_]+\)/);
    expect(body).not.toMatch(/db\.(quote|labelScanEvent|productInventory)\.count/);
  });

  it("/api/billing 은 4지표를 공용 계산으로 만든다", () => {
    /* 승계 (§plan-limit-subject): 두 번째 인자는 이제 스코프 객체다.
     *   3지표가 **같은 스코프 값**을 쓰는지는 아래 별도 단언이 본다. */
    expect(ROUTE).toMatch(/countUsageFor\("quotes", [A-Za-z0-9_]+\)/);
    expect(ROUTE).toMatch(/countUsageFor\("inventory", [A-Za-z0-9_]+\)/);
    expect(ROUTE).toMatch(/countUsageFor\("labelScan", [A-Za-z0-9_]+\)/);
    expect(ROUTE).toMatch(/itemsUsed:/);
    expect(ROUTE).toMatch(/itemsLimit:/);
    expect(ROUTE).toMatch(/labelScansUsed:/);
    expect(ROUTE).toMatch(/labelScansLimit:/);
  });

  /* ── §plan-limit-subject (호영님 2026-09-10 판정: 한도의 주체는 **조직**) ──
   *
   * 🛑 이 파일의 원 명제는 "enforce 와 화면이 같은 **계산식**을 쓴다" 였다.
   *   그런데 계산식이 같아도 **누구 것을 세는가**가 다르면 여전히 갈라진다 —
   *   실제로 그 상태였다:
   *     가격·한도  조직 (₩89,000/월 · 운영자 3명 포함 · 플랜은 Subscription 에 붙는다)
   *     사용량      개인 (`where { userId }`)
   *   결과 (a) Team 3인이면 월 한도를 사실상 3배 쓰고
   *        (b) 조직 재고는 `userId` 가 null 이라 품목 한도에 **아예 안 잡혔다**(무한).
   *   파는 단위와 쓰는 단위가 다르면 요금제가 성립하지 않는다.
   *   → 명제를 넓힌다: **한도와 사용량은 같은 조직을 본다.**
   */
  it("🛑 사용량 스코프는 조직 우선 · 조직 없을 때만 개인이다", () => {
    const code = stripComments(ENFORCE);
    // 스코프 해석이 **한 곳**에 있다(호출자가 각자 조립하지 않는다).
    expect(code).toMatch(/export async function resolveUsageScope/);
    // 조직이 있으면 조직, 없으면 개인 — 2축(행위자/스코프) 규칙.
    expect(code).toMatch(
      /scope\.organizationId[\s\S]{0,120}?\{\s*organizationId:\s*scope\.organizationId\s*\}[\s\S]{0,80}?\{\s*userId:\s*scope\.userId\s*\}/,
    );
    // 세 지표 전부 그 소유자 조건을 쓴다 — 하나라도 빠지면 그 축만 개인 계수로 남는다.
    const spread = code.match(/\.\.\.owner/g) ?? [];
    expect(spread.length).toBe(3);
  });

  it("🔑 한도와 사용량이 **같은 조직**에서 나온다 (해석 2회 금지)", () => {
    /* 조직을 두 번 해석하면 "한도는 org-A 플랜 · 사용량은 org-B 실적" 이 조용히 성립한다.
     *   창은 함수 블록으로 연다(4원칙 ⑤ — 고정 폭 슬라이스 금지). */
    const start = ENFORCE.indexOf("export async function enforcePlanLimit");
    expect(start).toBeGreaterThan(-1);
    const body = stripComments(ENFORCE.slice(start));
    const scopeIdx = body.search(/const scope = await resolveUsageScope\(/);
    const planIdx = body.search(/resolvePlan\(userId, scope\.organizationId\)/);
    const usedIdx = body.search(/countUsageFor\(kind, scope\)/);
    expect(scopeIdx, "스코프를 한 번 해석하는 자리가 없다").toBeGreaterThan(-1);
    expect(planIdx, "플랜이 그 스코프의 조직을 쓰지 않는다").toBeGreaterThan(scopeIdx);
    expect(usedIdx, "사용량이 그 스코프를 쓰지 않는다").toBeGreaterThan(scopeIdx);
  });

  it("🔑 화면도 같은 해석기를 쓴다 — 스코프를 직접 조립하지 않는다", () => {
    const code = stripComments(ROUTE);
    expect(code).toMatch(/resolveUsageScope\(/);
    /* 3지표가 **같은 변수**를 받아야 한다. 각각 다른 값을 넣으면 한 카드 안에서 갈라진다. */
    const args = [...code.matchAll(/countUsageFor\("(?:quotes|inventory|labelScan)", ([A-Za-z0-9_]+)\)/g)]
      .map((m) => m[1]);
    expect(args).toHaveLength(3);
    expect(new Set(args).size, `3지표가 서로 다른 스코프를 쓴다: ${args.join(" · ")}`).toBe(1);
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
