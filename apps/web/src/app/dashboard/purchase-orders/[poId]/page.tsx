"use client";

/**
 * 발주 상세 — §po-seed-cutoff (2026-09-22 · 호영님 판정 · 커밋 2/4)
 *
 * 🛑 이 화면은 ops-console 시드에서만 발주를 찾았다(`store.purchaseOrders.find(id)` · po-001~003).
 *    · 시드 id 로 들어오면 지어낸 발주(PO-2026-0087/0088)의 승인·라인·확인 내역까지 그렸다.
 *    · **실제 주문 id 로 들어오면 「찾을 수 없음」** 이었다 — 입고 목록·입고 상세가 실제 주문 id 로
 *      이 경로를 걸고 있었으므로 그 링크는 100% 막힌 길이었다(같은 커밋에서 링크 제거).
 *    · 그 위에 조건부 훅 결함도 있었다: `if (!po) return` 뒤에 useMemo 가 이어졌다(훅 순서 위반).
 *
 * 지금: 시드 조회를 끊고 화면이 자기 상태를 사실대로 말한다. 실제 발주 조회 구현은 이 트랙의 범위가 아니다
 *   (기능 개발 · 발주는 ENABLE_PURCHASING=false 로 꺼져 있다 · 호영님 지시).
 *   시드 전용이던 본문(승인 스트립·라인 실행·확인/인계 패널)은 도달 경로가 없어 함께 걷어냈다 —
 *   남겨 두면 다음 사람이 "실데이터만 꽂으면 된다" 고 읽는다. 복원은 git revert 로 한다.
 * 계약: __tests__/regression/po-seed-cutoff.test.ts
 */
import { PoUnwiredNotice } from "../_components/po-unwired-notice";

export default function PurchaseOrderDetailPage() {
  return <PoUnwiredNotice title="발주 상세 데이터 없음" />;
}
