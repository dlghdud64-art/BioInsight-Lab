/**
 * §11.181 #operational-brief-popup-self-contained
 * §11.182 right-rail simplification — non-modal + 한국어 라벨 + raw key 제거 + CTA wire
 * §11.202 right-rail layout contract — desktop 은 flex sibling rail (Radix Sheet 0).
 *
 * 우하단 FloatingEntry 클릭 시 우측에서 노출되는 운영 브리핑 rail.
 *
 * §11.202 (호영님 지시 — layout 계약):
 *   - desktop: 부모 flex row 안의 plain <aside> sibling. fixed/top-N/h-[calc] 0.
 *     본문이 reflow 되며 rail 이 차지한 폭만큼 좁아짐. dim 0 / overlay 0.
 *   - mobile: Radix Sheet (Portal) + dim — bottom sheet 패턴 유지.
 *   - header overlap 0 (rail 자체가 header 높이 영역을 침범하지 않음).
 *
 * §11.182 (이전 정합 — 한국어 / raw key 제거 / CTA wire):
 *   1. desktop dim overlay 0 (현재 §11.202 — Sheet 자체를 desktop 분기 외).
 *   2. desktop 폭 400 (시안 정합 380~420 range).
 *   3. eyebrow 한국어 "운영 브리핑".
 *   4. 판단 근거 section 라벨 한국어 swap.
 *   5. raw owner ID → 사람 라벨.
 *   6. P0/P1 → 즉시/높음/보통/낮음.
 *   7. CTA copy = item.nextAction.
 *   8. close X + minimize 두 진입점 (우상단).
 *
 * lock §11.142 호환:
 *   - work object selected 시만 facts 노출 (popup state 자체는 facts 0)
 *   - chatbot/assistant/터미널 UI 0
 *   - dead button 0 (nextAction 없으면 CTA 미렌더)
 *   - canonical truth 보호 (useOpsStore + canonical sourceTrace)
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
// #operational-brief-context-aware-category — pathname → category 자동 매핑.
import { deriveActiveCategoryFromPath } from "./derive-active-category-from-path";
// #operational-brief-critical-evidence-reason-d3 — priority + dueState 한 줄 이유.
import { derivePriorityReason } from "./derive-priority-reason";
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
// #operational-brief-category-color-e1 — 호영님 spec: 카테고리별 컬러 코드
//   (견적=블루 / 발주=퍼플 / 입고=그린 / 재고=앰버). 카드 좌측 컬러 바 +
//   Icon 색으로 시각적 구분. design system 기반 — 향후 다른 surface 도 동일
//   tone 매핑 가능.
const CATEGORIES: Array<{
  module: InboxSourceModule;
  label: string;
  description: string;
  icon: typeof FileText;
  tone: "blue" | "purple" | "emerald" | "amber";
}> = [
  { module: "quote", label: "견적 관리", description: "RFQ 요청 / 비교 / 발주 전환", icon: FileText, tone: "blue" },
  { module: "po", label: "발주 관리", description: "발행 / 공급사 확인 / 입고 인계", icon: ShoppingCart, tone: "purple" },
  { module: "receiving", label: "입고 및 검수", description: "격리 / 문서 / 검수 / 반영", icon: Package, tone: "emerald" },
  { module: "stock_risk", label: "재고 관리", description: "재주문 / 만료 / 위험", icon: AlertCircle, tone: "amber" },
];

// #operational-brief-category-color-e1 — tone → className 매핑 (Tailwind safelist).
const CATEGORY_TONE_BORDER: Record<"blue" | "purple" | "emerald" | "amber", string> = {
  blue: "border-l-blue-500",
  purple: "border-l-purple-500",
  emerald: "border-l-emerald-500",
  amber: "border-l-amber-500",
};
const CATEGORY_TONE_ICON: Record<"blue" | "purple" | "emerald" | "amber", string> = {
  blue: "text-blue-600",
  purple: "text-purple-600",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
};

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
  // #operational-brief-cta-shorten-d1 — 호영님 production 마찰: "비교표 검토
  //   후 공급사 선..." 잘림. 기존 pattern 이 "비교" 만 매칭 → "비교표" 매칭 실패.
  //   `비교(?:표)?` 분기로 표 포함 매칭.
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

/**
 * #operational-brief-rail-conversion-g1 — viewport 감지 hook (SSR safe).
 * #operational-brief-rail-conversion-g1b — Path C hot fix: 1280 → 1536px 상향.
 *
 * 호영님 Gemini Studio mockup Option A 정합 — desktop 2xl 이상 (≥ 1536px) 에서
 * popup → rail 영구 노출 전환. md~2xl 에서는 popup overlay 유지 (호영님 §11.219
 * floating overlay path + main canvas 보존 — quotes/purchases page header
 * 깨짐 차단). 본 hook 으로 isDesktopRail 분기.
 *
 * Path C 결정 근거: G1 deploy 후 1154px viewport 에서 quotes/purchases 의
 * page header (제목 + KPI 4 cell + filter chip) 가 main 좁아진 영역에서
 * 세로 wrap 깨짐 발견. xl (1280px) 도 sidebar 224 + rail 540 = 764 점유 →
 * main 516px 부족. 2xl (1536px) 로 상향 + rail width 540→420 축소 시 main
 * 892px 확보 — 정합. 1536px 미만 viewport 는 popup overlay fallback (호영님
 * 1154px 환경 = 기존 §11.219 path).
 */
