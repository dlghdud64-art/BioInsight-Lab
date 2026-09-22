"use client";

/**
 * 팀별 보기 — §team-view-no-fabrication (2026-09-22 · 호영님 판정)
 *
 * 🛑 이 탭은 `TEAM_DATA`(주석 「더미 데이터」) 로 팀 7개의 예산·지출·전월 대비 변동·주요 공급사·상태를
 *    **표기 없이** 그리고 있었다(분자생물학팀 · Sigma-Aldrich · +30.8% …). 탭 이름 「팀별 보기」 가
 *    실데이터를 약속하므로 예시 표기로 존치하는 선택지는 없다(호영님). 전부 지웠다.
 *
 * 탭은 **유지**한다. 조직 관리가 실제 엔티티라 팀별 지출은 제품이 언젠가 반드시 답해야 할 질문이고,
 * 탭을 지우면 그 질문 자체가 사라진다(재고 흐름·보관 위치와 같은 처리).
 *
 * 왜 비어 있는가 (2026-09-21 측정 · 스키마 + prod read-only):
 *   · 지출 원장 `PurchaseRecord` · `Order` 에 팀 필드가 **없다**.
 *   · 팀으로 가는 경로는 `PurchaseRequest.teamId → orderId → Order` 하나뿐인데,
 *     견적→결재 전환(견적 id 를 채우는 유일한 생성 경로)은 teamId 를 **채우지 않는다**.
 *   · prod: Team 0 · PurchaseRequest 0.
 * 🛑 「조직 관리에서 팀을 등록하세요」 같은 안내를 쓰지 않는다 — 팀을 등록하고 예산을 배정해도
 *    견적→결재로 발주하면 teamId 가 비어 이 탭은 영원히 0 이다. 작동하지 않는 경로를 안내하면
 *    화면이 또 거짓말한다(호영님). 문구는 **현재 참인 것까지만**.
 *    (진짜 결함 = 견적→결재 전환의 teamId 누락 · 별건 P1)
 *
 * 계약: __tests__/regression/team-view-no-fabrication.test.ts
 */
export default function TeamAnalyticsView() {
  return (
    <div
      data-testid="team-analytics-unwired"
      className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3"
    >
      <p className="text-[13px] font-bold text-gray-500">팀별 지출 데이터 없음</p>
      <p className="mt-0.5 text-xs text-gray-500 break-keep">
        지출 기록에 팀 귀속이 없어 팀별로 집계할 수 없습니다. 구매 요청 경로로 발주된 건만 팀에 귀속됩니다.
      </p>
    </div>
  );
}
