import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §support-center-sla-honesty (호영님 2026-07-08) — 지원 센터 SLA 문구 정직성.
 *
 * "당일 1차 확인"(당일 1차 응답)은 앱 표준 정직 문구("영업일 기준 1일 이내")보다 강한
 * 약속이라 제거. route·support 페이지와 동일하게 "영업일 기준 1일 이내 회신"으로 통일
 * (support-inquiry-mail 정직성 원칙: 실시간/당일 SLA 약속 금지).
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PAGE = readFileSync(
  join(REPO_ROOT, "src/app/dashboard/support-center/page.tsx"),
  "utf8",
);

describe("§support-center-sla-honesty — 당일 SLA 과약속 제거", () => {
  it("'당일 1차 확인' 문구 부재(과약속 회귀 차단)", () => {
    expect(PAGE).not.toMatch(/당일 1차 확인/);
  });

  it("정직 표준 '영업일 기준 1일 이내' 사용", () => {
    expect(PAGE).toMatch(/영업일 기준 1일 이내/);
  });
});
