"use client";

/**
 * 🛑 §inventory-fabricated-figures (2026-09-16) — 「보관 위치」 탭. 「입출고 흐름」 탭의 **형제 슬롯**.
 *
 * 이 파일도 실데이터를 읽지 않았다. props·fetch 가 없고 구역 5개(냉장·냉동·상온·위험물·미지정)의
 * 품목·만료·재주문·검수 수를 전부 `buildMockItems()` 가 지어냈다(Anti-GAPDH Antibody · ELISA Kit …).
 * 그 위에 「우선 조치 알림」 이 가짜 품목의 만료 D-3·재주문 필요를 알렸다.
 * 같은 결함을 한 탭에서만 고치면 형제가 남는다(CLAUDE.md §형제 슬롯 전수) — 입출고 흐름 탭과 함께 닫는다.
 *
 * 처방·되살릴 때의 계약은 inventory-flow-view.tsx 와 같다(regression/inventory-fabricated-figures.test.ts).
 * 실데이터 연결 시 원천 후보는 ProductInventory.location · storageCondition(실재 필드).
 */

export function StorageLocationView() {
  return (
    <div
      data-testid="storage-location-unwired"
      className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3"
    >
      <p className="text-[13px] font-bold text-gray-500">보관 위치 데이터 없음</p>
      <p className="mt-0.5 text-xs text-gray-500">
        이 탭은 아직 실제 재고의 보관 위치와 연결되지 않았습니다. 품목별 위치는 「품목 관리」 탭에서 확인하세요.
      </p>
    </div>
  );
}
