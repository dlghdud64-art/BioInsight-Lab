"use client";

/**
 * §11.93 #dashboard-quick-actions-card
 *
 * 호영님 시안의 "운영 바로가기" 4 카드 LabAxis 운영 verb 로 정합 흡수.
 * 시안의 (시약 뱅크 / 신규 발주 / SOP 점검 / 세팅) 은 LabAxis 운영
 * ontology 와 부분 정합 — 운영자가 가장 자주 쓰는 4 verb 로 재선정:
 *
 *   1. 견적 등록 → /dashboard/quotes (견적 요청 wizard)
 *   2. 발주 전환 → /dashboard/purchases (conversion-ready bucket)
 *   3. 입고 처리 → /dashboard/purchase-orders?bucket=handoff
 *   4. 재고 점검 → /dashboard/inventory?filter=low
 *
 * Sidebar 와 부분 duplicate 이지만:
 *   - sidebar: 메뉴 형태 (모든 surface 진입)
 *   - quick actions: dashboard 종합 surface 의 single-click 단축
 *   → operator quick access 가치, duplicate 가 아닌 multi-channel
 *     entry (호영님 mental model: dashboard 한 화면에서 처리).
 *
 * LabAxis 원칙:
 *   - 모든 link real route 검증 완료 (dead button 0)
 *   - icon + verb + 보조 description (시안 visual essence)
 *   - hover transition (§11.82 KpiCard 와 일관)
 */

import Link from "next/link";
import { useState } from "react";
import {
  FileText,
  ShoppingCart,
  Truck,
  Package,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * §11.247 #operator-quick-actions-responsive — 호영님 P0 반응형 + Progressive Disclosure.
 *
 * (1) Progressive Disclosure — 견적 발송 카드 기본 접힘 (다른 3 카드와 동일 높이),
 *     클릭 시 상태 흐름표 + Send 버튼 영역 펼침. transition 300ms ease-in-out.
 * (2) 반응형 grid — `repeat(auto-fit, minmax(280px, 1fr))` 으로 자동 분기
 *     (≥1200px 4열 / 800-1199px 2x2 / <800px 1열).
 * (3) min-h-[140px] 균일 — 4 카드 시각적 정렬.
 */

/** §11.243 #5 — 호영님 P0: 운영 바로가기 4 카드 건수 뱃지.
 *  countKey 로 stats 매핑 (caller forward). count > 0 시 우측 상단 badge,
 *  0 시 hide. canonical truth lock: count 자체 mutation 0 — display only. */
type ActionCountKey = "quotes" | "purchases" | "receiving" | "inventory";

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** accent border color (좌측 thin line — KpiCard 4-tone palette 와 일관) */
  tone: "blue" | "emerald" | "amber" | "purple";
  countKey: ActionCountKey;
}

export interface OperatorQuickActionsCounts {
  quotes: number;
  purchases: number;
  receiving: number;
  inventory: number;
}

const ACTIONS: QuickAction[] = [
  {
    label: "견적 등록",
    description: "공급사 견적을 새로 요청합니다",
    href: "/dashboard/quotes",
    icon: FileText,
    tone: "blue",
    countKey: "quotes",
  },
  {
    label: "발주 전환",
    description: "확정된 견적을 발주로 전환합니다",
    href: "/dashboard/purchases",
    icon: ShoppingCart,
    tone: "emerald",
    countKey: "purchases",
  },
  {
    label: "입고 처리",
    description: "도착한 발주를 입고 등록합니다",
    href: "/dashboard/purchase-orders",
    icon: Truck,
    tone: "amber",
    countKey: "receiving",
  },
  {
    label: "재고 점검",
    description: "안전재고 미달 품목을 확인합니다",
    href: "/dashboard/inventory?filter=low",
    icon: Package,
    tone: "purple",
    countKey: "inventory",
  },
];

