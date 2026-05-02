/**
 * §11.181 #operational-brief-popup-self-contained
 * §11.182 right-rail simplification — non-modal + 한국어 라벨 + raw key 제거 + CTA wire
 *
 * 우하단 FloatingEntry 클릭 시 우측에서 슬라이드 인 하는 non-modal rail.
 *
 * §11.182 (호영님 지시 — operational rail 정리):
 *   1. desktop dim overlay 제거 (modal={false}, SheetPortal+Content 직접 사용)
 *   2. width 640 → 400 (본문 가시성 보존)
 *   3. eyebrow 영문 → 한국어 "운영 브리핑" 으로 swap
 *   4. 판단 근거 section 라벨 한국어 swap (영문 내부 용어 비노출)
 *   5. raw owner ID (`user-inv-001`) → 사람 라벨 ("재고 운영" 등)
 *   6. P0/P1 → 즉시/높음/보통/낮음
 *   7. CTA copy = item.nextAction (canonical ontology 기반, 임의 라벨 0)
 *   8. close X 1개만 (우상단)
 *
 * lock §11.142 호환:
 *   - work object selected 시만 facts 노출 (popup state 자체는 facts 0)
 *   - chatbot/assistant/터미널 UI 0
 *   - dead button 0 (nextAction 없으면 CTA 미렌더)
 *   - canonical truth 보호 (useOpsStore + canonical sourceTrace)
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  AlertTriangle,
  X,
  Minus,
  Sparkles,
  FileText,
  ShoppingCart,
  Package,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import {
  buildFullInbox,
  sortInboxItems,
  WORK_TYPE_LABELS,
  SOURCE_MODULE_COLORS,
  type UnifiedInboxItem,
  type InboxSourceModule,
} from "@/lib/ops-console/inbox-adapter";
import { buildInboxItemBlockers } from "@/lib/ops-console/blocker-adapter";
import { useOperationalBriefPopup } from "./popup-context";
import { useOperationalBriefNarrative } from "@/lib/hooks/use-operational-brief";
import { MetricCell } from "./metric-cell";
import { formatRelativeKr } from "./relative-time";

/* §11.194 — 3-tier drill-down 카테고리 매핑 (canonical InboxSourceModule
   4종 → 운영자 친화 한국어 카테고리 카드). 호영님 prototype 시안 정합 —
   1단계 카테고리 → 2단계 list → 3단계 inline expand (Google snippet). */
const CATEGORIES: Array<{
  module: InboxSourceModule;
  label: string;
  description: string;
  icon: typeof FileText;
}> = [
  { module: "quote", label: "견적 관리", description: "RFQ 요청 / 비교 / 발주 전환", icon: FileText },
  { module: "po", label: "발주 관리", description: "발행 / 공급사 확인 / 입고 인계", icon: ShoppingCart },
  { module: "receiving", label: "입고 및 검수", description: "격리 / 문서 / 검수 / 반영", icon: Package },
  { module: "stock_risk", label: "재고 관리", description: "재주문 / 만료 / 위험", icon: AlertCircle },
];

/* §11.182 — priority 사람 라벨 (raw enum 노출 0). */
const PRIORITY_HUMAN: Record<string, string> = {
  p0: "즉시",
  p1: "높음",
  p2: "보통",
  p3: "낮음",
};
const PRIORITY_BADGE: Record<string, string> = {
  p0: "bg-red-500/10 text-red-700",
  p1: "bg-amber-500/10 text-amber-700",
  p2: "bg-blue-500/10 text-blue-700",
  p3: "bg-zinc-500/10 text-zinc-700",
};

