/**
 * §billing-surface-unify (호영님 2026-09-07) —
 * **결제 표면은 지어낸 숫자를 내지 않는다. 빈 화면이 거짓 숫자보다 낫다.**
 *
 * 발단: §plan-change-claim DML 로 T1 에 **진짜 미수 89,000원**(DRAFT)이 생겼다.
 *   그 순간 한 제품이 미납 금액을 두 개로 말하기 시작했다 —
 *   `/billing` 은 89,000원, `/dashboard/billing` 은 `₩ 0 · "모두 결제 완료"`.
 *   🔑 어제까지는 **둘 다 거짓이라 안 부딪혔다.** 하나를 참으로 만드니 모순이 드러났다.
 *
 * 걷어낸 것 3곳 (전부 같은 병 · 위조 PAID 의 읽기 경로 판본):
 *   1. `/dashboard/billing`        199줄 정적 목업(₩12,450,000 · 미납 ₩0 · 발행 계산서 건수).
 *                                  데이터 배선 0 · 인바운드 링크 0 → `/billing` 리다이렉트.
 *   2. `/api/billing/invoices`     "실제 데이터가 없으면 Mock 반환" — 청구 0인 사용자에게
 *                                  49,000원 `PAID` 3건. Invoice 는 그날까지 전역 0행이었으므로
 *                                  이 화면을 본 사람은 전부 "147,000원 결제 완료" 를 봤다.
 *   3. `/api/billing` GET          비인증 데모가 `usage.quotesLimit: 10` 을 지어냈는데
 *                                  같은 응답의 `planInfo.FREE.maxQuotesPerMonth` 는 3이었다.
 *                                  한 화면이 한도를 둘로 말했다.
 *
 * 🛑 잠그는 것은 **명제**이지 파일 목록이 아니다 — 결제 표면 전체를 돌며
 *   "세션 없으면 지어낸 페이로드" 형태를 찾는다(§page-shell-single-source 와 같은 설계).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB_ROOT, rel), "utf8");

/** 결제 API 표면 전량 — 디렉터리를 훑는다(파일명을 손으로 적지 않는다). */
function billingRoutes(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "route.ts") out.push(p);
    }
  })(join(WEB_ROOT, "src", "app", "api", "billing"));
  return out;
}

describe("§billing-surface-unify — 결제 API 는 데모 페이로드를 내지 않는다", () => {
  it("축이 비어 있지 않다 (검사가 조용히 사라지지 않게)", () => {
    expect(billingRoutes().length).toBeGreaterThan(3);
  });

  it("🛑 세션이 없을 때 지어낸 데이터를 돌려주는 라우트가 0이다", () => {
    /* 형태: `if (!session…) { return NextResponse.json({ … 데이터 … }) }`
     * 401/403 만 내는 것은 정상이다. 그 블록 안에 payload 가 있으면 거짓이다.
     * 창은 `if (!session` 의 여는 중괄호 ↔ 대응 닫는 중괄호(고정 폭 슬라이스 0). */
    const hits: string[] = [];
    for (const f of billingRoutes()) {
      const code = stripComments(readFileSync(f, "utf8"));
      const rel = f.slice(f.indexOf("src")).replace(/\\/g, "/");
      let idx = code.indexOf("if (!session");
      while (idx !== -1) {
        const open = code.indexOf("{", idx);
        if (open === -1) break;
        let i = open,
          depth = 0;
        while (i < code.length) {
          if (code[i] === "{") depth++;
          else if (code[i] === "}") {
            depth--;
            if (depth === 0) break;
          }
          i++;
        }
        const block = code.slice(open, i + 1);
        // 상태코드만 있고 데이터가 없어야 한다
        if (/NextResponse\.json\(/.test(block) && !/status:\s*40\d/.test(block)) {
          hits.push(`${rel} → 비인증 분기가 데이터를 반환한다`);
        }
        idx = code.indexOf("if (!session", i);
      }
    }
    expect(hits, `데모 페이로드:\n${hits.join("\n")}`).toHaveLength(0);
  });

  it("🛑 Mock/데모 인보이스 상수가 남아 있지 않다", () => {
    for (const f of billingRoutes()) {
      const code = stripComments(readFileSync(f, "utf8"));
      const rel = f.slice(f.indexOf("src")).replace(/\\/g, "/");
      expect(`${rel}: ${/const\s+MOCK_[A-Z_]+\s*=/.test(code)}`).toBe(`${rel}: false`);
      expect(`${rel}: ${/const\s+DEMO_[A-Z_]+\s*=/.test(code)}`).toBe(`${rel}: false`);
    }
  });

  it("🛑 빈 결과를 mock 으로 바꿔치기하지 않는다", () => {
    /* "실제 데이터가 없으면 Mock 반환" 이 이 사고의 형태다.
     * 길이 0 검사 뒤에 지어낸 배열을 내주는 분기를 막는다. */
    const code = stripComments(read("src/app/api/billing/invoices/route.ts"));
    expect(code).not.toMatch(/length === 0[\s\S]{0,200}?MOCK/);
    expect(code).toMatch(/invoices,/); // 실제 목록을 그대로 돌려준다
  });
});

describe("§billing-surface-unify — 목업 결제 화면 0", () => {
  it("`/dashboard/billing` 이 정적 목업이 아니라 `/billing` 으로 보낸다", () => {
    const code = stripComments(read("src/app/dashboard/billing/page.tsx"));
    expect(code).toMatch(/redirect\("\/billing"\)/);
    /* 🛑 지어낸 값이 남아 있지 않다 — 통합 청구·미납 0·결제 완료 문구. */
    expect(code).not.toMatch(/12,450,000/);
    expect(code).not.toMatch(/모두 결제 완료/);
  });

  it("🔑 실데이터 표면은 살아 있다 (회귀 0)", () => {
    /* 명제를 지키느라 진짜 청구 화면까지 없애면 그게 더 큰 결함이다. */
    const billing = stripComments(read("src/app/billing/page.tsx"));
    expect(billing).toMatch(/csrfFetch\("\/api\/billing"\)/);
    expect(billing).toMatch(/resolveInvoiceStatusLabel\(invoice\.status\)/);
  });
});
