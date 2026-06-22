/**
 * §11.352 (회귀) — 구매 운영 = 발주 인계 게이트 재명명 sentinel
 *
 * DECISION_11.35x (요청자 중심 B): LabAxis = 발주 의뢰·추적, 실행은 외부(ERP).
 * 구매 운영 surface 한정 재명명 ("발주 전환" → "발주 인계") + dead-end 해소
 * (confirmed 시 견적 회귀 대신 발주 관리(/dashboard/purchase-orders) 전진).
 *
 * 범위: 구매 운영 페이지만. 견적 rail chips / 운영자 퀵액션 어휘는 별건(§11.353/354).
 * 실 mutation(bulk-po) wiring 보존 = 회귀 0.
 *
 * 문자열 매칭은 toContain 사용(esbuild ts-loader 모호성 + NUL 회피).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const PAGE = "src/app/dashboard/purchases/page.tsx";

describe("§11.352 — 발주 인계 재명명 (구매 운영 surface)", () => {
  it("일괄 CTA = 발주 인계", () => {
    const src = read(PAGE);
    expect(src).toContain("일괄 발주 인계 ({stats.ready_for_po})");
  });
  it("KPI/STATUS_MAP 1단계 라벨 = 발주 인계 대기", () => {
    const src = read(PAGE);
    expect(src).toContain('label: "발주 인계 대기"');
    expect(src).toContain('label="발주 인계 대기"');
  });
  it("rail primary CTA = 발주 인계 (전환 아님)", () => {
    const src = read(PAGE);
    expect(src).toContain("발주 인계");
    expect(src).toContain("인계 중...");
  });
  it("토스트/확인 카피가 인계로 재프레이밍", () => {
    const src = read(PAGE);
    expect(src).toContain("건 발주 인계 완료");
    expect(src).toContain("발주 인계로 정리");
  });
});

describe("§11.352 — dead-end 해소 (발주 관리 전진)", () => {
  it("confirmed 시 발주 관리(/dashboard/purchase-orders)로 전진 링크", () => {
    const src = read(PAGE);
    expect(src).toContain('selectedItem.conversionStatus === "confirmed"');
    expect(src).toContain('href="/dashboard/purchase-orders"');
    expect(src).toContain("발주 관리에서 외부 발주·입고 추적");
  });
  it("빈 상태 카피가 발주 관리 추적으로 전진 안내 (§11.334 온보딩 supersede)", () => {
    // §11.334 — 빈상태 온보딩이 §11.284d 카피 supersede: "…상태를 추적" → "…를 추적하세요".
    //   전진 안내(발주 관리에서 외부 발주·입고 추적) 의도는 불변, 문구만 시안 정합.
    const src = read(PAGE);
    expect(src).toContain("발주 관리에서 외부 발주·입고를 추적");
  });
});

describe("§11.352 회귀 0 — 실 mutation wiring 보존", () => {
  it("bulk-po 엔드포인트 + mutate wiring 불변", () => {
    const src = read(PAGE);
    expect(src).toContain("/api/work-queue/purchase-conversion/bulk-po");
    expect(src).toContain("bulkPoMutation.mutate");
  });
  it("결재 게이트(internalApprovalStatus) dead-button 가드 보존", () => {
    const src = read(PAGE);
    expect(src).toContain('selectedItem.internalApprovalStatus === "PENDING"');
    expect(src).toContain("결재 완료 후 인계 가능");
  });
  it("'발주 전환' UI 라벨 잔존 0 (재명명 누락 방지)", () => {
    const src = read(PAGE);
    // 코드 라인(주석 제외)에서 옛 UI 라벨이 남지 않았는지 — 따옴표/JSX 텍스트 형태만 검사
    expect(src).not.toContain('label="발주 전환 대기"');
    expect(src).not.toContain("일괄 발주 전환 (");
  });
});
