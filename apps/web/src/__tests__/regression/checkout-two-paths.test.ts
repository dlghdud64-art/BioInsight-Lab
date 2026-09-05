/**
 * §checkout-two-paths (2026-09-05) — 유료 전환 경로가 **둘**인데 하나만 청구한다.
 *
 *   settings/billing  → POST /api/billing/checkout → Stripe        ✅ 실제 청구
 *   settings/plans    → CheckoutDialog → POST .../subscription     ❌ PG 0곳 · 청구 없음
 *
 * 사용자는 두 화면을 구분할 방법이 없고, 후자는 "지금 결제하고 바로 사용 ·
 * 다음 결제는 …에 자동 갱신됩니다" 라고 **돈에 대해 사실이 아닌 것**을 말한다.
 * dead button 보다 무겁다 — dead button 은 아무 일도 안 일어나는데, 이건
 * **일어나지 않은 일을 일어났다고** 말한다.
 *
 * 이 파일은 그 사실을 **기계로 고정**한다(호영님 판정 (B) 봉인의 전제 기록).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "../_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB_ROOT, rel), "utf8");

const DIALOG = "src/components/checkout/CheckoutDialog.tsx";
const CHECKOUT_ROUTE = "src/app/api/billing/checkout/route.ts";
const HEALTH = "src/app/api/health/route.ts";

describe("§checkout-two-paths — 두 경로의 실재", () => {
  it("🛑 CheckoutDialog 는 PG 를 부르지 않는다 (청구 없는 경로다)", () => {
    /* 이 사실이 바뀌면(= 결제가 배선되면) 봉인·문구 판정을 **다시 해야 한다**. */
    const code = stripComments(read(DIALOG));
    expect(code).not.toMatch(/stripe|Stripe|tosspayments|PortOne|iamport/);
    // 외부 호출은 자체 API 뿐 — 수집이 실제로 동작하는지 먼저 센다
    const calls = code.match(/(?:csrfFetch|fetch)\(`?\/api\/[^`)]*/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c).toMatch(/\/api\/organizations\//);
  });

  it("실제 청구 경로는 billing/checkout 하나다 (Stripe 실호출)", () => {
    const route = read(CHECKOUT_ROUTE);
    expect(route).toMatch(/import Stripe from "stripe"/);
    expect(route).toMatch(/stripe\.(customers|checkout)\./);
  });

  it("🔑 키 부재를 **관측 가능**하게 둔다 (prod env 는 코드에서 안 보인다)", () => {
    /* `billing/checkout` 은 키가 없어도 `sk_test_placeholder_will_fail` 로 기동하고
     * **호출 시점에야** 인증 실패한다. 그래서 봉인의 전제(청구 경로 생존)를
     * 배포본에서 확인할 축이 필요하다. 🛑 값이 아니라 존재 여부만 노출한다. */
    const health = read(HEALTH);
    expect(health).toMatch(/stripeConfigured: !!process\.env\.STRIPE_SECRET_KEY/);
    expect(health).toMatch(/hasTeamPriceId: !!process\.env\.STRIPE_PRICE_ID_TEAM_MONTHLY/);
    /* 시크릿 값 자체를 내보내지 않는다 — health 안의 모든 STRIPE_* 참조가 **불리언으로
     * 강제**돼야 한다. 🛑 첫 판본은 `not.toMatch(/…STRIPE_SECRET_KEY\s*[,)}]/)` 였는데
     * 정당한 `!!process.env.STRIPE_SECRET_KEY,` 의 쉼표에 스스로 걸렸다(자기 함정) —
     * 값 노출이 아니라 **강제 여부**를 봐야 한다. */
    const refs = [...health.matchAll(/(!!)?process\.env\.STRIPE_[A-Z_]+/g)];
    expect(refs.length).toBeGreaterThan(0);
    for (const m of refs) expect(`${m[0]}`).toMatch(/^!!process\.env\.STRIPE_/);
  });

  it("⏳ 거짓 문구 3종은 아직 소스에 남아 있다 (봉인이 풀리면 먼저 정직화)", () => {
    /* 지우지 않는다 — 결제 연동 시 다시 써야 한다. 대신 **여기서 알린다**:
     * 봉인이 풀려 이 문구가 도달 가능해지면, 정직화가 선행돼야 한다. */
    const utils = read("src/components/checkout/checkout-utils.ts");
    expect(utils).toMatch(/지금 결제하고 바로 사용/);
    expect(utils).toMatch(/자동 갱신됩니다/);
    expect(utils).toMatch(/청구됩니다/);
    expect(
      existsSync(join(WEB_ROOT, "src/components/checkout/checkout-utils.ts")),
      "checkout-utils 가 사라졌다. 거짓 문구 3종의 처리 결과를 이 단언에 반영할 것.",
    ).toBe(true);
  });
});
