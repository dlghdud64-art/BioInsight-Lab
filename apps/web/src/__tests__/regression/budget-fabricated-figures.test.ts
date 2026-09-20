/**
 * §budget-fabricated-figures (2026-09-20 · 릴레이 판정) · **예산 화면은 데이터를 읽지 않는 수·문장을 쓰지 않는다.**
 *
 * ── 왜 ──
 * 예산 화면에서 실데이터는 예산 행 1건(한도 ₩5,000,000 · 사용 ₩850,000 · 17%)뿐이었는데, 나머지는 전부 근거가 없었다.
 *   주간 소진 ₩21만   총 지출 ÷ 4(기간·주 수 미사용) — "최근 4주 평균 기준" 이라 적혀 있었다
 *   절감 가능          위험 예산 지출 × 0.15(고정 비율)
 *   승인 대기          reserved 가 상수 0 이라 **항상 0건**(실제 예약 BudgetEvent 는 읽지 않음)
 *   발주 전환 대기      라벨은 견적인데 실제로는 정상 예산 행 수
 *   미매핑 요청 0건     리터럴
 *   월별 지출 추이      총예산÷12 × 고정계수를 1~6월 라벨에 얹은 합성값(예산 기간은 8~12월)
 *   부서별 TOP 3       묶는 키(targetDepartment)가 DB 에 없어 언제나 「미지정」
 *   「AI 인사이트」 3장  코드 주석이 `AI Insight mock` · 「5개 프로젝트 공통 시약(PBS, Ethanol) … ₩1.2M」 같은
 *                      실행 가능한 문장이 데이터와 무관하게 항상 렌더 · 프로젝트 0개 · Ethanol 은 카탈로그에도 없음
 *   블록 제목은 「AI 예산 이상 탐지 & 예측」, 설명문은 「과거 지출 패턴을 분석하여…」 였다 — 분석 코드 0.
 * 재고(§inventory-fabricated-figures)에 이어 **같은 유형이 두 번째**다. 그래서 형태로 막는다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 예산 화면·스토어에 지어낸 수(고정 계수·리터럴 건수·나눗셈 상수)가 없다.
 *   ② 「AI」·「분석」·「예측」·「감지」를 **이름에 쓰는 블록**은 입력 데이터를 받는다 — 고정 문장 나열 금지.
 *   ③ 저장되지 않는 입력(targetDepartment)을 폼에 두지 않는다.
 *   ④ 실데이터 넷(한도·사용·잔액·소진율 → 즉시 확인·차단 위험)은 남아 있다.
 *
 * ── 이 파일이 안 보는 것 (자기 한계 · 다음 검사의 시작점) ──
 *   1. 예산 화면 밖. 같은 유형이 다른 화면에 남아 있다(2026-09-20 형태 조사 결과는 큐 참조).
 *   2. 서버가 내려주는 값의 진위 — API 가 지어낸 값을 주면 이 검사는 못 잡는다.
 *   3. 문장이 "그럴듯한지" 는 못 잰다. 입력을 받는지/리터럴인지만 본다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

const PAGE = "app/dashboard/budget/page.tsx";
const STORE = "lib/store/budget-store.ts";
const SHEET = "components/budget/budget-register-sheet.tsx";

describe("§budget-fabricated-figures · 예산 화면은 지어낸 수를 쓰지 않는다", () => {
  it("① 지어낸 수가 없다 (고정 계수·리터럴 건수·나눗셈 상수)", () => {
    const page = code(PAGE);
    const store = code(STORE);
    // 주간 소진 = 합계 ÷ 4
    expect(page).not.toMatch(/weeklyBurn/);
    expect(page).not.toMatch(/\/\s*4\s*\)/);
    // 절감 가능 = 지출 × 0.15
    expect(page).not.toMatch(/altSavings|\*\s*0\.15/);
    // 승인 대기 = 항상 0 (reserved 상수)
    expect(page).not.toMatch(/pendingApproval/);
    // 리터럴 건수 카드
    expect(page).not.toMatch(/count:\s*0\s*,/);
    // 월별 합성 계수 · 부서 집계
    expect(store).not.toMatch(/0\.85,\s*0\.9|monthlyBudget/);
    expect(store).not.toMatch(/generateMonthlyData|aggregateDepartments/);
    expect(page).not.toMatch(/departmentTop3|monthlyData/);
  });

  it("② 「AI·분석·예측·감지」 이름의 블록은 입력 데이터를 받는다 (고정 문장 나열 0)", () => {
    const page = code(PAGE);
    // mock 인사이트의 흔적 — 고정 문장·고정 수치
    expect(page).not.toMatch(/AI 인사이트|AI 예산 이상 탐지|소진 시점 예측|절감 기회 포착/);
    expect(page).not.toMatch(/PBS, Ethanol|₩1\.2M|42% 급증/);
    expect(page).not.toMatch(/aiInsights/);
    // 이름에 AI/분석/예측/감지를 쓰는 제목이 남아 있다면, 같은 파일이 입력 데이터를 받아야 한다
    const namesAi = /(AI|분석|예측|감지)/.test(page.match(/<h2[^>]*>([\s\S]{0,60}?)<\/h2>/g)?.join(" ") ?? "");
    if (namesAi) {
      expect(page, "AI/분석/예측/감지 제목이 있으면 입력 데이터(controls·budgets)를 써야 한다").toMatch(
        /(controls|budgets)\s*\./,
      );
    }
  });

  it("③ 저장되지 않는 입력(대상 부서/팀)을 폼에 두지 않는다", () => {
    const page = code(PAGE);
    expect(page).not.toMatch(/targetDepartment/);
    expect(page).not.toMatch(/대상 부서\/팀/);
    expect(code(SHEET)).not.toMatch(/targetDepartment/);
  });

  it("④ 실데이터 표시는 남아 있다 (한도·사용·잔액·소진율 → 즉시 확인·차단 위험)", () => {
    const page = code(PAGE);
    // 🛑 경계 필수 — `/immediateReview/` 는 `immediateReviewX` 에도 걸린다(4원칙 ① 접두사 포함).
    //   2026-09-20 프로브 실측: 경계 없이 썼더니 식별자를 전량 개명해도 GREEN 이었다.
    expect(page).toMatch(/\bimmediateReview\b/);
    expect(page).toMatch(/\bblockRisk\b/);
    expect(page).toMatch(/ctrl\.actual\b/);
    expect(page).toMatch(/ctrl\.available\b/);
    expect(page).toMatch(/\bburnRate\b/);
    // 지운 블록 자리에는 「데이터 없음」 이 남는다(왜 없는지 · 어디서 보는지)
    expect(page).toMatch(/데이터 없음/);
  });
});