/**
 * §11.182/184 — owner raw ID → 사람 라벨 (raw ID 절대 노출 0).
 *
 * 매핑 우선순위:
 *   1. explicit mapping (pilot seed + 운영 ontology) — `OWNER_HUMAN_LABEL`
 *   2. prefix-based smart fallback (user-{inv|proc|qc|rfq|admin}-* → 부서 라벨)
 *   3. 일반 fallback "담당자" (raw ID 노출 절대 0)
 *   4. null/undefined → "미배정"
 *
 * canonical (DB Membership.role) 조회는 §11.184b 후속 (별도 endpoint 필요).
 * 현재는 prefix pattern 으로 충분 — pilot ID 체계가 부서 prefix 강제하므로 안전.
 */
const OWNER_HUMAN_LABEL: Record<string, string> = {
  "user-inv-001": "재고 운영",
  "user-inv-002": "재고 운영",
  "user-proc-001": "구매 운영",
  "user-proc-002": "구매 운영",
  "user-qc-001": "품질 검토",
  "user-rfq-001": "견적 운영",
};

const OWNER_PREFIX_LABEL: Array<{ prefix: string; label: string }> = [
  { prefix: "user-inv-", label: "재고 운영" },
  { prefix: "user-proc-", label: "구매 운영" },
  { prefix: "user-qc-", label: "품질 검토" },
  { prefix: "user-rfq-", label: "견적 운영" },
  { prefix: "user-admin-", label: "관리자" },
];

function formatOwner(o: string | null | undefined): string {
  if (!o) return "미배정";
  // 1. explicit mapping
  if (OWNER_HUMAN_LABEL[o]) return OWNER_HUMAN_LABEL[o];
  // 2. prefix-based smart fallback
  for (const { prefix, label } of OWNER_PREFIX_LABEL) {
    if (o.startsWith(prefix)) return label;
  }
  // 3. 마지막 fallback — raw ID 노출 절대 0
  return "담당자";
}

/**
 * §11.185 — CTA copy shortener (nextAction → button label).
 *
 * nextAction 은 자연어 문장이라 button label 로 길어질 수 있음 (예: "비교 검토 후
 * 공급사 선정" 13자, "공급사에 문서 재요청" 11자, "격리 검사 실행 후 판정" 14자).
 * button 가독성을 위해 14자 이내 short label 로 압축.
 *
 * 매핑 우선순위:
 *   1. explicit short label (운영 ontology + 호영님 §11.182 예시)
 *   2. nextAction ≤ 14자 → 그대로
 *   3. > 14자 → 14자 + "…" truncate
 */
const CTA_SHORT_LABEL: Array<{ pattern: RegExp; short: string }> = [
  // §11.182 호영님 예시 매핑
  { pattern: /격리\s*검사/, short: "격리 검사 처리" },
  { pattern: /문서\s*재요청|문서\s*요청/, short: "문서 요청 보내기" },
  { pattern: /공급사\s*확인/, short: "공급사 확인하기" },
  { pattern: /비교\s*검토.*공급사\s*선정/, short: "공급사 선정" },
  { pattern: /발주서\s*발행/, short: "발주서 발행" },
  { pattern: /재주문|재발주/, short: "재주문 검토" },
  { pattern: /교체\s*발주/, short: "교체 발주" },
  { pattern: /견적\s*요청|견적\s*만들기/, short: "견적 요청" },
  { pattern: /응답\s*독촉|미응답/, short: "공급사 독촉" },
  { pattern: /PO\s*상태\s*확인/, short: "PO 상태 확인" },
];

const CTA_MAX_LENGTH = 14;

export function shortenCtaLabel(nextAction: string | null | undefined): string | null {
  const trimmed = nextAction?.trim();
  if (!trimmed) return null;
  // 1. explicit short label
  for (const { pattern, short } of CTA_SHORT_LABEL) {
    if (pattern.test(trimmed)) return short;
  }
  // 2. ≤ 14자 → 그대로
  if (trimmed.length <= CTA_MAX_LENGTH) return trimmed;
  // 3. > 14자 → truncate + ellipsis
  return trimmed.slice(0, CTA_MAX_LENGTH) + "…";
}

