/**
 * §brief-redesign #single-queue-inline-ai — 운영 브리핑 리디자인 (호영님 핸드오프 2026-06-28)
 *
 * 우측 레일 운영 브리핑을 "카테고리 탭 게이트"에서 **"모듈 무관 단일 오늘 할 일 큐
 * + 인라인 1줄 AI 근거 + 조치"**로 재설계.
 *
 * 설계 원칙: "무엇을 할지 판단 → 그 화면으로 간다." 브리핑에서 작업을 완결하지 않는다.
 *   - 칩 = 카테고리 게이트가 아니라 필터(기본 전체).
 *   - 2섹션: 지금 처리(hot) / 검토 대기.
 *   - 요약 스트립: 긴급 / 검토 대기 / 임박 마감(동적 recalc).
 *   - 카드 클릭 = 인라인 단일오픈, AI 근거 1줄 + (조건부)인라인 조치 + 화면 이동.
 *
 * 승인(호영님 2026-06-28): 공유 popup(8 surface 일괄) / LIVE 제거 /
 *   act-primary 실액션 가드(없으면 단일 화면이동 CTA) / data-days 숫자 파생.
 *
 * lock 호환: chatbot/assistant/터미널 UI 0 · dead button 0 · canonical truth 보호
 *   (UnifiedInboxItem 파생, 신규 truth 0).
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import {
  X,
  Minus,
  Sparkles,
  FileText,
  ShoppingCart,
  Package,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { csrfFetch } from "@/lib/api-client";
import { validateTransition } from "@/lib/operations/state-machine";
import {
  quoteStatusEmailSubject,
  quoteStatusEmailBody,
  type QuoteStatusEmailKind,
} from "@/lib/email/quote-status-email-content";
import { cn } from "@/lib/utils";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import {
  buildFullInbox,
  sortInboxItems,
  type UnifiedInboxItem,
  type InboxSourceModule,
} from "@/lib/ops-console/inbox-adapter";
import { useOperationalBriefPopup } from "./popup-context";
import { useOperationalBriefNarrative } from "@/lib/hooks/use-operational-brief";
import {
  deriveBriefingItem,
  summarizeBriefing,
  type BriefingItem,
} from "@/lib/operational-brief/derive-briefing-item";

/* 모듈 메타 — 핸드오프 색토큰(견적=blue / 발주=purple / 입고=emerald / 재고=amber). */
const MODULE_META: Record<
  InboxSourceModule,
  { label: string; icon: typeof FileText; bar: string }
> = {
  quote: { label: "견적", icon: FileText, bar: "#2563eb" },
  po: { label: "발주", icon: ShoppingCart, bar: "#7c3aed" },
  receiving: { label: "입고", icon: Package, bar: "#059669" },
  stock_risk: { label: "재고", icon: AlertCircle, bar: "#d97706" },
};
const MODULE_ORDER: InboxSourceModule[] = ["quote", "po", "receiving", "stock_risk"];

/* §11.185 — CTA copy shortener (nextAction → button label, 14자 이내). */
const CTA_SHORT_LABEL: Array<{ pattern: RegExp; short: string }> = [
  { pattern: /격리\s*검사/, short: "격리 검사 처리" },
  { pattern: /문서\s*재요청|문서\s*요청/, short: "문서 요청 보내기" },
  { pattern: /공급사\s*확인/, short: "공급사 확인하기" },
  { pattern: /비교(?:표)?\s*검토.*공급사\s*선정/, short: "공급사 선정" },
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
  for (const { pattern, short } of CTA_SHORT_LABEL) {
    if (pattern.test(trimmed)) return short;
  }
  if (trimmed.length <= CTA_MAX_LENGTH) return trimmed;
  return trimmed.slice(0, CTA_MAX_LENGTH) + "…";
}

