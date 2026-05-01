/**
 * §11.181 #operational-brief-popup-self-contained
 *
 * 우하단 FloatingEntry 클릭 시 뜨는 self-contained popup.
 *
 * 구조 (popup 내부 navigation, 페이지 이동 0):
 *   - 1단계: priority list (top 5 from useOpsStore + sortInboxItems)
 *   - 2단계: row click → 동일 popup 안에서 brief detail (4-section + 4-cell + amber)
 *   - 3단계: back button → list 복귀
 *
 * lock §11.142 호환:
 *   - work object selected 시만 facts 노출
 *   - chatbot/assistant/ai-reasoning UI 0
 *   - dead button 0 (list 빈 상태 시 empty state)
 *   - canonical truth 보호 (useOpsStore client-side mirror)
 */

"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, ExternalLink, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import {
  buildFullInbox,
  sortInboxItems,
  WORK_TYPE_LABELS,
  SOURCE_MODULE_COLORS,
  type UnifiedInboxItem,
} from "@/lib/ops-console/inbox-adapter";
import { buildInboxItemBlockers } from "@/lib/ops-console/blocker-adapter";
import { useOperationalBriefPopup } from "./popup-context";
import { useOperationalBriefNarrative } from "@/lib/hooks/use-operational-brief";
import { MetricCell } from "./metric-cell";
import { formatRelativeKr } from "./relative-time";

const PRIORITY_LABEL: Record<string, string> = {
  p0: "P0",
  p1: "P1",
  p2: "P2",
  p3: "P3",
};
const PRIORITY_BADGE: Record<string, string> = {
  p0: "bg-red-500/10 text-red-700",
  p1: "bg-amber-500/10 text-amber-700",
  p2: "bg-blue-500/10 text-blue-700",
  p3: "bg-zinc-500/10 text-zinc-700",
};

