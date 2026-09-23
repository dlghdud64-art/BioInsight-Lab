"use client";

/**
 * 발주 발송 워크벤치 — §po-seed-cutoff (2026-09-22 · 호영님 판정 · 커밋 2/4)
 *
 * 🛑 이 화면도 발주 상세와 같은 시드 위에 서 있었다(useDispatchWorkbenchData → ops-store 시드 + seed-data VENDOR_MAP).
 *    진입 경로는 발주 상세뿐이었고, 그 상세가 시드를 끊으면 이 화면만 시드를 계속 그리게 된다.
 *    측정 중 드러난 형제 슬롯이라 같은 커밋에서 함께 끊는다(호영님 판정: 시드 소비 전면 차단).
 *
 * 실제 발주 발송 배선은 이 트랙의 범위가 아니다(기능 개발 · 발주는 ENABLE_PURCHASING=false).
 * 계약: __tests__/regression/po-seed-cutoff.test.ts
 */
import { PoUnwiredNotice } from "../../_components/po-unwired-notice";

export default function PurchaseOrderDispatchWorkbenchPage() {
  return <PoUnwiredNotice title="발주 발송 데이터 없음" />;
}