/**
 * §11.183 — viewport 감지 hook (SSR safe).
 * mobile (max-width: 767px) → bottom sheet + dim. desktop (≥768px) → right rail + non-modal.
 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

/** Popup root — list ↔ detail stack. */
export function OperationalBriefPopup() {
  const {
    isOpen,
    close,
    selectedItemId,
    setSelectedItemId,
    isMinimized,
    toggleMinimize,
  } = useOperationalBriefPopup();
  const store = useOpsStore();
  // §11.183 — mobile bottom sheet vs desktop right rail 분기
  const isMobile = useIsMobile();

  // §11.194 — 3-tier drill-down state. selectedItemId (popup-context) 는
  // inline-expand 의 expandedItemId 로 의미 통합 (별도 state 추가 0).
  const [viewMode, setViewMode] = useState<"category" | "list">("category");
  const [selectedCategory, setSelectedCategory] = useState<InboxSourceModule | null>(null);

  // popup close 시 카테고리 진입 상태 초기화 (다음 open 때 1단계부터)
  useEffect(() => {
    if (!isOpen) {
      setViewMode("category");
      setSelectedCategory(null);
      setSelectedItemId(null);
    }
  }, [isOpen, setSelectedItemId]);

  const allItems = useMemo(
    () =>
      buildFullInbox(
        store.quoteRequests,
        store.quoteResponses,
        store.quoteComparisons,
        store.purchaseOrders,
        store.approvalExecutions,
        store.acknowledgements,
        store.receivingBatches,
        store.stockPositions,
        store.reorderRecommendations,
        store.expiryActions,
      ),
    [
      store.quoteRequests,
      store.quoteResponses,
      store.quoteComparisons,
      store.purchaseOrders,
      store.approvalExecutions,
      store.acknowledgements,
      store.receivingBatches,
      store.stockPositions,
      store.reorderRecommendations,
      store.expiryActions,
    ],
  );

  const sortedItems = useMemo(() => sortInboxItems(allItems), [allItems]);

  // 카테고리별 stats (urgent = priority p0 count)
  const categoryStats = useMemo(() => {
    const stats: Record<InboxSourceModule, { total: number; urgent: number }> = {
      quote: { total: 0, urgent: 0 },
      po: { total: 0, urgent: 0 },
      receiving: { total: 0, urgent: 0 },
      stock_risk: { total: 0, urgent: 0 },
    };
    for (const item of sortedItems) {
      stats[item.sourceModule].total += 1;
      if (item.priority === "p0") stats[item.sourceModule].urgent += 1;
    }
    return stats;
  }, [sortedItems]);

  // 선택 카테고리 items
  const categoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    return sortedItems.filter((i) => i.sourceModule === selectedCategory);
  }, [sortedItems, selectedCategory]);

  // §11.195 — minimize 시 desktop 에서는 우측 edge 의 작은 dock chip 만
  // 노출 (full sheet 미렌더). mobile 은 minimize 무시 — 단순 close.
  // chip 클릭 시 toggleMinimize() 로 다시 expand.
  const totalUrgent =
    categoryStats.quote.urgent +
    categoryStats.po.urgent +
    categoryStats.receiving.urgent +
    categoryStats.stock_risk.urgent;

  // dock chip 은 popup 이 isOpen + isMinimized + desktop 조건 만족 시만 mount.
  if (isOpen && isMinimized && !isMobile) {
    return (
      <PopupDockChip
        urgentCount={totalUrgent}
        onRestore={toggleMinimize}
        onClose={close}
      />
    );
  }

  return (
    // §11.182/183 — desktop: modal={false} (dim 0, 본문 클릭 가능 rail).
    //               mobile: modal={true} (dim + body scroll lock, OS bottom sheet 패턴).
    <SheetPrimitive.Root open={isOpen} onOpenChange={(v) => !v && close()} modal={isMobile}>
      <SheetPrimitive.Portal>
        {/* §11.183 — mobile 만 backdrop dim. desktop overlay 0 */}
        {isMobile && (
          <SheetPrimitive.Overlay
            className={cn(
              "fixed inset-0 z-30 bg-black/50",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=open]:fade-in data-[state=closed]:fade-out",
            )}
          />
        )}
        <SheetPrimitive.Content
          className={cn(
            "fixed z-40 bg-background shadow-lg overflow-y-auto",
            // §11.183 — mobile bottom sheet (max-md): inset-x-0 bottom-0 h-[85vh] rounded-t-2xl
            "max-md:inset-x-0 max-md:bottom-0 max-md:h-[85vh] max-md:rounded-t-2xl max-md:border-t max-md:border-bd",
            // §11.192 — desktop right rail (md+): width 400 → 480 (한국어
            // 텍스트 truncate 잘림 해소 + Google snippet 정보 밀도 확보)
            // §11.195 — md:top-4 (16px) 가 DashboardHeader (sticky top-0
            // z-50 h-16) 와 겹쳐 eyebrow 가 header 아래로 잘림 보고.
            // md:top-16 (64px) 으로 push down + h-[calc(100%-4rem)] 으로
            // 정확히 viewport 의 header 아래 영역만 차지하도록 정합.
            "md:top-16 md:bottom-0 md:right-0 md:h-[calc(100%-4rem)] md:w-[480px] md:max-w-[480px] md:border-l md:border-bd",
            // slide animation — mobile slide-up, desktop slide-right
            "transition ease-in-out duration-300",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "max-md:data-[state=open]:slide-in-from-bottom max-md:data-[state=closed]:slide-out-to-bottom",
            "md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right",
          )}
          onInteractOutside={(e) => {
            // §11.183 — desktop: 본문 클릭 시 popup 유지 (rail). mobile: backdrop click 시 close 허용.
            if (!isMobile) e.preventDefault();
          }}
        >
          {/* §11.195 — 우상단 controls cluster: minimize ↔ close 두 진입점.
              minimize (Minus) → dock chip 으로 collapse (state 보존).
              close (X) → fully unmount (state reset).
              mobile 에서는 minimize 가 의미 약함 (full screen sheet) 이라
              desktop only 노출. */}
          <div className="absolute right-3 top-2 z-10 flex items-center gap-1">
            {!isMobile && (
              <button
                type="button"
                onClick={toggleMinimize}
                className="rounded-sm p-1 text-slate-400 opacity-70 transition-opacity hover:opacity-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                aria-label="브리핑 최소화"
              >
                <Minus className="h-4 w-4" />
              </button>
            )}
            <SheetPrimitive.Close
              className="rounded-sm p-1 text-slate-400 opacity-70 transition-opacity hover:opacity-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
              aria-label="브리핑 닫기"
            >
              <X className="h-4 w-4" />
            </SheetPrimitive.Close>
          </div>

          {/* §11.194 — 3-tier drill-down dispatch:
                viewMode 'category' → PopupCategoryGrid (1단계)
                viewMode 'list' → PopupCategoryListWithExpand (2+3단계, inline expand)
              detail mode (PopupBriefDetail) deprecated — inline expand 가 흡수. */}
          {viewMode === "category" && (
            <PopupCategoryGrid
              stats={categoryStats}
              onSelectCategory={(cat) => {
                setSelectedCategory(cat);
                setViewMode("list");
                setSelectedItemId(null);
              }}
            />
          )}
          {viewMode === "list" && selectedCategory && (
            <PopupCategoryListWithExpand
              category={selectedCategory}
              items={categoryItems}
              expandedItemId={selectedItemId}
              onToggleExpand={(id) =>
                setSelectedItemId(id === selectedItemId ? null : id)
              }
              onBack={() => {
                setViewMode("category");
                setSelectedCategory(null);
                setSelectedItemId(null);
              }}
              onClose={close}
            />
          )}
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}

