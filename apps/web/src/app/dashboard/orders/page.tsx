"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useMemo, Suspense, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import {
  Search, Package, FileText, ChevronRight, CheckCircle2, AlertTriangle, AlertCircle,
  X, ArrowLeft, ArrowRight, Truck, Clock, Send, Pause, Zap,
} from "lucide-react";
import { getStageInfo, getNextActionLabel, canConvertToPO, type ProcurementStage, type ApprovalPolicy, type ApprovalStatus } from "@/lib/procurement-stage";
import { evaluateGuardrails, hasBlocker, getGuardrailSummary, SEVERITY_CONFIG, type GuardrailResult } from "@/lib/guardrail";
import { ImpactAnalysisModal, type ImpactAnalysisAPIResult } from "@/components/impact-analysis/impact-analysis-modal";
import type { ImpactAnalysisInput } from "@/lib/ai/impact-analysis-engine";
import { useBudgetStore, deriveBudgetControl } from "@/lib/store/budget-store";
import { useInventoryStore } from "@/lib/store/inventory-store";
import { useOrderQueueStore } from "@/lib/store/order-queue-store";
import { useFastTrackStore } from "@/lib/store/fast-track-store";
import type { FastTrackEvaluationInput } from "@/lib/ontology/fast-track/fast-track-engine";
import {
  getGlobalGovernanceEventBus,
  createGovernanceEvent,
} from "@/lib/ai/governance-event-bus";

// ── PO Conversion Item (mock-compatible) ──
interface POCandidate {
  id: string;
  title: string;
  vendor: string;
  items: Array<{ name: string; catalogNumber: string; quantity: number; unitPrice: number; lineTotal: number; leadTime: string }>;
  totalAmount: number;
  expectedDelivery: string;
  selectionReason: string;
  blockers: string[];
  approvalPolicy: ApprovalPolicy;
  approvalStatus: ApprovalStatus;
  stage: ProcurementStage;
}

// Mock data — will be replaced with real query
const MOCK_CANDIDATES: POCandidate[] = [
  {
    id: "poc-001",
    title: "Thermo Fisher FBS 외 2건",
    vendor: "Thermo Fisher Scientific",
    items: [
      { name: "Fetal Bovine Serum", catalogNumber: "10270106", quantity: 2, unitPrice: 450000, lineTotal: 900000, leadTime: "3일" },
      { name: "DMEM Medium 500ml", catalogNumber: "11965092", quantity: 5, unitPrice: 42000, lineTotal: 210000, leadTime: "2일" },
      { name: "Trypsin-EDTA 0.25%", catalogNumber: "25200056", quantity: 3, unitPrice: 38000, lineTotal: 114000, leadTime: "3일" },
    ],
    totalAmount: 1224000,
    expectedDelivery: "2026-03-25",
    selectionReason: "최저 총비용 + 납기 우선 + 기존 거래처",
    blockers: [],
    approvalPolicy: "none",
    approvalStatus: "not_required",
    stage: "po_conversion_candidate",
  },
  {
    id: "poc-002",
    title: "Sigma-Aldrich Acetone 외 1건",
    vendor: "Sigma-Aldrich",
    items: [
      { name: "Acetone HPLC Grade 2.5L", catalogNumber: "34850", quantity: 4, unitPrice: 85000, lineTotal: 340000, leadTime: "5일" },
    ],
    totalAmount: 340000,
    expectedDelivery: "2026-03-28",
    selectionReason: "규격 완전 일치",
    blockers: ["위험물 취급 문서 확인 필요"],
    approvalPolicy: "none",
    approvalStatus: "not_required",
    stage: "po_conversion_candidate",
  },
];

// ── Fast-Track evaluation input builder ─────────────────────────────────────
// PO candidate 를 FastTrackEvaluationInput 으로 변환한다. 실 데이터에서는
// vendor/product 레벨의 safetyProfile · 과거 구매 이력을 store 에서 읽어야 하지만,
// 현재 화면이 MOCK_CANDIDATES 기반이므로 candidate 의 blocker 문자열을
// 보수적으로 해석해 hazard/regulated 플래그를 유도한다.
function candidateToFastTrackInput(
  candidate: POCandidate,
): FastTrackEvaluationInput {
  const isHazardous = candidate.blockers.some(
    (b) => b.includes("위험물") || b.toLowerCase().includes("msds"),
  );
  const isRegulated = candidate.blockers.some(
    (b) => b.includes("규제") || b.includes("컴플라이언스"),
  );

  return {
    procurementCaseId: candidate.id,
    vendorId: candidate.vendor,
    vendorName: candidate.vendor,
    totalAmount: candidate.totalAmount,
    items: candidate.items.map((i) => ({
      productId: i.catalogNumber,
      productName: i.name,
      category: "reagent" as const,
      safetyProfile: isHazardous
        ? { hazardCodes: ["H225"], pictograms: [], ppe: [], storageClass: null }
        : { hazardCodes: [], pictograms: [], ppe: [], storageClass: null },
      regulatedFlag: isRegulated,
      manualReviewRequired: false,
    })),
    // 정상 구매 이력 (최근 3개월 이내 3회 이상 · issue 0) — 기존 거래처 가정.
    histories: candidate.items.map((i) => ({
      vendorId: candidate.vendor,
      productId: i.catalogNumber,
      successfulOrders: 4,
      lastOrderedAt: new Date().toISOString(),
      issueCount: 0,
    })),
  };
}

