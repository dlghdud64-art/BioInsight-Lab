/**
 * §plan-change-claim (호영님 2026-09-06, (가) 3축) —
 * **유료 플랜을 적용하면 상태·청구·감사가 함께 남는다.**
 *
 * 배경: `/api/organizations/[id]/subscription` 은 세금계산서 기반 B2B 신청 경로다
 * (PG 미호출은 형태이고, 봉인은 2026-09-05 호영님 판정으로 철회 — §checkout-two-paths).
 * 그런데 어제 정직화한 것은 **말**이었고 **상태**가 아니었다. prod 실측:
 *   `plan = TEAM` · `status = "active"` · `Invoice` 0행 · 감사 0행.
 *
 * 3축을 잠근다:
 *   1축  Subscription.status = "unpaid"        (미수 상태 표기)
 *   2축  MutationAuditEvent 내구 기록          (누가·언제·어느 플랜으로)
 *   3축  Invoice 미수 1행                      (금액·발행처·발행 상태)
 *
 * 🛑 상수를 참조하는 단언 금지 조항(2026-09-05) 적용 — 값 집합을 **리터럴**로 고정한다.
 *   `toBe(E.X)` 는 멤버가 지워지면 `undefined === undefined` 로 조용히 통과한다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import {
  buildPlanChangeClaim,
  resolveIssuanceReadiness,
  claimAmountKrw,
  CLAIM_INVOICE_STATUS,
  SUBSCRIPTION_STATUS,
  ISSUANCE_REQUIRED_FIELDS,
  INVOICE_STATUS_LABELS,
  resolveInvoiceStatusLabel,
} from "@/lib/billing/plan-change-claim";
import { SubscriptionPlan } from "@/lib/plans";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB_ROOT, rel), "utf8");
const ROUTE = "src/app/api/organizations/[id]/subscription/route.ts";

/** POST 본문 블록 — 고정 폭 슬라이스를 쓰지 않는다(4원칙 ⑤). */
function postBlock(src: string): string {
  const start = src.indexOf("export async function POST(");
  expect(start).toBeGreaterThan(-1);
  return src.slice(start);
}

/* 🛑 축은 **플랜을 쓰는 경로 전량**이다. 한 곳만 잠그면 형제 슬롯이 갈라진다.
 *   2026-09-07 실측: `/api/organizations/[id]/subscription` 만 고쳤더니
 *   `/api/billing` POST 가 `status:"PAID"` · `amountPaid: 가격` · `paidAt: now` 로
 *   **결제 완료를 지어내고** 있었다 — 미수보다 무거운 거짓이다.
 *   CLAUDE.md "형태를 하나 고쳤으면 같은 창의 형제 슬롯을 전수 훑는다" 위반이었고,
 *   그 누락을 다음에도 잡으려면 **검사 축부터** 전량이어야 한다. */
const BILLING_ROUTE = "src/app/api/billing/route.ts";

const PERIOD_START = new Date("2026-09-06T00:00:00.000Z");
const PERIOD_END = new Date("2026-10-06T00:00:00.000Z");

function claim(
  plan: SubscriptionPlan,
  billingInfo: { businessNumber?: string | null; taxInvoiceEmail?: string | null } | null,
  periodMonths = 1,
) {
  return buildPlanChangeClaim({
    plan,
    periodMonths,
    planLabel: "Basic",
    billingInfo,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
  });
}