/* ─────────────────── §11.195 dock chip (minimize 상태) ─────────────────── */

/**
 * popup 이 minimize 된 상태에서 우측 edge 에 노출되는 작은 dock chip.
 *
 * lock §11.142 호환:
 *   - state 보존 (close 와 다름) — 다시 expand 시 이전 viewMode/selection 유지
 *   - facts 0 노출 (단순 카운터 + label) — 운영 진행 가시성만 표시
 *   - dead button 0 (onRestore + onClose 모두 wired)
 *
 * 디자인:
 *   - md:top-20 right-0 (header h-16 + 16px gap), z-40 (header 아래)
 *   - vertical stack — 위에 X (완전 닫기), 아래 chevron (다시 펴기)
 *   - 긴급 카운트 있으면 rose dot badge 노출
 */
function PopupDockChip({
  urgentCount,
  onRestore,
  onClose,
}: {
  urgentCount: number;
  onRestore: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed right-0 top-20 z-40 flex flex-col items-stretch rounded-l-xl bg-slate-900 text-white shadow-xl shadow-slate-900/30"
      role="region"
      aria-label="운영 브리핑 — 최소화됨"
    >
      <button
        type="button"
        onClick={onClose}
        className="flex items-center justify-center px-2 pt-2 pb-1 text-slate-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-tl-xl"
        aria-label="브리핑 닫기"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onRestore}
        className="relative flex flex-col items-center gap-2 px-3 pt-3 pb-4 hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-bl-xl"
        aria-label="브리핑 펼치기"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span
          className="text-[11px] font-semibold tracking-wider"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          운영 브리핑
        </span>
        <ChevronRight className="h-3.5 w-3.5 rotate-180 text-slate-400" />
        {urgentCount > 0 && (
          <span
            className="absolute top-1 left-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white"
            aria-label={`긴급 ${urgentCount}건`}
          >
            {urgentCount}
          </span>
        )}
      </button>
    </div>
  );
}