/** Popup 의 "탭" — list ↔ detail 전환 stack. */
export function OperationalBriefPopup() {
  const { isOpen, close, selectedItemId, setSelectedItemId } = useOperationalBriefPopup();
  const store = useOpsStore();

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
  const top = sortedItems.slice(0, 5);
  const selected = selectedItemId
    ? sortedItems.find((i) => i.id === selectedItemId) ?? null
    : null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[640px] sm:max-w-[640px] p-0 overflow-y-auto"
      >
        {selected ? (
          <PopupBriefDetail item={selected} onBack={() => setSelectedItemId(null)} onClose={close} />
        ) : (
          <PopupPriorityList items={top} totalCount={sortedItems.length} onSelect={setSelectedItemId} onClose={close} />
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ─────────────────── Priority List ─────────────────── */

function PopupPriorityList({
  items,
  totalCount,
  onSelect,
  onClose,
}: {
  items: UnifiedInboxItem[];
  totalCount: number;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="px-6 py-5 border-b border-bd bg-el/20">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[11px] font-bold tracking-[0.12em] text-blue-700 uppercase">
            OPERATIONAL BRIEFING
          </span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors"
            aria-label="브리핑 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <h3 className="text-2xl font-bold text-slate-900 leading-tight">
          우선순위 작업
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          전체 {totalCount}건 중 상위 {items.length}건 — 항목 클릭 시 상세 브리핑
        </p>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-500">
          <p>현재 처리할 우선 작업이 없습니다.</p>
          <p className="mt-1 text-xs text-slate-400">
            견적 / 발주 / 입고 / 재고 위험이 있으면 자동으로 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-bd/40">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="w-full text-left px-6 py-4 hover:bg-el/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "inline-flex shrink-0 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap",
                    SOURCE_MODULE_COLORS[item.sourceModule],
                  )}
                >
                  {WORK_TYPE_LABELS[item.workType]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{item.summary}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className={cn(
                        "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium",
                        PRIORITY_BADGE[item.priority],
                      )}
                    >
                      {PRIORITY_LABEL[item.priority]}
                    </span>
                    <span className="text-[10px] text-slate-500">{item.dueState.label}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ─────────────────── Brief Detail ─────────────────── */

function PopupBriefDetail({
  item,
  onBack,
  onClose,
}: {
  item: UnifiedInboxItem;
  onBack: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const blockers = buildInboxItemBlockers(item);
  const lastUpdatedLabel = formatRelativeKr(item.updatedAt ?? null);

  // §11.161 — narrative hook (work object selected 상태에서만 호출)
  const { narrative: briefNarrative } = useOperationalBriefNarrative({
    sourceTrace: {
      workQueueTaskId: item.id,
      // popup 은 inbox/work-queue 통합 view — type narrowing 위해 work_queue 매핑.
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

  return (
    <>
      {/* Header — back / OPERATIONAL BRIEFING / close */}
      <div className="px-6 py-5 border-b border-bd bg-el/20">
        <div className="flex items-start justify-between mb-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition-colors"
            aria-label="우선순위 목록으로"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            목록
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors"
            aria-label="브리핑 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[11px] font-bold tracking-[0.12em] text-blue-700 uppercase">
            OPERATIONAL BRIEFING
          </span>
          <span
            className={cn(
              "inline-flex px-2 py-0.5 rounded text-[11px] font-medium",
              SOURCE_MODULE_COLORS[item.sourceModule],
            )}
          >
            {WORK_TYPE_LABELS[item.workType]}
          </span>
        </div>
        <h3 className="text-2xl font-bold text-slate-900 leading-tight">{item.title}</h3>
        {lastUpdatedLabel && (
          <div className="mt-2 text-[11px] text-slate-500 uppercase tracking-wide">
            <span className="font-semibold">LAST UPDATED</span> · {lastUpdatedLabel}
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* § 1. 상황 요약 */}
        <section>
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
            상황 요약
          </div>
          <div className="rounded-lg border-l-4 border-blue-500 bg-slate-50 p-4">
            <p className="text-base text-slate-800 leading-relaxed">
              {briefNarrative ?? item.summary}
            </p>
          </div>
        </section>

        {/* § 2. 핵심 근거 — 4-cell metric grid */}
        <section>
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
            RESOLVER 판별 근거
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCell
              label="우선순위"
              value={PRIORITY_LABEL[item.priority]}
              tone={item.priority === "p0" ? "danger" : item.priority === "p1" ? "warn" : "neutral"}
            />
            <MetricCell
              label="기한"
              value={item.dueState.label}
              tone={item.dueState.tone === "overdue" ? "danger" : item.dueState.tone === "due_soon" ? "warn" : "neutral"}
            />
            <MetricCell label="담당자" value={item.owner ?? "미할당"} tone="neutral" />
            <MetricCell
              label="차단 상태"
              value={blockers.length === 0 ? "없음" : `${blockers.length}건`}
              tone={blockers.length === 0 ? "ok" : "danger"}
            />
          </div>
        </section>

        {/* § 3. 리스크 — amber alert */}
        <section>
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
            리스크 식별
          </div>
          {blockers.length === 0 ? (
            <p className="text-sm text-slate-500">차단 없음</p>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-900">
                  차단 사유 ({blockers.length}건)
                </span>
              </div>
              {blockers.map((b) => (
                <div key={b.summaryKey} className="text-xs">
                  <div className="text-slate-800">• {b.whyBlocked}</div>
                  <div className="pl-3 text-blue-700">→ {b.whatCanResolveIt}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* § 4. 다음 조치 */}
        <section>
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
            다음 조치
          </div>
          <p className="text-sm text-blue-700 font-medium">{item.nextAction}</p>
        </section>

        {/* CTA */}
        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full h-11 text-sm gap-1.5"
            onClick={() => {
              // popup 닫고 detail page 로 이동 — work object 별 처리 surface
              onClose();
              router.push(item.entityRoute);
            }}
          >
            <ExternalLink className="h-4 w-4" />
            상세 페이지에서 처리
          </Button>
        </div>
      </div>
    </>
  );
}