describe("§plan-change-claim — 값 집합 (리터럴 고정)", () => {
  it("구독 상태 값이 active · unpaid 둘뿐이다", () => {
    expect(Object.values(SUBSCRIPTION_STATUS).slice().sort()).toEqual([
      "active",
      "unpaid",
    ]);
  });

  it("🛑 이 경로가 만드는 청구서 상태는 DRAFT 하나뿐이다 (OPEN 금지)", () => {
    /* 발행 배선이 없으므로 "발행됨" 은 어떤 경우에도 거짓이다.
     * OPEN 이 이 상수에 들어오는 순간 placeholder success 가 부활한다. */
    expect(Object.values(CLAIM_INVOICE_STATUS).slice().sort()).toEqual(["DRAFT"]);
  });

  it("발행 필수 항목이 사업자번호 · 계산서 수신 이메일이다", () => {
    expect(ISSUANCE_REQUIRED_FIELDS.slice().sort()).toEqual([
      "businessNumber",
      "taxInvoiceEmail",
    ]);
  });
});

describe("§plan-change-claim 1축 — 상태", () => {
  it("유료 플랜은 unpaid 다 (청구가 생겼고 수금된 적이 없다)", () => {
    expect(claim(SubscriptionPlan.TEAM, null).subscriptionStatus).toBe("unpaid");
    expect(claim(SubscriptionPlan.ORGANIZATION, null).subscriptionStatus).toBe(
      "unpaid",
    );
  });

  it("FREE 는 active 다 — 신규 조직 기본 조합이라 모순이 아니다", () => {
    /* 🛑 canceled·unpaid 로 적으면 각각 "해지됨"·"미수금 있음" 이라는 다른 거짓이 된다. */
    const r = claim(SubscriptionPlan.FREE, null);
    expect(r.subscriptionStatus).toBe("active");
    expect(r.invoice).toBeNull();
  });
});

describe("§plan-change-claim 3축 — 청구서", () => {
  it("금액이 화면이 보여준 식과 같다 (월 · 연간)", () => {
    // 월정가 89,000 · 연간은 월환산 79,000 × 12 = 948,000 (checkout-utils 와 동일 식)
    expect(claimAmountKrw(SubscriptionPlan.TEAM, 1)).toBe(89_000);
    expect(claimAmountKrw(SubscriptionPlan.TEAM, 12)).toBe(948_000);
    expect(claimAmountKrw(SubscriptionPlan.ORGANIZATION, 1)).toBe(259_000);
    expect(claimAmountKrw(SubscriptionPlan.FREE, 1)).toBe(0);
  });

  it("🛑 발행 요건이 갖춰져도 DRAFT · 번호 없음 (발행 배선이 없다)", () => {
    const r = claim(SubscriptionPlan.TEAM, {
      businessNumber: "123-45-67890",
      taxInvoiceEmail: "tax@example.com",
    });
    expect(r.invoice?.status).toBe("DRAFT");
    expect(r.invoice?.number).toBeNull();
    // 발행 가능하다는 사실 자체는 근거로 남긴다 — 배선이 생겼을 때 쓴다.
    expect(r.invoice?.issuance.issuable).toBe(true);
    expect(r.invoice?.description).toContain("미발행");
  });

  it("빈 문자열은 '없음' 으로 센다 (실측: businessNumber 가 \"\" 였다)", () => {
    /* `!= null` 로만 보면 "있다" 로 잘못 세고, 그게 곧 발행 가능한 척이다. */
    expect(resolveIssuanceReadiness({ businessNumber: "", taxInvoiceEmail: null })).toEqual({
      issuable: false,
      missing: ["businessNumber", "taxInvoiceEmail"],
    });
    expect(resolveIssuanceReadiness({ businessNumber: "   ", taxInvoiceEmail: "a@b.c" })).toEqual({
      issuable: false,
      missing: ["businessNumber"],
    });
    expect(resolveIssuanceReadiness(null).issuable).toBe(false);
  });

  it("미비 사유를 청구서 설명에 적는다 (값과 근거가 같이 간다)", () => {
    const r = claim(SubscriptionPlan.TEAM, { businessNumber: "", taxInvoiceEmail: null });
    expect(r.invoice?.description).toContain("businessNumber");
    expect(r.invoice?.description).toContain("taxInvoiceEmail");
    expect(r.invoice?.issuance.issuable).toBe(false);
  });

  it("🛑 없는 결제일·수금을 지어내지 않는다", () => {
    /* §checkout-two-paths 에서 화면에서 지운 "없는 결제일" 이
     * 청구서 쪽으로 자리만 옮기면 안 된다. */
    const r = claim(SubscriptionPlan.TEAM, null);
    expect(r.invoice?.dueDate).toBeNull();
    expect(r.invoice?.paidAt).toBeNull();
    expect(r.invoice?.amountPaid).toBe(0);
  });

  it("청구 기간이 구독 기간과 같은 값이다", () => {
    const r = claim(SubscriptionPlan.TEAM, null);
    expect(r.invoice?.periodStart).toBe(PERIOD_START);
    expect(r.invoice?.periodEnd).toBe(PERIOD_END);
  });
});