/* ─────────────────── §11.194 Tier 1: Category Grid ─────────────────── */

/**
 * 1단계 — 4 카테고리 카드 grid. 운영자가 먼저 처리할 영역(quote/po/receiving/
 * stock_risk)을 선택한다. 각 카드 = label + description + 전체/긴급 카운트.
 */
function PopupCategoryGrid({
  stats,
  onSelectCategory,
}: {
  stats: Record<InboxSourceModule, { total: number; urgent: number }>;
  onSelectCategory: (cat: InboxSourceModule) => void;
}) {
  return (
    <>
      {/* §11.195 — md:top-16 으로 header overlap 해소되어 pt-10 (40px) 불필요.
          상단 controls cluster (right-3 top-2 = 28px 점유) 와 좌측 라벨 분리만
          확보 — pt-6 + pr-20 (controls 영역 회피) 로 충분. */}
      <div className="px-6 pt-6 pb-5 pr-20 border-b border-bd">
        <div className="text-[11px] font-bold tracking-[0.08em] text-blue-700 uppercase mb-1">
          운영 브리핑
        </div>
        <h3 className="text-xl font-bold text-slate-900 leading-tight">카테고리 선택</h3>
        <p className="mt-1 text-xs text-slate-500">
          먼저 처리할 영역을 고르면 작업 큐가 펼쳐집니다.
        </p>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const stat = stats[cat.module];
          return (
            <button
              key={cat.module}
              type="button"
              onClick={() => onSelectCategory(cat.module)}
              className="group rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-400 hover:bg-slate-50 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <Icon className="h-5 w-5 text-slate-500 group-hover:text-slate-900 transition-colors" />
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-700 transition-colors" />
              </div>
              <p className="text-sm font-bold text-slate-900 mb-0.5 leading-snug">
                {cat.label}
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed mb-2 line-clamp-2">
                {cat.description}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500">
                  전체 <span className="font-semibold tabular-nums">{stat.total}</span>건
                </span>
                {stat.urgent > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold">
                    긴급 {stat.urgent}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ─────────────────── §11.194 Tier 2+3: List with Inline Expand ─────────────────── */

/**
 * 2단계 + 3단계 — 카테고리별 work queue list. row click 시 같은 row 안에서
 * AI brief inline expand (Google snippet 패턴). detail mode 별도 페이지 X —
 * same-canvas 보존.
 */
function PopupCategoryListWithExpand({
  category,
  items,
  expandedItemId,
  onToggleExpand,
  onBack,
  onClose,
}: {
  category: InboxSourceModule;
  items: UnifiedInboxItem[];
  expandedItemId: string | null;
  onToggleExpand: (id: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const categoryMeta = CATEGORIES.find((c) => c.module === category);
  const categoryLabel = categoryMeta?.label ?? category;

  return (
    <>
      {/* §11.195 — header overlap 해소로 pt-10 → pt-6, controls cluster 영역
          확보 위해 pr-20 (close + minimize 두 버튼 폭). */}
      <div className="px-6 pt-6 pb-5 pr-20 border-b border-bd">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition-colors mb-3"
          aria-label="카테고리 목록으로"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          카테고리
        </button>
        <div className="text-[11px] font-bold tracking-[0.08em] text-blue-700 uppercase mb-1">
          운영 브리핑
        </div>
        <h3 className="text-xl font-bold text-slate-900 leading-tight">{categoryLabel}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {items.length > 0
            ? `처리 대상 ${items.length}건 — 항목을 누르면 AI 분석이 펼쳐집니다.`
            : "현재 이 카테고리의 처리 항목이 없습니다."}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">
          <p>현재 이 카테고리에 처리 항목이 없습니다.</p>
        </div>
      ) : (
        <div className="divide-y divide-bd/40">
          {items.map((item) => (
            <PopupItemWithExpand
              key={item.id}
              item={item}
              expanded={expandedItemId === item.id}
              onToggle={() => onToggleExpand(item.id)}
              onClose={onClose}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ─────────────────── §11.194 List item + inline AI brief ─────────────────── */

function PopupItemWithExpand({
  item,
  expanded,
  onToggle,
  onClose,
}: {
  item: UnifiedInboxItem;
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const toneBorder =
    item.priority === "p0"
      ? "border-l-rose-500"
      : item.priority === "p1"
        ? "border-l-amber-400"
        : item.priority === "p2"
          ? "border-l-blue-400"
          : "border-l-slate-300";

  return (
    <div className={cn("border-l-4", toneBorder)}>
      {/* Row card (Google snippet 4-row hierarchy) */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-6 py-4 hover:bg-slate-50 transition-colors"
        aria-expanded={expanded}
      >
        {/* Row 1 — workType + priority badge + expand chevron */}
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={cn(
              "inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap",
              SOURCE_MODULE_COLORS[item.sourceModule],
            )}
          >
            {WORK_TYPE_LABELS[item.workType]}
          </span>
          <span
            className={cn(
              "inline-flex px-1.5 py-0.5 rounded text-xs font-bold",
              PRIORITY_BADGE[item.priority],
            )}
          >
            {PRIORITY_HUMAN[item.priority] ?? item.priority}
          </span>
          <span className="ml-auto text-slate-400">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </div>
        <p className="text-base font-bold text-slate-900 leading-snug line-clamp-2">{item.title}</p>
        <p className="mt-1 text-[13px] text-slate-700 leading-relaxed line-clamp-2">{item.summary}</p>
        <p className="mt-1.5 text-[11px] text-slate-500">{item.dueState.label}</p>
      </button>

      {/* Inline AI brief — 펼친 row 안에 4-section 노출 (구글 스니펫 패턴) */}
      {expanded && <PopupBriefInline item={item} onClose={onClose} />}
    </div>
  );
}

/* ─────────────────── §11.194 Inline AI brief body (4-section + CTA) ─────────────────── */

function PopupBriefInline({
  item,
  onClose,
}: {
  item: UnifiedInboxItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const blockers = buildInboxItemBlockers(item);
  const lastUpdatedLabel = formatRelativeKr(item.updatedAt ?? null);

  // §11.161 — narrative hook (work object selected 상태에서만 호출)
  const { narrative: briefNarrative } = useOperationalBriefNarrative({
    sourceTrace: {
      workQueueTaskId: item.id,
      module: "work_queue",
      sourceUpdatedAt: item.updatedAt ?? new Date(0),
    },
    facts: {
      status: WORK_TYPE_LABELS[item.workType] ?? item.workType,
      blocker: item.riskBadges.length > 0 ? item.riskBadges.join(", ") : "차단 없음",
      nextAction: item.nextAction ?? null,
    },
    enabled: !!item.id,
  });

  const ctaLabel = shortenCtaLabel(item.nextAction);

  // §11.198 — 시안 정합 6-section: AI INSIGHT brand banner + narrative +
  //   CRITICAL EVIDENCE 2-cell + DETECTED RISKS rose + 추천 해결책 emerald
  //   + 큰 primary CTA. canonical truth (briefNarrative / blockers / item)
  //   변경 0 — visible hierarchy 만 강화.
  const priorityHuman = PRIORITY_HUMAN[item.priority] ?? item.priority;
  const ownerLabel = formatOwner(item.owner);
  // 추천 해결책 = 첫 blocker 의 whatCanResolveIt (있으면), 없으면 nextAction.
  const recommendedFix = blockers[0]?.whatCanResolveIt ?? item.nextAction ?? null;

  return (
    <div className="px-6 pb-5 pt-1 bg-slate-50/50 border-t border-bd/40 space-y-4">
      {lastUpdatedLabel && (
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold pt-3">
          Last Updated · {lastUpdatedLabel}
        </p>
      )}

      {/* §11.198 § 1. LABAXIS AI INSIGHT brand banner (시안 정합 dark gradient) */}
      <section className="rounded-lg overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-blue-300" />
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-[0.08em]">LABAXIS AI INSIGHT</p>
              <p className="text-[9px] uppercase tracking-[0.1em] text-slate-400">
                Real-time Operations Analysis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[9px] uppercase tracking-wider text-emerald-300 font-bold">Live</span>
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm leading-relaxed text-slate-100">
            {briefNarrative ?? item.summary}
          </p>
        </div>
      </section>

      {/* §11.198 § 2. CRITICAL EVIDENCE — 2 cell large evidence card (시안 정합) */}
      <section>
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-2">
          Critical Evidence
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              우선순위
            </p>
            <p className="text-base font-bold text-slate-900 mb-1.5">{priorityHuman}</p>
            <span
              className={cn(
                "inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                PRIORITY_BADGE[item.priority],
              )}
            >
              {WORK_TYPE_LABELS[item.workType] ?? item.workType}
            </span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              담당
            </p>
            <p className="text-base font-bold text-slate-900 mb-1.5">{ownerLabel}</p>
            <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
              {item.dueState.label}
            </span>
          </div>
        </div>
      </section>

      {/* §11.198 § 3. DETECTED RISKS — rose alert (시안 정합 amber → rose) */}
      {blockers.length > 0 && (
        <section>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-2">
            Detected Risks
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-2">
            {blockers.map((b) => (
              <div key={b.summaryKey} className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs flex-1">
                  <div className="font-semibold text-rose-900 mb-0.5">{b.whyBlocked}</div>
                  <div className="text-rose-700 text-[11px]">
                    24시간 경과 시 SLA 위반 위험
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* §11.198 § 4. 추천 해결책 — emerald check + 본문 (시안 정합 신규) */}
      {recommendedFix && (
        <section>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                추천 해결책
              </p>
              <p className="text-xs text-emerald-900 leading-relaxed">{recommendedFix}</p>
            </div>
          </div>
        </section>
      )}

      {/* §11.198 § 5. 큰 Primary CTA (시안 정합 — h-10 → h-12, text-sm → text-base) */}
      {ctaLabel && (
        <Button
          className="w-full h-12 text-base font-semibold"
          onClick={() => {
            onClose();
            router.push(item.entityRoute);
          }}
        >
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
