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

  it("🛑 결제를 약속하는 문구가 **없다** (돈에 대해 사실이 아닌 말 0)", () => {
    /* 승계 (2026-09-05, 호영님 재판정): 옛 단언은 "거짓 문구 3종이 아직 남아 있다" 였다 —
     * 봉인 전제 하에 "봉인이 풀리면 먼저 정직화하라" 는 **알림**이었다.
     * 봉인이 철회되고(대안 경로도 죽어 있었다) 정직화를 실제로 했으므로,
     * 알림을 **부활 금지**로 뒤집는다. 보호의도는 같다 — 화면이 없는 결제를 말하지 않는다. */
    const utils = read("src/components/checkout/checkout-utils.ts");
    const dialog = read(DIALOG);
    const copy = stripComments(utils) + stripComments(dialog);

    expect(copy).not.toMatch(/지금 결제하고 바로 사용/);
    expect(copy).not.toMatch(/자동 갱신/);
    expect(copy).not.toMatch(/청구됩니다/);
    expect(copy).not.toMatch(/차액이 계산되어/);
    // 🛑 없는 날짜를 적지 않는다 — 갱신 주체가 없어 결제일이 존재하지 않는다
    expect(copy).not.toMatch(/다음 결제일/);
    expect(copy).not.toMatch(/정기 결제 금액/);
  });

  it("🔑 대신 사실을 말한다 (청구 없음 · 연동 준비 중)", () => {
    /* 부정 단언만 두면 문구를 **지워도** 통과한다 — 침묵은 정직이 아니다. */
    const utils = read("src/components/checkout/checkout-utils.ts");
    expect(utils).toMatch(/결제 없이 바로 적용/);
    expect(utils).toMatch(/결제 연동 준비 중이라 지금은 청구되지 않습니다/);
    expect(utils).toMatch(/즉시 적용 \(청구 없음\)/);
    expect(stripComments(read(DIALOG))).toMatch(/연동 준비 중 · 청구 없음/);
  });

  it("🛑 결제일 표시가 **결제 화면 전량**에서 없다 (범위를 밝힌 0)", () => {
    /* 🔑 앞선 보고의 "잔재 0" 은 `checkout-utils`·`CheckoutDialog` **범위에서만** 참이었다 —
     * `billing/page.tsx` 와 `settings/plans/page.tsx` 가 같은 날짜를 따로 그리고 있었다.
     * **범위를 밝히지 않은 0 은 틀린 0이다.** 그래서 여기서는 대상 파일을 열거해 고정한다.
     *
     * 발화 조건이 중요하다: `Subscription.currentPeriodEnd` 는 플랜 변경 POST 가
     * `now + 30일` 로 **만들어 넣는 값**이라, 업그레이드하는 순간 세 화면이 동시에
     * 없는 결제일을 말하기 시작했다. */
    const SURFACES = [
      "src/components/checkout/checkout-utils.ts",
      "src/components/checkout/CheckoutDialog.tsx",
      "src/app/billing/page.tsx",
      "src/app/dashboard/settings/plans/page.tsx",
    ];
    for (const rel of SURFACES) {
      const code = stripComments(read(rel));
      expect(`${rel}: ${/다음 결제일/.test(code)}`).toBe(`${rel}: false`);
      expect(`${rel}: ${/정기 결제 금액/.test(code)}`).toBe(`${rel}: false`);
    }
  });

  it("⏳ 파생원은 **지우지 않았다** (결제가 배선되면 진짜 결제일이 된다)", () => {
    /* 표시만 바꾸고 컬럼·파생은 남긴다 — 지금 버리면 나중에 복원해야 한다
     * (`checkout-utils` 때 문자열을 남긴 것과 같은 판단 · 호영님 지시). */
    expect(read("src/app/billing/page.tsx")).toMatch(/subscription\?\.currentPeriodEnd/);
    expect(read("src/app/dashboard/settings/plans/page.tsx")).toMatch(
      /const nextPaymentDate = \(\(\) =>/,
    );
  });

  it("settings/billing 실패가 **사유**를 말한다 (자기 문제로 읽히지 않게)", () => {
    /* prod 실측 `billing.stripeConfigured: false` — 이 경로는 반드시 실패한다.
     * "프로세스를 시작할 수 없습니다" 는 사실이지만 원인을 말하지 않아
     * 사용자가 카드·네트워크 문제로 읽는다. */
    const billing = stripComments(read("src/app/settings/billing/page.tsx"));
    expect(billing).toMatch(/title: "결제 연동 준비 중입니다"/);
    expect(billing).not.toMatch(/업그레이드 프로세스를 시작할 수 없습니다/);
    // 🛑 문구를 health 실측값에 배선하지 않는다 (매 렌더 health 호출 = 새 결합)
    expect(billing).not.toMatch(/stripeConfigured/);
  });

});
