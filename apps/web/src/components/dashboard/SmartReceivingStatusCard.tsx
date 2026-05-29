"use client";

/**
 * §11.308e #smart-receiving-status-card — 대시보드 본문 awareness + status 카드
 *
 * 호영님 P2 옵션 B (2026-05-28, 경량 — 새 API 0):
 *   §11.308a-v2 가 스마트 입고 진입을 글로벌 Header(ScanLine button)로 승격한 뒤,
 *   대시보드 본문에는 진입 button 이 사라짐 → 운영자가 헤더 button 을 놓치거나
 *   기능 자체를 인지 못 할 위험. 본 카드는 **진입 추가가 아닌 awareness + at-a-glance
 *   status** 역할로 본문 surface 에 자리한다.
 *
 * canonical truth:
 *   - 카드 = display-only (pending count 만 표시). 실제 스캔/등록 truth =
 *     Header [스마트 입고] modal + /api/inventory/smart-receiving POST.
 *   - 카드 CTA = 입고 큐(/dashboard/purchase-orders?bucket=handoff) 진입 —
 *     처리 funnel 의 deeper view.
 *
 * UX (§11.308d-2 후속, dead button/no-op 금지 정합):
 *   - 처리 대기 N건 (purchaseToReceivingCount) — yellow tint(1+) / slate(0)
 *   - 안내 문구 = "헤더 [스마트 입고] 버튼으로 스캔 → AI OCR → 재고 자동 반영"
 *     (Header button 의 위치/역할을 본문에서 가르침)
 *   - 단일 CTA = "입고 큐 열기" (real route, 항상 활성)
 *   - 카드 자체에 스캐너 modal 진입 button 을 두지 않음(중복 진입 방지 — Header 가 단일 source).
 *
 * CLAUDE.md Mobile Patterns 정합 (§11.311):
 *   - p-3 md:p-4 컴팩트, KPI 1 row 한 줄, 모바일 col → 데스크탑 row flex.
 */

import Link from "next/link";
import { ScanLine } from "lucide-react";

export interface SmartReceivingStatusCardProps {
  /** 발주 → 입고 처리 대기 건수 (stats.compareStats.purchaseToReceivingCount forward). */
  pendingHandoffCount: number;
}

export function SmartReceivingStatusCard({
  pendingHandoffCount,
}: SmartReceivingStatusCardProps) {
  const hasPending = pendingHandoffCount > 0;
  const displayCount = pendingHandoffCount > 99 ? "99+" : pendingHandoffCount;

  return (
    <section
      className="mt-4 rounded-xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm"
      data-testid="dashboard-smart-receiving-status-card"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <ScanLine className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">스마트 입고</h3>
              {hasPending ? (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-700"
                  data-testid="dashboard-smart-receiving-pending-badge"
                >
                  처리 대기 {displayCount}건
                </span>
              ) : (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700"
                  data-testid="dashboard-smart-receiving-pending-badge"
                >
                  처리 대기 0건
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed break-keep">
              상단 헤더 <strong className="text-slate-700">[스마트 입고]</strong> 버튼으로 스캔 →
              AI 가 OCR 추출·품목 매칭 → 재고에 자동 반영됩니다
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:flex-shrink-0">
          <Link
            href="/dashboard/purchase-orders?bucket=handoff"
            className="inline-flex min-h-[32px] items-center justify-center rounded-md bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
            data-testid="dashboard-smart-receiving-status-cta"
          >
            입고 큐 열기
          </Link>
        </div>
      </div>
    </section>
  );
}