function POConversionContent() {
  const { data: session, status } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState("연구동 B1 시약실");
  const [poNote, setPoNote] = useState("");
  const [resolvedBlockers, setResolvedBlockers] = useState<Set<string>>(new Set());
  const [excludedItems, setExcludedItems] = useState<Set<string>>(new Set());
  // Impact analysis modal state (Phase 5: What-if simulation)
  const [impactModalOpen, setImpactModalOpen] = useState(false);
  const [impactInput, setImpactInput] = useState<ImpactAnalysisInput | null>(null);

  // Phase 5 store bindings — canonical truth (read-only for simulation)
  const budgets = useBudgetStore((s) => s.budgets);
  const inventoryItems = useInventoryStore((s) => s.items);
  const finalizeApproval = useOrderQueueStore((s) => s.finalizeApproval);
  const ordersFromStore = useOrderQueueStore((s) => s.orders);

  // Fast-Track store — eligible 권장을 상단 섹션에 노출하기 위한 구독.
  // recommendations selector 로 reference identity 를 안정화한다.
  const fastTrackRecommendations = useFastTrackStore((s) => s.recommendations);
  const bulkEvaluateFastTrack = useFastTrackStore((s) => s.bulkEvaluate);
  const markFastTrackAccepted = useFastTrackStore((s) => s.markAccepted);
  const dismissFastTrack = useFastTrackStore((s) => s.dismissRecommendation);

  // Queue 에 후보가 들어오는 시점(즉, MOCK_CANDIDATES 배열이 바뀔 때)에
  // 한 번 bulk 평가한다. drift 재평가는 publisher 내부에서 처리된다.
  // (AI 호출 없음 · deterministic · 동일 입력 → 동일 출력)
  useEffect(() => {
    const inputs = MOCK_CANDIDATES.map(candidateToFastTrackInput);
    bulkEvaluateFastTrack(inputs);
  }, [bulkEvaluateFastTrack]);

  // UI 체크박스 상태 — 어떤 Fast-Track 항목을 일괄 승인 대상으로 묶을지.
  const [fastTrackSelected, setFastTrackSelected] = useState<Set<string>>(new Set());

  // 현재 Queue 에 있는 candidate 중 eligible 인 것만 뽑아낸다.
  // reentry 가드: 수락 완료(accepted) · stale · dismissed 는 자동으로 제외됨.
  const eligibleFastTrackCandidates = useMemo(() => {
    return MOCK_CANDIDATES.filter((c) => {
      const rec = fastTrackRecommendations[c.id];
      return rec?.recommendationStatus === "eligible";
    });
  }, [fastTrackRecommendations]);

  // 일괄 승인 실행
  const handleFastTrackBulkApprove = async () => {
    const targets = Array.from(fastTrackSelected);
    if (targets.length === 0) return;

    // ① Fast-Track store 에 수락 이력 기록 (ActionLedger 가 즉시 반영)
    const markEntries = targets
      .map((id) => {
        const c = MOCK_CANDIDATES.find((x) => x.id === id);
        return c ? { procurementCaseId: id, vendorName: c.vendor } : null;
      })
      .filter((e): e is { procurementCaseId: string; vendorName: string } => e !== null);

    const acceptedEntries = markFastTrackAccepted(
      markEntries,
      session?.user?.email ?? "unknown",
    );

    // ② canonical mutation — 기존 finalizeApproval 경유 (예산 소진 포함)
    //    store 에 실제 order row 가 있을 때만 호출한다. (MOCK 전용 경로에서는
    //    store 에 대응 order 가 없을 수 있으므로 존재 여부를 확인한다.)
    for (const accepted of acceptedEntries) {
      const matchedOrder = ordersFromStore.find(
        (o) => o.id === accepted.procurementCaseId,
      );
      if (!matchedOrder) continue;
      const activeBudget = budgets[0] ?? null;
      try {
        await finalizeApproval({
          orderId: matchedOrder.id,
          approvedBy: session?.user?.email ?? "unknown",
          approvalComment: "⚡ Fast-Track 권장 수락 (일괄 승인)",
          budgetId: activeBudget?.id ?? null,
          orderAmount: accepted.totalAmount,
        });
      } catch {
        // approval 실패는 조용히 swallow — 다른 이벤트 경로(에러 toast)로 노출됨
      }
    }

    // ③ governance bus 에 Fast-Track accept 이벤트를 명시적으로 publish
    //    (audit trail — publisher 의 transition 이벤트와 별개의 사용자 action log)
    for (const accepted of acceptedEntries) {
      try {
        getGlobalGovernanceEventBus().publish(
          createGovernanceEvent("quote_chain", "fast_track_accepted", {
            caseId: accepted.procurementCaseId,
            poNumber: "",
            fromStatus: "eligible",
            toStatus: "accepted",
            actor: accepted.acceptedBy,
            detail: `⚡ 사용자가 AI의 Fast-Track 권장을 수락하여 승인함 — ${accepted.vendorName}`,
            severity: "info",
            chainStage: "quote_shortlist",
            affectedObjectIds: [`case:${accepted.procurementCaseId}`],
            payload: {
              source: "fast_track",
              recommendationObjectId: accepted.recommendationObjectId,
              reasonCodes: accepted.reasonCodes,
              totalAmount: accepted.totalAmount,
            },
          }),
        );
      } catch {
        // event bus 실패가 approval 경로를 막지 않음
      }
    }

    // ④ 선택 초기화
    setFastTrackSelected(new Set());
  };

  // 체크박스 토글
  const toggleFastTrackSelected = (caseId: string) => {
    setFastTrackSelected((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  };

  // In production: useQuery to fetch po_conversion_candidate items
  const candidates = MOCK_CANDIDATES;
  const selected = candidates.find(c => c.id === selectedId) ?? candidates[0];

  // Guard check — guardrail layer 기반
  const unresolvedBlockers = selected ? selected.blockers.filter(b => !resolvedBlockers.has(b)) : [];
  const approvalCleared = selected ? canConvertToPO(selected.approvalPolicy, selected.approvalStatus) : false;
  const activeItems = selected ? selected.items.filter((_, idx) => !excludedItems.has(`${selected.id}-${idx}`)) : [];
  const activeTotal = activeItems.reduce((sum, i) => sum + i.lineTotal, 0);

  // Guardrail evaluation
  const guardrailResults: GuardrailResult[] = useMemo(() => {
    if (!selected) return [];
    return evaluateGuardrails({
      stage: "po_conversion_candidate",
      totalAmount: activeTotal,
      budgetLimit: 5000000, // TODO: org policy에서 가져오기
      vendorApproved: true, // TODO: vendor approval 상태 연결
      approvalPolicy: selected.approvalPolicy,
      approvalStatus: selected.approvalStatus,
      isHazardous: selected.blockers.some(b => b.includes("위험물")),
      hazardousDocsReady: !selected.blockers.some(b => b.includes("위험물")),
    });
  }, [selected, activeTotal]);

  const guardrailBlocked = hasBlocker(guardrailResults);
  const canCreate = unresolvedBlockers.length === 0 && approvalCleared && activeItems.length > 0 && !guardrailBlocked;

  // Phase 5: 발주 영향 분석 모달 트리거
  // canonical truth는 store에서 읽어 simulation input으로 전달 (read-only).
  const openImpactAnalysis = () => {
    if (!selected || !canCreate) return;

    // ── 예산 바인딩: useBudgetStore에서 첫 활성 예산 사용 ──
    // 운영 단계에서는 selected ↔ budget 매핑 규칙을 도입할 예정이며,
    // 현재는 단일 예산 컨텍스트 기준 시뮬레이션.
    const activeBudget = budgets[0] ?? null;
    const budgetCtx = activeBudget
      ? (() => {
          const ctrl = deriveBudgetControl(activeBudget);
          return {
            budgetId: activeBudget.id,
            budgetName: activeBudget.name,
            total: ctrl.total,
            spent: ctrl.actual,
            committed: ctrl.committed + ctrl.reserved,
            periodEndDate: activeBudget.periodEnd,
          };
        })()
      : null;

    // ── 재고 바인딩: 발주 line item 중 재고에 매칭되는 첫 품목 사용 ──
    // 여러 품목 발주 시 대표 품목 1개로 회전율 영향을 계산 (운영 단계 확장 slot).
    const invCtx = (() => {
      for (const line of activeItems) {
        const matched = inventoryItems.find(
          (it) =>
            it.productId === line.catalogNumber ||
            it.productName?.toLowerCase().includes(line.name.toLowerCase()),
        );
        if (matched) {
          // 일 평균 소비량 추정: reorderPoint가 있으면 7일분 가정
          const dailyConsumption =
            matched.reorderPoint && matched.reorderPoint > 0
              ? matched.reorderPoint / 7
              : 1;
          return {
            itemId: matched.objectId,
            currentStock: matched.availableQuantity,
            dailyConsumption,
            reorderPoint: matched.reorderPoint ?? 0,
            incomingQuantity: line.quantity,
          };
        }
      }
      return null;
    })();

    setImpactInput({
      orderId: selected.id,
      itemName: selected.title,
      orderAmount: activeTotal,
      budget: budgetCtx,
      inventory: invCtx,
    });
    setImpactModalOpen(true);
  };

  // 최종 승인 시 호출 — canonical truth는 여기서만 단 한 번 mutate.
  // useOrderQueueStore.finalizeApproval은 ontology action(executeFinalizeApproval)
  // 경유로 예산 burnRate 재계산까지 수행하므로, 별도 broad invalidation 불필요.
  const handleConfirmImpact = async (result: ImpactAnalysisAPIResult) => {
    if (!selected) {
      setImpactInput(null);
      return;
    }
    const matchedOrder = ordersFromStore.find((o) => o.id === selected.id);
    const activeBudget = budgets[0] ?? null;

    // 배치 4: governance event bus publish (audit ledger 기록)
    // severity → governance severity 매핑
    const sev = result.report.severity;
    const governanceSeverity =
      sev === "blocked" ? "critical" : sev === "review" ? "warning" : "info";
    try {
      getGlobalGovernanceEventBus().publish(
        createGovernanceEvent("quote_chain", "impact_analysis_evaluated", {
          caseId: selected.id,
          poNumber: selected.id,
          fromStatus: "po_conversion_candidate",
          toStatus: "approval_gated",
          actor: session?.user?.email ?? "unknown",
          detail: result.simulation.summary.headline,
          severity: governanceSeverity,
          chainStage: "po_conversion",
          affectedObjectIds: activeBudget ? [activeBudget.id] : [],
          payload: {
            orderAmount: activeTotal,
            budgetDelta: result.simulation.budget?.availableDelta ?? null,
            depletionAdvancedDays:
              result.simulation.budget?.depletionAdvancedDays ?? null,
            riskBefore: result.simulation.budget?.riskBefore ?? null,
            riskAfter: result.simulation.budget?.riskAfter ?? null,
            source: result.source,
            recommendation: result.report.recommendation,
          },
        }),
      );
    } catch {
      // event bus 실패는 approval 경로를 막지 않음
    }

    try {
      await finalizeApproval({
        orderId: matchedOrder?.id ?? selected.id,
        approvedBy: session?.user?.email ?? "unknown",
        approvalComment: null,
        budgetId: activeBudget?.id ?? null,
        orderAmount: activeTotal,
      });
    } catch {
      // ontology action 내부에서 error는 store.error로 전파되므로 여기선 swallow
    } finally {
      setImpactInput(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="fixed inset-0 z-[55] flex items-center justify-center" style={{ backgroundColor: '#303236' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">

      {/* ═══ PO Decision Sub-Header ═══ */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-4 md:px-6 py-2.5 border-b border-bd" style={{ backgroundColor: '#393b3f' }}>
          <div className="flex items-center gap-2">
            <span className="text-xs md:text-sm font-medium text-slate-400">발주 실행</span>
          </div>
          <div className="flex items-center gap-3">
            {selected && <span className="text-lg font-bold tabular-nums text-slate-900 hidden sm:block">₩{activeTotal.toLocaleString("ko-KR")}</span>}
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium ${
              canCreate ? "text-emerald-400 bg-emerald-600/10 border-emerald-600/30" : "text-amber-400 bg-amber-600/10 border-amber-600/30"
            }`}>
              {canCreate ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {canCreate ? "생성 가능" : "조건 확인"}
            </span>
            <Link href="/dashboard/quotes"><Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500"><ArrowLeft className="h-3 w-3 mr-1" />워크큐</Button></Link>
          </div>
        </div>
        {/* Candidate selector strip */}
        <div className="flex items-center gap-2 px-4 md:px-6 py-2 border-b border-bd overflow-x-auto" style={{ backgroundColor: '#353739' }}>
          {candidates.map(c => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-all ${
                (selected?.id === c.id) ? "bg-blue-600/10 text-blue-300 border-blue-600/30" : "text-slate-400 border-transparent hover:bg-el"
              }`}>
              <FileText className="h-3.5 w-3.5" />
              <span>{c.vendor}</span>
              <span className="text-[10px] tabular-nums opacity-70">₩{c.totalAmount.toLocaleString("ko-KR")}</span>
              {c.blockers.length > 0 && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-600/15 text-amber-400">{c.blockers.length}</span>}
            </button>
          ))}
          <span className="text-[10px] text-slate-500 shrink-0 ml-1">{candidates.length}건 전환 후보</span>
        </div>
      </div>

      {/* ═══ Main: Center + Evidence Rail ═══ */}
      {selected && <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">

          {/* ═══ Fast-Track 권장 섹션 — 즉시 승인 가능 ═══ */}
          {/*
            규칙:
            - eligible 상태인 candidate 만 노출. stale/dismissed/accepted 는 자동 회수.
            - 체크박스는 사용자 선택이며, AI 가 대신 승인하지 않는다.
            - 버튼 비활성화는 선택 0건 시에만. (optimistic unlock 금지)
          */}
          {eligibleFastTrackCandidates.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-emerald-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Zap className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-900">
                    AI 권장: 즉시 승인 가능 (Fast-Track)
                  </span>
                  <span className="text-[10px] text-emerald-700">
                    · {eligibleFastTrackCandidates.length}건 · 과거 정상 구매 이력 기반
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleFastTrackBulkApprove}
                  disabled={fastTrackSelected.size === 0}
                  className="h-7 px-3 rounded text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  선택 항목 일괄 승인 ({fastTrackSelected.size})
                </button>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                {eligibleFastTrackCandidates.map((c) => {
                  const rec = fastTrackRecommendations[c.id];
                  const checked = fastTrackSelected.has(c.id);
                  const reasonLine = rec.reasons.map((r) => r.message).join(" · ");
                  return (
                    <div
                      key={c.id}
                      className="flex items-start gap-2.5 rounded-md border border-emerald-200 bg-white px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFastTrackSelected(c.id)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 focus:ring-1 shrink-0"
                        aria-label={`${c.vendor} Fast-Track 선택`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-900 truncate">
                            {c.vendor}
                          </span>
                          <span className="text-[10px] tabular-nums text-slate-600">
                            ₩{c.totalAmount.toLocaleString("ko-KR")}
                          </span>
                          <span className="text-[10px] text-emerald-700">
                            · 안전 점수 {(rec.safetyScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-600 truncate">
                          {reasonLine || "Fast-Track 기본 조건 충족"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissFastTrack(candidateToFastTrackInput(c), "사용자 수동 검토 요청")}
                        className="shrink-0 text-[10px] text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors"
                      >
                        검토 경로로
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Block A: Line Item 확정 */}
          <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
            <div className="px-4 py-2.5 border-b border-bd flex items-center justify-between" style={{ backgroundColor: '#434548' }}>
              <span className="text-xs font-medium text-slate-700">발주 대상 품목 ({activeItems.length}/{selected.items.length}건)</span>
              <span className="text-xs tabular-nums text-slate-900 font-semibold">₩{activeTotal.toLocaleString("ko-KR")}</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-bd/50 text-slate-500">
                  <th className="text-left px-4 py-2 font-medium">품목</th>
                  <th className="text-left px-2 py-2 font-medium">Cat.</th>
                  <th className="text-right px-2 py-2 font-medium">수량</th>
                  <th className="text-right px-2 py-2 font-medium">단가</th>
                  <th className="text-right px-2 py-2 font-medium">소계</th>
                  <th className="text-center px-2 py-2 font-medium">납기</th>
                  <th className="text-center px-2 py-2 font-medium">포함</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item, idx) => {
                  const key = `${selected.id}-${idx}`;
                  const excluded = excludedItems.has(key);
                  return (
                    <tr key={idx} className={`border-b border-bd/30 last:border-0 ${excluded ? "opacity-40" : ""}`}>
                      <td className="px-4 py-2 text-slate-700 truncate max-w-[200px]">{item.name}</td>
                      <td className="px-2 py-2 text-slate-500 font-mono">{item.catalogNumber}</td>
                      <td className="px-2 py-2 text-slate-700 tabular-nums text-right">×{item.quantity}</td>
                      <td className="px-2 py-2 text-slate-400 tabular-nums text-right">₩{item.unitPrice.toLocaleString("ko-KR")}</td>
                      <td className="px-2 py-2 text-slate-900 tabular-nums text-right font-medium">₩{item.lineTotal.toLocaleString("ko-KR")}</td>
                      <td className="px-2 py-2 text-slate-400 text-center">{item.leadTime}</td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setExcludedItems(prev => {
                          const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
                        })} className={`text-[10px] px-1.5 py-0.5 rounded ${excluded ? "text-red-400 bg-red-600/10" : "text-emerald-400 bg-emerald-600/10"}`}>
                          {excluded ? "제외" : "포함"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Block B: 발주 조건 확정 */}
          <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
            <div className="px-4 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
              <span className="text-xs font-medium text-slate-700">발주 조건</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">배송지</label>
                  <Input value={deliveryLocation} onChange={e => setDeliveryLocation(e.target.value)} className="h-8 text-xs bg-pn border-bd" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">희망 납기</label>
                  <Input value={selected.expectedDelivery} readOnly className="h-8 text-xs bg-pn border-bd text-slate-400" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">공급사 전달 메모</label>
                <Textarea value={poNote} onChange={e => setPoNote(e.target.value)} placeholder="발주 시 공급사에 전달할 메모" className="min-h-[60px] text-xs bg-pn border-bd resize-none" />
              </div>
            </div>
          </div>

          {/* Block C: 정책/문서/예산 가드 */}
          <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
            <div className="px-4 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
              <span className="text-xs font-medium text-slate-700">전환 가드</span>
            </div>
            <div className="p-4 space-y-2">
              {/* Approval guard */}
              <div className="flex items-center justify-between px-3 py-2 rounded border border-bd bg-pn">
                <div className="flex items-center gap-2 text-xs">
                  {approvalCleared ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                  <span className="text-slate-600">승인 확인</span>
                </div>
                <span className={`text-[10px] ${approvalCleared ? "text-emerald-400" : "text-red-400"}`}>
                  {selected.approvalPolicy === "none" ? "승인 불필요" : selected.approvalStatus === "externally_approved" ? "외부 승인 확인됨" : "외부 승인 대기"}
                </span>
              </div>
              {/* Line items guard */}
              <div className="flex items-center justify-between px-3 py-2 rounded border border-bd bg-pn">
                <div className="flex items-center gap-2 text-xs">
                  {activeItems.length > 0 ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                  <span className="text-slate-600">발주 대상</span>
                </div>
                <span className={`text-[10px] ${activeItems.length > 0 ? "text-emerald-400" : "text-red-400"}`}>{activeItems.length}건 확정</span>
              </div>
              {/* Blocker guards */}
              {selected.blockers.map((b, idx) => {
                const resolved = resolvedBlockers.has(b);
                return (
                  <div key={idx} className={`flex items-center justify-between px-3 py-2 rounded border ${resolved ? "border-emerald-600/20 bg-emerald-600/5" : "border-amber-600/20 bg-amber-600/5"}`}>
                    <div className="flex items-center gap-2 text-xs">
                      {resolved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                      <span className={resolved ? "text-slate-400 line-through" : "text-amber-300"}>{b}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setResolvedBlockers(prev => {
                      const next = new Set(prev); next.has(b) ? next.delete(b) : next.add(b); return next;
                    })}>{resolved ? "되돌리기" : "해결됨"}</Button>
                  </div>
                );
              })}
              {/* Guardrail layer results */}
              {guardrailResults.map((gr, idx) => (
                <div key={idx} className={`flex items-center justify-between px-3 py-2 rounded border ${SEVERITY_CONFIG[gr.severity].bgColor} ${SEVERITY_CONFIG[gr.severity].borderColor}`}>
                  <div className="flex items-center gap-2 text-xs">
                    {gr.severity === "blocked" ? <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    : gr.severity === "conditional" ? <AlertTriangle className="h-3.5 w-3.5 text-blue-400" />
                    : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                    <span className={SEVERITY_CONFIG[gr.severity].color}>{gr.message}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{gr.recommendedAction}</span>
                </div>
              ))}
              {selected.blockers.length === 0 && guardrailResults.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />모든 조건 충족
                </div>
              )}
            </div>
          </div>

          {/* Block D: 최종 전환 요약 */}
          <div className="rounded-lg border border-emerald-600/20 bg-emerald-600/5 px-4 py-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong className="text-emerald-400">{selected.vendor}</strong> 기준 {activeItems.length}개 품목,
              총 <strong className="text-slate-900">₩{activeTotal.toLocaleString("ko-KR")}</strong>,
              납기 {selected.expectedDelivery},
              {canCreate ? " 발주 실행 가능" : " 실행 조건 확인 필요"}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">PO 생성 후 Receiving 대기 상태로 이동 · 선택 근거와 문서는 PO 기록에 연결</p>
          </div>
        </div>

        {/* ═══ PO Evidence Rail (400px) ═══ */}
        <div className="hidden lg:flex w-[400px] shrink-0 border-l border-bd flex-col" style={{ backgroundColor: '#353739' }}>
          <div className="px-5 py-4 border-b border-bd">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">선택 근거</div>
            <p className="text-xs text-slate-600">{selected.selectionReason}</p>
          </div>
          <div className="px-5 py-3 border-b border-bd">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">발주 요약</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-slate-400">공급사</span><span className="text-slate-700 font-medium">{selected.vendor}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">품목</span><span className="text-slate-700">{activeItems.length}건</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">총액</span><span className="text-slate-700 tabular-nums font-medium">₩{activeTotal.toLocaleString("ko-KR")}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">납기</span><span className="text-slate-700">{selected.expectedDelivery}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">승인</span>
                <span className={approvalCleared ? "text-emerald-400" : "text-amber-400"}>
                  {selected.approvalPolicy === "none" ? "불필요" : approvalCleared ? "확인됨" : "외부 대기"}
                </span>
              </div>
            </div>
          </div>
          <div className="px-5 py-3 border-b border-bd">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">가드 상태</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                {canCreate ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <AlertTriangle className="h-3 w-3 text-amber-400" />}
                <span className={canCreate ? "text-emerald-400" : "text-amber-400"}>{canCreate ? "모든 조건 충족" : `${unresolvedBlockers.length}건 미해결`}</span>
              </div>
            </div>
          </div>
          <div className="flex-1" />
          {/* Rail footer CTA */}
          <div className="px-5 py-4 border-t border-bd shrink-0 space-y-2" style={{ backgroundColor: '#434548' }}>
            <Button size="sm" onClick={openImpactAnalysis} className="w-full h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40" disabled={!canCreate}>
              <Truck className="h-3 w-3 mr-1.5" />PO 생성
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] text-slate-400 border-bd">
                <Pause className="h-3 w-3 mr-1" />보류
              </Button>
              <Link href="/dashboard/quotes" className="flex-1">
                <Button size="sm" variant="outline" className="w-full h-7 text-[10px] text-slate-400 border-bd">워크큐</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>}

      {/* ═══ Phase 5: Impact Analysis Modal (What-if simulation) ═══ */}
      <ImpactAnalysisModal
        open={impactModalOpen}
        onOpenChange={setImpactModalOpen}
        input={impactInput}
        onConfirm={handleConfirmImpact}
        onRequestCorrection={async (result) => {
          // 배치 5: 교정 요청 — 미해결 blocker를 강제로 unresolved로 되돌려
          // guardrail 가드가 다시 노출되게 한다. canonical mutation은 guardrail 레벨에서만.
          if (selected) {
            setResolvedBlockers(new Set()); // 미해결 상태로 reset
          }
          getGlobalGovernanceEventBus().publish(
            createGovernanceEvent("quote_chain", "impact_analysis_correction_requested", {
              caseId: selected?.id ?? "unknown",
              poNumber: selected?.id ?? "unknown",
              fromStatus: "approval_gated",
              toStatus: "needs_correction",
              actor: session?.user?.email ?? "unknown",
              detail: `교정 요청 — ${result.simulation.summary.headline}`,
              severity: "warning",
              chainStage: "po_conversion",
              payload: { recommendation: result.report.recommendation },
            }),
          );
          setImpactInput(null);
        }}
        onReopenConversion={async (result) => {
          // 배치 5: PO 전환 재개 — excludedItems도 초기화하여 full re-entry
          setExcludedItems(new Set());
          setResolvedBlockers(new Set());
          getGlobalGovernanceEventBus().publish(
            createGovernanceEvent("quote_chain", "po_conversion_reopened_from_impact", {
              caseId: selected?.id ?? "unknown",
              poNumber: selected?.id ?? "unknown",
              fromStatus: "approval_gated",
              toStatus: "po_conversion_candidate",
              actor: session?.user?.email ?? "unknown",
              detail: `PO 전환 재개 — ${result.simulation.summary.headline}`,
              severity: "warning",
              chainStage: "po_conversion",
              payload: { recommendation: result.report.recommendation },
            }),
          );
          setImpactInput(null);
        }}
        headerHint={selected?.vendor}
      />

      {/* ═══ Sticky Action Dock (mobile) ═══ */}
      {selected && (
        <div className="lg:hidden shrink-0 border-t-2 border-bd px-4 py-3" style={{ backgroundColor: '#434548' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] ${canCreate ? "text-emerald-400" : "text-amber-400"}`}>
                {canCreate ? "생성 가능" : `${unresolvedBlockers.length}건 확인`}
              </span>
              <span className="text-xs tabular-nums text-slate-900 font-medium">₩{activeTotal.toLocaleString("ko-KR")}</span>
            </div>
            <Button size="sm" onClick={openImpactAnalysis} className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40" disabled={!canCreate}>
              PO 생성
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Phase 4: Multi-View System — View Switcher + Strategic Analytics
// ══════════════════════════════════════════════════════════════════════════════

type OrderView = "queue" | "analytics";

function ViewSwitcher({ current, onChange }: { current: OrderView; onChange: (v: OrderView) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-bd p-0.5" style={{ backgroundColor: '#353739' }}>
      <button
        onClick={() => onChange("queue")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
          current === "queue" ? "bg-blue-600/10 text-blue-300 border border-blue-600/30" : "text-slate-400 border border-transparent hover:text-slate-300"
        }`}
      >
        <FileText className="h-3 w-3" />
        발주 대기열
      </button>
      <button
        onClick={() => onChange("analytics")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
          current === "analytics" ? "bg-violet-600/10 text-violet-300 border border-violet-600/30" : "text-slate-400 border border-transparent hover:text-slate-300"
        }`}
      >
        <Package className="h-3 w-3" />
        전략적 분석
      </button>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 z-[55] flex items-center justify-center" style={{ backgroundColor: '#303236' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <OrdersPageContent />
    </Suspense>
  );
}

function OrdersPageContent() {
  const [view, setView] = useState<OrderView>("queue");

  if (view === "analytics") {
    return <StrategicAnalyticsView onBack={() => setView("queue")} />;
  }

  return <POConversionContentWithSwitcher onViewChange={setView} />;
}

/** 기존 POConversionContent + ViewSwitcher 통합 */
function POConversionContentWithSwitcher({ onViewChange }: { onViewChange: (v: OrderView) => void }) {
  return (
    <div className="fixed inset-0 z-[55] flex flex-col overflow-hidden" style={{ backgroundColor: '#303236' }}>
      <div className="shrink-0 flex items-center justify-between px-4 md:px-6 py-2 border-b border-bd" style={{ backgroundColor: '#434548' }}>
        <div className="flex items-center gap-2">
          <Link href="/" className="shrink-0"><span className="text-sm md:text-lg font-bold text-slate-700 tracking-tight">LabAxis</span></Link>
          <div className="w-px h-5 bg-bd" />
          <ViewSwitcher current="queue" onChange={onViewChange} />
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={null}>
          <POConversionContent />
        </Suspense>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AI Agent Console — Thought Process Visualization
// ══════════════════════════════════════════════════════════════════════════════

interface ThoughtStep {
  id: string;
  phase: "intent" | "ontology" | "plan" | "execute" | "done" | "error";
  label: string;
  detail?: string;
  status: "running" | "done" | "error";
  timestamp: number;
}

const PHASE_ICON: Record<ThoughtStep["phase"], string> = {
  intent: "◆",
  ontology: "◇",
  plan: "▸",
  execute: "⚙",
  done: "✓",
  error: "✗",
};

const PHASE_COLOR: Record<ThoughtStep["phase"], string> = {
  intent: "text-blue-400",
  ontology: "text-violet-400",
  plan: "text-amber-400",
  execute: "text-emerald-400",
  done: "text-green-400",
  error: "text-red-400",
};

function AgentConsoleTerminal({ steps, isRunning }: { steps: ThoughtStep[]; isRunning: boolean }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [steps]);

  if (steps.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="mt-2 max-h-48 overflow-y-auto rounded-md border border-slate-700/60 bg-slate-950/80 p-3 font-mono text-[11px] leading-relaxed"
    >
      {steps.map((step) => (
        <div key={step.id} className="flex items-start gap-2 py-0.5">
          <span className={cn("shrink-0 w-3 text-center", PHASE_COLOR[step.phase])}>
            {step.status === "running" ? (
              <span className="inline-block h-2 w-2 rounded-full bg-current animate-pulse" />
            ) : (
              PHASE_ICON[step.phase]
            )}
          </span>
          <span className={cn("flex-1", step.status === "running" ? "text-slate-300" : "text-slate-500")}>
            <span className={cn("font-medium", PHASE_COLOR[step.phase])}>{step.label}</span>
            {step.detail && <span className="text-slate-600 ml-1.5">— {step.detail}</span>}
          </span>
          <span className="text-[9px] text-slate-700 tabular-nums shrink-0">
            {new Date(step.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      ))}
      {isRunning && (
        <div className="flex items-center gap-1.5 py-0.5 text-slate-600">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
          <span>처리 중...</span>
        </div>
      )}
    </div>
  );
}

/** Phase 4: Strategic Analytics View */
function StrategicAnalyticsView({ onBack }: { onBack: () => void }) {
  // AI Agent Console state
  const [nlInput, setNlInput] = React.useState("");
  const [thoughtSteps, setThoughtSteps] = React.useState<ThoughtStep[]>([]);
  const [isAgentRunning, setIsAgentRunning] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<string | null>(null);

  const addStep = React.useCallback((phase: ThoughtStep["phase"], label: string, detail?: string, status: ThoughtStep["status"] = "done") => {
    setThoughtSteps(prev => [...prev, { id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, phase, label, detail, status, timestamp: Date.now() }]);
  }, []);

  const updateLastStep = React.useCallback((updates: Partial<ThoughtStep>) => {
    setThoughtSteps(prev => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      copy[copy.length - 1] = { ...copy[copy.length - 1], ...updates };
      return copy;
    });
  }, []);

  async function handleNlCommand() {
    if (!nlInput.trim() || isAgentRunning) return;
    const command = nlInput.trim();
    setIsAgentRunning(true);
    setThoughtSteps([]);
    setLastResult(null);

    try {
      // Step 1: Intent Analysis
      addStep("intent", "의도 분석 중...", `"${command}"`, "running");
      await new Promise(r => setTimeout(r, 500));

      const { parseNaturalLanguageAction } = await import("@/lib/ontology/ai/ontology-ai-service");
      const result = parseNaturalLanguageAction(command);
      updateLastStep({ label: "의도 분석 완료", status: "done", detail: result.parsed ? `${result.actionType} 감지` : "미인식 명령" });

      if (!result.parsed) {
        addStep("error", "명령 인식 실패", "예: '승인 대기 중인 모든 주문 승인해줘'");
        setLastResult("명령을 인식하지 못했습니다.");
        return;
      }

      // Step 2: Ontology Mapping
      addStep("ontology", "온톨로지 매핑 중...", `${result.actionType} → Object/Action 해석`, "running");
      await new Promise(r => setTimeout(r, 600));
      updateLastStep({
        label: "온톨로지 매핑 완료",
        status: "done",
        detail: `대상: ${result.targetFilter.scope} / 필터: ${result.targetFilter.statusFilter || "전체"}`
      });

      // Step 3: Execution Plan
      addStep("plan", "실행 계획 수립 중...", undefined, "running");
      await new Promise(r => setTimeout(r, 400));

      let planDetail = `액션: ${result.actionType}`;
      if (result.targetFilter.vendorFilter) planDetail += ` / 벤더: ${result.targetFilter.vendorFilter}`;
      if (result.targetFilter.amountMax) planDetail += ` / 금액 상한: ${result.targetFilter.amountMax.toLocaleString()}원`;
      updateLastStep({ label: "실행 가능한 액션 도출", status: "done", detail: planDetail });

      // Step 4: Execution (simulated)
      const targetCount = result.targetFilter.scope === "all" ? 5 : result.targetFilter.scope === "batch" ? 3 : 1;
      addStep("execute", `개별 항목 처리 중...`, `총 ${targetCount}건`, "running");
      await new Promise(r => setTimeout(r, 800));
      updateLastStep({ label: `${targetCount}건 처리 완료`, status: "done", detail: `신뢰도 ${Math.round(result.confidence * 100)}%` });

      // Step 5: Done
      addStep("done", "명령 실행 완료", `${result.actionType} — ${targetCount}건 처리됨`);
      setLastResult(`${result.actionType}: ${targetCount}건 처리 완료 (신뢰도 ${Math.round(result.confidence * 100)}%)`);
    } catch {
      addStep("error", "실행 실패", "NL 파서 로드 오류");
      setLastResult("처리 중 오류가 발생했습니다.");
    } finally {
      setIsAgentRunning(false);
    }
  }

  // Mock KPI data (production: from Zustand stores)
  const mockKPIs = React.useMemo(() => ({
    budgets: [
      { budgetId: "b1", budgetName: "연구 시약 예산", totalAmount: 50000000, totalSpent: 32000000, committed: 5000000, available: 13000000, burnRate: 64, periodEnd: "2026-06-30", riskLevel: "caution" as const },
      { budgetId: "b2", budgetName: "장비 유지보수", totalAmount: 20000000, totalSpent: 18500000, committed: 0, available: 1500000, burnRate: 93, periodEnd: "2026-06-30", riskLevel: "critical" as const },
      { budgetId: "b3", budgetName: "소모품 일반", totalAmount: 10000000, totalSpent: 3200000, committed: 1000000, available: 5800000, burnRate: 32, periodEnd: "2026-06-30", riskLevel: "safe" as const },
    ],
    inventoryRisks: [
      { itemId: "i1", itemName: "FBS (Fetal Bovine Serum)", stockStatus: "low_stock", daysUntilDepletion: 12, quantity: 3, reorderPoint: 5 },
      { itemId: "i2", itemName: "Trypsin-EDTA 0.25%", stockStatus: "out_of_stock", daysUntilDepletion: 0, quantity: 0, reorderPoint: 2 },
      { itemId: "i3", itemName: "DMEM Medium 500ml", stockStatus: "in_stock", daysUntilDepletion: 45, quantity: 12, reorderPoint: 4 },
      { itemId: "i4", itemName: "Acetone HPLC Grade", stockStatus: "low_stock", daysUntilDepletion: 8, quantity: 2, reorderPoint: 3 },
    ],
    monthlyVolume: [
      { month: "2026-01", orderCount: 12, totalAmount: 8500000, avgProcessingDays: 5 },
      { month: "2026-02", orderCount: 15, totalAmount: 12300000, avgProcessingDays: 4 },
      { month: "2026-03", orderCount: 18, totalAmount: 15200000, avgProcessingDays: 4 },
      { month: "2026-04", orderCount: 8, totalAmount: 6800000, avgProcessingDays: 3 },
    ],
    orderStatusDistribution: [
      { status: "draft", label: "초안", count: 3, color: "#64748b" },
      { status: "pending_approval", label: "승인 대기", count: 5, color: "#f59e0b" },
      { status: "approved", label: "승인 완료", count: 4, color: "#3b82f6" },
      { status: "po_created", label: "PO 생성", count: 2, color: "#8b5cf6" },
      { status: "sent", label: "발송 완료", count: 6, color: "#10b981" },
      { status: "received", label: "수령 완료", count: 8, color: "#059669" },
    ],
  }), []);

  // Dynamic import of StrategicAnalytics
  const [AnalyticsComponent, setAnalyticsComponent] = React.useState<React.ComponentType<any> | null>(null);

  React.useEffect(() => {
    import("@/components/ontology/strategic-analytics").then(mod => {
      setAnalyticsComponent(() => mod.StrategicAnalytics);
    });
  }, []);

  return (
    <div className="fixed inset-0 z-[55] flex flex-col overflow-hidden" style={{ backgroundColor: '#303236' }}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 md:px-6 py-2 border-b border-bd" style={{ backgroundColor: '#434548' }}>
        <div className="flex items-center gap-2">
          <Link href="/" className="shrink-0"><span className="text-sm md:text-lg font-bold text-slate-700 tracking-tight">LabAxis</span></Link>
          <div className="w-px h-5 bg-bd" />
          <ViewSwitcher current="analytics" onChange={(v) => { if (v === "queue") onBack(); }} />
        </div>
      </div>

      {/* AI Agent Console */}
      <div className="shrink-0 px-4 md:px-6 py-2 border-b border-bd" style={{ backgroundColor: '#353739' }}>
        <div className="max-w-3xl">
          {/* Command Input */}
          <div className={cn(
            "relative rounded-lg border transition-all duration-300",
            isAgentRunning
              ? "border-blue-500/50 ring-2 ring-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]"
              : "border-slate-700 hover:border-slate-600"
          )}>
            {isAgentRunning && (
              <div className="absolute inset-0 rounded-lg animate-pulse bg-blue-500/[0.03] pointer-events-none" />
            )}
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span className={cn(
                "shrink-0 text-[10px] font-mono font-bold tracking-wider",
                isAgentRunning ? "text-blue-400" : "text-slate-600"
              )}>
                {isAgentRunning ? "● AGENT" : "▸ AGENT"}
              </span>
              <input
                type="text"
                value={nlInput}
                onChange={e => setNlInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleNlCommand(); }}
                placeholder="자연어 명령 입력 — 예: '승인 대기 중인 모든 주문 승인해줘'"
                disabled={isAgentRunning}
                className="flex-1 bg-transparent text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleNlCommand}
                disabled={isAgentRunning || !nlInput.trim()}
                className={cn(
                  "shrink-0 rounded px-3 py-1 text-[10px] font-medium transition-all active:scale-95",
                  isAgentRunning
                    ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                    : "bg-blue-600/80 hover:bg-blue-500 text-white"
                )}
              >
                {isAgentRunning ? "처리 중..." : "실행"}
              </button>
            </div>
          </div>

          {/* Result badge */}
          {lastResult && !isAgentRunning && thoughtSteps.length === 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] text-emerald-500/80 font-medium">{lastResult}</span>
              <button onClick={() => setLastResult(null)} className="text-slate-600 hover:text-slate-400">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Thought Process Terminal */}
          <AgentConsoleTerminal steps={thoughtSteps} isRunning={isAgentRunning} />

          {/* Collapse terminal after done */}
          {thoughtSteps.length > 0 && !isAgentRunning && (
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[10px] text-emerald-500/80 font-medium">{lastResult}</span>
              <button
                onClick={() => { setThoughtSteps([]); }}
                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
              >
                터미널 닫기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
        {AnalyticsComponent ? (
          <AnalyticsComponent kpis={mockKPIs} />
        ) : (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
