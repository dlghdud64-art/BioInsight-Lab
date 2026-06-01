"use client";

import { SearchPanel } from "../_components/search-panel";
import { useTestFlow } from "../_components/test-flow-provider";
import { toast } from "sonner";
import { resolveAddToQuoteToast } from "@/lib/quote/resolve-add-to-quote-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/products/price-display";
import { Loader2, PenLine, X, Trash2, Search, FileText, Package, SlidersHorizontal, TrendingDown, AlertTriangle, AlertCircle, Sparkles, Check, Camera, Menu, LayoutDashboard, ShoppingCart, Settings, ChevronDown } from "lucide-react";
// §11.254b 햄버거 메뉴는 §11.283b 에서 plain button + useState 으로 swap.
// §11.298f Radix DropdownMenu import dead — application-wide grep 0 회복.
import Link from "next/link";
import Image from "next/image";
// §11.258b — 검색 결과 toolbar 정렬 + 카테고리 필터칩 (호영님 spec #7 client-side scope).
//   PRODUCT_CATEGORIES (REAGENT/TOOL/EQUIPMENT/RAW_MATERIAL) + SORT_OPTIONS
//   (relevance/price_low/price_high/lead_time/review) 모두 lib/constants 정의 +
//   test-flow-provider 의 sortBy/searchCategory + server fetch 정합.
import { PRODUCT_CATEGORIES, SORT_OPTIONS } from "@/lib/constants";
// §11.258c — 자동완성 client hook (호영님 spec #6).
//   useAutocomplete(query) → { items, isLoading }. debounce 300ms + fetch.
//   server route /api/search/autocomplete + Product.name/brand/catalogNumber 3 type.
import { useAutocomplete } from "@/hooks/use-autocomplete";
import { SourcingResultRow } from "../_components/sourcing-result-row";
import { SourcingContextRail } from "../_components/sourcing-context-rail";
import { QuoteCartPanel } from "../_components/quote-cart-panel"; // §11.339 v2 — 우측 탭 카트
import { CenterWorkWindow } from "@/components/work-window/center-work-window";
import { RequestReviewWindow } from "../_components/request-review-window";
import { CompareReviewWorkWindow } from "../_components/compare-review-work-window";
import { RequestAssemblyWorkWindow } from "@/components/sourcing/request-assembly-work-window";
import { RequestSubmissionWorkWindow } from "@/components/sourcing/request-submission-work-window";
// §11.312 — sticky bar 바텀시트 (호영님 P1 2026-05-26)
import { SourcingCandidatesSheet } from "@/components/sourcing/SourcingCandidatesSheet";
import { QuoteManagementWorkqueue } from "../_components/quote-management-workqueue";
import { QuoteNormalizationWorkbench } from "../_components/quote-normalization-workbench";
import { QuoteCompareReviewWorkbench } from "../_components/quote-compare-review-workbench";
import { PoConversionEntryWorkbench } from "../_components/po-conversion-entry-workbench";
import { PoCreatedDetailWorkbench } from "../_components/po-created-detail-workbench";
import { DispatchPreparationWorkbench } from "../_components/dispatch-preparation-workbench";
import { SendConfirmationWorkbench } from "../_components/send-confirmation-workbench";
import { PoSentTrackingWorkbench } from "../_components/po-sent-tracking-workbench";
import { SupplierConfirmationWorkbench } from "../_components/supplier-confirmation-workbench";
import { ReceivingPreparationWorkbench } from "../_components/receiving-preparation-workbench";
import { ReceivingExecutionWorkbench } from "../_components/receiving-execution-workbench";
import { InventoryIntakeWorkbench } from "../_components/inventory-intake-workbench";
import { StockReleaseWorkbench } from "../_components/stock-release-workbench";
import { ReorderDecisionWorkbench } from "../_components/reorder-decision-workbench";
import { ProcurementReentryWorkbench } from "../_components/procurement-reentry-workbench";
import { SourcingSearchReopenWorkbench } from "../_components/sourcing-search-reopen-workbench";
import { SourcingResultReviewWorkbench } from "../_components/sourcing-result-review-workbench";
import { CompareReopenWorkbench } from "../_components/compare-reopen-workbench";
import { RequestReopenWorkbench } from "../_components/request-reopen-workbench";
import { RequestSubmissionReopenWorkbench } from "../_components/request-submission-reopen-workbench";
import { QuoteManagementReentryWorkbench } from "../_components/quote-management-reentry-workbench";
import { QuoteNormalizationReentryWorkbench } from "../_components/quote-normalization-reentry-workbench";
import { QuoteCompareReentryWorkbench } from "../_components/quote-compare-reentry-workbench";
import { ApprovalReentryWorkbench } from "../_components/approval-reentry-workbench";
import { PoConversionReentryWorkbench } from "../_components/po-conversion-reentry-workbench";
import { PoCreatedReentryWorkbench } from "../_components/po-created-reentry-workbench";
import { DispatchPreparationReentryWorkbench } from "../_components/dispatch-preparation-reentry-workbench";
import { SendConfirmationReentryWorkbench } from "../_components/send-confirmation-reentry-workbench";
import { PoSentReentryTrackingWorkbench } from "../_components/po-sent-reentry-tracking-workbench";
import { SupplierConfirmationReentryWorkbench } from "../_components/supplier-confirmation-reentry-workbench";
import { ReceivingPreparationReentryWorkbench } from "../_components/receiving-preparation-reentry-workbench";
import { ReceivingExecutionReentryWorkbench } from "../_components/receiving-execution-reentry-workbench";
import { StockReleaseReentryWorkbench } from "../_components/stock-release-reentry-workbench";
import { ReorderDecisionReentryWorkbench } from "../_components/reorder-decision-reentry-workbench";
import { ProcurementReentryReopenWorkbench } from "../_components/procurement-reentry-reopen-workbench";
import { CompareReviewCenterWorkWindow } from "../_components/compare-review-center-work-window";
import { ApprovalHandoffGate } from "../_components/approval-handoff-gate";
import { ApprovalWorkbench } from "../_components/approval-workbench";
import { PoCreatedWorkbenchV2 } from "../_components/po-created-workbench-v2";
import { calculateRequestReadiness } from "../_components/request-readiness";
import { validateCompareCategoryIntegrity } from "@/lib/ai/compare-review-engine";
import type { RequestCandidateHandoff, CompareDecisionSnapshot } from "@/lib/ai/compare-review-engine";
// ── Reopen chain imports ──
import { buildCompareReopenHandoff, type CompareReopenHandoff } from "@/lib/ai/sourcing-result-review-engine";
import type { SourcingResultReviewObject } from "@/lib/ai/sourcing-result-review-engine";
import { buildRequestReopenFromCompareHandoff, type RequestReopenFromCompareHandoff } from "@/lib/ai/compare-reopen-engine";
import type { CompareReopenDecisionSnapshot } from "@/lib/ai/compare-reopen-engine";
import { buildRequestSubmissionReopenHandoff, type RequestSubmissionReopenHandoff } from "@/lib/ai/request-reopen-engine";
import type { RequestReopenObject } from "@/lib/ai/request-reopen-engine";
import { buildQuoteManagementReentryHandoff, type QuoteManagementReentryHandoff } from "@/lib/ai/request-submission-reopen-engine";
import type { RequestResubmissionEvent } from "@/lib/ai/request-submission-reopen-engine";
import type { RequestDraftSnapshot, RequestSubmissionHandoff } from "@/lib/ai/request-assembly-engine";
import type { RequestSubmissionEvent, QuoteWorkqueueHandoff } from "@/lib/ai/request-submission-engine";
import { buildQuoteWorkqueueHandoff as buildQWHandoff } from "@/lib/ai/request-submission-engine";
import type { QuoteNormalizationHandoff } from "@/lib/ai/quote-workqueue-engine";
import { buildQuoteNormalizationHandoff as buildNormHandoff } from "@/lib/ai/quote-workqueue-engine";
import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCompareStore } from "@/lib/store/compare-store";
import { generateSearchSummary, type SearchSummaryLine } from "@/lib/ai/suggestion-engine";
import { buildSourcingStrategyOptionSet } from "@/lib/ai/decision-option-builders";
import type { DecisionOption, DecisionOptionSet } from "@/lib/ai/decision-option-set";
import { buildSourcingAiContextHash, createCompareSeedDraft, type CompareSeedDraft, type SourcingStrategyOptionLocal } from "@/lib/ai/sourcing-operating-layer";
import { LabelScannerModal } from "@/components/inventory/LabelScannerModal";
import { ComparisonModal } from "../_components/comparison-modal";
import { RequestWizardModal } from "../_components/request-wizard-modal";
import { useOntologyContextBridge } from "@/hooks/use-ontology-context-bridge";

type SourcingCandidateTriageState = "shortlist" | "hold" | "exclude";

const SOURCING_TRIAGE_STORAGE_KEY = "labaxis-sourcing-triage-state";

