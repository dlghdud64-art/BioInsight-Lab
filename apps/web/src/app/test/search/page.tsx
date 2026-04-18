"use client";

import { SearchPanel } from "../_components/search-panel";
import { useTestFlow } from "../_components/test-flow-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/products/price-display";
import { Loader2, PenLine, X, Trash2, Search, FileText, Package, SlidersHorizontal, TrendingDown, AlertTriangle, AlertCircle, Sparkles, Check, Camera } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { SourcingResultRow } from "../_components/sourcing-result-row";
import { SourcingContextRail } from "../_components/sourcing-context-rail";
import { CenterWorkWindow } from "@/components/work-window/center-work-window";
import { RequestReviewWindow } from "../_components/request-review-window";
import { CompareReviewWorkWindow } from "../_components/compare-review-work-window";
import { RequestAssemblyWorkWindow } from "@/components/sourcing/request-assembly-work-window";
import { RequestSubmissionWorkWindow } from "@/components/sourcing/request-submission-work-window";
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
import { useRfqHandoffStore } from "@/lib/store/rfq-handoff-store";
import type { QuoteNormalizationHandoff } from "@/lib/ai/quote-workqueue-engine";
import { buildQuoteNormalizationHandoff as buildNormHandoff } from "@/lib/ai/quote-workqueue-engine";
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
    searchBrand,
    sortBy,
    minPrice,
    maxPrice,
    grade,
  } = useTestFlow();
  const { getDisplayName: getStoredName } = useCompareStore();
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  // ── Step 2: activeResultId (ID only) — rail은 products에서 derive ──
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
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
  const [previewStrategy, setPreviewStrategy] = useState<"conservative" | "balanced" | "alternative">("balanced");
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

  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

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

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden" style={{ backgroundColor: '#F8FAFC' }}>
      {/* ═══ A. Search Utility Bar — compact, not hero ═══ */}
      <SearchUtilityBar activeFilterCount={activeFilterCount} onOpenFilter={() => setIsMobileFilterOpen(true)} onAuthRequired={() => setIsLoginPromptOpen(true)} isLoggedIn={!!session?.user} stageOwner={stageOwner} onBackToSourcing={() => setWorkWindowMode(null)} />

      {/* ═══ Mobile filter sheet ═══ */}
      <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
        <SheetContent side="bottom" className="h-[75vh] overflow-y-auto">
          <div className="pt-2"><SearchPanel /></div>
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
                <Sheet>
                  <SheetTrigger asChild>
                    <button className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors">
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
                {!!session?.user && hasSearched && searchQuery && (
                  <Link href={`/dashboard/inventory?q=${encodeURIComponent(searchQuery)}`}>
                    <button className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors">
                      <Package className="h-3.5 w-3.5" />
                      재고
                    </button>
                  </Link>
                )}
              </div>
            </div>

            {/* ═══ P1 AI 제안 fallback (sourcing strip이 안 보일 때) ═══ */}
            {!shouldShowSourcingStrip && aiShouldShow && (
              <div className="px-4 pt-1.5">
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
                      isInCompare={compareIds.includes(product.id)}
                      isInRequest={quoteItems.some((q: any) => q.productId === product.id)}
                      isSelected={railProduct?.id === product.id}
                      compareSessionCount={compareStatuses[product.id]?.activeCount}
                      onToggleCompare={() => handleProtectedAction(() => toggleCompare(product.id, { name: product.name, brand: product.brand }))}
                      onToggleRequest={() => handleProtectedAction(() => {
                        const existing = quoteItems.find((q: any) => q.productId === product.id);
                        if (existing) { removeQuoteItem(existing.id); } else { addProductToQuote(product); }
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
            {/* ═══ AI 비교 판단 상태 strip — 작업 상태 바 (추천 카드 아님) ═══ */}
            {aiCompareReadiness.active ? (
              <div className="px-3 py-2 border-b border-slate-200">
                <div className={`rounded-md border px-3 py-2.5 ${aiCompareReadiness.mode === "direct" ? "border-blue-200 bg-blue-50" : aiCompareReadiness.mode === "mixed_warning" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${aiCompareReadiness.mode === "direct" ? "bg-blue-500" : aiCompareReadiness.mode === "mixed_warning" ? "bg-amber-500" : "bg-red-400"}`} />
                      <span className="text-[10px] font-semibold text-slate-800">비교 검토 활성</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${aiCompareReadiness.mode === "direct" ? "bg-blue-50 text-blue-600" : aiCompareReadiness.mode === "mixed_warning" ? "bg-amber-600/15 text-amber-300" : "bg-red-600/15 text-red-300"}`}>
                      {compareIds.length}개 선택
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mb-2">{aiCompareReadiness.label}</div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    {shouldShowSourcingStrip && (
                      <span className="text-blue-600">판단안 3개 준비됨</span>
                    )}
                  </div>
                  {/* Primary CTA: 비교 검토 시작 */}
                  <div className="flex gap-1.5 mt-2">
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium"
                      onClick={() => handleProtectedAction(() => setComparisonModalOpen(true))}
                    >
                      <PenLine className="h-3 w-3 mr-1" />
                      비교 검토
                    </Button>
                    {/* AI 아이콘 버튼 제거 — 비교 검토 버튼만 유지 */}
                  </div>
                </div>
              </div>
            ) : hasSearched && products.length >= 2 && compareIds.length < 2 ? (
              <div className="px-3 py-2 border-b border-slate-200">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  <span className="text-[10px] text-slate-500">제품 2개 이상 선택 시 비교 검토가 활성화됩니다</span>
                </div>
              </div>
            ) : null}

            {railProduct ? (
              <SourcingContextRail
                product={railProduct}
                isInCompare={compareIds.includes(railProduct.id)}
                isInRequest={quoteItems.some((q: any) => q.productId === railProduct.id)}
                onToggleCompare={() => handleProtectedAction(() => toggleCompare(railProduct.id, { name: railProduct.name, brand: railProduct.brand }))}
                onToggleRequest={() => handleProtectedAction(() => {
                  const existing = quoteItems.find((q: any) => q.productId === railProduct.id);
                  if (existing) { removeQuoteItem(existing.id); } else { addProductToQuote(railProduct); }
                })}
                onClose={() => setActiveResultId(null)}
                onOpenCompareWindow={() => handleProtectedAction(() => setWorkWindowMode("compare"))}
                onOpenRequestWindow={() => handleProtectedAction(() => setWorkWindowMode("request"))}
                compareCount={compareIds.length}
                requestCount={quoteItems.length}
                searchQuery={searchQuery}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="w-12 h-12 rounded-xl bg-el border border-slate-200 flex items-center justify-center mb-4">
                  <PenLine className="h-6 w-6 text-blue-600/60" />
                </div>
                <p className="text-sm font-semibold text-slate-800 mb-1.5">제품을 선택해 비교를 시작하세요</p>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  선택한 제품은 비교 목록에 모아<br />가격, 규격, 제조사를 함께 검토할 수 있습니다.
                </p>
              </div>
            )}
          </div>
        </div>
        ) : (
        /* ═══ Stage Shell — request/quote/post-quote 단계 배경 ═══ */
        <div className="flex-1 overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#333B48' }}>
          <div className="max-w-lg w-full px-6">
            {/* Stage header */}
            <div className="text-center mb-6">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3 border ${stageOwner === "request" ? "bg-emerald-600/10 border-emerald-500/20" : stageOwner === "quote" ? "bg-blue-50 border-blue-200" : "bg-orange-600/10 border-orange-500/20"}`}>
                {stageOwner === "request" ? <FileText className="h-5 w-5 text-emerald-600" /> : stageOwner === "quote" ? <Package className="h-5 w-5 text-blue-600" /> : <Package className="h-5 w-5 text-orange-400" />}
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
              <h2 className="text-lg font-bold text-slate-900 mb-2">시약·장비를 검색하세요</h2>
              <p className="text-sm text-slate-600 mb-2 leading-relaxed">시약명, CAS No., 제조사, 카탈로그 번호로 500만+ 품목을 검색할 수 있습니다.</p>
              <p className="text-xs text-slate-500 mb-6">검색 후 비교 목록 추가 · 견적 요청 · 재고 연결까지 하나의 흐름으로 이어집니다</p>

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

              {session?.user ? (
                <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
                  <Link href="/protocol/bom" className="hover:text-slate-600 transition-colors">BOM 등록</Link>
                  <span>·</span>
                  <Link href="/dashboard/inventory" className="hover:text-slate-600 transition-colors">재고 확인</Link>
                  <span>·</span>
                  <Link href="/app/compare" className="hover:text-slate-600 transition-colors">비교 목록</Link>
                </div>
              ) : (
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
      {hasSearched && !!session?.user && isSourcingOwner && (
        <div className="border-t border-white/10 shrink-0" style={{ backgroundColor: '#0f172a' }}>
          <div className="px-4 py-3 flex items-center gap-4 flex-wrap">
            {/* Compare segment */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <PenLine className={`h-4 w-4 ${compareIds.length > 0 ? "text-blue-600" : "text-slate-500"}`} />
                <span className={`text-sm font-semibold ${compareIds.length > 0 ? "text-slate-100" : "text-slate-400"}`}>비교</span>
                <Badge variant="secondary" className={`h-5 min-w-5 px-1.5 text-xs ${compareIds.length > 0 ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-500"}`}>{compareIds.length}</Badge>
              </div>
              {compareIds.length > 0 ? (
                <>
                  {compareReady ? (
                    <Button size="sm" className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium" onClick={() => handleProtectedAction(() => setComparisonModalOpen(true))}>
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      비교 검토
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" />2개 이상 필요
                    </span>
                  )}
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-500 hover:text-red-500" onClick={() => clearCompare()}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <span className="text-xs text-slate-500">후보 없음</span>
              )}
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-white/20" />

            {/* Request segment */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <FileText className={`h-4 w-4 ${quoteItems.length > 0 ? "text-emerald-600" : "text-slate-500"}`} />
                <span className={`text-sm font-semibold ${quoteItems.length > 0 ? "text-slate-100" : "text-slate-400"}`}>견적</span>
                <Badge variant="secondary" className={`h-5 min-w-5 px-1.5 text-xs ${quoteItems.length > 0 ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-500"}`}>{quoteItems.length}</Badge>
              </div>
              {quoteItems.length > 0 ? (
                <>
                  {requestReadiness.summary.review > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                      <AlertTriangle className="h-3 w-3" />검토 {requestReadiness.summary.review}
                    </span>
                  )}
                  {requestReadiness.summary.blocked > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-600/10 text-red-500">
                      <AlertCircle className="h-3 w-3" />차단 {requestReadiness.summary.blocked}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 tabular-nums font-medium">₩{totalAmount.toLocaleString("ko-KR")}</span>
                  {requestHandoff ? (
                    <Button size="sm" className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={() => handleProtectedAction(() => setWorkWindowMode("request-assembly"))}>
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      견적 요청 조립
                    </Button>
                  ) : (
                    <Button size="sm" className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={() => handleProtectedAction(() => setRequestWizardOpen(true))}>
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      견적 요청서 만들기
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-500 hover:text-red-500" onClick={() => { quoteItems.forEach((item: any) => removeQuoteItem(item.id)); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <span className="text-xs text-slate-500">후보 없음</span>
              )}
            </div>

            {/* 현재 검색 결과 밖 후보 안내 */}
            {(() => {
              const visibleIds = new Set(products.map((p: any) => p.id));
              const hiddenCompare = compareIds.filter((id: string) => !visibleIds.has(id)).length;
              const hiddenRequest = quoteItems.filter((q: any) => !visibleIds.has(q.productId)).length;
              const total = hiddenCompare + hiddenRequest;
              if (total === 0) return null;
              return (
                <span className="text-[10px] text-slate-500 hidden sm:inline">
                  이전 검색 후보 {total}개 유지 중
                </span>
              );
            })()}

            {/* Spacer + clear all */}
            {(compareIds.length > 0 || quoteItems.length > 0) && (
              <>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-3 text-xs text-slate-500 hover:text-red-500"
                  onClick={() => { clearCompare(); quoteItems.forEach((item: any) => removeQuoteItem(item.id)); }}
                >
                  전체 해제
                </Button>
              </>
            )}
          </div>
        </div>
      )}

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
          // Cross-page handoff: sessionStorage 에 저장 후 navigation.
          // 견적관리 페이지가 mount 시 consumeHandoff() 로 수신.
          useRfqHandoffStore.getState().setHandoff(handoff);
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
          if (existing) { removeQuoteItem(existing.id); } else {
            const p = products.find((pp: any) => pp.id === productId);
            if (p) addProductToQuote(p);
          }
        }}
        totalAmount={totalAmount}
      />

      {/* ═══ AI Decision Layer — right-anchored, workbench context 유지 ═══ */}
      {isStrategyOverlayOpen && canOpenStrategyOverlay && (
        <div className="fixed inset-0 z-[70]" onClick={closeStrategyOverlay}>
          {/* Minimal backdrop — workbench 맥락 유지 */}
          <div className="absolute inset-0 bg-black/15" />
          {/* Anchored decision layer — right edge, rail과 연결된 느낌 */}
          <div
            className="absolute top-[60px] right-0 bottom-[64px] w-[400px] bg-white border-l border-blue-200 shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden"
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
                    <span className="text-[9px] text-amber-600 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200">갱신 필요</span>
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
                          <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 rounded bg-amber-600/[0.05] border border-amber-500/10">
                            <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
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
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    <span className="text-[10px] text-amber-600">선택 상태가 변경되었습니다</span>
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

function SearchUtilityBar({ activeFilterCount, onOpenFilter, onAuthRequired, isLoggedIn, stageOwner = "sourcing", onBackToSourcing }: { activeFilterCount: number; onOpenFilter: () => void; onAuthRequired: () => void; isLoggedIn: boolean; stageOwner?: string; onBackToSourcing?: () => void }) {
  const { searchQuery, setSearchQuery, runSearch, hasSearched } = useTestFlow();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [labelScanOpen, setLabelScanOpen] = useState(false);

  useEffect(() => { setLocalQuery(searchQuery); }, [searchQuery]);

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
    } catch {}
    runSearch();
  };

  return (
    <div className="shrink-0">
      {/* ── 1행: LabAxis 소싱 + 검색바 + 유틸리티 — 한 줄 ── */}
      <div className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-2.5 md:py-3" style={{ backgroundColor: '#0f172a' }}>
        <div className="flex items-center gap-1.5 shrink-0">
          <Link href="/dashboard" className="flex items-center">
            <span className="text-lg font-bold text-white tracking-tight">LabAxis</span>
          </Link>
          {stageOwner !== "sourcing" ? (
            <>
              <span className="text-slate-500 text-sm ml-1">소싱</span>
              <span className="text-slate-600 text-sm">/</span>
              <span className="text-sm font-semibold text-slate-200">{STAGE_LABELS[stageOwner] || stageOwner}</span>
            </>
          ) : (
            <span className="text-sm font-semibold text-slate-400 ml-1">소싱</span>
          )}
        </div>

        {/* 검색 인풋 — 인라인 */}
        <form onSubmit={handleSubmit} className="flex items-center flex-1 min-w-0">
          <div className="flex items-center flex-1 bg-white border border-white/20 rounded-lg focus-within:ring-2 focus-within:ring-blue-500/30 transition-all">
            <Search className="h-4 w-4 text-slate-400 ml-3 shrink-0" />
            <Input
              type="text"
              value={localQuery}
              onChange={(e) => { setLocalQuery(e.target.value); setSearchQuery(e.target.value); }}
              placeholder="시약명 / CAS / 제조사 / 카탈로그 번호"
              className="h-10 px-2.5 text-sm border-0 bg-transparent text-slate-900 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
            />
            <Button
              type="submit"
              size="sm"
              className="h-7 px-4 mr-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shrink-0"
              disabled={!localQuery.trim()}
            >
              검색
            </Button>
          </div>
        </form>

        {/* 유틸리티 — AI 라벨 스캔 */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* AI 라벨 스캔 */}
          <button
            onClick={() => setLabelScanOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors shrink-0"
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI 라벨 스캔</span>
          </button>
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
    </div>
  );
}