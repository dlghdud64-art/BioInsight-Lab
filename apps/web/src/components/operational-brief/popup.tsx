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
import { ArrowLeft, AlertTriangle, X } from "lucide-react";
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
  const { isOpen, close, selectedItemId, setSelectedItemId } = useOperationalBriefPopup();
  const store = useOpsStore();
  // §11.183 — mobile bottom sheet vs desktop right rail 분기
  const isMobile = useIsMobile();

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
  const totalCount = sortedItems.length;
  const selected = selectedItemId
    ? sortedItems.find((i) => i.id === selectedItemId) ?? null
    : null;

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
            // §11.182 — desktop right rail (md+): inset-y-0 right-0 h-full w-[400px]
            "md:inset-y-0 md:right-0 md:h-full md:w-[400px] md:max-w-[400px] md:border-l md:border-bd",
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
          {/* §11.182 — 단일 close X (우상단). PopupPriorityList/PopupBriefDetail header 의 X 제거 */}
          <SheetPrimitive.Close
            className="absolute right-4 top-4 z-10 rounded-sm p-1 text-slate-400 opacity-70 transition-opacity hover:opacity-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label="브리핑 닫기"
          >
            <X className="h-4 w-4" />
          </SheetPrimitive.Close>

          {selected ? (
            <PopupBriefDetail
              item={selected}
              onBack={() => setSelectedItemId(null)}
              onClose={close}
            />
          ) : (
            <PopupPriorityList
              items={top}
              totalCount={totalCount}
              onSelect={setSelectedItemId}
            />
          )}
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}

/* ─────────────────── Priority List ─────────────────── */

function PopupPriorityList({
  items,
  totalCount,
  onSelect,
}: {
  items: UnifiedInboxItem[];
  totalCount: number;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      {/* Header — §11.182 한국어 eyebrow + Top N subtitle */}
      <div className="px-6 py-5 border-b border-bd">
        <div className="text-[11px] font-bold tracking-[0.08em] text-blue-700 uppercase mb-1">
          운영 브리핑
        </div>
        <h3 className="text-xl font-bold text-slate-900 leading-tight">
          {items.length > 0 ? `오늘 즉시 처리 ${items.length}건` : "오늘 즉시 처리할 항목 없음"}
        </h3>
        {totalCount > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            전체 {totalCount}건 중 상위 우선순위 기준
          </p>
        )}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">
          <p>현재 처리할 우선 작업이 없습니다.</p>
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
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "inline-flex shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap",
                    SOURCE_MODULE_COLORS[item.sourceModule],
                  )}
                >
                  {WORK_TYPE_LABELS[item.workType]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{item.summary}</p>
                  <div className="mt-1.5 text-[11px] text-slate-500">
                    <span
                      className={cn(
                        "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium mr-2",
                        PRIORITY_BADGE[item.priority],
                      )}
                    >
                      {PRIORITY_HUMAN[item.priority] ?? item.priority}
                    </span>
                    {item.dueState.label}
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

  // §11.182/185 — CTA copy = item.nextAction shortened (canonical ontology + 14자 cap).
  // nextAction 없으면 CTA 미렌더 (dead button 0).
  const ctaLabel = shortenCtaLabel(item.nextAction);

  return (
    <>
      {/* Header — §11.182 back / 한국어 eyebrow / 단일 X (Sheet root) */}
      <div className="px-6 py-5 border-b border-bd pr-12">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition-colors mb-3"
          aria-label="우선순위 목록으로"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          목록
        </button>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-[11px] font-bold tracking-[0.08em] text-blue-700 uppercase">
            운영 브리핑
          </span>
          <span
            className={cn(
              "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium",
              SOURCE_MODULE_COLORS[item.sourceModule],
            )}
          >
            {WORK_TYPE_LABELS[item.workType]}
          </span>
        </div>
        <h3 className="text-lg font-bold text-slate-900 leading-tight">{item.title}</h3>
        {lastUpdatedLabel && (
          <div className="mt-1.5 text-[11px] text-slate-500">{lastUpdatedLabel} 업데이트</div>
        )}
      </div>

      <div className="p-6 space-y-5">
        {/* § 1. 상황 요약 */}
        <section>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-2">
            상황 요약
          </div>
          <div className="rounded-md border-l-2 border-blue-500 bg-slate-50 p-3">
            <p className="text-sm text-slate-800 leading-relaxed">
              {briefNarrative ?? item.summary}
            </p>
          </div>
        </section>

        {/* § 2. 판단 근거 — §11.182 내부 용어 라벨 제거, 사람 owner / 사람 priority */}
        <section>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-2">
            판단 근거
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <MetricCell
              label="우선순위"
              value={PRIORITY_HUMAN[item.priority] ?? item.priority}
              tone={item.priority === "p0" ? "danger" : item.priority === "p1" ? "warn" : "neutral"}
            />
            <MetricCell
              label="기한"
              value={item.dueState.label}
              tone={item.dueState.tone === "overdue" ? "danger" : item.dueState.tone === "due_soon" ? "warn" : "neutral"}
            />
            <MetricCell label="담당" value={formatOwner(item.owner)} tone="neutral" />
            <MetricCell
              label="차단 상태"
              value={blockers.length === 0 ? "없음" : `${blockers.length}건`}
              tone={blockers.length === 0 ? "ok" : "danger"}
            />
          </div>
        </section>

        {/* § 3. 리스크 */}
        <section>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-2">
            리스크
          </div>
          {blockers.length === 0 ? (
            <p className="text-sm text-slate-500">차단 없음</p>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 space-y-2">
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
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-2">
            다음 조치
          </div>
          <p className="text-sm text-blue-700 font-medium">{item.nextAction ?? "—"}</p>
        </section>

        {/* §11.182 — Primary CTA (canonical nextAction copy). nextAction 없으면 미렌더 (dead button 0). */}
        {ctaLabel && (
          <div className="pt-2">
            <Button
              className="w-full h-11 text-sm"
              onClick={() => {
                // popup 닫고 detail page 로 이동 — work object 별 처리 surface
                onClose();
                router.push(item.entityRoute);
              }}
            >
              {ctaLabel}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