export default function SearchPage() {
  const {
    products,
    isSearchLoading,
    compareIds,
    toggleCompare,
    addProductToQuote,
    quoteItems,
    queryAnalysis,
    clearCompare,
    removeQuoteItem,
    updateQuoteItem,
    hasSearched,
    analysisLoading,
    searchQuery,
    setSearchQuery,
    runSearch,
    searchCategory,
    setSearchCategory,
    searchBrand,
    setSearchBrand,
    // §11.258d-2 — server vendorCounts facet 으로 동적 chip row 생성 (top 5).
    vendorFacets,
    sortBy,
    setSortBy,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    grade,
  } = useTestFlow();
  const { getDisplayName: getStoredName } = useCompareStore();
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pilotProfile = searchParams.get("labaxisPilot") ?? searchParams.get("pilot");
  const isBrowserPilotSourcingAiCompare = pilotProfile === "sourcing-ai-compare";
  const pilotCompareSeededRef = useRef(false);
  // ── Step 2: activeResultId (ID only) — rail은 products에서 derive ──
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  // §11.339 v2 4·5 — 하단 바 "검토/견적/비교" 클릭 → 우측 탭 전환 트리거(카운터 = useEffect 발화).
  const [reviewFocusKey, setReviewFocusKey] = useState(0);
  const [quoteFocusKey, setQuoteFocusKey] = useState(0);
  const [compareFocusKey, setCompareFocusKey] = useState(0);
  // §11.303-hotfix-e — SearchPage 자체 filter dropdown state (SearchUtilityBar 와 별개).
  //   SearchPage JSX (line 891-1039) 가 category/price/vendor dropdown 을
  //   직접 render — useState 가 누락되어 type error. SearchUtilityBar 의
  //   동일 state (line 2487) 는 별개 scope.
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<"category" | "price" | "vendor" | null>(null);
  const [sourcingCandidateTriage, setSourcingCandidateTriage] = useState<Record<string, SourcingCandidateTriageState>>({});
  const railProduct = useMemo(() => activeResultId ? products.find((p: any) => p.id === activeResultId) ?? null : null, [activeResultId, products]);
  const [workWindowMode, setWorkWindowMode] = useState<"compare" | "request" | "compare-review" | "compare-review-center" | "approval-handoff-gate" | "approval-workbench" | "po-created-wb-v2" | "request-assembly" | "request-submission" | "quote-queue" | "quote-normalization" | "quote-compare" | "po-conversion" | "po-created" | "dispatch-prep" | "send-confirm" | "po-sent-tracking" | "supplier-confirm" | "receiving-prep" | "receiving-exec" | "inventory-intake" | "stock-release" | "reorder-decision" | "procurement-reentry" | "search-reopen" | "result-review" | "compare-reopen" | "request-reopen" | "submission-reopen" | "quote-reentry" | "norm-reentry" | "compare-reentry" | "approval-reentry" | "po-conv-reentry" | "po-created-reentry" | "dispatch-prep-reentry" | "send-confirm-reentry" | "sent-tracking-reentry" | "supplier-confirm-reentry" | "rcv-prep-reentry" | "rcv-exec-reentry" | "stock-release-reentry" | "reorder-decision-reentry" | "procurement-reentry-reopen" | null>(null);

  // ── Reopen chain canonical states ──
  const [resultReviewObject, setResultReviewObject] = useState<SourcingResultReviewObject | null>(null);
  const [compareReopenHandoff, setCompareReopenHandoff] = useState<CompareReopenHandoff | null>(null);
  const [compareReopenSnapshot, setCompareReopenSnapshot] = useState<CompareReopenDecisionSnapshot | null>(null);
  const [requestReopenHandoff, setRequestReopenHandoff] = useState<RequestReopenFromCompareHandoff | null>(null);
  const [requestReopenObject, setRequestReopenObject] = useState<RequestReopenObject | null>(null);
  const [requestSubmissionReopenHandoff, setRequestSubmissionReopenHandoff] = useState<RequestSubmissionReopenHandoff | null>(null);
  const [resubmissionEvent, setResubmissionEvent] = useState<RequestResubmissionEvent | null>(null);
  const [quoteManagementReentryHandoff, setQuoteManagementReentryHandoff] = useState<QuoteManagementReentryHandoff | null>(null);

  // ── Stage ownership: sourcing owns up to compare, request/quote owns after ──
  const REQUEST_STAGE_MODES = new Set([
    "request-assembly", "request-submission", "request-reopen", "submission-reopen",
  ]);
  const QUOTE_STAGE_MODES = new Set([
    "quote-queue", "quote-normalization", "quote-compare", "quote-reentry", "norm-reentry", "compare-reentry",
  ]);
  const POST_QUOTE_STAGE_MODES = new Set([
    "approval-handoff-gate", "approval-workbench", "approval-reentry",
    "po-conversion", "po-conv-reentry", "po-created", "po-created-reentry", "po-created-wb-v2",
    "dispatch-prep", "dispatch-prep-reentry", "send-confirm", "send-confirm-reentry",
    "po-sent-tracking", "sent-tracking-reentry", "supplier-confirm", "supplier-confirm-reentry",
    "receiving-prep", "rcv-prep-reentry", "receiving-exec", "rcv-exec-reentry",
    "inventory-intake", "stock-release", "stock-release-reentry",
    "reorder-decision", "reorder-decision-reentry", "procurement-reentry", "procurement-reentry-reopen",
  ]);
  const stageOwner: "sourcing" | "request" | "quote" | "post-quote" = useMemo(() => {
    if (!workWindowMode) return "sourcing";
    if (REQUEST_STAGE_MODES.has(workWindowMode)) return "request";
    if (QUOTE_STAGE_MODES.has(workWindowMode)) return "quote";
    if (POST_QUOTE_STAGE_MODES.has(workWindowMode)) return "post-quote";
    return "sourcing";
  }, [workWindowMode]);
  const isSourcingOwner = stageOwner === "sourcing";
  // ── Compare Review + Request Assembly + Submission + Quote Queue + Normalization canonical state ──
  const [requestHandoff, setRequestHandoff] = useState<RequestCandidateHandoff | null>(null);
  const [requestDraftSnapshot, setRequestDraftSnapshot] = useState<RequestDraftSnapshot | null>(null);
  const [submissionEvent, setSubmissionEvent] = useState<RequestSubmissionEvent | null>(null);
  const [quoteWorkqueueHandoff, setQuoteWorkqueueHandoff] = useState<QuoteWorkqueueHandoff | null>(null);
  const [normalizationHandoff, setNormalizationHandoff] = useState<QuoteNormalizationHandoff | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  // §11.265b-2 — AI 분석 바텀시트 (호영님 spec "AI 분석은 AI 분석 영역").
  //   §11.265b-1 hidden 으로 모바일 비표시된 인라인 AI 제안 fallback + TRIAGE 블록을
  //   바텀시트 안에서 동일 markup 으로 노출. 트리거는 §11.265c 1줄 row 안 "AI 분석"
  //   버튼 (별도 cluster). 본 phase 는 shell + state + content 만.
  const [aiAnalysisSheetOpen, setAiAnalysisSheetOpen] = useState(false);
  // ── AI suggestion orchestration (contextHash 기반, SSR-safe) ──
  const [aiDismissedHash, setAiDismissedHash] = useState<string | null>(null);
  // ── P2: Sourcing tri-option operating layer ──
  const [activeSourcingStrategy, setActiveSourcingStrategy] = useState<"conservative" | "balanced" | "alternative">("balanced");
  const [sourcingDismissed, setSourcingDismissed] = useState(false);
  const [compareSeedDraft, setCompareSeedDraft] = useState<CompareSeedDraft | null>(null);
  // ── Strategy overlay state (compact trigger + anchored overlay) ──
  const [isStrategyOverlayOpen, setIsStrategyOverlayOpen] = useState(false);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [requestWizardOpen, setRequestWizardOpen] = useState(false);

  // §11.312 — sticky bar 바텀시트 (호영님 P1 2026-05-26).
  // bar 의 "비교 N" / "견적 N" / "⚠ 검토 N" 영역 탭 시 sheet 열림.
  // mode 분기로 1 컴포넌트 재사용 (compare / quote / review).
  const [candidatesSheetMode, setCandidatesSheetMode] = useState<
    "compare" | "quote" | "review" | null
  >(null);
  const [previewStrategy, setPreviewStrategy] = useState<"conservative" | "balanced" | "alternative">("balanced");

  useEffect(() => {
    if (!isBrowserPilotSourcingAiCompare || pilotCompareSeededRef.current || products.length < 2) return;

    products.slice(0, 2).forEach((product: any) => {
      if (!compareIds.includes(product.id)) {
        toggleCompare(product.id, { name: product.name, brand: product.brand });
      }
    });
    pilotCompareSeededRef.current = true;
    setWorkWindowMode("compare");
  }, [compareIds, isBrowserPilotSourcingAiCompare, products, toggleCompare]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SOURCING_TRIAGE_STORAGE_KEY);
      if (saved) {
        setSourcingCandidateTriage(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const [preSelectionSnapshot, setPreSelectionSnapshot] = useState<string[] | null>(null);

  // Batch-fetch compare status for visible products
  const productIds = useMemo(() => products.map((p: any) => p.id), [products]);
  const { data: compareStatusData } = useQuery<{ statuses: Record<string, { activeCount: number }> }>({
    queryKey: ["compare-status", productIds],
    queryFn: async () => {
      const res = await fetch(`/api/products/compare-status?productIds=${productIds.join(",")}`);
      if (!res.ok) return { statuses: {} };
      return res.json();
    },
    enabled: productIds.length > 0 && !!session?.user,
    staleTime: 30_000,
  });
  const compareStatuses = compareStatusData?.statuses ?? {};

  const activeFilterCount = [searchCategory, searchBrand, grade].filter(Boolean).length
    + (sortBy !== "relevance" ? 1 : 0)
    + (minPrice !== undefined ? 1 : 0)
    + (maxPrice !== undefined ? 1 : 0);

  // Auth return context — search query + filters를 URL에 보존
  const callbackUrl = (() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (searchCategory) params.set("category", searchCategory);
    if (searchBrand) params.set("brand", searchBrand);
    if (sortBy !== "relevance") params.set("sort", sortBy);
    const qs = params.toString();
    return qs ? `/test/search?${qs}` : "/test/search";
  })();

  const handleProtectedAction = (action: () => void) => {
    // 세션 로딩 중이면 action 실행 허용 (로딩 완료 후 재검증됨)
    if (sessionStatus === "loading") {
      action();
      return;
    }
    if (!session?.user) {
      setIsLoginPromptOpen(true);
      return;
    }
    action();
  };

  const handleLoginRedirect = () => {
    setIsLoginPromptOpen(false);
    router.push(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  };

  // §11.338 — 가격 표시 정합: 견적 회신으로 확정된 가격(unitPrice>0)만 합산.
  //   미견적(unitPrice=0, import/시드 = price null)은 "견적 후 확정"이라 금액에서 제외 →
  //   하단 바가 "확정분 합계 + N건 가격 미정"으로 표기(환각/모순 방지, §11.335 정책).
  const totalAmount = quoteItems.reduce(
    (sum, item) => sum + ((item.unitPrice ?? 0) > 0 ? (item.lineTotal || 0) : 0),
    0,
  );
  const priceUnknownCount = quoteItems.filter((item: any) => !((item.unitPrice ?? 0) > 0)).length;
  const hasConfirmedPrice = quoteItems.some((item: any) => (item.unitPrice ?? 0) > 0);

  // ── Step 2 상태 정책: query 변경 시 activeResultId 초기화 ──
  useEffect(() => {
    setActiveResultId(null);
    setAiDismissedHash(null); // 새 검색 시 AI 제안 다시 노출
    setIsStrategyOverlayOpen(false); // 새 검색 시 overlay 닫기
  }, [searchQuery]);

  // ── AI contextHash (간단 해시, SSR-safe) ──
  const aiContextHash = useMemo(() => {
    const key = `${searchQuery}_${products.length}_${compareIds.length}_${quoteItems.length}`;
    return key;
  }, [searchQuery, products.length, compareIds.length, quoteItems.length]);

  // Restore pending search after login
  useEffect(() => {
    if (session?.user && !hasSearched) {
      try {
        const pending = sessionStorage.getItem("labaxis-pending-search");
        if (pending) {
          sessionStorage.removeItem("labaxis-pending-search");
          setSearchQuery(pending);
          setTimeout(() => runSearch(), 100);
        }
      } catch {}
    }
  }, [session?.user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-close overlay when selection drops below threshold
  useEffect(() => {
    if (isStrategyOverlayOpen && compareIds.length < 2 && quoteItems.length < 2) {
      setIsStrategyOverlayOpen(false);
    }
  }, [compareIds.length, quoteItems.length, isStrategyOverlayOpen]);

  // Compare 2+ 자동 work window hint
  const compareReady = compareIds.length >= 2;
  const requestReady = quoteItems.length > 0;

  // ── AI compare readiness evaluation — 자동 활성화 ──
  const aiCompareReadiness = useMemo(() => {
    if (!compareReady) return { active: false, mode: "inactive" as const, label: "" };
    const candidates = compareIds.map((id: string) => {
      const p = products.find((pp: any) => pp.id === id);
      if (!p) return null;
      const v = p.vendors?.[0];
      return { id: p.id, name: p.name, brand: p.brand || "", category: p.category || "", priceKRW: v?.priceInKRW || 0, leadTimeDays: v?.leadTimeDays || 0 };
    }).filter(Boolean) as any[];
    const catResult = validateCompareCategoryIntegrity(candidates);
    return {
      active: true,
      mode: catResult.compareMode as "direct" | "mixed_warning" | "blocked",
      label: catResult.compareMode === "direct" ? "같은 카테고리 비교 준비 완료" : catResult.compareMode === "mixed_warning" ? "혼합 카테고리 — 경고 상태" : "비교 불가 상태",
      catResult,
    };
  }, [compareReady, compareIds, products]);
  const showSourcingActionDock = hasSearched && !!session?.user && isSourcingOwner && (compareIds.length > 0 || quoteItems.length > 0);

  // ── Ontology Contextual Action Layer — sourcing detail ──
  const sourcingDetailForBridge = useMemo(() => {
    const selectedNames = compareIds
      .map((id: string) => {
        const p = products.find((pp: any) => pp.id === id);
        return p?.name ?? null;
      })
      .filter(Boolean) as string[];

    // Supplier count: unique vendors across selected compare candidates
    const supplierSet = new Set<string>();
    compareIds.forEach((id: string) => {
      const p = products.find((pp: any) => pp.id === id);
      p?.vendors?.forEach((v: any) => { if (v?.name) supplierSet.add(v.name); });
    });

    // AI analysis exists if compare work window was opened and aiCompareReadiness is active
    const aiDone = aiCompareReadiness.active && aiCompareReadiness.mode !== "blocked";

    // Request draft completeness
    const draftExists = requestDraftSnapshot !== null;
    const draftCompleteness = requestDraftSnapshot
      ? { filled: requestDraftSnapshot.requestDraftLines?.filter((ln: any) => ln.quantity > 0).length ?? 0,
          total: requestDraftSnapshot.requestDraftLines?.length ?? quoteItems.length }
      : null;

    // Incomplete items (quoteItems without full info)
    const incomplete: string[] = [];
    quoteItems.forEach((q: any) => {
      if (!q.deliveryDate) incomplete.push("납기 확인 필요");
    });

    // Last submitted quote request ID
    const lastSubmitted = submissionEvent?.id ?? null;

    return {
      selectedProductNames: selectedNames,
      availableSupplierCount: supplierSet.size,
      aiAnalysisExists: aiDone,
      requestDraftExists: draftExists,
      requestDraftCompleteness: draftCompleteness,
      incompleteItems: [...new Set(incomplete)],
      lastSubmittedQuoteRequestId: lastSubmitted,
      linkedCompareResultExists: requestHandoff !== null || aiDone,
      handoffTarget: "견적 관리",
    };
  }, [compareIds, products, aiCompareReadiness, requestDraftSnapshot, quoteItems, submissionEvent, requestHandoff]);

  // ── Ontology Contextual Action Layer bridge ──
  useOntologyContextBridge({
    compareIds,
    quoteItems,
    activeWorkWindow: workWindowMode,
    currentStage: workWindowMode === "request-assembly"
      ? "request_assembly"
      : workWindowMode === "request-submission"
      ? "request_submission"
      : workWindowMode === "compare" || workWindowMode === "compare-review"
      ? "search_comparing"
      : workWindowMode === "quote-queue" || workWindowMode === "quote-normalization"
      ? "quote_management"
      : workWindowMode === "quote-compare"
      ? "quote_comparison"
      : workWindowMode === "dispatch-prep"
      ? "dispatch_prep"
      : workWindowMode === "po-created" || workWindowMode === "po-created-reentry"
      ? "po_created"
      : quoteItems.length > 0
      ? "search_requesting"
      : compareIds.length >= 2
      ? "search_comparing"
      : "search_idle",
    selectedEntityIds: compareIds,
    selectedEntityType: compareIds.length > 0 ? "product" : "none",
    counts: {
      compareIds: compareIds.length,
      quoteItems: quoteItems.length,
    },
    sourcingDetail: sourcingDetailForBridge,
    onActionDispatched: (_actionKey: string, targetWorkWindow: string) => {
      const windowMap: Record<string, typeof workWindowMode> = {
        "request-assembly": "request-assembly",
        "request-submission": "request-submission",
        "compare": "compare",
        "compare-review": "compare-review",
        "quote-compare": "quote-compare",
        "dispatch-prep": "dispatch-prep",
        "po-conversion": "po-conversion",
        "po-created-reentry": "po-created-reentry",
      };
      const mapped = windowMap[targetWorkWindow];
      if (mapped) setWorkWindowMode(mapped);
    },
  });

  // Request readiness for dock indicators
  const requestReadiness = useMemo(
    () => calculateRequestReadiness(quoteItems, compareIds, products),
    [quoteItems, compareIds, products],
  );

  // AI Next Step Summary
  const aiSearchSummary = useMemo<SearchSummaryLine[]>(
    () => hasSearched && products.length > 0 ? generateSearchSummary({
      query: searchQuery,
      products,
      compareIds,
      quoteItemIds: quoteItems.map((q: any) => q.productId),
    }) : [],
    [hasSearched, products, searchQuery, compareIds, quoteItems],
  );

  const aiShouldShow = aiSearchSummary.length > 0 && aiDismissedHash !== aiContextHash;

  // ── P2: Sourcing 3-option set ──
  const sourcingOptionSet = useMemo<DecisionOptionSet | null>(() => {
    if (!hasSearched || products.length < 2) return null;
    return buildSourcingStrategyOptionSet({
      query: searchQuery,
      products: products.map((p: any) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        priceKRW: p.vendors?.[0]?.priceInKRW ?? 0,
        leadTimeDays: p.vendors?.[0]?.leadTimeDays ?? 0,
        specMatchScore: 0,
      })),
      compareIds,
      requestIds: quoteItems.map((q: any) => q.productId),
    });
  }, [hasSearched, products, searchQuery, compareIds, quoteItems]);

  const sourcingOptions = (sourcingOptionSet?.options ?? []) as (DecisionOption & { compareSeedIds?: string[] })[];
  const activeSourcingOption = sourcingOptions.find(o => o.frame === activeSourcingStrategy) ?? sourcingOptions.find(o => o.frame === "balanced") ?? null;
  // 전략안은 선택 상태 기반으로만 노출 — 검색 직후/선택 전/혼합 카테고리에서는 숨김
  const hasComparableSelection = compareIds.length >= 2;
  const hasRequestReadySelection = quoteItems.length >= 2;
  const shouldShowSourcingStrip = sourcingOptionSet && sourcingOptions.length === 3 && !sourcingDismissed && hasSearched && products.length >= 2 && (hasComparableSelection || hasRequestReadySelection);

  // Overlay open guard: can only open when selection is meaningful
  const canOpenStrategyOverlay = shouldShowSourcingStrip;
  // Stale check: snapshot mismatch
  const selectionKey = `${compareIds.join(",")}_${quoteItems.map((q: any) => q.productId).join(",")}`;
  const isStrategyStale = isStrategyOverlayOpen && preSelectionSnapshot !== null && preSelectionSnapshot.join(",") !== compareIds.join(",");

  const openStrategyOverlay = () => {
    if (!canOpenStrategyOverlay) return;
    setPreviewStrategy(activeSourcingStrategy);
    setPreSelectionSnapshot([...compareIds]);
    setIsStrategyOverlayOpen(true);
  };

  const closeStrategyOverlay = () => {
    setIsStrategyOverlayOpen(false);
    setCompareSeedDraft(null);
  };

  const applyStrategyOption = (optionFrame: "conservative" | "balanced" | "alternative") => {
    if (isStrategyStale) return;
    const opt = sourcingOptions.find(o => o.frame === optionFrame);
    if (!opt) return;
    const candidateIds = products
      .filter((p: any) => !compareIds.includes(p.id) && p.vendors?.[0]?.priceInKRW > 0)
      .slice(0, 3)
      .map((p: any) => p.id);
    if (candidateIds.length >= 2) {
      candidateIds.forEach(id => {
        const p = products.find((pp: any) => pp.id === id);
        if (p && !compareIds.includes(id)) { toggleCompare(id, { name: p.name, brand: p.brand }); }
      });
      setActiveSourcingStrategy(optionFrame);
      closeStrategyOverlay();
      // Auto-open AI comparison modal after AI apply
      setComparisonModalOpen(true);
    }
  };

  // Preview option for overlay
  const previewOption = sourcingOptions.find(o => o.frame === previewStrategy) ?? null;

  // 11.263c - Sourcing result triage evidence for Browser Pilot.
  const sourcingTriage = useMemo(() => {
    if (!hasSearched || products.length === 0) return null;

    const queryToken = searchQuery.trim().toLowerCase().split(/\s+/).find(Boolean) ?? "";
    const hasVendorEvidence = (product: any) => {
      const vendor = product.vendors?.[0];
      return Boolean(vendor?.vendor?.name || vendor?.name || (vendor?.priceInKRW ?? 0) > 0);
    };
    // §11.337 Part A — 식별자(품명·Cat.No) 우선 매칭. 짧은 쿼리(≤2자)는 임의 위치
    //   부분일치 시 "P"가 PCR의 P, Capricorn의 p 까지 걸려 noise → prefix(시작/단어경계)만.
    //   긴 쿼리(≥3자)는 의도가 명확하므로 전 필드 부분일치 허용(기존 동작 보존).
    const matchesQuery = (product: any) => {
      if (!queryToken) return false;
      const name = String(product.name ?? "").toLowerCase();
      const catNo = String(product.catalogNumber ?? "").toLowerCase();

      if (queryToken.length <= 2) {
        // 품명/Cat.No 의 시작 또는 단어경계(공백 뒤) 시작 일치만.
        const startsWith = (text: string) =>
          text.startsWith(queryToken) ||
          text.split(/[\s\-_/]+/).some((w) => w.startsWith(queryToken));
        return startsWith(name) || startsWith(catNo);
      }

      // 긴 쿼리 — 전 필드 부분일치(제조사/규격/분류 포함).
      const haystack = [
        product.name,
        product.brand,
        product.catalogNumber,
        product.specification,
        product.category,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(queryToken);
    };

    const availableProducts = products.filter((product: any) => hasVendorEvidence(product));
    const blockedProducts = products.filter((product: any) => !hasVendorEvidence(product));
    const exactProducts = availableProducts.filter((product: any) => matchesQuery(product));
    const exactIds = new Set(exactProducts.map((product: any) => product.id));
    const anchorCategory = exactProducts[0]?.category ?? availableProducts[0]?.category ?? null;
    const equivalentProducts = availableProducts.filter((product: any) => {
      return !exactIds.has(product.id) && anchorCategory && product.category === anchorCategory;
    });
    const equivalentIds = new Set(equivalentProducts.map((product: any) => product.id));
    const alternativeProducts = availableProducts.filter((product: any) => {
      return !exactIds.has(product.id) && !equivalentIds.has(product.id);
    });
    const blockedIds = new Set(blockedProducts.map((product: any) => product.id));
    const alternativeIds = new Set(alternativeProducts.map((product: any) => product.id));
    const classificationByProductId = Object.fromEntries(products.map((product: any) => {
      const id = product.id;
      if (blockedIds.has(id)) {
        return [id, { key: "blocked", label: "Blocked", reason: "차단 사유: 공급사 또는 가격 확인 필요", tone: "red" }];
      }
      if (exactIds.has(id)) {
        return [id, { key: "exact", label: "Exact Match", reason: "검색어와 제품 근거가 일치합니다.", tone: "blue" }];
      }
      if (equivalentIds.has(id)) {
        return [id, { key: "equivalent", label: "Cross-Vendor Equivalent", reason: "동일 카테고리의 교차 공급사 후보입니다.", tone: "violet" }];
      }
      if (alternativeIds.has(id)) {
        return [id, { key: "alternative", label: "Substitute", reason: "대체 규격 또는 팩 단위 검토 후보입니다.", tone: "emerald" }];
      }
      return [id, { key: "blocked", label: "Blocked", reason: "차단 사유: triage 근거 부족", tone: "red" }];
    }));

    const firstActionProduct = exactProducts[0] ?? equivalentProducts[0] ?? alternativeProducts[0] ?? products[0] ?? null;
    const blockedReason = blockedProducts.length > 0
      ? `${blockedProducts.length}건은 공급사/가격 확인 후 보류 또는 제외가 필요합니다.`
      : "차단 사유 없음. 비교 후보를 같은 화면에서 검토할 수 있습니다.";
    const toCandidateRow = (
      product: any,
      section: "Exact Match" | "Cross-Vendor Equivalent" | "Substitute" | "Blocked",
      action: SourcingCandidateTriageState,
      reason: string,
      tone: "blue" | "violet" | "emerald" | "red",
    ) => ({
      key: `${section}-${product.id}`,
      productId: product.id,
      name: product.name ?? "이름 없는 후보",
      brand: product.brand ?? "",
      section,
      action,
      reason,
      tone,
    });
    const candidateRows = [
      ...exactProducts.slice(0, 1).map((product: any) => toCandidateRow(
        product,
        "Exact Match",
        "shortlist",
        "Shortlist: 비교 후보로 바로 이동",
        "blue",
      )),
      ...equivalentProducts.slice(0, 1).map((product: any) => toCandidateRow(
        product,
        "Cross-Vendor Equivalent",
        "shortlist",
        "Shortlist: 동등 후보 비교 대상",
        "violet",
      )),
      ...alternativeProducts.slice(0, 1).map((product: any) => toCandidateRow(
        product,
        "Substitute",
        "hold",
        "Hold: 대체 규격 확인 필요",
        "emerald",
      )),
      ...blockedProducts.slice(0, 1).map((product: any) => toCandidateRow(
        product,
        "Blocked",
        "exclude",
        "Exclude: 차단 사유 + 공급사 코드 확인 필요",
        "red",
      )),
    ];

    return {
      firstActionProduct,
      blockedReason,
      candidateRows,
      candidateSections: [
        { key: "exact", label: "Exact Match", count: exactProducts.length, tone: "blue" as const },
        { key: "equivalent", label: "Cross-Vendor Equivalent", count: equivalentProducts.length, tone: "violet" as const },
        { key: "alternative", label: "Substitute", count: alternativeProducts.length, tone: "emerald" as const },
        { key: "blocked", label: "Blocked", count: blockedProducts.length, tone: "red" as const },
      ],
      classificationByProductId,
      sections: [
        { key: "exact", label: "Exact Match", sublabel: "정확 일치", count: exactProducts.length, tone: "blue" },
        { key: "equivalent", label: "Cross-Vendor Equivalent", sublabel: "동등 후보", count: equivalentProducts.length, tone: "violet" },
        { key: "alternative", label: "Substitute", sublabel: "대체 후보", count: alternativeProducts.length, tone: "emerald" },
        { key: "blocked", label: "Blocked", sublabel: "차단/보류", count: blockedProducts.length, tone: "red" },
      ],
    };
  }, [hasSearched, products, searchQuery]);

  const openSourcingTriageReview = () => handleProtectedAction(() => {
    if (sourcingTriage?.firstActionProduct?.id) {
      setActiveResultId(sourcingTriage.firstActionProduct.id);
    }
    closeStrategyOverlay();
    setWorkWindowMode("result-review");
  });

  const openSourcingTriageRequest = () => handleProtectedAction(() => {
    const product = sourcingTriage?.firstActionProduct;
    if (product?.id) {
      setActiveResultId(product.id);
      const exists = quoteItems.some((item: any) => item.productId === product.id);
      if (!exists) {
        addProductToQuote(product);
      }
    }
    closeStrategyOverlay();
    setWorkWindowMode("request");
  });

  const setSourcingCandidateTriageState = (productId: string, state: SourcingCandidateTriageState) => {
    setSourcingCandidateTriage((prev) => {
      const next = { ...prev, [productId]: state };
      try {
        window.localStorage.setItem(SOURCING_TRIAGE_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    // §11.280 — outer container `pointer-events-auto` 강제 (호영님 P0, 햄버거 dead button fix).
    //   Radix Sheet/Dialog 가 mount 시 `<body>` pointer-events:none 추가 후 unmount cleanup 누락
    //   → CSS inherited cascade 로 햄버거 + 모든 button hit-test 차단 (Radix issue #2122).
    //   outer container 가 own `pointer-events: auto` 명시 → cascade 차단, 모든 descendant 정상 hit-test.
    //   Radix modal 자체 차단 behavior 는 Radix 자체 overlay 안 (body sibling z-index) 에서 작동 → 영향 0.
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden pointer-events-auto" style={{ backgroundColor: '#F8FAFC' }}>
      {/* ═══ A. Search Utility Bar — compact, not hero ═══ */}
      {/* §11.265e — onOpenFilter prop 제거 (dead prop, SearchUtilityBar body 사용 0). */}
      <SearchUtilityBar activeFilterCount={activeFilterCount} onAuthRequired={() => setIsLoginPromptOpen(true)} isLoggedIn={!!session?.user} stageOwner={stageOwner} onBackToSourcing={() => setWorkWindowMode(null)} />

      {/* ═══ Mobile filter sheet ═══ */}
      <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
        <SheetContent side="bottom" className="h-[75vh] overflow-y-auto">
          <div className="pt-2"><SearchPanel /></div>
        </SheetContent>
      </Sheet>

      {/* ═══ §11.265b-2 AI 분석 바텀시트 ═══
            호영님 spec "AI 분석은 AI 분석 영역". §11.265b-1 hidden 으로 모바일 비표시
            된 인라인 AI 제안 fallback + TRIAGE 블록 markup 을 sheet 안에서 동일 content
            노출. content / state / handler 는 inline 과 동일 closure 변수 사용 →
            별도 컴포넌트 분리 X (markup duplication ~80 line acceptable). 트리거는
            §11.265c 1줄 요약 row 안 "AI 분석" 버튼 (별도 cluster) → 본 phase 는
            진입 path 0 = dead component 아닌 latent component (사용자 영향 0). */}
      <Sheet open={aiAnalysisSheetOpen} onOpenChange={setAiAnalysisSheetOpen}>
        <SheetContent
          data-testid="sourcing-ai-analysis-sheet"
          side="bottom"
          className="h-[85vh] overflow-y-auto p-0"
        >
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">AI 분석</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {/* §11.292 SOURCING RESULT TRIAGE 제거 — AI 제안 · 차단 사유만 표기 */}
              AI 제안 · 차단 사유
            </p>
          </div>
          <div className="px-3 py-3 space-y-3">
            {/* AI 제안 fallback (§11.265b-1 inline 과 동일 content) */}
            {!shouldShowSourcingStrip && aiShouldShow && aiSearchSummary[0] && (
              <div className="flex items-center gap-2 px-2.5 py-2 rounded border border-blue-200 bg-blue-50">
                <span className="text-[10px] font-semibold text-blue-600 shrink-0">AI 제안</span>
                <span className="text-[11px] text-slate-700 flex-1 break-words">{aiSearchSummary[0].text}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {aiSearchSummary.some(l => l.signal === "compare") && compareIds.length === 0 && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-blue-600 hover:bg-blue-50 border border-blue-200"
                      onClick={() => handleProtectedAction(() => {
                        products.filter((p: any) => p.vendors?.[0]?.priceInKRW > 0 && !compareIds.includes(p.id)).slice(0, 3)
                          .forEach((p: any) => toggleCompare(p.id, { name: p.name, brand: p.brand }));
                      })}>비교 후보 담기</Button>
                  )}
                </div>
              </div>
            )}
            {/* §11.292 모바일 sheet TRIAGE 블록 제거 (호영님 P1 1단계 정합).
                desktop 과 동일 — 분류 정보 가치 0 + Shortlist/Hold/Exclude
                불필요 중간 단계. AI 동등 대체품 분석은 2단계 비교 surface. */}
            {!sourcingTriage && (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                현재 분석할 검색 결과가 없습니다.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ B + C. Workbench Body ═══ */}
      {hasSearched && !!session?.user ? (
        isSourcingOwner ? (
        <div className="flex-1 overflow-hidden flex">
          {/* B. Result Workbench List — main scrollable canvas */}
          <div className="flex-1 overflow-y-auto">
            {/* ═══ 3행: Operating Status Bar — 흰 배경, 결과 수 + 후보 + 필터/재고 ═══ */}
            <div className="px-4 md:px-6 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm">
                {/* 결과 수 */}
                <span className="text-slate-700 font-medium">
                  {isSearchLoading ? "검색 중..." : <><span className="font-bold text-slate-900">{products.length}</span>건</>}
                </span>
                {activeFilterCount > 0 && (
                  <span className="text-slate-400 text-xs">필터 {activeFilterCount}개</span>
                )}
                {/* 비교/견적 후보 + 다음 행동 */}
                {(compareIds.length > 0 || quoteItems.length > 0) && (
                  <span className="text-slate-300 hidden sm:inline">|</span>
                )}
                {compareIds.length > 0 && (
                  <span className="text-blue-600 font-semibold text-sm hidden sm:inline">비교 후보 {compareIds.length}</span>
                )}
                {quoteItems.length > 0 && (
                  <span className="text-emerald-600 font-semibold text-sm hidden sm:inline">견적 후보 {quoteItems.length}</span>
                )}
                <span className="text-slate-400 text-xs hidden md:inline">
                  {(() => {
                    if (compareIds.length === 0 && quoteItems.length === 0) return "선택된 후보가 없습니다";
                    if (compareIds.length === 1 && quoteItems.length === 0) return "비교 시작 전 후보를 1개 더 선택하세요";
                    if (compareIds.length >= 2 && quoteItems.length === 0) return "동일 규격 비교가 가능합니다";
                    if (compareIds.length === 0 && quoteItems.length > 0) return "요청서 생성으로 이어갈 수 있습니다";
                    if (compareIds.length >= 1 && quoteItems.length >= 1) return "비교 후 요청 전환이 적절합니다";
                    return "";
                  })()}
                </span>
              </div>
              {/* 필터 / 재고 — 흰 배경 오른쪽 */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* §11.258b — 정렬 select (server 지원 4 옵션, "이름순" 은 §11.258d 백로그).
                    setSortBy → test-flow-provider state → useQuery key 안 sortBy →
                    server fetch 재요청 (정합 line 174). */}
                <label className="inline-flex items-center gap-1.5">
                  <span className="sr-only">정렬 기준</span>
                  {/* §11.268b — 정렬 select 에 min-h-[44px] 추가 (§11.266 family
                      44px 일관성). text-xs / px-2.5 py-1.5 / rounded-md / outline /
                      tone 보존. setSortBy onChange + 4 option 보존. */}
                  <select
                    data-testid="sourcing-sort-select"
                    aria-label="정렬 기준"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="text-xs font-medium min-h-[44px] px-2.5 py-1.5 rounded-md text-slate-700 hover:bg-slate-100 border border-slate-200 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="relevance">AI 추천순</option>
                    <option value="price_low">가격 낮은순</option>
                    <option value="price_high">가격 높은순</option>
                    <option value="lead_time">배송기간순</option>
                    {/* §11.258d-1 — "이름순" (server line 119 a.name.localeCompare(b.name)). */}
                    <option value="name">이름순</option>
                  </select>
                </label>
                {/* §11.265c — Operating Status Bar 필터 버튼 모바일 표시 (호영님 spec
                    "검색바 바로 아래 1줄"). 기존 hidden md:inline-flex → inline-flex.
                    데스크탑은 그대로, 모바일에도 inline 노출. activeFilterCount badge
                    보존 (필터 적용 시 파란 배지). SearchUtilityBar 필터 entry 와의
                    중복 정합은 §11.265d 백로그. */}
                {/* §11.266a — sourcing 필터 button 44x44 touch target
                    (§11.266 P1 cluster, §11.264h family cross-cutting concern
                    확장). text-xs 뒤 min-h-[44px] 추가 → Apple HIG / Material
                    / WCAG 2.1 SC 2.5.5 표준 정합. text-xs / px-3 py-1.5 /
                    rounded-md / border / tone / hover state 보존. §11.265c
                    모바일 inline-flex (hidden md:inline-flex 미적용) 보존. */}
                <Sheet>
                  <SheetTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 text-xs font-medium min-h-[44px] px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      필터
                      {activeFilterCount > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] text-white font-medium">{activeFilterCount}</span>
                      )}
                    </button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[280px] p-4">
                    <SearchPanel />
                  </SheetContent>
                </Sheet>
                {/* §11.265c — AI 분석 트리거 버튼 (호영님 spec 1줄 row 4번째 요소).
                    §11.265b-2 의 aiAnalysisSheetOpen state 활성 → bottom sheet 진입.
                    모바일에서 §11.265b-1 hidden 된 인라인 AI 제안 + TRIAGE 의
                    access path 복원. 데스크탑은 inline TRIAGE 가 정상 표시되지만
                    동일 트리거 노출 (UX 일관성) — 데스크탑 사용자도 sheet 진입 가능. */}
                <button
                  type="button"
                  data-testid="sourcing-ai-analysis-trigger"
                  aria-label="AI 분석 열기"
                  onClick={() => setAiAnalysisSheetOpen(true)}
                  /* §11.266e + §11.268b — sourcing AI 분석 button. min-h-[44px]
                      (§11.266 family 44px) 보존. violet → slate outline (호영님
                      §11.268b spec "파란색 강조 제거") — 필터 button (§11.266a)
                      과 동일 outline. Sparkles / 라벨 / setAiAnalysisSheetOpen
                      onClick 보존. */
                  className="inline-flex items-center gap-1.5 text-xs font-medium min-h-[44px] px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  AI 분석
                </button>
                {!!session?.user && hasSearched && searchQuery && (
                  <Link href={`/dashboard/inventory?q=${encodeURIComponent(searchQuery)}`}>
                    {/* §11.266e — 재고 button (데스크탑 한정) 44x44 sibling consistency. */}
                    <button className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium min-h-[44px] px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors">
                      <Package className="h-3.5 w-3.5" />
                      재고
                    </button>
                  </Link>
                )}
              </div>
            </div>

            {/* §11.294b — 모바일 unified row dead chip cleanup. §11.265a 가
                인라인 필터 칩 row 를 `hidden` 으로 전환한 이후 (~140px 절약 +
                SearchUtilityBar 필터 button → isMobileFilterOpen Sheet → SearchPanel
                풀 필터 모바일 entry 로 wiring), 본 1 row 의 chip JSX (~148 line)
                는 dead reference 상태 유지. 모바일 시트 옵션 2 (호영님 spec
                §11.294 2단계) 가 이미 §11.265a 에서 완전 구현 — 추가 작업 0.
                dead chip JSX 통째 제거 (회귀 0, visible UI 영향 0). */}

            {/* §11.294 데스크탑 필터 1 row + 3 dropdown — 호영님 P2 spec
                1단계 (2026-05-24). 기존 §11.258b/d-1/d-2 의 3 row (~156 line)
                를 1 row + 3 plain dropdown 으로 단순화. "전체" 라벨 제거 (미선택
                = dropdown 기본 label). 선택 시만 파란색 + ✕ 해제 button.
                §11.283b plain button + useState pattern (Radix 의존성 0).
                모바일 §11.263b unified row 그대로 유지 (호영님 spec 2단계 별도). */}
            <div className="hidden md:flex px-4 md:px-6 py-2 border-b border-slate-100 bg-white items-center gap-2">
              {/* 카테고리 dropdown */}
              <div className="relative">
                <button
                  type="button"
                  data-testid="sourcing-category-dropdown"
                  onClick={() => setFilterDropdownOpen((p) => p === "category" ? null : "category")}
                  aria-expanded={filterDropdownOpen === "category"}
                  aria-haspopup="menu"
                  className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    searchCategory
                      ? "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <span>{searchCategory ? (PRODUCT_CATEGORIES as Record<string, string>)[searchCategory] ?? "카테고리" : "카테고리"}</span>
                  {searchCategory ? (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="카테고리 필터 해제"
                      onClick={(e) => { e.stopPropagation(); setSearchCategory(""); }}
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                {filterDropdownOpen === "category" && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setFilterDropdownOpen(null)} aria-hidden="true" />
                    <div role="menu" className="absolute left-0 top-full mt-1 w-44 rounded-md border border-slate-200 bg-white shadow-lg z-50 py-1">
                      {(["REAGENT", "TOOL", "EQUIPMENT"] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          role="menuitem"
                          onClick={() => { setSearchCategory(cat); setFilterDropdownOpen(null); }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-100 ${searchCategory === cat ? "text-blue-700 font-semibold" : "text-slate-700"}`}
                        >
                          {PRODUCT_CATEGORIES[cat]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* 가격대 dropdown */}
              <div className="relative">
                {(() => {
                  const priceLabel =
                    minPrice === undefined && maxPrice === 50000 ? "~5만" :
                    minPrice === 50000 && maxPrice === 200000 ? "5~20만" :
                    minPrice === 200000 && maxPrice === undefined ? "20만~" : null;
                  const isPriceActive = priceLabel !== null;
                  return (
                    <>
                      <button
                        type="button"
                        data-testid="sourcing-price-dropdown"
                        onClick={() => setFilterDropdownOpen((p) => p === "price" ? null : "price")}
                        aria-expanded={filterDropdownOpen === "price"}
                        aria-haspopup="menu"
                        className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          isPriceActive
                            ? "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <span>{isPriceActive ? priceLabel : "가격대"}</span>
                        {isPriceActive ? (
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label="가격대 필터 해제"
                            onClick={(e) => { e.stopPropagation(); setMinPrice(undefined); setMaxPrice(undefined); }}
                            className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </span>
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {filterDropdownOpen === "price" && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setFilterDropdownOpen(null)} aria-hidden="true" />
                          <div role="menu" className="absolute left-0 top-full mt-1 w-32 rounded-md border border-slate-200 bg-white shadow-lg z-50 py-1">
                            {([
                              { label: "~5만", min: undefined, max: 50000 },
                              { label: "5~20만", min: 50000, max: 200000 },
                              { label: "20만~", min: 200000, max: undefined },
                            ] as const).map((opt) => (
                              <button
                                key={opt.label}
                                type="button"
                                role="menuitem"
                                onClick={() => { setMinPrice(opt.min); setMaxPrice(opt.max); setFilterDropdownOpen(null); }}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-100 ${priceLabel === opt.label ? "text-blue-700 font-semibold" : "text-slate-700"}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* 제조사 dropdown — vendorFacets > 0 시만 노출 */}
              {vendorFacets.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    data-testid="sourcing-vendor-dropdown"
                    onClick={() => setFilterDropdownOpen((p) => p === "vendor" ? null : "vendor")}
                    aria-expanded={filterDropdownOpen === "vendor"}
                    aria-haspopup="menu"
                    className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      searchBrand
                        ? "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <span className="truncate max-w-[140px]">{searchBrand || "제조사"}</span>
                    {searchBrand ? (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="제조사 필터 해제"
                        onClick={(e) => { e.stopPropagation(); setSearchBrand(""); }}
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {filterDropdownOpen === "vendor" && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setFilterDropdownOpen(null)} aria-hidden="true" />
                      <div role="menu" className="absolute left-0 top-full mt-1 w-60 max-h-80 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg z-50 py-1">
                        {vendorFacets.slice(0, 20).map((v) => (
                          <button
                            key={v.vendorId}
                            type="button"
                            role="menuitem"
                            onClick={() => { setSearchBrand(v.vendorName); setFilterDropdownOpen(null); }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-100 flex items-center justify-between gap-2 ${searchBrand === v.vendorName ? "text-blue-700 font-semibold" : "text-slate-700"}`}
                          >
                            <span className="truncate">{v.vendorName}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">{v.count}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ═══ P1 AI 제안 fallback (sourcing strip이 안 보일 때) ═══
                §11.265b-1 — 모바일 hidden (호영님 spec "AI 분석은 AI 분석 영역").
                  §11.265c 의 1줄 요약 row 안 "AI 분석" 버튼이 §11.265b-2 의
                  AiAnalysisBottomSheet 트리거 — 본 inline 은 데스크탑 한정. */}
            {!shouldShowSourcingStrip && aiShouldShow && (
              <div className="hidden md:block px-4 pt-1.5">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-blue-200 bg-blue-50">
                  <span className="text-[10px] font-semibold text-blue-600 shrink-0">AI 제안</span>
                  <span className="text-[10px] text-slate-600 flex-1 truncate">{aiSearchSummary[0]?.text}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {aiSearchSummary.some(l => l.signal === "compare") && compareIds.length === 0 && (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-blue-600 hover:bg-blue-50 border border-blue-200"
                        onClick={() => handleProtectedAction(() => {
                          products.filter((p: any) => p.vendors?.[0]?.priceInKRW > 0 && !compareIds.includes(p.id)).slice(0, 3)
                            .forEach((p: any) => toggleCompare(p.id, { name: p.name, brand: p.brand }));
                        })}>비교 후보 담기</Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-slate-500 hover:text-slate-600"
                      onClick={() => setAiDismissedHash(aiContextHash)}><X className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
            )}

            {/* §11.292 SOURCING RESULT TRIAGE 블록 제거 (호영님 P1 1단계) —
                검색이 이미 필터 역할 + 모든 카드가 동일 분류 = 정보가치 0 +
                Shortlist/Hold/Exclude 는 불필요 중간 단계. AI 동등 대체품 /
                대체 후보 분석은 비교 단계 (2단계 별도 batch) 로 이동. dead
                state (sourcingCandidateTriage / openSourcingTriageReview /
                openSourcingTriageRequest) 는 P2 cleanup batch 에서 제거. */}

            {/* Result rows */}
            <div className="px-3 py-2 space-y-0.5">
              {isSearchLoading ? (
                <div className="space-y-0.5">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="rounded-lg border border-transparent bg-white p-3 animate-stagger-up" style={{ animationDelay: `${i * 60}ms` }}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 shrink-0 rounded border border-slate-200 bg-slate-100 animate-pulse" />
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="h-4 bg-slate-100 rounded w-3/5 animate-pulse" />
                          <div className="h-3 bg-slate-50 rounded w-4/5 animate-pulse" />
                          <div className="flex gap-1.5">
                            <div className="h-5 bg-slate-50 rounded-full w-20 animate-pulse" />
                            <div className="h-5 bg-slate-50 rounded-full w-16 animate-pulse" />
                          </div>
                        </div>
                        <div className="shrink-0 hidden md:flex flex-col items-end gap-1">
                          <div className="h-4 bg-slate-100 rounded w-20 animate-pulse" />
                          <div className="h-3 bg-slate-50 rounded w-12 animate-pulse" />
                        </div>
                        <div className="shrink-0 hidden sm:flex items-center gap-1.5">
                          <div className="h-7 bg-slate-50 rounded-md w-16 animate-pulse" />
                          <div className="h-7 bg-slate-50 rounded-md w-16 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : products.length > 0 ? (
                products.map((product: any, idx: number) => (
                  <div
                    key={product.id}
                    className="animate-stagger-up"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <SourcingResultRow
                      product={product}
                      query={searchQuery}
                      isInCompare={compareIds.includes(product.id)}
                      isInRequest={quoteItems.some((q: any) => q.productId === product.id)}
                      isSelected={railProduct?.id === product.id}
                      compareSessionCount={compareStatuses[product.id]?.activeCount}
                      onToggleCompare={() => handleProtectedAction(() => toggleCompare(product.id, { name: product.name, brand: product.brand }))}
                      onToggleRequest={() => handleProtectedAction(() => {
                        const existing = quoteItems.find((q: any) => q.productId === product.id);
                        if (existing) {
                          removeQuoteItem(existing.id);
                          toast.info("견적함에서 제거되었습니다.");
                        } else {
                          // #P02-e2e-blocker fix: result-driven toast.
                          // Vendor-pending now creates a real candidacy
                          // row instead of silently failing with a fake
                          // success toast.
                          const r = addProductToQuote(product);
                          const t = resolveAddToQuoteToast(r);
                          toast[t.intent](t.message);
                        }
                      })}
                      onSelect={() => setActiveResultId(product.id)}
                    />
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center text-center py-16">
                  <Package className="h-7 w-7 text-slate-500 mb-2" strokeWidth={1.5} />
                  <p className="text-sm text-slate-600 mb-1">검색 결과가 없습니다</p>
                  <p className="text-xs text-slate-500">다른 키워드로 검색해보세요</p>
                </div>
              )}
            </div>
          </div>

          {/* C. Right Context Rail — persistent panel */}
          <div className="hidden lg:flex w-[360px] shrink-0 border-l border-slate-200 bg-white flex-col overflow-hidden">
            {/* §11.339 v2 2단계 — 탭 위 "비교 검토 활성" strip 제거(2-3). 비교는 비교함 탭 + 하단 바로 일원화. */}

            {/* §11.339 v2 — 우측 패널 탭 카트(견적함/비교함/상세). 하단 드로어 2종 흡수.
                상세 탭 = SourcingContextRail(§11.337 Part C 통합) slot 주입. */}
            <QuoteCartPanel
              quoteItems={(quoteItems as any[]).map((q) => ({
                id: q.id,
                productId: q.productId,
                productName: q.productName ?? products.find((p: any) => p.id === q.productId)?.name,
                vendorName: q.vendorName ?? products.find((p: any) => p.id === q.productId)?.brand,
                category: products.find((p: any) => p.id === q.productId)?.category,
                unitPrice: q.unitPrice,
                quantity: q.quantity ?? 1,
                unit: q.unit ?? products.find((p: any) => p.id === q.productId)?.unit ?? null,
              }))}
              compareItems={compareIds.map((id: string) => {
                const p = products.find((pp: any) => pp.id === id);
                // §11.339 v2 2-4 — 현재 검색결과에 없는 비교 항목은 compareStore 저장명 fallback.
                //   "제품" placeholder 버그 수정(다른 검색에서 담은 항목 품명 보존).
                const storedName = getStoredName(id);
                return {
                  id,
                  name: p?.name || storedName || "제품",
                  brand: p?.brand,
                  category: p?.category,
                };
              })}
              unpricedCount={priceUnknownCount}
              reviewFlags={requestReadiness.candidates
                .map((c) => {
                  const nonPriceReview = c.flags.find(
                    (f) => f.type === "review_required" && f.label !== "가격 미확인",
                  );
                  return nonPriceReview
                    ? { itemId: c.itemId, detail: nonPriceReview.detail, resolvable: false }
                    : null;
                })
                .filter((f): f is { itemId: string; detail: string; resolvable: boolean } => f !== null)}
              forceDetailKey={activeResultId}
              forceQuoteKey={(reviewFocusKey + quoteFocusKey) ? String(reviewFocusKey + quoteFocusKey) : null}
              forceCompareKey={compareFocusKey ? String(compareFocusKey) : null}
              detailSlot={railProduct ? (
                <SourcingContextRail
                  product={railProduct}
                  isInCompare={compareIds.includes(railProduct.id)}
                  isInRequest={quoteItems.some((q: any) => q.productId === railProduct.id)}
                  onToggleCompare={() => handleProtectedAction(() => toggleCompare(railProduct.id, { name: railProduct.name, brand: railProduct.brand }))}
                  onToggleRequest={() => handleProtectedAction(() => {
                    const existing = quoteItems.find((q: any) => q.productId === railProduct.id);
                    if (existing) {
                      removeQuoteItem(existing.id);
                      toast.info("견적함에서 제거되었습니다.");
                    } else {
                      const r = addProductToQuote(railProduct);
                      const t = resolveAddToQuoteToast(r);
                      toast[t.intent](t.message);
                    }
                  })}
                  onClose={() => setActiveResultId(null)}
                  onOpenCompareWindow={() => handleProtectedAction(() => setWorkWindowMode("compare"))}
                  onOpenRequestWindow={() => handleProtectedAction(() => setWorkWindowMode("request"))}
                  compareCount={compareIds.length}
                  requestCount={quoteItems.length}
                  searchQuery={searchQuery}
                />
              ) : null}
              onQuantityChange={(id, quantity) => updateQuoteItem(id, { quantity })}
              onRemoveQuoteItem={(id) => removeQuoteItem(id)}
              onRemoveCompareItem={(id) => toggleCompare(id)}
              compareReadiness={aiCompareReadiness}
              onCompareReview={() => handleProtectedAction(() => setComparisonModalOpen(true))}
              onResolveReview={(id) => {
                const item = quoteItems.find((q: any) => q.id === id);
                if (item && compareIds.includes(item.productId)) toggleCompare(item.productId);
              }}
              onKeepReview={(id) => {
                const item = quoteItems.find((q: any) => q.id === id);
                if (item && compareIds.includes(item.productId)) toggleCompare(item.productId);
              }}
              onQuoteRequest={() => handleProtectedAction(() => {
                if (requestHandoff) {
                  setWorkWindowMode("request-assembly");
                } else {
                  setRequestWizardOpen(true);
                }
              })}
            />
          </div>
        </div>
        ) : (
        /* ═══ Stage Shell — request/quote/post-quote 단계 배경 ═══ */
        <div className="flex-1 overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#333B48' }}>
          <div className="max-w-lg w-full px-6">
            {/* Stage header */}
            <div className="text-center mb-6">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3 border ${stageOwner === "request" ? "bg-emerald-600/10 border-emerald-500/20" : stageOwner === "quote" ? "bg-blue-50 border-blue-200" : "bg-yellow-600/10 border-yellow-500/20"}`}>
                {stageOwner === "request" ? <FileText className="h-5 w-5 text-emerald-600" /> : stageOwner === "quote" ? <Package className="h-5 w-5 text-blue-600" /> : <Package className="h-5 w-5 text-yellow-400" />}
              </div>
              <p className="text-sm font-bold text-slate-100 mb-1">
                {stageOwner === "request" ? "견적 요청 단계" : stageOwner === "quote" ? "견적 관리 단계" : "구매 실행 단계"}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {stageOwner === "request" ? "소싱 비교 결과를 기반으로 견적 요청서를 조립·제출합니다." : stageOwner === "quote" ? "제출된 견적을 공급사별로 정리·비교·검토합니다." : "승인된 견적을 PO로 전환하고 발주를 실행합니다."}
              </p>
            </div>

            {/* Handoff context — 이전 선택 맥락 */}
            {(quoteItems.length > 0 || compareIds.length > 0 || searchQuery) && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 mb-4 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">이전 선택 맥락</p>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                  {searchQuery && (
                    <span className="text-slate-600">검색: <span className="font-medium text-slate-800">{searchQuery}</span></span>
                  )}
                  {compareIds.length > 0 && (
                    <span className="text-blue-600">비교 후보 <span className="font-semibold">{compareIds.length}건</span></span>
                  )}
                  {quoteItems.length > 0 && (
                    <span className="text-emerald-600">견적 후보 <span className="font-semibold">{quoteItems.length}건</span></span>
                  )}
                </div>
                {quoteItems.length > 0 && (
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {quoteItems.slice(0, 3).map((q: any) => q.name || q.productName || "품목").join(", ")}
                    {quoteItems.length > 3 && ` 외 ${quoteItems.length - 3}개`}
                  </div>
                )}
              </div>
            )}

            {/* Next action */}
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">다음 액션</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                {stageOwner === "request"
                  ? "워크벤치 상단의 작업 창에서 요청서 조립 · 검토 · 제출을 진행하세요."
                  : stageOwner === "quote"
                  ? "워크벤치 상단의 작업 창에서 견적 정리 · 비교 검토를 진행하세요."
                  : "워크벤치 상단의 작업 창에서 PO 전환 · 발주를 진행하세요."}
              </p>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setWorkWindowMode(null)}
                className="text-xs text-blue-600 hover:text-blue-600 transition-colors"
              >
                소싱 검색으로 돌아가기
              </button>
            </div>
          </div>
        </div>
        )
      ) : (
        /* ═══ Search Entry Surface — 비로그인 or 검색 전 ═══ */
        <div className="flex-1 overflow-hidden flex">
          {/* Center: search entry */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-lg px-6">
              <div className="w-14 h-14 rounded-xl bg-el border border-slate-200 flex items-center justify-center mx-auto mb-5">
                <Search className="h-7 w-7 text-blue-600" />
              </div>
              {/* §11.252e #2 — 빈 화면 설명 텍스트 모바일 어절 분리 어색 fix.
                  짧은 문장 swap + break-keep 으로 어절 단위 줄바꿈 보장. */}
              <h2 className="text-lg font-bold text-slate-900 mb-2 break-keep">시약·장비를 검색하세요</h2>
              <p className="text-sm text-slate-600 mb-2 leading-relaxed break-keep">시약명·CAS·제조사·카탈로그 번호로 500만+ 품목 검색</p>
              <p className="text-xs text-slate-500 mb-6 break-keep">검색 → 비교 → 견적 → 재고까지 한 흐름으로 연결됩니다</p>

              {/* §11.252e #3 — card-position: 품목 등록 / 재고 확인 / 비교 목록 카드를
                  검색 입력 직하단 (샘플 칩 위) 로 이동. 호영님 spec "검색 전에 먼저 노출".
                  로그인 사용자만 노출 — 비로그인은 하단 fallback 버튼 유지. */}
              {session?.user && (
                <div className="grid grid-cols-3 gap-2 max-w-md mx-auto mb-6">
                  <Link
                    href="/protocol/bom"
                    className="min-h-[44px] inline-flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg border border-slate-200 bg-el/50 text-xs text-slate-600 hover:bg-st hover:text-slate-900 hover:border-slate-300 transition-colors"
                    aria-label="품목 등록 페이지로 이동"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-600/70" />
                    <span className="text-[11px] font-medium break-keep">품목 등록</span>
                  </Link>
                  <Link
                    href="/dashboard/inventory"
                    className="min-h-[44px] inline-flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg border border-slate-200 bg-el/50 text-xs text-slate-600 hover:bg-st hover:text-slate-900 hover:border-slate-300 transition-colors"
                    aria-label="재고 확인 페이지로 이동"
                  >
                    <Package className="h-3.5 w-3.5 text-blue-600/70" />
                    <span className="text-[11px] font-medium break-keep">재고 확인</span>
                  </Link>
                  <Link
                    href="/app/compare"
                    className="min-h-[44px] inline-flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg border border-slate-200 bg-el/50 text-xs text-slate-600 hover:bg-st hover:text-slate-900 hover:border-slate-300 transition-colors"
                    aria-label="비교 목록 페이지로 이동"
                  >
                    <PenLine className="h-3.5 w-3.5 text-blue-600/70" />
                    <span className="text-[11px] font-medium break-keep">비교 목록</span>
                  </Link>
                </div>
              )}

              {/* 예시 검색어 chip */}
              <div className="flex items-center gap-1.5 flex-wrap justify-center mb-6">
                {["Trypsin", "FBS", "DMEM", "Tris-HCl", "67-66-3"].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setSearchQuery(term);
                      if (session?.user) {
                        runSearch();
                      } else {
                        try { sessionStorage.setItem("labaxis-pending-search", term); } catch {}
                        setIsLoginPromptOpen(true);
                      }
                    }}
                    className="text-xs px-2.5 py-1 rounded-md bg-el border border-slate-200 text-slate-400 hover:bg-st hover:text-slate-600 transition-all cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>

              {/* 검색 가능한 키 설명 */}
              <div className="mb-6 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">검색 가능한 키</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {["시약명", "CAS No.", "제조사", "카탈로그 번호", "규격"].map((key) => (
                    <span key={key} className="text-[11px] px-2 py-0.5 rounded bg-el border border-slate-200 text-slate-400">{key}</span>
                  ))}
                </div>
              </div>

              {/* 로그인 후 가능한 작업 — 비로그인만 표시 */}
              {!session?.user && (
                <div className="mb-6">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">로그인 후 가능한 작업</p>
                  <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                    {[
                      { icon: PenLine, label: "비교", desc: "후보 나란히 비교" },
                      { icon: FileText, label: "견적 요청", desc: "요청서 생성·전송" },
                      { icon: Package, label: "재고 연결", desc: "입고·Lot 추적" },
                      { icon: Search, label: "운영 이력", desc: "검색·구매 이력 관리" },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="flex items-start gap-2 px-3 py-2 rounded-md bg-el/50 border border-slate-200 text-left">
                          <Icon className="h-3.5 w-3.5 text-blue-600/70 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[11px] font-medium text-slate-600">{item.label}</p>
                            <p className="text-[10px] text-slate-500">{item.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* §11.252e #3 — 기존 하단 카드 제거 (검색 입력 직하단으로 이동, line ~825).
                  비로그인 사용자만 fallback 버튼 노출. */}
              {!session?.user && (
                <Button
                  className="h-9 px-6 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
                  onClick={() => setIsLoginPromptOpen(true)}
                >
                  로그인하고 검색 시작하기
                </Button>
              )}
            </div>
          </div>

          {/* Right guide rail — 비로그인 안내 */}
          {!session?.user && (
            <div className="hidden lg:flex w-[360px] shrink-0 border-l border-slate-200 bg-white flex-col items-center justify-center text-center px-6">
              <div className="w-12 h-12 rounded-xl bg-el border border-slate-200 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-blue-600/60" />
              </div>
              <p className="text-sm font-semibold text-slate-800 mb-1.5">로그인 후 검색 결과를 확인하세요</p>
              <p className="text-xs text-slate-400 leading-relaxed mb-5">
                제품 비교, 견적 요청, 요청서 작성,<br />운영 이력 관리는 로그인 후 사용할 수 있습니다.
              </p>
              <Button
                size="sm"
                className="h-8 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
                onClick={() => setIsLoginPromptOpen(true)}
              >
                로그인하고 검색 계속하기
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ═══ D. Sticky Action Dock — sourcing stage only ═══ */}
      {/* §11.252f — 액션 바 2행 분리 (compareIds.length > 0 / quoteItems.length > 0).
          §11.268c — divider opacity 강화 (border-white/20).
          §11.312 (호영님 P1 2026-05-26):
            - bar 의 "비교 N" / "견적 N" / "⚠ 검토 N" 영역 탭 → SourcingCandidatesSheet
              (각 항목 ✕ 개별 삭제 + dead button 해소)
            - amber → yellow (§11.302 색상 체계)
            - 🗑 휴지통 button 제거 (sheet 내 "전체 삭제" 통합)
            - 첫 항목명 미리보기 텍스트 (공간 허용 시) */}
      {showSourcingActionDock && (
        <div className="border-t border-white/10 shrink-0" style={{ backgroundColor: '#0f172a' }}>
          {/* §11.252f 1행 — 비교 (compareIds.length > 0 일 때만 노출) */}
          {compareIds.length > 0 && (
            <div className="px-4 min-h-[44px] flex items-center gap-2 sm:gap-3 border-b border-white/20">
              {/* §11.312 — 비교 N 영역 탭 → sheet (개별 삭제 + 미리보기) */}
              <button
                type="button"
                data-testid="sourcing-bar-compare-open"
                aria-label="비교 후보 목록 열기"
                onClick={() => setCompareFocusKey((k) => k + 1)} /* §11.339 v2 5 — 드로어 대신 비교함 탭 */
                className="flex items-center gap-2 shrink-0 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <PenLine className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-sm font-semibold text-slate-100 shrink-0">비교</span>
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs bg-blue-600 text-white shrink-0">{compareIds.length}</Badge>
                {/* §11.312 — 첫 항목명 미리보기 (모바일 truncate) */}
                <span className="hidden sm:inline text-xs text-slate-300 truncate max-w-[140px]">
                  {(() => {
                    const first = products.find((p: any) => p.id === compareIds[0]);
                    return first?.name ? first.name : null;
                  })()}
                </span>
              </button>
              {!compareReady && (
                <span className="inline-flex items-center gap-1 text-xs text-yellow-500 whitespace-nowrap">
                  <AlertTriangle className="h-3 w-3 shrink-0" />2개 이상 필요
                </span>
              )}
              <div className="ml-auto flex items-center gap-2 shrink-0">
                {compareReady && (
                  <Button size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium" onClick={() => handleProtectedAction(() => setComparisonModalOpen(true))}>
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    비교 검토
                  </Button>
                )}
                {/* §11.312 — 🗑 휴지통 button 제거: sheet 내 "전체 삭제" 통합 */}
              </div>
            </div>
          )}

          {/* §11.252f 2행 — 견적 (quoteItems.length > 0 일 때만 노출) */}
          {quoteItems.length > 0 && (
            <div className="px-4 min-h-[44px] flex items-center gap-2 sm:gap-3">
              {/* §11.312 — 견적 N 영역 탭 → sheet (개별 삭제 + 미리보기) */}
              <button
                type="button"
                data-testid="sourcing-bar-quote-open"
                aria-label="견적 후보 목록 열기"
                onClick={() => setQuoteFocusKey((k) => k + 1)} /* §11.339 v2 5 — 드로어 대신 견적함 탭 */
                className="flex items-center gap-2 shrink-0 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <FileText className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-sm font-semibold text-slate-100 shrink-0">견적</span>
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs bg-emerald-600 text-white shrink-0">{quoteItems.length}</Badge>
                {/* §11.312 — 첫 항목명 미리보기 (모바일 truncate) */}
                <span className="hidden sm:inline text-xs text-slate-300 truncate max-w-[140px]">
                  {(() => {
                    const first = quoteItems[0] as any;
                    const product = products.find((p: any) => p.id === first?.productId);
                    return product?.name ?? first?.productName ?? null;
                  })()}
                </span>
              </button>
              {/* §11.339 v2 4 — 검토 필요는 견적함 탭 인라인(cart-review-inline)으로 일원화.
                  하단 노란 시트(review mode) 진입 제거. 배지는 건수 표시만(비클릭, 인라인이 실동작). */}
              {requestReadiness.summary.review > 0 && (
                <button
                  type="button"
                  data-testid="sourcing-bar-review-count"
                  aria-label="검토 필요 항목 보기 (견적함 탭)"
                  title="견적함 탭에서 검토 필요 항목 확인"
                  onClick={() => setReviewFocusKey((k) => k + 1)}
                  className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 shrink-0 hover:bg-yellow-200 transition-colors cursor-pointer"
                >
                  <AlertTriangle className="h-3 w-3 shrink-0" />검토 {requestReadiness.summary.review}
                </button>
              )}
              {requestReadiness.summary.blocked > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 shrink-0">
                  <AlertCircle className="h-3 w-3 shrink-0" />차단 {requestReadiness.summary.blocked}
                </span>
              )}
              <div className="ml-auto flex items-center gap-3 shrink-0">
                {/* §11.338 — 확정가 있으면 합계, 미견적 건수는 별도 표기. 전부 미견적이면 "견적 후 확정". */}
                <span className="text-xs text-slate-300 tabular-nums font-medium shrink-0 whitespace-nowrap" data-testid="quote-bar-total">
                  {hasConfirmedPrice ? `₩${totalAmount.toLocaleString("ko-KR")}` : "견적 후 확정"}
                  {priceUnknownCount > 0 && (
                    <span className="ml-1 text-[10px] text-slate-400">· {priceUnknownCount}건 가격 미정</span>
                  )}
                </span>
                {/* §11.312-b — 전체 해제 🗑 = 견적 금액과 primary CTA 사이, outline + AlertDialog 확인 다이얼로그
                    (호영님 spec 5번: 옛 "전체 해제 별도 줄 우측 끝" 제거 + bar 본체 통합). */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="sourcing-bar-clear-all-trigger"
                      aria-label="견적 후보 전체 해제"
                      className="h-8 w-8 p-0 shrink-0 border-slate-200/40 bg-slate-700/40 text-slate-300 hover:bg-slate-600/60 hover:text-slate-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>견적 후보를 모두 해제할까요?</AlertDialogTitle>
                      <AlertDialogDescription>
                        견적 후보 {quoteItems.length}건{compareIds.length > 0 ? ` · 비교 후보 ${compareIds.length}건` : ""}이 모두 해제됩니다. 개별 항목 삭제는 "견적" 또는 "비교" 영역을 탭하여 시트에서 가능합니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => { clearCompare(); quoteItems.forEach((item: any) => removeQuoteItem(item.id)); }}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        모두 해제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                {requestHandoff ? (
                  <Button size="sm" className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shrink-0" onClick={() => handleProtectedAction(() => setWorkWindowMode("request-assembly"))}>
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden sm:inline">견적 요청 조립</span>
                    <span className="sm:hidden">요청 조립</span>
                  </Button>
                ) : (
                  <Button size="sm" className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shrink-0" onClick={() => handleProtectedAction(() => setRequestWizardOpen(true))}>
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden sm:inline">견적 요청서 만들기</span>
                    <span className="sm:hidden">견적 요청</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* §11.312-b — 옛 "전체 해제 별도 줄" 제거 (line 1565-1575). 견적 bar 본체 안 🗑 으로 통합. */}
        </div>
      )}

      {/* §11.312 — Sourcing Candidates Sheet (compare / quote / review 3 mode 통합) */}
      {/* §11.339 v2 5 — 하단 SourcingCandidatesSheet(견적/비교/검토 드로어) 제거. 우측 탭 카트로 일원화. */}

      {/* ═══ E. Center Work Window — Compare Review (difference-first decision surface) ═══ */}
      <CompareReviewWorkWindow
        open={workWindowMode === "compare-review" || workWindowMode === "compare"}
        onClose={() => setWorkWindowMode(null)}
        compareIds={compareIds}
        products={products}
        openedBy={workWindowMode === "compare-review" ? "ai_apply" : "manual"}
        aiOptionId={activeSourcingStrategy}
        aiOptions={sourcingOptions.map((opt) => ({
          id: opt.id,
          frame: opt.frame as "conservative" | "balanced" | "alternative",
          title: opt.title,
          rationale: opt.rationale,
          strengths: opt.strengths,
          risks: opt.risks,
          nextAction: opt.nextAction,
        }))}
        onShortlistApplied={(shortlistIds, requestCandidateIds) => {
          // Sync: shortlist가 compare truth에 반영
        }}
        onRequestHandoff={(handoff) => {
          setRequestHandoff(handoff);
          // 견적 후보 반영 → request assembly work window 열기
          setWorkWindowMode("request-assembly");
        }}
        onUndoDecision={() => {
          setRequestHandoff(null);
        }}
      />

      {/* ═══ E-1b. Center Work Window — Compare Review Center (판단 작업면) ═══ */}
      <CompareReviewCenterWorkWindow
        open={workWindowMode === "compare-review-center"}
        onClose={() => setWorkWindowMode(null)}
        compareId={`cmp_${Date.now().toString(36)}`}
        requestReference={searchQuery || ""}
        initialOptions={compareIds.map((id) => {
          const p = products.find((pp: any) => pp.id === id);
          const v = p?.vendors?.[0];
          return {
            optionId: id,
            supplier: v?.vendor?.name || p?.brand || "—",
            itemName: p?.name || "—",
            packSpec: p?.specification || p?.packSize || "—",
            leadTimeDays: v?.leadTimeDays || null,
            priceKRW: v?.priceInKRW || null,
            availability: "unknown" as const,
            riskFlags: [],
            reviewStatus: "pending_review" as const,
            rationale: { selectionReasonCodes: [], selectionNote: "", exclusionReasonCodes: [], exclusionNote: "" },
          };
        })}
        isReopened={false}
        onReviewCompleted={(_state) => {}}
        onApprovalHandoff={() => {
          setWorkWindowMode("po-conversion");
        }}
        onFollowupRequest={(_ids) => {}}
      />

      {/* ═══ E-1c. Approval Handoff Gate ═══ */}
      <ApprovalHandoffGate
        open={workWindowMode === "approval-handoff-gate"}
        onClose={() => setWorkWindowMode(null)}
        compareReviewState={null}
        onReturnToReview={() => setWorkWindowMode("compare-review-center")}
        onHandoffConfirmed={(_pkg) => {
          // Approval Workbench로 이동
          setWorkWindowMode("po-conversion");
        }}
        onFixBlocker={(_id) => setWorkWindowMode("compare-review-center")}
      />

      {/* ═══ E-1d. Approval Workbench ═══ */}
      <ApprovalWorkbench
        open={workWindowMode === "approval-workbench"}
        onClose={() => setWorkWindowMode(null)}
        handoffPackage={null}
        onApproved={() => setWorkWindowMode("po-conversion")}
        onReturned={() => setWorkWindowMode("compare-review-center")}
        onRejected={() => setWorkWindowMode(null)}
      />

      {/* ═══ E-1e. PO Created Workbench V2 ═══ */}
      <PoCreatedWorkbenchV2
        open={workWindowMode === "po-created-wb-v2"}
        onClose={() => setWorkWindowMode(null)}
        poRecord={null}
        onDispatchPrepRouted={() => setWorkWindowMode("dispatch-prep")}
        onCorrectionRouted={(_target) => setWorkWindowMode("po-conversion")}
        onHoldSet={() => {}}
      />

      {/* ═══ E-2. Center Work Window — Request Assembly (견적 요청 조립) ═══ */}
      <RequestAssemblyWorkWindow
        open={workWindowMode === "request-assembly"}
        onClose={() => setWorkWindowMode(null)}
        handoff={requestHandoff}
        products={products}
        quoteItems={quoteItems}
        onDraftRecorded={(snapshot) => {
          setRequestDraftSnapshot(snapshot);
        }}
        onSubmissionReady={(_handoff) => {
          // Submission handoff 저장
        }}
        onGoToSubmission={() => {
          setWorkWindowMode("request-submission");
        }}
      />

      {/* ═══ E-3. Center Work Window — Request Submission (최종 검토 + 제출) ═══ */}
      <RequestSubmissionWorkWindow
        open={workWindowMode === "request-submission"}
        onClose={() => setWorkWindowMode(null)}
        draftSnapshot={requestDraftSnapshot}
        onSubmissionExecuted={(event) => {
          setSubmissionEvent(event);
        }}
        onQuoteWorkqueueOpen={(handoff) => {
          setQuoteWorkqueueHandoff(handoff);
          router.push(
            `/dashboard/quotes?from=rfq&requestId=${encodeURIComponent(handoff.requestSubmissionEventId)}&vendorCount=${handoff.submittedVendorTargetIds.length}&lineCount=${handoff.submittedLineIds.length}`,
          );
        }}
        onBackToAssembly={() => {
          setWorkWindowMode("request-assembly");
        }}
      />

      {/* ═══ E-4. Center Work Window — Quote Management Workqueue ═══ */}
      <QuoteManagementWorkqueue
        open={workWindowMode === "quote-queue"}
        onClose={() => setWorkWindowMode(null)}
        handoff={quoteWorkqueueHandoff}
        onNormalizationOpen={(vendorId) => {
          // Build normalization handoff from queue handoff
          if (quoteWorkqueueHandoff) {
            setNormalizationHandoff({
              quoteWorkqueueRowId: `qrow_${vendorId}`,
              requestSubmissionEventId: quoteWorkqueueHandoff.requestSubmissionEventId,
              vendorTargetId: vendorId,
              rawQuoteReference: null,
              expectedRequestLineCount: quoteWorkqueueHandoff.submittedLineIds.length,
              receivedQuoteLineCount: 0,
            });
            setWorkWindowMode("quote-normalization");
          }
        }}
        onCompareReviewOpen={() => {
          setWorkWindowMode("quote-compare");
        }}
        onFollowUpOpen={(_vendorId) => {
          // Future: open follow-up dialog
        }}
      />

      {/* ═══ E-5. Center Work Window — Quote Normalization ═══ */}
      <QuoteNormalizationWorkbench
        open={workWindowMode === "quote-normalization"}
        onClose={() => setWorkWindowMode(null)}
        handoff={normalizationHandoff}
        onNormalizationRecorded={(_normalizedQuote) => {
          // Update queue row state
        }}
        onCompareHandoffReady={() => {
          setWorkWindowMode("quote-queue");
        }}
        onBackToQueue={() => {
          setWorkWindowMode("quote-queue");
        }}
      />

      {/* ═══ E-6. Center Work Window — Quote Compare Review ═══ */}
      <QuoteCompareReviewWorkbench
        open={workWindowMode === "quote-compare"}
        onClose={() => setWorkWindowMode(null)}
        workqueueObjectId={quoteWorkqueueHandoff?.requestSubmissionEventId || ""}
        requestSubmissionEventId={quoteWorkqueueHandoff?.requestSubmissionEventId || ""}
        normalizedQuotes={[]}
        onDecisionRecorded={(_snapshot) => {
          // Store quote compare decision snapshot
        }}
        onApprovalHandoff={(handoff) => {
          setWorkWindowMode("po-conversion");
        }}
        onBackToQueue={() => {
          setWorkWindowMode("quote-queue");
        }}
      />

      {/* ═══ E-7. Center Work Window — PO Conversion Entry ═══ */}
      <PoConversionEntryWorkbench
        open={workWindowMode === "po-conversion"}
        onClose={() => setWorkWindowMode(null)}
        approvalHandoff={null}
        onDraftRecorded={(_draft) => {
          // Store PO conversion draft
        }}
        onPoCreatedHandoff={(_handoff) => {
          setWorkWindowMode("po-created");
        }}
        onSendBackToApproval={() => {
          setWorkWindowMode("quote-compare");
        }}
      />

      {/* ═══ E-8. Center Work Window — PO Created Detail ═══ */}
      <PoCreatedDetailWorkbench
        open={workWindowMode === "po-created"}
        onClose={() => setWorkWindowMode(null)}
        createdHandoff={null}
        conversionDraft={null}
        onCreatedRecorded={(_obj) => {
          // Store PO created object
        }}
        onDispatchPrepHandoff={(_handoff) => {
          setWorkWindowMode("dispatch-prep");
        }}
        onReturnToConversion={() => {
          setWorkWindowMode("po-conversion");
        }}
      />

      {/* ═══ E-9. Center Work Window — Dispatch Preparation ═══ */}
      <DispatchPreparationWorkbench
        open={workWindowMode === "dispatch-prep"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onPrepRecorded={(_obj) => {}}
        onSendConfirmationHandoff={(_h) => {
          setWorkWindowMode("send-confirm");
        }}
        onReturnToCreated={() => {
          setWorkWindowMode("po-created");
        }}
      />

      {/* ═══ E-10. Center Work Window — Send Confirmation ═══ */}
      <SendConfirmationWorkbench
        open={workWindowMode === "send-confirm"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onExecutionRecorded={(_event) => {}}
        onPoSentDetailHandoff={(_h) => {
          setWorkWindowMode("po-sent-tracking");
        }}
        onReturnToPreparation={() => {
          setWorkWindowMode("dispatch-prep");
        }}
      />

      {/* ═══ E-11. Center Work Window — PO Sent Tracking ═══ */}
      <PoSentTrackingWorkbench
        open={workWindowMode === "po-sent-tracking"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onAcknowledgmentRecorded={(_obj) => {}}
        onSupplierConfirmation={() => {
          setWorkWindowMode("supplier-confirm");
        }}
        onReturnToSendConfirmation={() => {
          setWorkWindowMode("send-confirm");
        }}
      />

      {/* ═══ E-12. Center Work Window — Supplier Confirmation ═══ */}
      <SupplierConfirmationWorkbench
        open={workWindowMode === "supplier-confirm"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onConfirmationRecorded={(_obj) => {}}
        onReceivingPrepHandoff={() => {
          setWorkWindowMode("receiving-prep");
        }}
        onReturnToSentTracking={() => {
          setWorkWindowMode("po-sent-tracking");
        }}
      />

      {/* ═══ E-13. Center Work Window — Receiving Preparation ═══ */}
      <ReceivingPreparationWorkbench
        open={workWindowMode === "receiving-prep"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onPrepRecorded={(_obj) => {}}
        onExecutionHandoff={() => {
          setWorkWindowMode("receiving-exec");
        }}
        onReturnToConfirmation={() => {
          setWorkWindowMode("supplier-confirm");
        }}
      />

      {/* ═══ E-14. Center Work Window — Receiving Execution ═══ */}
      <ReceivingExecutionWorkbench
        open={workWindowMode === "receiving-exec"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onExecutionRecorded={(_obj) => {}}
        onInventoryIntakeHandoff={() => {
          setWorkWindowMode("inventory-intake");
        }}
        onReturnToPreparation={() => {
          setWorkWindowMode("receiving-prep");
        }}
      />

      {/* ═══ E-15. Center Work Window — Inventory Intake ═══ */}
      <InventoryIntakeWorkbench
        open={workWindowMode === "inventory-intake"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onIntakeRecorded={(_obj) => {}}
        onStockReleaseHandoff={() => {
          setWorkWindowMode("stock-release");
        }}
        onReturnToExecution={() => {
          setWorkWindowMode("receiving-exec");
        }}
      />

      {/* ═══ E-16. Center Work Window — Stock Release ═══ */}
      <StockReleaseWorkbench
        open={workWindowMode === "stock-release"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onReleaseRecorded={(_obj) => {}}
        onReorderDecisionHandoff={() => {
          setWorkWindowMode("reorder-decision");
        }}
        onReturnToIntake={() => {
          setWorkWindowMode("inventory-intake");
        }}
      />

      {/* ═══ E-17. Center Work Window — Reorder Decision ═══ */}
      <ReorderDecisionWorkbench
        open={workWindowMode === "reorder-decision"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onDecisionRecorded={(_obj) => {}}
        onProcurementReentryHandoff={() => {
          setWorkWindowMode("procurement-reentry");
        }}
        onReturnToStockRelease={() => {
          setWorkWindowMode("stock-release");
        }}
      />

      {/* ═══ E-18. Center Work Window — Procurement Re-entry ═══ */}
      <ProcurementReentryWorkbench
        open={workWindowMode === "procurement-reentry"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onReentryRecorded={(_obj) => {}}
        onSourcingReopenHandoff={() => {
          setWorkWindowMode("search-reopen");
        }}
        onReturnToReorderDecision={() => {
          setWorkWindowMode("reorder-decision");
        }}
      />

      {/* ═══ E-19. Center Work Window — Sourcing Search Reopen ═══ */}
      <SourcingSearchReopenWorkbench
        open={workWindowMode === "search-reopen"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onReopenRecorded={(_obj) => {}}
        onSourcingResultHandoff={() => {
          setWorkWindowMode("result-review");
        }}
        onReturnToReentry={() => {
          setWorkWindowMode("procurement-reentry");
        }}
      />

      {/* ═══ E-20. Center Work Window — Sourcing Result Review ═══ */}
      <SourcingResultReviewWorkbench
        open={workWindowMode === "result-review"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onReviewRecorded={(obj) => {
          setResultReviewObject(obj);
          // Compare Reopen handoff 미리 생성
          const crHandoff = buildCompareReopenHandoff(obj);
          setCompareReopenHandoff(crHandoff);
        }}
        onCompareReopenHandoff={() => {
          setWorkWindowMode("compare-reopen");
        }}
        onRequestReopenHandoff={() => {
          // Result Review에서 request-direct 후보가 있을 때 Request Reopen으로 직행
          // (request-assembly 우회 분기 제거됨)
          setWorkWindowMode("request-reopen");
        }}
        onReturnToSearchReopen={() => {
          setWorkWindowMode("search-reopen");
        }}
      />

      {/* ═══ E-21. Center Work Window — Compare Reopen ═══ */}
      <CompareReopenWorkbench
        open={workWindowMode === "compare-reopen"}
        onClose={() => setWorkWindowMode(null)}
        handoff={compareReopenHandoff}
        onDecisionRecorded={(snapshot) => {
          setCompareReopenSnapshot(snapshot);
          // Compare → Request Reopen handoff 생성
          const rrHandoff = buildRequestReopenFromCompareHandoff(snapshot);
          setRequestReopenHandoff(rrHandoff);
        }}
        onRequestReopenHandoff={() => {
          setWorkWindowMode("request-reopen");
        }}
        onReturnToResultReview={() => {
          setWorkWindowMode("result-review");
        }}
      />

      {/* ═══ E-22. Center Work Window — Request Reopen ═══ */}
      <RequestReopenWorkbench
        open={workWindowMode === "request-reopen"}
        onClose={() => setWorkWindowMode(null)}
        handoff={requestReopenHandoff}
        onReopenRecorded={(obj) => {
          setRequestReopenObject(obj);
          // Request Reopen → Submission Reopen handoff 생성
          const srHandoff = buildRequestSubmissionReopenHandoff(obj);
          setRequestSubmissionReopenHandoff(srHandoff);
        }}
        onRequestSubmissionReopenHandoff={() => {
          setWorkWindowMode("submission-reopen");
        }}
        onReturnToCompareReopen={() => {
          setWorkWindowMode("compare-reopen");
        }}
      />

      {/* ═══ E-23. Center Work Window — Request Submission Reopen ═══ */}
      <RequestSubmissionReopenWorkbench
        open={workWindowMode === "submission-reopen"}
        onClose={() => setWorkWindowMode(null)}
        handoff={requestSubmissionReopenHandoff}
        onResubmissionRecorded={(event) => {
          setResubmissionEvent(event);
          // Submission Reopen → Quote Management Re-entry handoff 생성
          const qmHandoff = buildQuoteManagementReentryHandoff(event);
          setQuoteManagementReentryHandoff(qmHandoff);
        }}
        onQuoteManagementReentryHandoff={() => {
          setWorkWindowMode("quote-reentry");
        }}
        onReturnToRequestReopen={() => {
          setWorkWindowMode("request-reopen");
        }}
      />

      {/* ═══ E-24. Center Work Window — Quote Management Re-entry ═══ */}
      <QuoteManagementReentryWorkbench
        open={workWindowMode === "quote-reentry"}
        onClose={() => setWorkWindowMode(null)}
        handoff={quoteManagementReentryHandoff}
        onReentryRecorded={(_obj) => {}}
        onNormalizationReentryHandoff={() => {
          setWorkWindowMode("norm-reentry");
        }}
        onCompareReentryHandoff={() => {
          setWorkWindowMode("quote-compare");
        }}
        onReturnToSubmissionReopen={() => {
          setWorkWindowMode("submission-reopen");
        }}
      />

      {/* ═══ E-25. Center Work Window — Quote Normalization Re-entry ═══ */}
      <QuoteNormalizationReentryWorkbench
        open={workWindowMode === "norm-reentry"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onReentryRecorded={(_obj) => {}}
        onCompareReentryHandoff={() => {
          setWorkWindowMode("compare-reentry");
        }}
        onReturnToManagementReentry={() => {
          setWorkWindowMode("quote-reentry");
        }}
      />

      {/* ═══ E-26. Center Work Window — Quote Compare Re-entry ═══ */}
      <QuoteCompareReentryWorkbench
        open={workWindowMode === "compare-reentry"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onDecisionRecorded={(_snapshot) => {}}
        onApprovalReentryHandoff={() => {
          setWorkWindowMode("approval-reentry");
        }}
        onReturnToNormReentry={() => {
          setWorkWindowMode("norm-reentry");
        }}
      />

      {/* ═══ E-27. Center Work Window — Approval Re-entry ═══ */}
      <ApprovalReentryWorkbench
        open={workWindowMode === "approval-reentry"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onDecisionRecorded={(_obj) => {}}
        onPoConversionReentryHandoff={() => {
          setWorkWindowMode("po-conv-reentry");
        }}
        onReturnToCompareReentry={() => {
          setWorkWindowMode("compare-reentry");
        }}
      />

      {/* ═══ E-28. Center Work Window — PO Conversion Re-entry ═══ */}
      <PoConversionReentryWorkbench
        open={workWindowMode === "po-conv-reentry"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onDraftRecorded={(_obj) => {}}
        onPoCreatedReentryHandoff={() => {
          setWorkWindowMode("po-created-reentry");
        }}
        onReturnToApprovalReentry={() => {
          setWorkWindowMode("approval-reentry");
        }}
      />

      {/* ═══ E-29. Center Work Window — PO Created Re-entry ═══ */}
      <PoCreatedReentryWorkbench
        open={workWindowMode === "po-created-reentry"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onCreatedRecorded={(_obj) => {}}
        onDispatchPrepReentryHandoff={() => {
          setWorkWindowMode("dispatch-prep-reentry");
        }}
        onReturnToConversionReentry={() => {
          setWorkWindowMode("po-conv-reentry");
        }}
      />

      {/* ═══ E-30. Center Work Window — Dispatch Preparation Re-entry ═══ */}
      <DispatchPreparationReentryWorkbench
        open={workWindowMode === "dispatch-prep-reentry"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onPrepRecorded={(_obj) => {}}
        onSendConfirmationReentryHandoff={() => {
          setWorkWindowMode("send-confirm-reentry");
        }}
        onReturnToCreatedReentry={() => {
          setWorkWindowMode("po-created-reentry");
        }}
      />

      {/* ═══ E-31. Center Work Window — Send Confirmation Re-entry ═══ */}
      <SendConfirmationReentryWorkbench
        open={workWindowMode === "send-confirm-reentry"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onReexecutionRecorded={(_event) => {}}
        onPoSentReentryTrackingHandoff={() => {
          setWorkWindowMode("sent-tracking-reentry");
        }}
        onReturnToDispatchPrepReentry={() => {
          setWorkWindowMode("dispatch-prep-reentry");
        }}
      />

      {/* ═══ E-32. Center Work Window — PO Sent Re-entry Tracking ═══ */}
      <PoSentReentryTrackingWorkbench
        open={workWindowMode === "sent-tracking-reentry"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onAcknowledgmentReentryRecorded={(_obj) => {}}
        onSupplierConfirmationReentryHandoff={() => {
          setWorkWindowMode("supplier-confirm-reentry");
        }}
        onReturnToSendConfirmReentry={() => {
          setWorkWindowMode("send-confirm-reentry");
        }}
      />

      {/* ═══ E-33. Center Work Window — Supplier Confirmation Re-entry ═══ */}
      <SupplierConfirmationReentryWorkbench
        open={workWindowMode === "supplier-confirm-reentry"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onConfirmationRecorded={(_obj) => {}}
        onReceivingPrepReentryHandoff={() => {
          setWorkWindowMode("rcv-prep-reentry");
        }}
        onReturnToSentTrackingReentry={() => {
          setWorkWindowMode("sent-tracking-reentry");
        }}
      />

      {/* ═══ E-34. Center Work Window — Receiving Preparation Re-entry ═══ */}
      <ReceivingPreparationReentryWorkbench
        open={workWindowMode === "rcv-prep-reentry"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onPrepRecorded={(_obj) => {}}
        onReceivingExecReentryHandoff={() => {
          setWorkWindowMode("rcv-exec-reentry");
        }}
        onReturnToSupplierConfirmReentry={() => {
          setWorkWindowMode("supplier-confirm-reentry");
        }}
      />

      {/* ═══ E-35. Center Work Window — Receiving Execution Re-entry ═══ */}
      <ReceivingExecutionReentryWorkbench
        open={workWindowMode === "rcv-exec-reentry"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onExecRecorded={(_obj) => {}}
        onInventoryIntakeReentryHandoff={() => {
          setWorkWindowMode("stock-release-reentry");
        }}
        onReturnToReceivingPrepReentry={() => {
          setWorkWindowMode("rcv-prep-reentry");
        }}
      />

      {/* ═══ E-36. Center Work Window — Stock Release Re-entry ═══ */}
      <StockReleaseReentryWorkbench
        open={workWindowMode === "stock-release-reentry"}
        onClose={() => setWorkWindowMode(null)}
        receivingExecReentryObjectId=""
        onReleaseRecorded={(_obj) => {}}
        onReorderDecisionReentryHandoff={() => {
          setWorkWindowMode("reorder-decision-reentry");
        }}
        onReturnToReceivingExecReentry={() => {
          setWorkWindowMode("rcv-exec-reentry");
        }}
      />

      {/* ═══ E-37. Center Work Window — Reorder Decision Re-entry ═══ */}
      <ReorderDecisionReentryWorkbench
        open={workWindowMode === "reorder-decision-reentry"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onDecisionRecorded={(_obj) => {}}
        onProcurementReentryReopenHandoff={() => {
          setWorkWindowMode("procurement-reentry-reopen");
        }}
        onReturnToStockReleaseReentry={() => {
          setWorkWindowMode("stock-release-reentry");
        }}
      />

      {/* ═══ E-38. Center Work Window — Procurement Re-entry Reopen ═══ */}
      <ProcurementReentryReopenWorkbench
        open={workWindowMode === "procurement-reentry-reopen"}
        onClose={() => setWorkWindowMode(null)}
        handoff={null}
        onReopenRecorded={(_obj) => {}}
        onSourcingSearchReopenHandoff={() => {
          // Sourcing Search Reopen (20단계)로 순환 → 전체 cycle 자기순환 ABSOLUTE COMPLETE
          setWorkWindowMode("search-reopen");
        }}
        onCompareReopenHandoff={() => {
          setWorkWindowMode("compare-reopen");
        }}
        onRequestReopenHandoff={() => {
          setWorkWindowMode("request-reopen");
        }}
        onReturnToReorderDecisionReentry={() => {
          setWorkWindowMode("reorder-decision-reentry");
        }}
      />

      {/* ═══ E-39. Center Work Window — Request Review (기존 6-area) ═══ */}
      <RequestReviewWindow
        open={workWindowMode === "request"}
        onClose={() => setWorkWindowMode(null)}
        quoteItems={quoteItems}
        compareIds={compareIds}
        products={products}
        onRemoveItem={removeQuoteItem}
        onUpdateItem={updateQuoteItem}
        onClearAll={() => { quoteItems.forEach((item: any) => removeQuoteItem(item.id)); }}
        onCreateRequest={() => { router.push("/app/quote"); setWorkWindowMode(null); }}
        onSwitchToCompare={() => setWorkWindowMode("compare")}
        onToggleCompare={(productId: string) => {
          const p = products.find((pp: any) => pp.id === productId);
          if (p) toggleCompare(productId, { name: p.name, brand: p.brand });
        }}
        onToggleRequest={(productId: string) => {
          const existing = quoteItems.find((q: any) => q.productId === productId);
          if (existing) {
            removeQuoteItem(existing.id);
            toast.info("견적함에서 제거되었습니다.");
          } else {
            const p = products.find((pp: any) => pp.id === productId);
            if (p) {
              const r = addProductToQuote(p);
              const t = resolveAddToQuoteToast(r);
              toast[t.intent](t.message);
            }
          }
        }}
        totalAmount={totalAmount}
      />

      {/* ═══ AI Decision Layer — non-blocking right rail, workbench context 유지 ═══ */}
      {isStrategyOverlayOpen && canOpenStrategyOverlay && (
        <div
          className={`pointer-events-none fixed right-0 top-[60px] z-[50] hidden w-full max-w-[360px] md:block ${showSourcingActionDock ? "bottom-[128px]" : "bottom-0"}`}
          data-testid="sourcing-strategy-rail"
        >
          {/* Anchored decision layer — right edge only.
              No full-screen backdrop: Browser Pilot must be able to click central
              compare/request CTAs while this guidance rail is open. */}
          <div
            className="pointer-events-auto absolute top-0 right-0 bottom-0 w-full bg-white border-l border-blue-200 shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Layer header — strong AI branding */}
            <div className="px-4 py-3.5 border-b border-slate-200 bg-blue-50">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-600/20 border border-blue-500/30">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <div>
                    <span className="text-[12px] font-semibold text-slate-800">비교 구성안</span>
                    <span className="text-[10px] text-slate-500 ml-2">미리보기</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {isStrategyStale && (
                    <span className="text-[9px] text-yellow-600 px-1.5 py-0.5 rounded bg-yellow-50 border border-yellow-200">갱신 필요</span>
                  )}
                  <button
                    type="button"
                    onClick={closeStrategyOverlay}
                    className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-600 hover:bg-white/[0.05] transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-slate-400">현재 선택 <span className="text-slate-800 font-medium">{compareIds.length}개</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">판단안 <span className="text-blue-600 font-medium">3개</span></span>
              </div>
            </div>

            {/* Segmented tabs — 비용/납기/규격 */}
            <div className="px-3 py-2.5 border-b border-slate-200 flex gap-1.5">
              {sourcingOptions.map((opt) => {
                const label = opt.frame === "conservative" ? "비용 우선" : opt.frame === "balanced" ? "납기·가격 균형" : "규격 신뢰";
                const isActive = previewStrategy === opt.frame;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPreviewStrategy(opt.frame as any)}
                    className={`flex-1 text-center px-2 py-2 rounded-md text-[10px] font-medium transition-all ${isActive
                      ? "bg-blue-50 text-blue-600 border border-blue-500/30 shadow-sm shadow-blue-500/10"
                      : "text-slate-500 hover:text-slate-400 hover:bg-white/[0.03] border border-transparent"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Preview panel — single option detail */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {previewOption ? (
                <div className="space-y-4">
                  {/* Delta summary — numbers first */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="px-3 py-2.5 rounded-md border border-slate-200 bg-slate-50">
                      <span className="text-[9px] text-slate-500 block mb-0.5">추가 후보</span>
                      <span className="text-base font-bold tabular-nums text-slate-100">
                        {products.filter((p: any) => !compareIds.includes(p.id) && p.vendors?.[0]?.priceInKRW > 0).slice(0, 3).length}개
                      </span>
                    </div>
                    <div className="px-3 py-2.5 rounded-md border border-slate-200 bg-slate-50">
                      <span className="text-[9px] text-slate-500 block mb-0.5">현재 비교</span>
                      <span className="text-base font-bold tabular-nums text-slate-100">{compareIds.length}개</span>
                    </div>
                  </div>

                  {/* Strengths */}
                  <div>
                    <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">강점</span>
                    <div className="mt-1.5 space-y-1">
                      {previewOption.strengths.slice(0, 3).map((s: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 rounded bg-emerald-600/[0.05] border border-emerald-500/10">
                          <Check className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                          <span className="text-[10px] text-slate-600 leading-relaxed">{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Risks */}
                  {previewOption.risks.length > 0 && (
                    <div>
                      <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">리스크</span>
                      <div className="mt-1.5 space-y-1">
                        {previewOption.risks.slice(0, 2).map((r, i: number) => (
                          <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 rounded bg-yellow-600/[0.05] border border-yellow-500/10">
                            <AlertTriangle className="h-3 w-3 text-yellow-600 mt-0.5 shrink-0" />
                            <span className="text-[10px] text-slate-400 leading-relaxed">{typeof r === "string" ? r : r.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rationale */}
                  <div className="px-3 py-2.5 rounded-md bg-blue-600/[0.06] border border-blue-500/15">
                    <span className="text-[9px] font-medium text-blue-600 uppercase tracking-wider block mb-1">추천 이유</span>
                    <span className="text-[10px] text-blue-200 leading-relaxed">{previewOption.rationale}</span>
                  </div>

                  {/* Next action */}
                  <div className="flex items-center gap-2 text-[10px] px-2.5 py-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500">다음 단계</span>
                    <span className="text-slate-600 font-medium">{previewOption.nextAction}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-500">구성안을 선택하세요</div>
              )}
            </div>

            {/* Action area — preview / apply separation */}
            <div className="px-4 py-3.5 border-t border-slate-200 bg-slate-50">
              {isStrategyStale ? (
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-yellow-600" />
                    <span className="text-[10px] text-yellow-600">선택 상태가 변경되었습니다</span>
                  </div>
                  <Button size="sm" className="w-full h-8 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-600"
                    onClick={closeStrategyOverlay}>
                    닫기
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="flex-1 h-8 text-[10px] text-slate-400 hover:text-slate-600 border border-slate-200"
                    onClick={closeStrategyOverlay}>
                    닫기
                  </Button>
                  <Button size="sm" className="flex-1 h-8 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium"
                    onClick={() => handleProtectedAction(() => applyStrategyOption(previewStrategy))}>
                    <Sparkles className="h-3 w-3 mr-1" />
                    이 구성 반영
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Utility dialogs */}
      <AlertDialog open={itemToDelete !== null} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>품목 삭제</AlertDialogTitle>
            <AlertDialogDescription>이 품목을 리스트에서 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (itemToDelete) { removeQuoteItem(itemToDelete); setItemToDelete(null); } }} className="bg-red-600 hover:bg-red-700">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isLoginPromptOpen} onOpenChange={setIsLoginPromptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>로그인 후 검색 결과를 확인하세요</DialogTitle>
            <DialogDescription>
              검색 결과 확인과 비교·견적 요청은 로그인 후 사용할 수 있습니다.
              로그인 후 입력한 검색어로 바로 이어서 검색할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleLoginRedirect}>로그인하기</Button>
            <Button variant="outline" className="w-full" onClick={handleLoginRedirect}>무료로 시작하기</Button>
            <Button variant="ghost" className="w-full text-slate-500" onClick={() => setIsLoginPromptOpen(false)}>돌아가기</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ AI 비교 분석 모달 ═══ */}
      <ComparisonModal
        open={comparisonModalOpen}
        onOpenChange={setComparisonModalOpen}
        compareIds={compareIds}
        products={products}
        onOpenRequestWizard={() => {
          setComparisonModalOpen(false);
          setRequestWizardOpen(true);
        }}
      />

      {/* ═══ 견적 요청 위저드 모달 ═══ */}
      <RequestWizardModal
        open={requestWizardOpen}
        onOpenChange={setRequestWizardOpen}
        products={products}
        quoteItems={quoteItems}
        compareIds={compareIds}
        onSubmitSuccess={() => {
          quoteItems.forEach((item: any) => removeQuoteItem(item.id));
        }}
        onQuoteManagementOpen={() => {
          router.push("/dashboard/quotes");
        }}
      />
    </div>
  );
}

/** ═══ A. Search Utility Bar — 3층: 앱 헤더 / 검색 바 / (상태바는 본문에서) ═══ */
const STAGE_LABELS: Record<string, string> = {
  sourcing: "소싱",
  request: "요청 조립",
  quote: "견적 관리",
  "post-quote": "발주 · 운영",
};

// §11.265e — onOpenFilter dead prop 제거. SearchUtilityBar body 안 사용 0 이었음.
//   필터 entry 는 §11.265c (Operating Status Bar 필터 button + SheetTrigger asChild
//   + SearchPanel) 가 유일. dead prop drift 차단 + 명확성.
function SearchUtilityBar({ activeFilterCount, onAuthRequired, isLoggedIn, stageOwner = "sourcing", onBackToSourcing }: { activeFilterCount: number; onAuthRequired: () => void; isLoggedIn: boolean; stageOwner?: string; onBackToSourcing?: () => void }) {
  const { searchQuery, setSearchQuery, runSearch, hasSearched } = useTestFlow();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [labelScanOpen, setLabelScanOpen] = useState(false);
  // §11.283b 햄버거 메뉴 plain state — Radix DropdownMenu 제거 후 단순화.
  // 호영님 P0+ 4차 (2026-05-24) 보고: §11.280~§11.283 (Radix wiring 4차
  // hot fix) 후에도 호영님 환경 dead button. Radix 의존성 제거 + plain
  // button + useState + 조건부 menu render 로 직관적으로 단순화.
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  // §11.294 필터 dropdown plain state — 호영님 P2 spec (2026-05-24).
  // 데스크탑 3 row → 1 row + 3 dropdown 단순화. §11.283b 정합 (Radix 의존성 0).
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<"category" | "price" | "vendor" | null>(null);

  // §11.258a #4 — 최근 검색어 dropdown (모바일). localStorage
  // "bioinsight-recent-searches" 가 이미 handleSubmit 안 저장 중 (page.tsx:2001-2003).
  // 본 hook 은 그 저장값을 mount 시 + setRecentSearches 후 동기.
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  // §11.258a #4 — input focus 시 + 빈 query 시 dropdown open. submit/clear 시 close.
  const [recentOpen, setRecentOpen] = useState(false);
  // §11.258c — 자동완성 hook (debounce 300ms + 2글자+ fetch). localQuery 변경
  //   시 즉시 호출. 결과는 모바일 dropdown 안 별도 section 으로 노출 (최근 검색어
  //   dropdown 과 분리 — focus 상태로 양쪽 모두 가능).
  const { items: autocompleteItems } = useAutocomplete(localQuery);
  // §11.258c-2 — 데스크탑 inline form 의 자동완성 dropdown open state.
  //   모바일 recentOpen 과 별개 (분리된 input → 분리된 focus state).
  //   Input focus 시 true + blur 200ms timeout 으로 false (link click race 방지).
  const [desktopOpen, setDesktopOpen] = useState(false);

  useEffect(() => { setLocalQuery(searchQuery); }, [searchQuery]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("bioinsight-recent-searches") || "[]") as string[];
      setRecentSearches(stored.slice(0, 5));
    } catch {}
  }, []);

  // §11.258a #2 — X 클리어 button onClick handler. localQuery + searchQuery 동시 빈 값.
  const handleClearQuery = () => {
    setLocalQuery("");
    setSearchQuery("");
    setRecentOpen(false);
  };
  // §11.258a #4 — 최근 검색어 pick (탭 → 즉시 검색 실행).
  const handlePickRecent = (q: string) => {
    setLocalQuery(q);
    setSearchQuery(q);
    setRecentOpen(false);
    if (isLoggedIn) runSearch();
  };
  // §11.258a #4 — 최근 검색어 개별 삭제 (✕ button).
  const handleRemoveRecent = (q: string) => {
    const updated = recentSearches.filter((s) => s !== q);
    setRecentSearches(updated);
    try {
      localStorage.setItem("bioinsight-recent-searches", JSON.stringify(updated));
    } catch {}
  };
  // §11.258a #4 — 최근 검색어 전체 삭제 ("전체 삭제" button).
  const handleClearAllRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem("bioinsight-recent-searches");
    } catch {}
    setRecentOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localQuery.trim()) return;
    setSearchQuery(localQuery);

    if (!isLoggedIn) {
      try { sessionStorage.setItem("labaxis-pending-search", localQuery.trim()); } catch {}
      onAuthRequired();
      return;
    }

    try {
      const stored = JSON.parse(localStorage.getItem("bioinsight-recent-searches") || "[]") as string[];
      const updated = [localQuery.trim(), ...stored.filter((s: string) => s !== localQuery.trim())].slice(0, 5);
      localStorage.setItem("bioinsight-recent-searches", JSON.stringify(updated));
      // §11.258a #4 — state 동기 (UI dropdown 즉시 반영).
      setRecentSearches(updated);
    } catch {}
    // §11.258a #4 — submit 시 dropdown close.
    setRecentOpen(false);
    runSearch();
  };

  return (
    <div className="shrink-0">
      {/* ── 1행: LabAxis 소싱 + 검색바 + 유틸리티 — 한 줄 ── */}
      {/* §11.254 — 소싱 헤더 로고 분리:
          - "LabAxis" Link href="/" (메인 홈, 모든 서비스 영역 통일)
          - "소싱" 서브 라벨 Link href="/app/search" (소싱 검색 초기 화면)
          이전 단일 Link → 두 독립 Link 분리. dead span ("소싱" 텍스트 only) →
          탐색 가능 Link 으로 wiring 강화. aria-label 추가 a11y 정합. */}
      {/* §11.258a — 모바일 헤더 2행 분리 (방안 A, 호영님 spec).
          1행: LabAxis + 소싱 + AI 스캔 + 햄버거 (nav + utility).
          2행 (모바일 한정, md:hidden): 검색바 풀너비 + X 클리어 + 최근 검색어.
          데스크탑 (md+) 은 1행 안에 inline 검색 form 보존. */}
      <div className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-2.5 md:py-3" style={{ backgroundColor: '#0f172a' }}>
        <div className="flex items-center gap-1.5 shrink-0">
          <Link href="/" className="flex items-center" aria-label="LabAxis 홈으로 이동">
            <span className="text-lg font-bold text-white tracking-tight">LabAxis</span>
          </Link>
          {stageOwner !== "sourcing" ? (
            <>
              <Link href="/app/search" className="ml-1" aria-label="소싱 검색으로 이동">
                <span className="text-slate-500 text-sm hover:text-slate-300 transition-colors">소싱</span>
              </Link>
              <span className="text-slate-600 text-sm">/</span>
              <span className="text-sm font-semibold text-slate-200">{STAGE_LABELS[stageOwner] || stageOwner}</span>
            </>
          ) : (
            <Link href="/app/search" className="ml-1" aria-label="소싱 검색으로 이동">
              <span className="text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors">소싱</span>
            </Link>
          )}
        </div>

        {/* §11.263a — 모바일 한정 spacer (헤더 우측 배치 root cause fix).
            데스크탑은 아래 검색 form `hidden md:flex flex-1` 이 spacer 역할 →
            AI 스캔+햄버거 우측 정렬. 모바일은 form 이 hidden 이라 spacer 부재
            → 4 element 가 좌측에 붙음. 이 spacer 추가로 AI 스캔+햄버거
            우측 끝 정렬 (호영님 spec 소싱 모바일 #1 긴급). */}
        <div className="flex-1 md:hidden" aria-hidden="true" />

        {/* §11.258a — 데스크탑 한정 검색 인풋 (인라인). md+ 에서만 1행 안.
            §11.258c-2 — relative wrapper 추가 (안 absolute dropdown 의 positioning 기준). */}
        <form onSubmit={handleSubmit} className="hidden md:flex items-center flex-1 min-w-0 relative">
          <div className="flex items-center flex-1 bg-white border border-white/20 rounded-lg focus-within:ring-2 focus-within:ring-blue-500/30 transition-all">
            <Search className="h-4 w-4 text-slate-400 ml-3 shrink-0" />
            <Input
              data-testid="sourcing-search-input"
              type="text"
              value={localQuery}
              onChange={(e) => { setLocalQuery(e.target.value); setSearchQuery(e.target.value); }}
              onFocus={() => setDesktopOpen(true)}
              onBlur={() => { setTimeout(() => setDesktopOpen(false), 200); }}
              placeholder="시약명·CAS·제조사·카탈로그 번호"
              className="h-10 px-2.5 text-sm border-0 bg-transparent text-slate-900 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
            />
            {/* §11.258a #2 — X 클리어 button. localQuery > 0 시 노출. */}
            {localQuery.length > 0 && (
              <button
                type="button"
                onClick={handleClearQuery}
                aria-label="검색어 지우기"
                className="inline-flex items-center justify-center h-9 w-9 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <Button
              type="submit"
              size="sm"
              className="h-7 px-4 mr-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shrink-0"
              disabled={!localQuery.trim()}
            >
              검색
            </Button>
          </div>

          {/* §11.258c-3 — 데스크탑 inline 최근 검색어 dropdown. 자동완성 dropdown
              과 mutually exclusive (autocomplete = 2글자+, recent = 빈 query).
              §11.258a 모바일 dropdown 패턴 reuse — handlePickRecent /
              handleRemoveRecent / handleClearAllRecent helper 100% reuse.
              hidden md:block 으로 데스크탑 한정 노출. */}
          {desktopOpen && !localQuery && recentSearches.length > 0 && (
            <div className="hidden md:block absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 max-h-72 overflow-y-auto z-30">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-600">최근 검색어</span>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleClearAllRecent(); setDesktopOpen(false); }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  전체 삭제
                </button>
              </div>
              <ul className="divide-y divide-slate-100">
                {recentSearches.map((q) => (
                  <li key={`desktop-recent-${q}`} className="flex items-center">
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handlePickRecent(q); setDesktopOpen(false); }}
                      className="flex-1 min-h-[40px] px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2"
                    >
                      <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{q}</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleRemoveRecent(q); }}
                      aria-label={`${q} 삭제`}
                      className="inline-flex items-center justify-center min-h-[40px] min-w-[40px] text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* §11.258c-2 — 데스크탑 inline 자동완성 dropdown. md+ 한정 (hidden md:block).
              모바일 dropdown 과 mutually exclusive (다른 form 안). desktopOpen +
              localQuery 2글자+ + items > 0 시 노출. type chip + label 동일 패턴. */}
          {desktopOpen && localQuery.trim().length >= 2 && autocompleteItems.length > 0 && (
            <div className="hidden md:block absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 max-h-72 overflow-y-auto z-30">
              <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-600">
                자동완성 ({autocompleteItems.length}건)
              </div>
              <ul className="divide-y divide-slate-100">
                {autocompleteItems.map((item, idx) => {
                  const typeLabel =
                    item.type === "product" ? "품목" :
                    item.type === "brand" ? "제조사" :
                    "카탈로그";
                  const typeColor =
                    item.type === "product" ? "text-blue-600 bg-blue-50" :
                    item.type === "brand" ? "text-emerald-600 bg-emerald-50" :
                    "text-slate-600 bg-slate-100";
                  return (
                    <li key={`desktop-${item.type}-${item.value}-${idx}`}>
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); handlePickRecent(item.value); setDesktopOpen(false); }}
                        className="w-full min-h-[40px] px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2"
                      >
                        <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeColor}`}>
                          {typeLabel}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </form>

        {/* 유틸리티 — AI 라벨 스캔 + 햄버거 메뉴 (§11.254b)
            §11.268a — 호영님 P0 spec: 모바일 우하단 FAB 이 비교/견적 액션 바 위에
            완전 겹침 → "견적 요청서 만들기" 핵심 액션 차단. FAB 제거 + 헤더 inline
            을 모바일에서도 visible (hidden md:flex → flex). §11.264f revert.
            §11.254b — 햄버거 메뉴 (모바일 핵심 navigation) 보존. */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* AI 라벨 스캔 — 소싱 핵심 기능. §11.268a — 모바일 + 데스크탑 모두 inline
              표시 (FAB 제거로 액션 바 겹침 해소). */}
          <button
            onClick={() => setLabelScanOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors shrink-0"
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI 라벨 스캔</span>
          </button>
          {/* §11.283b #sourcing-hamburger-plain-button — 호영님 P0+ 5차
              (2026-05-24) 단순화: §11.280 / §11.280-2 / §11.282-d / §11.282-e
              / §11.283 (Radix wiring 5차 hot fix) 후에도 호영님 환경 dead
              button. Radix DropdownMenu 자체 제거 + plain <button> +
              useState + 조건부 <div> menu. 직관적·단순. 5 menuItem
              (대시보드/견적/구매/재고/설정) Link navigation 그대로. 외부
              click 시 close 는 useEffect + addEventListener. ESC close 도
              keydown listener. dependency 0 (Radix wiring trap 0). */}
          <div className="relative shrink-0">
            <button
              type="button"
              aria-label="메뉴 열기"
              aria-expanded={hamburgerOpen}
              aria-haspopup="menu"
              onClick={() => setHamburgerOpen((v) => !v)}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mr-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0 touch-manipulation [-webkit-tap-highlight-color:transparent]"
            >
              <Menu className="h-5 w-5 pointer-events-none" />
            </button>
            {hamburgerOpen && (
              <>
                {/* backdrop — 외부 click 시 close */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setHamburgerOpen(false)}
                  aria-hidden="true"
                />
                <div
                  role="menu"
                  aria-label="주요 화면"
                  className="absolute right-0 top-full mt-2 w-56 rounded-md border border-slate-200 bg-white shadow-lg z-50 py-1"
                >
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    주요 화면
                  </div>
                  <div className="h-px bg-slate-100 mx-1 my-1" />
                  <Link
                    href="/dashboard"
                    role="menuitem"
                    onClick={() => setHamburgerOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <LayoutDashboard className="h-4 w-4 text-slate-500" />
                    <span>대시보드</span>
                  </Link>
                  <Link
                    href="/dashboard/quotes"
                    role="menuitem"
                    onClick={() => setHamburgerOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <FileText className="h-4 w-4 text-slate-500" />
                    <span>견적 관리</span>
                  </Link>
                  <Link
                    href="/dashboard/purchases"
                    role="menuitem"
                    onClick={() => setHamburgerOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <ShoppingCart className="h-4 w-4 text-slate-500" />
                    <span>구매 운영</span>
                  </Link>
                  <Link
                    href="/dashboard/inventory"
                    role="menuitem"
                    onClick={() => setHamburgerOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <Package className="h-4 w-4 text-slate-500" />
                    <span>재고 관리</span>
                  </Link>
                  <div className="h-px bg-slate-100 mx-1 my-1" />
                  <Link
                    href="/dashboard/settings"
                    role="menuitem"
                    onClick={() => setHamburgerOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <Settings className="h-4 w-4 text-slate-500" />
                    <span>설정</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <LabelScannerModal
          open={labelScanOpen}
          onOpenChange={setLabelScanOpen}
          onScanComplete={(result) => {
            const q = result.parsed.catalogNo || result.parsed.productName || result.parsed.casNumber || "";
            if (q) {
              setLocalQuery(q);
              setSearchQuery(q);
              if (isLoggedIn) runSearch();
            }
          }}
        />
      </div>

      {/* §11.268a — §11.264f FAB block 제거 (호영님 P0 spec). 모바일 우하단 fixed
            FAB 이 비교/견적 액션 바 위에 완전 겹침 → "견적 요청서 만들기" 핵심 액션
            차단. 헤더 inline button (위 div line ~2891) 을 모바일에서도 visible
            (hidden md:flex → flex) 로 swap → FAB-헤더 functional duplication 해소. */}

{/* §11.258a #3 — 모바일 한정 검색 form (2행, md:hidden).
          헤더 1행 (LabAxis + 소싱 + 스캔 + 햄버거) 직후 풀너비 검색바.
          placeholder 완전 표시 (잘림 0) + Input text-base (16px) 으로 iOS Safari
          줌인 차단. X 클리어 button + 최근 검색어 dropdown 함께. */}
      <form
        onSubmit={handleSubmit}
        className="md:hidden flex items-center gap-2 px-4 pb-2.5 relative"
        style={{ backgroundColor: '#0f172a' }}
      >
        <div className="flex items-center flex-1 bg-white border border-white/20 rounded-lg focus-within:ring-2 focus-within:ring-blue-500/30 transition-all">
          <Search className="h-4 w-4 text-slate-400 ml-3 shrink-0" />
          <Input
            data-testid="sourcing-search-input-mobile"
            type="text"
            value={localQuery}
            onChange={(e) => { setLocalQuery(e.target.value); setSearchQuery(e.target.value); }}
            onFocus={() => { if (!localQuery && recentSearches.length > 0) setRecentOpen(true); }}
            onBlur={() => { setTimeout(() => setRecentOpen(false), 200); }}
            placeholder="시약명·CAS·제조사·카탈로그 번호 검색"
            className="h-11 px-2.5 text-base border-0 bg-transparent text-slate-900 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
          />
          {/* §11.258a #2 — X 클리어 button (모바일). 44px touch target. */}
          {localQuery.length > 0 && (
            <button
              type="button"
              onClick={handleClearQuery}
              aria-label="검색어 지우기"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          type="submit"
          size="sm"
          className="h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md shrink-0"
          disabled={!localQuery.trim()}
        >
          검색
        </Button>

        {/* §11.258c — 자동완성 dropdown (모바일). 2글자+ 입력 시 server top 5
            (품목 / 제조사 / 카탈로그) 노출. debounce 300ms (hook 안). 최근 검색어
            dropdown 과 mutually exclusive (recent = 빈 query, autocomplete = 2글자+).
            클릭 → setLocalQuery + 즉시 submit (logged in 시 runSearch). */}
        {recentOpen && localQuery.trim().length >= 2 && autocompleteItems.length > 0 && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 max-h-72 overflow-y-auto z-20">
            <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-600">
              자동완성 ({autocompleteItems.length}건)
            </div>
            <ul className="divide-y divide-slate-100">
              {autocompleteItems.map((item, idx) => {
                const typeLabel =
                  item.type === "product" ? "품목" :
                  item.type === "brand" ? "제조사" :
                  "카탈로그";
                const typeColor =
                  item.type === "product" ? "text-blue-600 bg-blue-50" :
                  item.type === "brand" ? "text-emerald-600 bg-emerald-50" :
                  "text-slate-600 bg-slate-100";
                return (
                  <li key={`${item.type}-${item.value}-${idx}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handlePickRecent(item.value); }}
                      className="w-full min-h-[44px] px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2"
                    >
                      <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeColor}`}>
                        {typeLabel}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* §11.258a #4 — 최근 검색어 dropdown (input focus + 빈 query 시). */}
        {recentOpen && !localQuery && recentSearches.length > 0 && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 max-h-72 overflow-y-auto z-20">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-600">최근 검색어</span>
              <button
                type="button"
                onClick={handleClearAllRecent}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                전체 삭제
              </button>
            </div>
            <ul className="divide-y divide-slate-100">
              {recentSearches.map((q) => (
                <li key={q} className="flex items-center">
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handlePickRecent(q); }}
                    className="flex-1 min-h-[44px] px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2"
                  >
                    <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{q}</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleRemoveRecent(q); }}
                    aria-label={`${q} 삭제`}
                    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
}