function useIsRailDesktop(): boolean {
  const [isRail, setIsRail] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1536px)");
    setIsRail(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsRail(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isRail;
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
  // #operational-brief-rail-conversion-g1 — 2xl 이상 desktop rail 모드 분기.
  //   isOpen 무관 항상 mount + close/minimize/floating-entry 모두 hide.
  //   #operational-brief-rail-conversion-g1b — Path C hot fix: xl→2xl breakpoint.
  const isDesktopRail = useIsRailDesktop();

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

  // #operational-brief-context-aware-category — popup open 시 pathname 자동
  //   인식 → 매핑되는 카테고리가 있으면 모달 skip 후 작업 큐 바로 진입.
  //   호영님 마찰 ("견적 관리 페이지에서 또 카테고리 선택?") 차단. 매핑 실패
  //   (dashboard 메인 / settings 등) 시 기존 category grid fallback 보존.
  const pathname = usePathname();
  useEffect(() => {
    if (!isOpen) return;
    const auto = deriveActiveCategoryFromPath(pathname);
    if (auto) {
      setSelectedCategory(auto);
      setViewMode("list");
    }
  }, [isOpen, pathname]);

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
  // #operational-brief-rail-conversion-g1c — desktop rail 모드 (2xl+) 는
  //   minimize 의미 0 (rail 영구 노출). isMinimized=true 인 채로 viewport
  //   resize 시 dock chip 만 노출 + rail 안 보이는 회귀 차단. tablet 에서
  //   minimize → desktop resize 시 자동 rail 복귀.
  if (isOpen && isMinimized && !isMobile && !isDesktopRail) {
    return (
      <PopupDockChip
        urgentCount={totalUrgent}
        onRestore={toggleMinimize}
        onClose={close}
      />
    );
  }

  // §11.202 — popup 닫혀 있으면 mount 0 (desktop rail 도 자리 차지 0).
  // #operational-brief-rail-conversion-g1 — desktop rail 모드는 isOpen 무관
  //   항상 mount (rail 영구 노출). md~xl 또는 mobile 은 isOpen=true 시만 mount.
  if (!isOpen && !isDesktopRail) return null;

  // 운영 브리핑 컨텐츠 (desktop / mobile 공통 — 4-section + drill-down)
  const briefBody = (
    <>
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
          stats={categoryStats}
          expandedItemId={selectedItemId}
          onToggleExpand={(id) =>
            setSelectedItemId(id === selectedItemId ? null : id)
          }
          onBack={() => {
            setViewMode("category");
            setSelectedCategory(null);
            setSelectedItemId(null);
          }}
          // #operational-brief-category-tabs-d5 — 호영님 spec: 다른 카테고리
          //   브리핑 1 click 직접 전환. back + 새 카테고리 진입 = 1 click.
          onSwitchCategory={(cat) => {
            setSelectedCategory(cat);
            setSelectedItemId(null);
          }}
          onClose={close}
        />
      )}
    </>
  );

  // §11.202 — mobile: Radix Sheet (Portal + dim + bottom sheet) 유지.
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
            {/* mobile 은 minimize 의미 없음 (full bottom sheet) — close 만 노출 */}
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

  // §11.219 — desktop: floating overlay (mobile sheet 패턴 정합).
  //   호영님 피드백 — 기존 §11.202 의 <aside> flex sibling 이 main canvas 를
  //   push (reflow) → "운영브리핑이 화면을 밀어버린다". fixed inset-y-0 right-0
  //   으로 floating 변환 — main canvas 영향 0, popup 만 화면 위에 띄움.
  //   backdrop 으로 밖 click 시 close — mobile 패턴 정합.
  //   z-40 > NoSSR / sticky / Vercel toolbar (z-30) — 다른 surface 의 overlay
  //   는 침범 0.
  return (
    <>
      {/* §11.219 — backdrop (밖 click 닫기).
          #operational-brief-rail-conversion-g1 — desktop rail 모드는 backdrop
          의미 0 (rail 영구 노출). 2xl 에서 hide (Path C: xl→2xl 상향). */}
      <div
        className="fixed inset-0 z-30 hidden md:block 2xl:hidden bg-black/20"
        onClick={close}
        aria-hidden="true"
      />
      <aside
        role="complementary"
        aria-label="운영 브리핑"
        className={cn(
          // #operational-brief-popup-header-cutoff — DashboardHeader 가 sticky
          // top-0 z-50 h-14 md:h-16. popup 이 top-0 z-40 이면 header 뒤로
          // 위쪽 64px 가 가려져 "운영 브리핑" eyebrow + "카테고리 선택" h3 가
          // 짤림. popup 을 header 아래로 offset (top-16 md+) + height 보정.
          // #operational-brief-popup-width-expand (Phase C2) — 호영님 피드백:
          //   "popup 이 견적 카드 위에 겹쳐서 양쪽 다 못 본다, 폭이 좁아서
          //   텍스트 잘린다, 판단 근거 카드 '불가·수신...' 말줄임". 400px →
          //   540px 확대 (호영님 spec 정합 폭). xl:1280px+ 에서 main canvas
          //   reflow 없이 양쪽 같이 보기 가능. mobile sheet 분기 영향 0.
          // #operational-brief-rail-conversion-g1 — desktop rail 모드 (2xl+):
          //   fixed → static (main sibling reflow). 호영님 mockup 정합.
          //   md~2xl: fixed top-16 right-0 floating overlay 보존 (Path C 정합 —
          //   1280~1536px 구간 quotes/purchases page header 깨짐 차단).
          //   #operational-brief-rail-conversion-g1b Path C: xl→2xl 상향 + rail
          //   width 540→420 축소 (Gemini mockup spec 정합).
          "fixed top-16 right-0 z-40 hidden md:flex md:flex-col",
          "2xl:static 2xl:top-auto 2xl:right-auto 2xl:z-auto 2xl:h-auto",
          "h-[calc(100vh-4rem)] md:w-[400px] xl:w-[540px] 2xl:w-[420px]",
          "2xl:flex-shrink-0",
          "border-l border-bd bg-white shadow-xl 2xl:shadow-none",
          "overflow-y-auto",
        )}
      >
        {/* §11.219 — desktop close cluster: minimize + close.
            #operational-brief-rail-conversion-g1 — desktop rail 모드 (2xl+) 는
            rail 영구 노출이라 minimize/close 의미 0 → 2xl:hidden 으로 hide.
            md~2xl overlay 모드에서는 보존 (Path C: xl→2xl 상향). */}
        <div className="absolute right-3 top-2 z-10 flex items-center gap-1 2xl:hidden">
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
      {/* §11.202 — desktop 은 flex sibling rail 이라 header 영역 침범 0 (header
          sticky top-0 z-50 가 별도 row 차지). 상단 controls cluster (right-3
          top-2 = 28px 점유) 와 좌측 라벨 분리만 확보 — pt-6 + pr-20 (controls
          영역 회피) 로 충분. */}
      <div className="px-6 pt-6 pb-5 pr-20 2xl:pt-4 2xl:pb-3 2xl:pr-6 border-b border-bd">
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
          // #operational-brief-category-color-e1 — tone-별 border/icon className.
          const toneBorderClass = CATEGORY_TONE_BORDER[cat.tone];
          const toneIconClass = CATEGORY_TONE_ICON[cat.tone];
          // #operational-brief-visual-uplift-f1 — 비활성 카테고리 (count 0)
          //   grayscale 처리. 호영님 spec: 활성 카테고리에 시선 집중 + 비활성
          //   은 시각 무게 ↓. opacity-60 + grayscale literal class (purge safe).
          const isInactive = stat.total === 0;
          return (
            <button
              key={cat.module}
              type="button"
              onClick={() => onSelectCategory(cat.module)}
              className={cn(
                "group rounded-xl border border-slate-200 border-l-4 bg-white p-4 text-left",
                "hover:border-slate-400 hover:bg-slate-50 transition-all",
                toneBorderClass,
                isInactive && "opacity-60 grayscale",
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <Icon className={cn("h-5 w-5 transition-colors", toneIconClass)} />
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
                {/* #operational-brief-urgent-badge-e2 — 호영님 spec: solid red
                    강조. 기존 bg-rose-50 text-rose-700 (subtle) → bg-rose-500
                    text-white (solid) — 한눈에 주의 식별. */}
                {stat.urgent > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[10px] font-bold">
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
// #operational-brief-category-tabs-d5 — chip active state tone 매핑
//   (E1 CATEGORY_TONE_BORDER 와 1:1 정합 design system).
const CATEGORY_TONE_ACTIVE_BG: Record<"blue" | "purple" | "emerald" | "amber", string> = {
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
};

function PopupCategoryListWithExpand({
  category,
  items,
  stats,
  expandedItemId,
  onToggleExpand,
  onBack,
  onSwitchCategory,
  onClose,
}: {
  category: InboxSourceModule;
  items: UnifiedInboxItem[];
  stats: Record<InboxSourceModule, { total: number; urgent: number }>;
  expandedItemId: string | null;
  onToggleExpand: (id: string) => void;
  onBack: () => void;
  onSwitchCategory: (cat: InboxSourceModule) => void;
  onClose: () => void;
}) {
  const categoryMeta = CATEGORIES.find((c) => c.module === category);
  const categoryLabel = categoryMeta?.label ?? category;

  return (
    <>
      {/* §11.195 — header overlap 해소로 pt-10 → pt-6, controls cluster 영역
          확보 위해 pr-20 (close + minimize 두 버튼 폭). */}
      <div className="px-6 pt-6 pb-5 pr-20 2xl:pt-4 2xl:pb-3 2xl:pr-6 border-b border-bd">
        {/* #operational-brief-visual-uplift-f1 — back button 큰 클릭 영역.
            기존 text-xs (h-3.5 ArrowLeft) 가 너무 작아 호영님 spec 정합:
            text-sm + px-3 py-2 + h-4 ArrowLeft + hover bg 강화. */}
        <button
          onClick={onBack}
          className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors mb-2"
          aria-label="카테고리 목록으로"
        >
          <ArrowLeft className="h-4 w-4" />
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

      {/* #operational-brief-category-tabs-d5 — 4 chip 탭 strip. 호영님 spec:
          "상단에 카테고리 탭(견적 | 발주 | 입고 | 재고)을 넣으면 한 번에 전환
          가능". active chip = E1 tone 강조 + aria-pressed. inactive chip =
          slate subtle + click 시 onSwitchCategory 직접 전환. */}
      <div className="px-4 py-2 border-b border-bd/40 flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => {
          const isActive = cat.module === category;
          const stat = stats[cat.module];
          return (
            <button
              key={cat.module}
              type="button"
              onClick={() => {
                if (!isActive) onSwitchCategory(cat.module);
              }}
              aria-pressed={isActive}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium inline-flex items-center gap-1 transition-colors",
                isActive
                  ? CATEGORY_TONE_ACTIVE_BG[cat.tone]
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900",
              )}
            >
              <span>{cat.label}</span>
              {stat.urgent > 0 && (
                <span
                  className={cn(
                    "ml-0.5 px-1 rounded text-[9px] font-bold",
                    isActive ? "bg-rose-500 text-white" : "bg-rose-500 text-white",
                  )}
                >
                  {stat.urgent}
                </span>
              )}
            </button>
          );
        })}
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

  // #operational-brief-card-priority-hierarchy-d4 — 호영님 spec: 상위 건은
  //   더 크게/테두리 강조, 하위 건은 축소. p0/p1 (urgent) → border-l-[6px]
  //   강조 + 기본 padding/title size. p2/p3 (non-urgent) → border-l-2 얇게
  //   + py-3 + title text-sm 축소.
  const isUrgent = item.priority === "p0" || item.priority === "p1";
  const borderWidth = isUrgent ? "border-l-[6px]" : "border-l-2";
  const buttonPadding = isUrgent ? "px-6 py-4" : "px-6 py-3";
  const titleClass = isUrgent
    ? "text-base font-bold text-slate-900 leading-snug line-clamp-2"
    : "text-sm font-semibold text-slate-700 leading-snug line-clamp-2";

  return (
    <div className={cn(borderWidth, toneBorder)}>
      {/* Row card (Google snippet 4-row hierarchy) */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          buttonPadding,
          "w-full text-left hover:bg-slate-50 transition-colors",
        )}
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
        <p className={titleClass}>{item.title}</p>
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
      {/* #operational-brief-last-updated-label-d2 — 호영님 spec: "AI 분석이 5분
          전인지 데이터가 5분 전인지 모호". "마지막 분석" 으로 명확화 (AI 분석
          기준 timestamp). */}
      {lastUpdatedLabel && (
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold pt-3">
          마지막 분석 · {lastUpdatedLabel}
        </p>
      )}

      {/* §11.198 § 1. LABAXIS AI INSIGHT brand banner.
          #operational-brief-visual-uplift-f1 — 호영님 Gemini mockup 정합:
          glow gradient (bg-blue-500/10 blur-2xl absolute) 으로 시선 집중도 ↑.
          rounded-lg → rounded-xl, gradient bg → solid slate-900, LIVE 뱃지
          pill 형태로 통합. */}
      <section className="relative overflow-hidden rounded-xl bg-slate-900 text-white">
        {/* glow gradient — 우측 상단 코너 blue glow (디자인 강조 element) */}
        <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
        <div className="relative px-4 py-3 border-b border-white/10 flex items-center justify-between">
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
          {/* LIVE pill — 기존 점 + 텍스트 분리 → pill 통합 (animate-pulse dot inside) */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live
          </span>
        </div>
        <div className="relative px-4 py-3">
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
            <p className="text-base font-bold text-slate-900 mb-0.5">{priorityHuman}</p>
            {/* #operational-brief-critical-evidence-reason-d3 — 호영님 spec:
                "우선순위: 높음" 만으로는 왜 높은지 모름. priority + dueState
                결합 한 줄 이유 ("3일 남음 — 즉시 확인 필요"). */}
            <p className="text-[11px] text-slate-600 leading-snug mb-1.5">
              {derivePriorityReason({ priority: item.priority, dueState: item.dueState })}
            </p>
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