describe("§plan-change-claim — 라우트 배선", () => {
  it("1축: status 를 \"active\" 로 고정하지 않고 claim 값을 쓴다", () => {
    const post = stripComments(postBlock(read(ROUTE)));
    expect(post).not.toMatch(/status:\s*"active"/);
    // update · create 두 분기 **모두** 배선돼야 한다(경로는 OR 로 묶지 않는다).
    const statusWrites = post.match(/status:\s*claim\.subscriptionStatus/g) ?? [];
    expect(statusWrites).toHaveLength(2);
  });

  it("3축: 발행처를 읽고 청구서를 만든다", () => {
    const post = stripComments(postBlock(read(ROUTE)));
    expect(post).toMatch(/db\.billingInfo\.findUnique/);
    expect(post).toMatch(/db\.invoice\.create/);
    expect(post).toMatch(/buildPlanChangeClaim\(/);
  });

  it("2축: MutationAuditEvent 에 **DB로** 직접 쓴다", () => {
    /* 🛑 enforcement.complete 로는 이 자리를 못 채운다 — 그 경로는
     *   모듈 최상위 `let auditStore` 라 인스턴스 메모리다(prod 실측 0행). */
    const post = stripComments(postBlock(read(ROUTE)));
    expect(post).toMatch(/db\.mutationAuditEvent\.create/);
    expect(post).toMatch(/actorId:\s*session\.user\.id/);
    expect(post).toMatch(/planBefore/);
    expect(post).toMatch(/planAfter/);
  });

  it("🛑 감사 실패를 조용히 삼키지 않는다 (사유를 남긴다)", () => {
    const post = stripComments(postBlock(read(ROUTE)));
    expect(post).toMatch(/감사 기록 실패/);
  });

  it("시각을 하나만 잡는다 (같은 사건의 시각이 갈리지 않게)", () => {
    /* 실측: 이전 판본이 planExpiresAt 과 currentPeriodStart 를 각각 new Date() 로 떠
     * periodEnd 가 periodStart 보다 0.759초 앞섰다. */
    const post = stripComments(postBlock(read(ROUTE)));
    expect(post).not.toMatch(/currentPeriodStart:\s*new Date\(\)/);
    expect((post.match(/currentPeriodStart:\s*now/g) ?? []).length).toBe(2);
  });
});

describe("§plan-change-claim — 어제 판정과 충돌하지 않는다 (회귀 0)", () => {
  it("§checkout-two-paths 의 '청구 없음' 문구를 건드리지 않았다", () => {
    /* 발행된 청구서는 여전히 0이다 — 여기서 만드는 것은 내부 기록이다.
     * 이 단언이 RED 가 되면 두 계약 중 하나를 바꾼 것이므로 승인 없이 진행하면 안 된다. */
    const utils = read("src/components/checkout/checkout-utils.ts");
    expect(utils).toMatch(/즉시 적용 \(청구 없음\)/);
    expect(utils).toMatch(/결제 연동 준비 중이라 지금은 청구되지 않습니다/);
  });

  it("이 경로는 여전히 PG 를 부르지 않는다 (형태 유지)", () => {
    const post = stripComments(postBlock(read(ROUTE)));
    expect(post).not.toMatch(/stripe|Stripe|tosspayments|PortOne|iamport/);
  });
});

describe("§plan-change-claim — 플랜 쓰기 경로 **전량** (형제 슬롯)", () => {
  /* 두 경로 다 결제를 받지 않는다. 한쪽만 정직하면 다른 쪽으로 거짓이 되살아난다. */
  const ROUTES = [ROUTE, BILLING_ROUTE];

  it("🛑 어느 경로도 결제 완료를 지어내지 않는다 (PAID · paidAt · amountPaid 위조 0)", () => {
    for (const rel of ROUTES) {
      const post = stripComments(postBlock(read(rel)));
      expect(`${rel}: ${/status:\s*"PAID"/.test(post)}`).toBe(`${rel}: false`);
      expect(`${rel}: ${/paidAt:\s*now/.test(post)}`).toBe(`${rel}: false`);
      expect(`${rel}: ${/amountPaid:\s*planInfo\.price/.test(post)}`).toBe(`${rel}: false`);
    }
  });

  it('🛑 어느 경로도 status 를 "active" 로 고정하지 않는다', () => {
    for (const rel of ROUTES) {
      const post = stripComments(postBlock(read(rel)));
      expect(`${rel}: ${/status:\s*"active"/.test(post)}`).toBe(`${rel}: false`);
    }
  });

  it("두 경로가 **같은 정본**을 쓴다 (다시 갈라지지 않게)", () => {
    for (const rel of ROUTES) {
      const post = stripComments(postBlock(read(rel)));
      expect(`${rel}: ${/buildPlanChangeClaim\(/.test(post)}`).toBe(`${rel}: true`);
      expect(`${rel}: ${/status:\s*claim\.subscriptionStatus/.test(post)}`).toBe(`${rel}: true`);
      expect(`${rel}: ${/db\.billingInfo\.findUnique/.test(post)}`).toBe(`${rel}: true`);
    }
  });

  it("🛑 청구 내역이 enum 값을 화면에 그대로 그리지 않는다 (raw internal key 0)", () => {
    /* 지금까지 위조 PAID 만 만들어져 안 드러났다. 미수 DRAFT 가 생기는 순간
     * `{... : invoice.status}` 가 화면에 `DRAFT` 를 띄운다. */
    const page = stripComments(read("src/app/billing/page.tsx"));
    expect(page).not.toMatch(/\?\s*"결제완료"\s*:\s*invoice\.status/);
    expect(page).toMatch(/resolveInvoiceStatusLabel\(invoice\.status\)/);
    // 번호가 없을 때 내부 id 조각을 대신 그리지 않는다
    expect(page).not.toMatch(/invoice\.number \|\| invoice\.id\.slice/);
  });

  it("청구서 상태 라벨이 InvoiceStatus 전 값을 덮는다", () => {
    expect(Object.keys(INVOICE_STATUS_LABELS).slice().sort()).toEqual([
      "DRAFT",
      "OPEN",
      "PAID",
      "UNCOLLECTIBLE",
      "VOID",
    ]);
    expect(resolveInvoiceStatusLabel("DRAFT")).toBe("미발행 · 미수");
    // 모르는 값이면 원문 — 빈 칸이 되면 상태가 없는 것처럼 보인다
    expect(resolveInvoiceStatusLabel("WHATEVER")).toBe("WHATEVER");
    expect(resolveInvoiceStatusLabel(null)).toBe("—");
  });

  it("🛑 청구서 번호를 지어내지 않는다 (번호는 발행의 표지)", () => {
    for (const rel of ROUTES) {
      const post = stripComments(postBlock(read(rel)));
      expect(`${rel}: ${/number:\s*`INV-/.test(post)}`).toBe(`${rel}: false`);
    }
  });
});