const TONE_MAP = {
  blue: { accent: "border-l-blue-500", iconBg: "bg-blue-50", iconColor: "text-blue-600" },
  emerald: { accent: "border-l-emerald-500", iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  amber: { accent: "border-l-amber-500", iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  purple: { accent: "border-l-purple-500", iconBg: "bg-purple-50", iconColor: "text-purple-600" },
};

const QUOTE_DISPATCH_STEPS = [
  "공급사 없음",
  "연락처 필요",
  "메시지 미리보기",
  "전송 확인",
] as const;

const QUOTE_DISPATCH_STATE_MATRIX = [
  {
    key: "no-supplier",
    label: "공급사 없음",
    button: "버튼 비활성",
    preview: "미리보기 대기",
    result: "공급사 선택 필요",
  },
  {
    key: "missing-contact",
    label: "연락처 없음",
    button: "버튼 비활성",
    preview: "초안만 표시",
    result: "연락처 필요",
  },
  {
    key: "ready",
    label: "정상 입력",
    button: "버튼 활성",
    preview: "전송 전 미리보기",
    result: "dispatch 이벤트 추적",
  },
] as const;

export interface OperatorQuickActionsQuoteDispatchReadiness {
  supplierSelected?: boolean;
  contactValid?: boolean;
  previewReady?: boolean;
  dispatchEventTracked?: boolean;
  serverError?: boolean;
}

interface OperatorQuickActionsProps {
  /** §11.243 #5 — 카드 우측 상단 건수 뱃지 (count > 0 시 노출). caller forward. */
  counts?: OperatorQuickActionsCounts;
  quoteDispatchReadiness?: OperatorQuickActionsQuoteDispatchReadiness;
}

export function OperatorQuickActions({
  counts,
  quoteDispatchReadiness,
}: OperatorQuickActionsProps = {}) {
  // §11.247 #1 — 견적 발송 카드 Progressive Disclosure. default false 로
  //   접힌 상태 (다른 3 카드와 동일 높이). 클릭/Enter/Space 시 toggle.
  const [isQuoteDispatchExpanded, setIsQuoteDispatchExpanded] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-extrabold text-slate-900">운영 바로가기</h3>
        <p className="text-[11px] text-slate-500 break-keep">
          가장 자주 쓰는 운영 동선 4개
        </p>
      </div>
      {/* §11.247 #2 — 반응형 grid auto-fit minmax(280px, 1fr) (≥sm).
          §11.252a — 모바일 (<640px) 1열 fallback 차단: grid-cols-2 강제 (2x2 컴팩트).
          호영님 spec: 카드당 높이 과도 → 2x2 + 카드 min-h 모바일 축소 (스크롤 40% 감소).
          breakpoint 분기: 모바일 = grid-cols-2 + min-h-[110px], sm+ = auto-fit + min-h-[140px]. */}
      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const tone = TONE_MAP[action.tone];
          // §11.243 #5 — count > 0 시 우측 상단 뱃지. ChevronRight 자리 swap.
          const count = counts ? counts[action.countKey] : 0;
          if (action.countKey === "quotes") {
            const quoteReadiness = {
              supplierSelected: count > 0,
              contactValid: false,
              previewReady: false,
              dispatchEventTracked: false,
              serverError: false,
              ...quoteDispatchReadiness,
            };
            const canSendToSupplier =
              quoteReadiness.supplierSelected &&
              quoteReadiness.contactValid &&
              quoteReadiness.previewReady &&
              !quoteReadiness.serverError;
            const sendBlockReason = quoteReadiness.serverError
              ? "서버 오류"
              : !quoteReadiness.supplierSelected
                ? "공급사 선택 필요"
                : !quoteReadiness.contactValid
                  ? "연락처 필요"
                  : !quoteReadiness.previewReady
                    ? "메시지 미리보기 필요"
                    : "전송 가능";
            // §11.247 #1 — Progressive Disclosure.
            // §11.279c-cont — comment 안 영문 한글 swap.
            //   접힌 상태: minimal layout (다른 3 카드와 동일 높이) + 자세히 보기 hint.
            //   펼친 상태: 전체 상태 흐름표 + 공급사에 전송 button + 접기 CTA.
            //   카드 클릭/Enter/Space 으로 toggle. min-h-[140px] 균일 + transition 300ms.
            const toggle = () => setIsQuoteDispatchExpanded((prev) => !prev);
            return (
              <div
                key={action.href}
                role="button"
                tabIndex={0}
                aria-expanded={isQuoteDispatchExpanded}
                aria-label={`견적 발송 카드 ${isQuoteDispatchExpanded ? "접기" : "펼치기"}`}
                onClick={(e) => {
                  // 카드 자체 클릭으로 toggle — 단, 내부 Link/Button 클릭 시는 propagation stop
                  if ((e.target as HTMLElement).closest("a, button")) return;
                  toggle();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle();
                  }
                }}
                /* §11.252a — 모바일 min-h-[110px] + sm+ 140px (다른 카드와 동일). */
                className={`rounded-lg border border-slate-200 border-l-2 ${tone.accent} bg-white px-4 py-3 shadow-sm transition-all duration-300 ease-in-out hover:shadow-md hover:border-slate-300 min-h-[110px] sm:min-h-[140px] cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2`}
                data-testid="dashboard-quote-dispatch-card"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg ${tone.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-4 w-4 ${tone.iconColor}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-500">
                      대기 {count > 99 ? "99+" : count}건
                    </span>
                    {isQuoteDispatchExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </div>
                </div>
                <p className="text-sm font-bold text-slate-900 break-keep">견적 발송</p>
                {/* §11.252a — 설명 line-clamp-1 모바일 (1줄) + sm+ 전체. */}
                <p className="text-[11px] text-slate-500 mt-0.5 break-keep line-clamp-1 sm:line-clamp-none">
                  공급사 선택부터 전송 확인까지 한 화면에서 검토합니다
                </p>
                {/* §11.247 #1 — 접힌 상태: minimal hint, 펼친 상태: full content. */}
                {!isQuoteDispatchExpanded && (
                  <p className="mt-2 text-[10px] font-semibold text-blue-600 break-keep">
                    클릭하여 상세 흐름 + 전송 보기 →
                  </p>
                )}
                {isQuoteDispatchExpanded && (
                <>
                <div
                  className="mt-3 grid grid-cols-2 gap-1.5"
                  data-testid="dashboard-quote-dispatch-readiness"
                >
                  {QUOTE_DISPATCH_STEPS.map((step) => (
                    <span
                      key={step}
                      data-testid="dashboard-quote-dispatch-stage"
                      className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${
                        step === "연락처 필요"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      {step}
                    </span>
                  ))}
                </div>
                <div
                  className="mt-2 space-y-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"
                  data-testid="dashboard-quote-dispatch-state-matrix"
                >
                  {QUOTE_DISPATCH_STATE_MATRIX.map((row) => (
                    <div
                      key={row.key}
                      data-testid={`dashboard-quote-dispatch-case-${row.key}`}
                      className="grid grid-cols-[0.8fr_0.8fr_1fr] gap-1 text-[10px] text-slate-600"
                    >
                      <span className="font-semibold text-slate-800">{row.label}</span>
                      <span>{row.button}</span>
                      <span>{row.preview} · {row.result}</span>
                    </div>
                  ))}
                </div>
                <div
                  className="mt-2 flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800"
                  data-testid="dashboard-quote-dispatch-contact-warning"
                >
                  <span className="break-keep">{sendBlockReason}</span>
                  <Link
                    href="/dashboard/quotes?labaxisPilot=quote-dispatch&manualSupplier=1"
                    className="shrink-0 text-slate-600 underline-offset-2 hover:underline"
                    data-testid="dashboard-quote-dispatch-manual-link"
                  >
                    수동 공급사 추가
                  </Link>
                </div>
                <div
                  className="mt-2 grid gap-1 text-[10px] text-slate-500"
                  data-testid="dashboard-quote-dispatch-preview-tracking"
                >
                  <span data-testid="dashboard-quote-dispatch-preview-status">
                    미리보기: {quoteReadiness.previewReady ? "전송 전 확인됨" : "메시지 미리보기 필요"}
                  </span>
                  <span data-testid="dashboard-quote-dispatch-tracking-status">
                    전송 결과: {quoteReadiness.dispatchEventTracked ? "dispatch 이벤트 추적됨" : "발송 후 새로고침에도 dispatch 이벤트 추적"}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Link
                    href="/dashboard/quotes?labaxisPilot=quote-dispatch"
                    aria-disabled={!canSendToSupplier}
                    className={`inline-flex min-h-[32px] flex-1 items-center justify-center rounded-md bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700 ${
                      !canSendToSupplier ? "pointer-events-none opacity-60" : ""
                    }`}
                    data-testid="dashboard-quote-dispatch-primary-cta"
                  >
                    공급사에 전송
                  </Link>
                  <Link
                    href="/dashboard/quotes"
                    className="min-h-[32px] shrink-0 rounded-md px-2 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  >
                    검토
                  </Link>
                  {/* §11.247 #1 — 접기 CTA */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle();
                    }}
                    className="min-h-[32px] shrink-0 rounded-md px-2 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    aria-label="견적 발송 카드 접기"
                  >
                    접기
                  </button>
                </div>
                </>
                )}
              </div>
            );
          }
          return (
            <Link
              key={action.href}
              href={action.href}
              /* §11.252a — 모바일 min-h-[110px] (스크롤 축소) + sm+ 140px 보존.
                 설명 line-clamp-1 으로 1줄 강제 (호영님 spec "설명 1줄 축약"). */
              className={`group rounded-lg border border-slate-200 border-l-2 ${tone.accent} bg-white px-4 py-3 shadow-sm transition-all duration-300 ease-in-out hover:shadow-md hover:border-slate-300 cursor-pointer min-h-[110px] sm:min-h-[140px]`}
            >
              <div className="flex items-start justify-between mb-2">
                <div
                  className={`w-8 h-8 rounded-lg ${tone.iconBg} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon className={`h-4 w-4 ${tone.iconColor}`} />
                </div>
                {count > 0 ? (
                  <span
                    data-quick-action-badge={action.countKey}
                    className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-bold ${tone.iconBg} ${tone.iconColor}`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 mt-1" />
                )}
              </div>
              <p className="text-sm font-bold text-slate-900 break-keep">{action.label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 break-keep line-clamp-1 sm:line-clamp-none">
                {action.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
