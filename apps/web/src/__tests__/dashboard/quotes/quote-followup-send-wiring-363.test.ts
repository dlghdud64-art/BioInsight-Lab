/**
 * §11.363 #followup-send-wiring — "추가 회신 확보" dead button → 추가 발송 wiring
 *
 * 호영님 P-라이브 (2026-06-06):
 *   증상 — 견적 관리 → 회신 검토(CenterWorkWindow) → "추가 회신 확보" 클릭 무반응.
 *   판정 — primaryAction.onClick 이 setActiveWorkWindow(null) 단독(창만 닫음) = dead button.
 *   결정 — "추가 발송(재요청)" intent → canonical send 단일점(request_send → VendorRequestModal) 재진입.
 *
 * intent 경로 (둘 다 동일 no-op 으로 수렴하던 것):
 *   1. activeWorkWindow === "followup_send"  (compare_not_ready / response_delayed)
 *   2. activeWorkWindow === "compare_review" + 유효견적 < 2  (라벨 "추가 회신 확보")
 *
 * canonical truth lock (회귀 0):
 *   - request_send → VendorRequestModal 발송 단일점 변경 0
 *   - secondaryAction "닫기" 보존
 *   - compare_review >= 2 → "선택안 확정" 라벨/경로 보존 (send intent 아님)
 *   - approval_prep / po_conversion close 동작 보존 (§11.363 scope 밖)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.363 — CenterWorkWindow 추가발송 wiring", () => {
  it("primaryAction.onClick 이 추가발송 intent 에서 request_send 로 전이한다 (dead button 제거)", () => {
    // CenterWorkWindow primaryAction.label 은 "승인 패키지 준비 완료" 를 포함(유니크 앵커).
    // 그 onClick 안에서 setActiveWorkWindow("request_send") 로 라우팅되어야 한다.
    expect(page).toMatch(
      /"승인 패키지 준비 완료"[\s\S]{0,800}setActiveWorkWindow\("request_send"\)/
    );
  });

  it("followup_send intent 가 추가발송 라우팅 조건에 포함된다", () => {
    expect(page).toMatch(
      /activeWorkWindow === "followup_send"[\s\S]{0,300}setActiveWorkWindow\("request_send"\)/
    );
  });

  it("compare_review + 유효견적<2 intent 가 추가발송 라우팅 조건에 포함된다", () => {
    expect(page).toMatch(
      /activeWorkWindow === "compare_review"[\s\S]{0,120}responses\?\.length[\s\S]{0,40}< 2[\s\S]{0,200}setActiveWorkWindow\("request_send"\)/
    );
  });
});

describe("§11.363 회귀 0 — canonical truth / 보존 항목", () => {
  it("request_send → VendorRequestModal 발송 단일점 보존", () => {
    expect(page).toMatch(
      /activeWorkWindow === "request_send" && selectedQuote && \(\s*<VendorRequestModal/
    );
  });

  it('secondaryAction "닫기" 보존', () => {
    expect(page).toMatch(
      /secondaryAction=\{\{ label: "닫기", onClick: \(\) => setActiveWorkWindow\(null\) \}\}/
    );
  });

  it('compare_review >= 2 → "선택안 확정" 라벨 보존 (send intent 아님)', () => {
    expect(page).toMatch(/>= 2 \? "선택안 확정" : "추가 회신 확보"/);
  });
});
