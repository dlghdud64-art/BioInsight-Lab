"use client";

/**
 * 🛑 §inventory-fabricated-figures (2026-09-16 · 릴레이 지시) — 「입출고 흐름」 탭.
 *
 * 이 파일은 **실데이터를 한 번도 읽지 않았다.** props·fetch 가 없고, 화면의 모든 수가 모듈 상수였다:
 *   파이프라인 7단계  MOCK_STAGES   (재고 반영 45·78 lots · 사용 중 12·15 lots · 안전재고 미만 3 …)
 *   단계 상세·입고 예정 MOCK_ITEMS  (Anti-CD3 Ab · RPMI 1640 …)
 *   하단 요약 카드     리터럴      (검수 대기 2 · 안전재고 미만 3 · 재주문 검토 2 · 폐기 검토 1)
 *   「AI 흐름 분석」   detectInsights(MOCK_INVENTORIES, MOCK_USAGE) — 엔진은 진짜인데 **입력이 가짜**라
 *                    사용 기록 0건인 계정에 「사용량 급증 2건」「재주문 검토 2건」을 띄웠다.
 *   prod 대조(2026-09-16 · 릴레이 브라우저 + operator DB): 재고 4품목 · lot 0 · 사용 이력 0 ·
 *   미달 1품목 · 입고안(ReceivingDraft) 0 — 화면 숫자 중 맞는 것이 없었다.
 * 운영 판단 화면이 사실이 아닌 수로 「조치 필요」를 지시하면 재주문·폐기 결정이 틀린다.
 *
 * 처방: 실데이터 배선이 없는 동안 **수를 그리지 않는다.** 분석 카드도 근거 데이터가 없으니 띄우지 않는다.
 * 실데이터로 되살릴 때의 계약(regression/inventory-fabricated-figures.test.ts):
 *   ① 모듈 수준 가짜 데이터(MOCK_ · buildMock · 숫자 리터럴 count) 0
 *   ② 분석 카드는 **실사용 기록 길이 게이트** 뒤에서만 렌더
 * 되살리는 작업은 별건 결정이다(입고안·발주·사용 기록 3축 배선 필요).
 */

export function InventoryFlowView() {
  return (
    <div
      data-testid="inventory-flow-unwired"
      className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3"
    >
      <p className="text-[13px] font-bold text-gray-500">입출고 흐름 데이터 없음</p>
      <p className="mt-0.5 text-xs text-gray-500">
        이 탭은 아직 실제 입고·사용 기록과 연결되지 않았습니다. 품목별 수량은 「품목 관리」 탭에서 확인하세요.
      </p>
    </div>
  );
}