/**
 * §11.183 — viewport 감지 hook (SSR safe).
 * mobile (max-width: 767px) → bottom sheet + dim. desktop (≥768px) → right rail.
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

/** Popup root — 단일 큐(칩 필터 + 2섹션 + 인라인 1줄 AI). */
/* §brief-proposal-ui (호영님 2026-06-29) — 넘기기(dismiss) 사유. 정직 라벨 only.
   가짜 진척 주장(자동화/모델 반영 류) 0 — dismiss 는 순수 view-state 숨김(서버 변형 0). */
type DismissReason = "done" | "unnecessary" | "later";
const DISMISS_REASONS: { key: DismissReason; label: string }[] = [
  { key: "done", label: "이미 처리함" },
  { key: "unnecessary", label: "불필요" },
  { key: "later", label: "나중에" },
];

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
  const isMobile = useIsMobile();

  // 칩 필터(게이트 아님). null = 전체.
  const [selectedModule, setSelectedModule] = useState<InboxSourceModule | null>(null);

  // §brief-proposal-ui — 넘기기(dismiss)는 client view-state only(서버/canonical truth 0 변형).
  //   새로고침 시 리셋(백엔드 영속 없음 = 정직). 사유는 honest 라벨(가짜 진척 주장 0).
  const [dismissed, setDismissed] = useState<Map<string, DismissReason>>(new Map());
  const dismissItem = (id: string, reason: DismissReason) =>
    setDismissed((prev) => new Map(prev).set(id, reason));
  const restoreItem = (id: string) =>
    setDismissed((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });

  // popup close 시 필터/선택/숨김 초기화.
  useEffect(() => {
    if (!isOpen) {
      setSelectedModule(null);
      setSelectedItemId(null);
      setDismissed(new Map());
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

  // 모듈별 건수(칩 라벨). urgent = priority p0.
  const moduleCounts = useMemo(() => {
    const c: Record<InboxSourceModule, { total: number; urgent: number }> = {
      quote: { total: 0, urgent: 0 },
      po: { total: 0, urgent: 0 },
      receiving: { total: 0, urgent: 0 },
      stock_risk: { total: 0, urgent: 0 },
    };
    for (const it of sortedItems) {
      if (dismissed.has(it.id)) continue; // §brief-proposal-ui — 숨김 제외(recalc)
      c[it.sourceModule].total += 1;
      if (it.priority === "p0") c[it.sourceModule].urgent += 1;
    }
    return c;
  }, [sortedItems, dismissed]);

  // 보이는 항목(필터 + 숨김 제외 = 활성). §brief-proposal-ui.
  const visibleItems = useMemo(() => {
    const active = sortedItems.filter((i) => !dismissed.has(i.id));
    return selectedModule ? active.filter((i) => i.sourceModule === selectedModule) : active;
  }, [sortedItems, selectedModule, dismissed]);

  // 숨긴 항목(되돌리기 섹션용). 필터 연동.
  const dismissedItems = useMemo(() => {
    const d = sortedItems.filter((i) => dismissed.has(i.id));
    return selectedModule ? d.filter((i) => i.sourceModule === selectedModule) : d;
  }, [sortedItems, selectedModule, dismissed]);

  // 활성 전체 건수(헤더·전체 칩 — 숨김 제외, 모듈 무관).
  const activeTotal = useMemo(
    () => sortedItems.filter((i) => !dismissed.has(i.id)).length,
    [sortedItems, dismissed],
  );

  const totalUrgent =
    moduleCounts.quote.urgent +
    moduleCounts.po.urgent +
    moduleCounts.receiving.urgent +
    moduleCounts.stock_risk.urgent;

  // minimize 상태 — desktop dock chip.
  if (isOpen && isMinimized && !isMobile) {
    return (
      <PopupDockChip urgentCount={totalUrgent} onRestore={toggleMinimize} onClose={close} />
    );
  }

  if (!isOpen) return null;

  const briefBody = (
    <BriefQueue
      items={visibleItems}
      dismissedItems={dismissedItems}
      moduleCounts={moduleCounts}
      totalCount={activeTotal}
      selectedModule={selectedModule}
      onSelectModule={(m) => {
        setSelectedModule(m);
        setSelectedItemId(null);
      }}
      expandedItemId={selectedItemId}
      onToggleExpand={(id) => setSelectedItemId(id === selectedItemId ? null : id)}
      onDismiss={dismissItem}
      onRestore={restoreItem}
      onClose={close}
    />
  );

  // mobile: Radix Sheet (Portal + dim + bottom sheet).
  if (isMobile) {
    return (
      <SheetPrimitive.Root open={isOpen} onOpenChange={(v) => !v && close()} modal={true}>
        <SheetPrimitive.Portal>
          <SheetPrimitive.Overlay
            className={cn(
              "fixed inset-0 z-30 bg-black/50",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=open]:fade-in data-[state=closed]:fade-out",
            )}
          />
          <SheetPrimitive.Content
            className={cn(
              "fixed z-40 bg-background shadow-lg overflow-y-auto",
              "inset-x-0 bottom-0 h-[85vh] rounded-t-2xl border-t border-bd",
              "transition ease-in-out duration-300",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            )}
          >
            <div className="absolute right-3 top-2 z-10 flex items-center gap-1">
              <SheetPrimitive.Close
                className="rounded-sm p-1 text-slate-400 opacity-70 transition-opacity hover:opacity-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                aria-label="브리핑 닫기"
              >
                <X className="h-4 w-4" />
              </SheetPrimitive.Close>
            </div>
            {briefBody}
          </SheetPrimitive.Content>
        </SheetPrimitive.Portal>
      </SheetPrimitive.Root>
    );
  }

  // desktop: floating overlay (main canvas push 0).
  return (
    <>
      <div
        className="fixed inset-0 z-30 hidden md:block bg-black/20"
        onClick={close}
        aria-hidden="true"
      />
      <aside
        role="complementary"
        aria-label="운영 브리핑"
        className={cn(
          "fixed top-0 right-0 z-[60] hidden md:flex md:flex-col",
          "h-screen md:w-[400px] xl:w-[460px] 2xl:w-[432px]",
          "border-l border-bd bg-white shadow-xl",
          "overflow-y-auto",
        )}
      >
        <div className="absolute right-3 top-2 z-10 flex items-center gap-1">
          <button
            type="button"
            onClick={toggleMinimize}
            className="rounded-sm p-1 text-slate-400 opacity-70 transition-opacity hover:opacity-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label="브리핑 최소화"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-sm p-1 text-slate-400 opacity-70 transition-opacity hover:opacity-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label="브리핑 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {briefBody}
      </aside>
    </>
  );
}

/* ─────────────────── 단일 큐 (헤더 + 칩 + 스트립 + 2섹션) ─────────────────── */

function BriefQueue({
  items,
  dismissedItems,
  moduleCounts,
  totalCount,
  selectedModule,
  onSelectModule,
  expandedItemId,
  onToggleExpand,
  onDismiss,
  onRestore,
  onClose,
}: {
  items: UnifiedInboxItem[];
  dismissedItems: UnifiedInboxItem[];
  moduleCounts: Record<InboxSourceModule, { total: number; urgent: number }>;
  totalCount: number;
  selectedModule: InboxSourceModule | null;
  onSelectModule: (m: InboxSourceModule | null) => void;
  expandedItemId: string | null;
  onToggleExpand: (id: string) => void;
  onDismiss: (id: string, reason: DismissReason) => void;
  onRestore: (id: string) => void;
  onClose: () => void;
}) {
  const briefs = useMemo(() => items.map(deriveBriefingItem), [items]);
  const summary = useMemo(() => summarizeBriefing(briefs), [briefs]);

  const hotItems = items.filter((i) => deriveBriefingItem(i).hot);
  const reviewItems = items.filter((i) => !deriveBriefingItem(i).hot);

  const soonestLabel =
    summary.soonestDays === null
      ? "—"
      : summary.soonestDays <= 0
        ? "오늘"
        : `${summary.soonestDays}일`;

  return (
    <div className="flex flex-col pt-12 pb-6">
      {/* 헤더 */}
      <div className="px-5 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          운영 브리핑
        </p>
        <div className="mt-1 flex items-center gap-2">
          <h2 className="text-xl font-bold text-slate-900">오늘 할 일</h2>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-2.5 py-0.5 text-[12px] font-semibold text-slate-600">
            <span className="tabular-nums">{totalCount}건</span>
            {summary.urgent > 0 && (
              <>
                <span className="h-3 w-px bg-slate-300" />
                <span className="inline-flex items-center gap-1 text-rose-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  긴급 {summary.urgent}
                </span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* 필터 칩 — 게이트 아님 */}
      <div className="flex gap-2 overflow-x-auto px-5 pb-3">
        <ChipButton
          label="전체"
          count={totalCount}
          active={selectedModule === null}
          onClick={() => onSelectModule(null)}
        />
        {MODULE_ORDER.map((m) => (
          <ChipButton
            key={m}
            label={MODULE_META[m].label}
            count={moduleCounts[m].total}
            urgent={moduleCounts[m].urgent}
            active={selectedModule === m}
            onClick={() => onSelectModule(m)}
          />
        ))}
      </div>

      {/* 요약 스트립 — 필터 연동(보이는 항목 기준) */}
      <div className="mx-5 mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-4">
          <StripStat label="긴급" value={`${summary.urgent}`} tone="danger" />
          <StripStat label="검토 대기" value={`${summary.review}`} />
          <StripStat label="임박 마감" value={soonestLabel} tone={summary.soonestDays !== null && summary.soonestDays <= 0 ? "danger" : "default"} />
        </div>
        <Sparkline />
      </div>

      {/* 리스트 — 2섹션 */}
      <div className="flex flex-col">
        {items.length === 0 && (
          <div className="mx-5 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-700">오늘 확인할 항목을 모두 처리했습니다</p>
              <p className="mt-0.5 text-[12px] text-slate-500">견적·발주·입고·재고 4개 모듈을 모니터링 중입니다.</p>
            </div>
          </div>
        )}

        {hotItems.length > 0 && (
          <>
            <div className="flex items-center gap-1.5 px-5 pb-1.5 pt-2">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                지금 처리
              </span>
              <span className="text-[11px] text-slate-400">— 마감·차단 임박</span>
            </div>
            {hotItems.map((it) => (
              <BriefCard
                key={it.id}
                item={it}
                expanded={expandedItemId === it.id}
                onToggle={() => onToggleExpand(it.id)}
                onDismiss={onDismiss}
                onClose={onClose}
              />
            ))}
          </>
        )}

        {reviewItems.length > 0 && (
          <>
            <div className="px-5 pb-1.5 pt-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                검토 대기
              </span>
              <span className="ml-1.5 text-[11px] text-slate-400">— 여유 있음</span>
            </div>
            {reviewItems.map((it) => (
              <BriefCard
                key={it.id}
                item={it}
                expanded={expandedItemId === it.id}
                onToggle={() => onToggleExpand(it.id)}
                onDismiss={onDismiss}
                onClose={onClose}
              />
            ))}
          </>
        )}

        {/* §brief-proposal-ui — 오늘 숨김(넘기기) 섹션. 되돌리기 가능(view-state only). */}
        {dismissedItems.length > 0 && (
          <div className="mt-2 border-t border-slate-100">
            <div className="px-5 pb-1.5 pt-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">오늘 숨김</span>
              <span className="ml-1.5 text-[11px] text-slate-400">— {dismissedItems.length}건 · 되돌릴 수 있음</span>
            </div>
            {dismissedItems.map((it) => {
              const b = deriveBriefingItem(it);
              return (
                <div key={it.id} className="flex items-center gap-2 border-b border-slate-100 px-5 py-2">
                  <span className="min-w-0 flex-1 truncate text-[12px] text-slate-400">{b.title}</span>
                  <button
                    type="button"
                    onClick={() => onRestore(it.id)}
                    className="flex-shrink-0 text-[11px] font-medium text-slate-500 hover:text-slate-900"
                  >
                    되돌리기
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ChipButton({
  label,
  count,
  urgent = 0,
  active,
  onClick,
}: {
  label: string;
  count: number;
  urgent?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-brief-chip
      onClick={onClick}
      className={cn(
        "inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors min-h-[32px]",
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      <span>{label}</span>
      <span className={cn("tabular-nums", active ? "text-slate-300" : "text-slate-400")}>{count}</span>
      {urgent > 0 && (
        <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
          {urgent}
        </span>
      )}
    </button>
  );
}

function StripStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</span>
      <span
        className={cn(
          "text-[15px] font-bold tabular-nums leading-tight",
          tone === "danger" ? "text-rose-600" : "text-slate-900",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** 스파크라인 자리 — 추세 데이터 미연동 시 정적 막대(가짜 수치 0). */
function Sparkline() {
  const bars = [40, 60, 35, 75, 55, 85, 50];
  return (
    <div className="flex items-end gap-0.5" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-1 rounded-sm bg-slate-300"
          style={{ height: `${Math.round(h * 0.24)}px` }}
        />
      ))}
    </div>
  );
}

/* ─────────────────── 작업 카드 (모듈 액센트 + 인라인 단일오픈) ─────────────────── */

function BriefCard({
  item,
  expanded,
  onToggle,
  onDismiss,
  onClose,
}: {
  item: UnifiedInboxItem;
  expanded: boolean;
  onToggle: () => void;
  onDismiss: (id: string, reason: DismissReason) => void;
  onClose: () => void;
}) {
  const brief: BriefingItem = deriveBriefingItem(item);
  const meta = MODULE_META[brief.module];

  return (
    <div className="border-b border-slate-100">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50"
        style={{ borderLeft: `3px solid ${brief.hot ? meta.bar : "transparent"}` }}
      >
        <span
          className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${meta.bar}14`, color: meta.bar }}
        >
          <meta.icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex flex-shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{ backgroundColor: `${meta.bar}14`, color: meta.bar }}
            >
              {brief.moduleLabel}
            </span>
            <span
              className={cn(
                "truncate text-[11px] font-medium",
                brief.due.soon ? "text-rose-600" : "text-slate-400",
              )}
            >
              {brief.due.text}
            </span>
          </div>
          <p className="mt-0.5 text-[13px] font-bold text-slate-900 break-keep">{brief.title}</p>
          <p className="truncate text-[12px] text-slate-500">{brief.subtitle}</p>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
        )}
      </button>
      {expanded && <BriefCardInline item={item} brief={brief} onDismiss={onDismiss} onClose={onClose} />}
    </div>
  );
}

/* ─────────────────── 인라인 1줄 AI 근거 + 조치 ─────────────────── */

function BriefCardInline({
  item,
  brief,
  onDismiss,
  onClose,
}: {
  item: UnifiedInboxItem;
  brief: BriefingItem;
  onDismiss?: (id: string, reason: DismissReason) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [dismissOpen, setDismissOpen] = useState(false);

  const { narrative } = useOperationalBriefNarrative({
    sourceTrace: {
      workQueueTaskId: item.id,
      module: "work_queue",
      sourceUpdatedAt: item.updatedAt ?? new Date(0),
    },
    facts: {
      status: brief.moduleLabel,
      blocker: item.riskBadges.length > 0 ? item.riskBadges.join(", ") : "차단 없음",
      nextAction: item.nextAction ?? null,
    },
    enabled: !!item.id,
  });

  const reason = narrative ?? brief.aiReason;
  const goLabel = shortenCtaLabel(item.nextAction) ?? `${brief.moduleLabel} 화면 열기`;

  return (
    <div className="space-y-3 bg-slate-50/60 px-5 pb-4 pt-1">
      {/* AI 근거 1줄 */}
      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
        <span className="mt-0.5 inline-flex flex-shrink-0 items-center gap-1 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
          <Sparkles className="h-3 w-3" />
          AI 판단
        </span>
        <p className="text-[12.5px] leading-relaxed text-slate-700">{reason}</p>
      </div>

      {/* 차단(있을 때만) — 1줄 */}
      {item.riskBadges.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-600" />
          <p className="text-[11.5px] text-rose-700">{item.riskBadges.join(" · ")}</p>
        </div>
      )}

      {/* 조치 — act-primary(실액션 있을 때만) + act-go(화면 이동) */}
      <div className="flex gap-2">
        {brief.primaryAction && (
          <Button
            className="h-10 flex-1 text-[13px] font-semibold"
            onClick={() => {
              onClose();
              router.push(brief.goHref);
            }}
          >
            {brief.primaryAction.label}
          </Button>
        )}
        <Button
          variant={brief.primaryAction ? "outline" : "default"}
          className="h-10 flex-1 text-[13px] font-semibold"
          onClick={() => {
            onClose();
            router.push(brief.goHref);
          }}
        >
          {goLabel}
          <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      {/* §brief-proposal-ui — 넘기기(dismiss): 정직 view-state 숨김. 실 비즈니스 액션 0·가짜 진척 주장 0. */}
      {onDismiss &&
        (dismissOpen ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500">넘기기 사유</span>
            {DISMISS_REASONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => {
                  onDismiss(item.id, r.key);
                  setDismissOpen(false);
                }}
                className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
              >
                {r.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDismissOpen(false)}
              className="text-[11px] text-slate-400 hover:text-slate-600"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDismissOpen(true)}
            className="text-[12px] text-slate-400 hover:text-slate-600"
          >
            넘기기
          </button>
        ))}

      {/* §brief-quote-status-email — 견적 모듈: 고객 완료/취소 통보(발송 전 미리보기→확인→발송). */}
      {brief.module === "quote" && <QuoteNotifyAction quoteId={item.entityId} />}
    </div>
  );
}

/* ─────────────────── §brief-quote-status-email — 견적 상태 통보(미리보기→확인→발송) ─────────────────── */

function QuoteNotifyAction({ quoteId }: { quoteId: string }) {
  const [phase, setPhase] = useState<
    "idle" | "loading" | "preview" | "ineligible" | "sending" | "done" | "error"
  >("idle");
  const [kind, setKind] = useState<QuoteStatusEmailKind>("completed");
  const [recipient, setRecipient] = useState("");
  const [customerName, setCustomerName] = useState("고객");
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const quoteNumber = quoteId.slice(-8).toUpperCase();

  async function openPreview(k: QuoteStatusEmailKind) {
    setKind(k);
    setPhase("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/quotes/${quoteId}/detail`);
      if (!res.ok) throw new Error("견적 정보를 불러오지 못했습니다.");
      const j = await res.json();
      const d = j?.data;
      const status: string = d?.quote?.status ?? "";
      const target = k === "completed" ? "COMPLETED" : "CANCELLED";
      if (!validateTransition("QUOTE", status, target).valid) {
        setPhase("ineligible");
        return;
      }
      setRecipient(d?.customer?.email ?? "");
      setCustomerName(d?.customer?.name || "고객");
      setItemCount(typeof d?.totals?.itemCount === "number" ? d.totals.itemCount : null);
      setPhase("preview");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "오류가 발생했습니다.");
      setPhase("error");
    }
  }

  async function send() {
    if (kind === "cancelled" && !reason.trim()) return;
    setPhase("sending");
    setErrorMsg("");
    try {
      const res = await csrfFetch(`/api/quotes/${quoteId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: kind === "completed" ? "COMPLETED" : "CANCELLED",
          ...(kind === "cancelled" ? { reason: reason.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error((j && j.error) || "발송에 실패했습니다.");
      }
      setPhase("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "발송에 실패했습니다.");
      setPhase("error");
    }
  }

  if (phase === "done") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
        <p className="text-[12px] text-emerald-800">
          {recipient}님께 {kind === "completed" ? "완료" : "취소"} 통보 이메일을 발송했습니다.
        </p>
      </div>
    );
  }

  if (phase === "ineligible") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <p className="text-[12px] text-slate-500">현재 상태에서는 이 통보를 보낼 수 없습니다.</p>
        <button
          type="button"
          onClick={() => setPhase("idle")}
          className="flex-shrink-0 text-[11px] text-slate-400 hover:text-slate-600"
        >
          닫기
        </button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
        <p className="min-w-0 flex-1 text-[12px] text-rose-700">{errorMsg}</p>
        <button
          type="button"
          onClick={() => setPhase("idle")}
          className="flex-shrink-0 text-[11px] text-rose-500 hover:text-rose-700"
        >
          닫기
        </button>
      </div>
    );
  }

  if (phase === "preview" || phase === "sending") {
    const subject = quoteStatusEmailSubject(kind, quoteNumber);
    const body = quoteStatusEmailBody(kind, { customerName, reason });
    const blocked = !recipient || (kind === "cancelled" && !reason.trim());
    return (
      <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
        <p className="text-[11px] font-bold text-blue-800">
          발송 전 미리보기 — 이 내용 그대로 전송됩니다
        </p>
        <div className="space-y-1 rounded-md border border-slate-200 bg-white p-2.5 text-[12px]">
          <p>
            <span className="text-slate-400">받는사람 </span>
            <span className="font-medium text-slate-800">{recipient || "(이메일 없음)"}</span>
          </p>
          <p>
            <span className="text-slate-400">제목 </span>
            <span className="font-medium text-slate-800">{subject}</span>
          </p>
          {itemCount !== null && (
            <p>
              <span className="text-slate-400">견적 </span>
              <span className="text-slate-700">#{quoteNumber} · 품목 {itemCount}개</span>
            </p>
          )}
          <div className="mt-1 space-y-0.5 border-t border-slate-100 pt-1.5">
            {body.map((line, i) => (
              <p key={i} className="text-[12px] leading-relaxed text-slate-700">
                {line}
              </p>
            ))}
          </div>
        </div>
        {kind === "cancelled" && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="취소 사유를 입력하세요 (본문에 포함됩니다)"
            rows={2}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-[12px]"
          />
        )}
        {!recipient && (
          <p className="text-[11px] text-rose-600">고객 이메일이 없어 발송할 수 없습니다.</p>
        )}
        <div className="flex gap-2">
          <Button
            className="h-9 flex-1 text-[12px] font-semibold"
            disabled={blocked || phase === "sending"}
            onClick={send}
          >
            {phase === "sending" ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1 h-3.5 w-3.5" />
            )}
            확인하고 발송
          </Button>
          <Button
            variant="outline"
            className="h-9 text-[12px]"
            disabled={phase === "sending"}
            onClick={() => setPhase("idle")}
          >
            닫기
          </Button>
        </div>
      </div>
    );
  }

  // idle / loading
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-400">고객 통보</span>
      <button
        type="button"
        disabled={phase === "loading"}
        onClick={() => openPreview("completed")}
        className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-50"
      >
        완료 통보
      </button>
      <button
        type="button"
        disabled={phase === "loading"}
        onClick={() => openPreview("cancelled")}
        className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-50"
      >
        취소 통보
      </button>
      {phase === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
    </div>
  );
}

/* ─────────────────── §11.195 dock chip (minimize 상태) ─────────────────── */

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
