/**
 * §11.244 Phase B #analytics-empty-state-mockup — 호영님 P0 spec 잔여 3 항목
 *
 * 호영님 P0 spec (Phase B):
 *   #3 빈 상태 vs 로딩 중 명확 분리 (skeleton/목업/에러 3 표현)
 *   #4 빈 차트 mockup + 반투명 overlay (§11.243b 패턴 reuse)
 *      - overview 탭: 월별 추이 mockup AreaChart
 *      - vendor 탭: 공급사 집중도 mockup horizontal bars
 *      - anomaly 탭: 이상 지출 mockup timeline
 *   #7 탭별 빈 상태 메시지 차별화:
 *      - 종합 현황: "발주 데이터가 쌓이면 월별 지출 트렌드와 카테고리별 비중을
 *                  확인할 수 있습니다. → 첫 발주 완료 후 자동 활성화"
 *      - 공급사 의존도: "복수 공급사 거래 시 특정 공급사에 대한 의존도를
 *                      분석합니다. → 2개 이상 공급사 거래 데이터 필요"
 *      - 이상 지출 감지: "과거 거래 대비 비정상적인 가격 변동, 비정상 발주
 *                       패턴을 자동으로 감지합니다. → 3개월 이상 데이터 축적
 *                       시 활성화"
 *
 * canonical truth lock:
 *   - useQuery / data shape / 3 tab 분기 변경 0
 *   - hasMonthlyData / vendorItems / anomalies derive 보존
 *   - mockup data 는 빈 상태 한정 (실제 데이터 1건+ 시 자동 hide)
 *
 * Out of scope (Phase C 별도 batch):
 *   - #1 프로그레시브 로딩 (KPI/차트 독립 fetch)
 *   - #8 10초 timeout + 재시도 button
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/analytics/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.244 Phase B #4a — overview 탭 월별 차트 mockup overlay", () => {
  it("MOCKUP_MONTHLY_DATA 또는 동등 sample data hardcode", () => {
    expect(page).toMatch(/(MOCKUP_MONTHLY|mockMonthly|sampleMonthly|sampleAreaData)/);
  });

  it("backdrop-blur overlay + opacity-50 또는 grayscale (시각 dim)", () => {
    expect(page).toMatch(/(backdrop-blur|opacity-50|grayscale)/);
  });

  it("overview 빈 상태 메시지 — '발주 데이터가 쌓이면' 또는 '첫 발주 완료 후'", () => {
    expect(page).toMatch(/(발주 데이터가 쌓이면|첫 발주 완료 후|자동 활성화)/);
  });
});

describe("§11.244 Phase B #4b — vendor 탭 공급사 의존도 mockup", () => {
  it("MOCKUP_VENDOR 또는 동등 sample bars (3+ supplier)", () => {
    expect(page).toMatch(/(MOCKUP_VENDOR|mockVendor|sampleVendor)/);
  });

  it("vendor 빈 상태 메시지 — '복수 공급사' 또는 '2개 이상 공급사'", () => {
    expect(page).toMatch(/(복수 공급사|2개 이상 공급사|의존도를 분석합니다)/);
  });
});

describe("§11.244 Phase B #4c — anomaly 탭 이상 지출 mockup + 안내", () => {
  it("anomaly 빈 상태 메시지 — '가격 변동' 또는 '비정상 발주 패턴'", () => {
    expect(page).toMatch(/(비정상적인 가격 변동|비정상 발주 패턴|3개월 이상 데이터)/);
  });
});

describe("§11.244 Phase B invariant 보존 (cluster lineage)", () => {
  it("3 탭 분기 보존 (overview / vendor / anomaly)", () => {
    expect(page).toMatch(/activeTab === "overview"/);
    expect(page).toMatch(/activeTab === "vendor"/);
    expect(page).toMatch(/activeTab === "anomaly"/);
  });

  it("hasMonthlyData / vendorItems / anomalies derive 보존", () => {
    expect(page).toMatch(/hasMonthlyData/);
    expect(page).toMatch(/vendorItems/);
    expect(page).toMatch(/anomalies/);
  });

  it("§11.244 Phase A trace 보존 (dataInsufficient + AI disabled)", () => {
    expect(page).toMatch(/dataInsufficient/);
  });

  it("§11.244 Phase B trace marker comment", () => {
    expect(page).toMatch(/§11\.244[\s\S]{0,200}(mockup|overlay|빈 상태|Phase B)/i);
  });
});
