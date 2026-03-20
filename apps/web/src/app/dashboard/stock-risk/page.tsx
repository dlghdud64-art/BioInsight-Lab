"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Package,
  TrendingDown,
  Beaker,
  Ban,
  CheckCircle2,
  FileText,
  ArrowRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
type RiskStatus = "healthy" | "watch" | "reorder_due" | "critical" | "expiry_risk" | "quarantine" | "blocked";
type ReorderUrgency = "low" | "medium" | "high" | "critical";
type ExpiryActionType = "consume_first" | "discount_transfer" | "dispose" | "extend_review";
type ConversionState = "pending" | "converted" | "blocked" | "skipped";

interface StockHealthRow {
  id: string;
  itemLabel: string;
  location: string;
  available: number;
  threshold: number;
  unit: string;
  coverageDays: number;
  incoming: string;
  riskStatus: RiskStatus;
}

interface ReorderRow {
  id: string;
  itemLabel: string;
  type: string;
  urgency: ReorderUrgency;
  recommendedOrder: string;
  vendorHint: string;
  budgetImpact: string;
  conversionState: ConversionState;
  blockedReasons: string[];
}

interface ExpiryRow {
  id: string;
  itemLabel: string;
  lotNumber: string;
  actionType: ExpiryActionType;
  actionLabel: string;
  daysToExpiry: number;
  affectedQty: string;
  status: "pending" | "completed" | "in_progress";
}

// ── Status config ──────────────────────────────────────────────────
const RISK_BADGE: Record<RiskStatus, { label: string; className: string }> = {
  healthy: { label: "안전", className: "bg-green-900/40 text-green-300 border-green-700" },
  watch: { label: "관찰", className: "bg-blue-900/40 text-blue-300 border-blue-700" },
  reorder_due: { label: "재주문 필요", className: "bg-amber-900/40 text-amber-300 border-amber-700" },
  critical: { label: "긴급", className: "bg-red-900/40 text-red-300 border-red-700" },
  expiry_risk: { label: "만료 위험", className: "bg-orange-900/40 text-orange-300 border-orange-700" },
  quarantine: { label: "격리", className: "bg-purple-900/40 text-purple-300 border-purple-700" },
  blocked: { label: "차단", className: "bg-red-900/40 text-red-300 border-red-700" },
};

const URGENCY_BADGE: Record<ReorderUrgency, { label: string; className: string }> = {
  low: { label: "낮음", className: "bg-slate-700/60 text-slate-300 border-slate-600" },
  medium: { label: "보통", className: "bg-blue-900/40 text-blue-300 border-blue-700" },
  high: { label: "높음", className: "bg-amber-900/40 text-amber-300 border-amber-700" },
  critical: { label: "긴급", className: "bg-red-900/40 text-red-300 border-red-700" },
};

const EXPIRY_ACTION_LABEL: Record<ExpiryActionType, string> = {
  consume_first: "우선 사용",
  discount_transfer: "할인 이전",
  dispose: "폐기",
  extend_review: "연장 검토",
};

// ── Snapshot pills ─────────────────────────────────────────────────
const SNAPSHOT_DEFS: { key: string; label: string; icon: typeof AlertTriangle; getValue: (h: StockHealthRow[], r: ReorderRow[], e: ExpiryRow[]) => number; className: string }[] = [
  {
    key: "shortage",
    label: "부족 품목",
    icon: TrendingDown,
    getValue: (h) => h.filter((r) => r.riskStatus === "reorder_due" || r.riskStatus === "critical").length,
    className: "border-amber-800/50 bg-amber-900/20",
  },
  {
    key: "critical",
    label: "긴급 부족",
    icon: AlertTriangle,
    getValue: (h) => h.filter((r) => r.riskStatus === "critical").length,
    className: "border-red-800/50 bg-red-900/20",
  },
  {
    key: "expiry",
    label: "만료 임박",
    icon: Clock,
    getValue: (h) => h.filter((r) => r.riskStatus === "expiry_risk").length,
    className: "border-orange-800/50 bg-orange-900/20",
  },
  {
    key: "quarantine",
    label: "격리 제약",
    icon: Ban,
    getValue: (h) => h.filter((r) => r.riskStatus === "quarantine" || r.riskStatus === "blocked").length,
    className: "border-purple-800/50 bg-purple-900/20",
  },
];

// ── Mock data ──────────────────────────────────────────────────────
const MOCK_HEALTH: StockHealthRow[] = [
  { id: "sh-1", itemLabel: "Fetal Bovine Serum, 500ml", location: "냉동고 A-2", available: 3, threshold: 5, unit: "EA", coverageDays: 18, incoming: "PO-2026-0041 (2EA)", riskStatus: "reorder_due" },
  { id: "sh-2", itemLabel: "DMEM/F-12 Medium, 500ml", location: "냉장고 B-1", available: 12, threshold: 5, unit: "EA", coverageDays: 45, incoming: "—", riskStatus: "healthy" },
  { id: "sh-3", itemLabel: "Trypsin-EDTA 0.25%, 100ml", location: "냉장고 B-3", available: 1, threshold: 4, unit: "EA", coverageDays: 5, incoming: "RCV-2026-0018 (8EA)", riskStatus: "critical" },
  { id: "sh-4", itemLabel: "PBS pH 7.4, 1L", location: "상온 C-1", available: 8, threshold: 6, unit: "EA", coverageDays: 30, incoming: "—", riskStatus: "watch" },
  { id: "sh-5", itemLabel: "Penicillin-Streptomycin, 100ml", location: "냉동고 A-1", available: 2, threshold: 3, unit: "EA", coverageDays: 14, incoming: "—", riskStatus: "expiry_risk" },
  { id: "sh-6", itemLabel: "L-Glutamine, 100ml", location: "냉장고 B-2", available: 0, threshold: 2, unit: "EA", coverageDays: 0, incoming: "—", riskStatus: "blocked" },
  { id: "sh-7", itemLabel: "Collagenase Type IV, 1g", location: "냉동고 A-3", available: 4, threshold: 2, unit: "EA", coverageDays: 60, incoming: "—", riskStatus: "quarantine" },
];

const MOCK_REORDER: ReorderRow[] = [
  { id: "ro-1", itemLabel: "Fetal Bovine Serum, 500ml", type: "정기 보충", urgency: "high", recommendedOrder: "5 EA", vendorHint: "Sigma-Aldrich", budgetImpact: "₩4,250,000", conversionState: "pending", blockedReasons: [] },
  { id: "ro-2", itemLabel: "Trypsin-EDTA 0.25%, 100ml", type: "긴급 보충", urgency: "critical", recommendedOrder: "10 EA", vendorHint: "Thermo Fisher", budgetImpact: "₩525,000", conversionState: "pending", blockedReasons: [] },
  { id: "ro-3", itemLabel: "L-Glutamine, 100ml", type: "재고 복원", urgency: "critical", recommendedOrder: "5 EA", vendorHint: "Gibco", budgetImpact: "₩180,000", conversionState: "blocked", blockedReasons: ["예산 한도 초과 (분기 잔여: ₩120,000)", "승인권자 미지정"] },
  { id: "ro-4", itemLabel: "Penicillin-Streptomycin, 100ml", type: "만료 대체", urgency: "medium", recommendedOrder: "3 EA", vendorHint: "Sigma-Aldrich", budgetImpact: "₩165,000", conversionState: "pending", blockedReasons: [] },
];

const MOCK_EXPIRY: ExpiryRow[] = [
  { id: "ex-1", itemLabel: "Penicillin-Streptomycin, 100ml", lotNumber: "PS-2025-D12", actionType: "consume_first", actionLabel: "우선 사용", daysToExpiry: 21, affectedQty: "2 EA", status: "pending" },
  { id: "ex-2", itemLabel: "Collagenase Type IV, 1g", lotNumber: "COL-2025-E03", actionType: "extend_review", actionLabel: "연장 검토", daysToExpiry: 45, affectedQty: "1 EA", status: "in_progress" },
  { id: "ex-3", itemLabel: "BSA Fraction V, 100g", lotNumber: "BSA-2025-F08", actionType: "dispose", actionLabel: "폐기", daysToExpiry: 7, affectedQty: "1 EA", status: "pending" },
];

// ── Component ──────────────────────────────────────────────────────
export default function StockRiskPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"health" | "reorder" | "expiry">("health");
  const [search, setSearch] = useState("");

  const healthRows = MOCK_HEALTH;
  const reorderRows = MOCK_REORDER;
  const expiryRows = MOCK_EXPIRY;

  const filteredHealth = useMemo(() => {
    if (!search.trim()) return healthRows;
    const q = search.toLowerCase();
    return healthRows.filter((r) => r.itemLabel.toLowerCase().includes(q) || r.location.toLowerCase().includes(q));
  }, [healthRows, search]);

  const filteredReorder = useMemo(() => {
    if (!search.trim()) return reorderRows;
    const q = search.toLowerCase();
    return reorderRows.filter((r) => r.itemLabel.toLowerCase().includes(q));
  }, [reorderRows, search]);

  const filteredExpiry = useMemo(() => {
    if (!search.trim()) return expiryRows;
    const q = search.toLowerCase();
    return expiryRows.filter((r) => r.itemLabel.toLowerCase().includes(q) || r.lotNumber.toLowerCase().includes(q));
  }, [expiryRows, search]);

  const handleCreateQuote = (reorderId: string) => {
    // TODO: store.createQuoteFromReorder(reorderId)
    router.push("/dashboard/quotes");
  };

  const handleCompleteExpiry = (expiryId: string) => {
    // TODO: store.completeExpiryAction(expiryId)
    alert("만료 조치를 완료합니다");
  };

  // Readiness
  const reorderReadiness = reorderRows.some((r) => r.conversionState === "blocked") ? "blocked" : "ready";
  const expiryActionReadiness = expiryRows.some((r) => r.status === "pending") ? "blocked" : "ready";
  const procurementHandoffReadiness = reorderRows.some((r) => r.urgency === "critical" && r.conversionState === "pending") ? "ready" : "blocked";

  return (
    <div className="p-4 md:p-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">재고 위험 관리</h1>
        <p className="text-sm text-slate-400 mt-1">
          부족, 만료, 격리 위험을 감지하고 재주문 및 조치를 관리합니다
        </p>
      </div>

      {/* Risk Snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SNAPSHOT_DEFS.map((snap) => {
          const Icon = snap.icon;
          const value = snap.getValue(healthRows, reorderRows, expiryRows);
          return (
            <div
              key={snap.key}
              className={`flex items-center gap-3 px-4 py-3 border rounded-xl ${snap.className}`}
            >
              <Icon className="h-5 w-5 text-slate-400 shrink-0" />
              <div>
                <div className="text-xs text-slate-500">{snap.label}</div>
                <div className="text-lg font-bold text-slate-100 tabular-nums">{value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-bd">
        {(
          [
            { key: "health", label: "재고 현황" },
            { key: "reorder", label: "재주문 추천" },
            { key: "expiry", label: "만료 조치" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          placeholder="품목명, 위치, Lot 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-el border-bd text-sm"
        />
      </div>

      {/* ── Stock Health Tab ── */}
      {activeTab === "health" && (
        <div className="border border-bd rounded-xl overflow-hidden bg-pn">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bd bg-el/50">
                  <th className="text-left px-4 py-3 font-medium text-slate-400">품목</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-400">위치</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-400">가용</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-400">기준</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-400">커버리지</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-400">입고 예정</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-400">위험</th>
                </tr>
              </thead>
              <tbody>
                {filteredHealth.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      조건에 맞는 품목이 없습니다
                    </td>
                  </tr>
                )}
                {filteredHealth.map((row) => {
                  const rBadge = RISK_BADGE[row.riskStatus];
                  const ratio = row.threshold > 0 ? row.available / row.threshold : 0;
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-bd last:border-b-0 hover:bg-el/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-200">{row.itemLabel}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{row.location}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-mono ${
                            ratio < 0.5 ? "text-red-400" : ratio < 1 ? "text-amber-400" : "text-slate-200"
                          }`}
                        >
                          {row.available}
                        </span>
                        <span className="text-slate-500 ml-1">{row.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 font-mono">
                        {row.threshold} {row.unit}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-mono ${
                            row.coverageDays <= 7
                              ? "text-red-400"
                              : row.coverageDays <= 21
                              ? "text-amber-400"
                              : "text-slate-300"
                          }`}
                        >
                          {row.coverageDays}일
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{row.incoming}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${rBadge.className}`}>
                          {rBadge.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Reorder Tab ── */}
      {activeTab === "reorder" && (
        <div className="border border-bd rounded-xl overflow-hidden bg-pn">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bd bg-el/50">
                  <th className="text-left px-4 py-3 font-medium text-slate-400">품목</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-400">유형</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-400">긴급도</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-400">추천 수량</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-400">공급사</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-400">예산 영향</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-400">액션</th>
                </tr>
              </thead>
              <tbody>
                {filteredReorder.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      재주문 추천이 없습니다
                    </td>
                  </tr>
                )}
                {filteredReorder.map((row) => {
                  const uBadge = URGENCY_BADGE[row.urgency];
                  const isBlocked = row.conversionState === "blocked";
                  const isConverted = row.conversionState === "converted";
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-bd last:border-b-0 hover:bg-el/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-200">{row.itemLabel}</td>
                      <td className="px-4 py-3 text-slate-400">{row.type}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${uBadge.className}`}>
                          {uBadge.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{row.recommendedOrder}</td>
                      <td className="px-4 py-3 text-slate-400">{row.vendorHint}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        {row.budgetImpact}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="space-y-1">
                          <Button
                            size="sm"
                            variant={isBlocked ? "ghost" : "outline"}
                            onClick={() => handleCreateQuote(row.id)}
                            disabled={isBlocked || isConverted}
                            className="text-xs h-7 px-2 gap-1 border-bd"
                          >
                            {isConverted ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                전환 완료
                              </>
                            ) : (
                              <>
                                <ArrowRight className="h-3 w-3" />
                                견적 요청
                              </>
                            )}
                          </Button>
                          {isBlocked && row.blockedReasons.length > 0 && (
                            <div className="text-left">
                              {row.blockedReasons.map((reason, i) => (
                                <p key={i} className="text-xs text-red-400">
                                  {reason}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Expiry Tab ── */}
      {activeTab === "expiry" && (
        <div className="border border-bd rounded-xl overflow-hidden bg-pn">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bd bg-el/50">
                  <th className="text-left px-4 py-3 font-medium text-slate-400">품목</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-400">Lot</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-400">조치 유형</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-400">만료까지</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-400">영향 수량</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-400">상태</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-400">액션</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpiry.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      만료 조치 항목이 없습니다
                    </td>
                  </tr>
                )}
                {filteredExpiry.map((row) => {
                  const expiryTone =
                    row.daysToExpiry <= 7
                      ? "text-red-400"
                      : row.daysToExpiry <= 30
                      ? "text-orange-400"
                      : "text-amber-400";
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-bd last:border-b-0 hover:bg-el/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-200">{row.itemLabel}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">{row.lotNumber}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            row.actionType === "dispose"
                              ? "bg-red-900/30 text-red-300 border-red-700"
                              : row.actionType === "consume_first"
                              ? "bg-amber-900/30 text-amber-300 border-amber-700"
                              : "bg-blue-900/30 text-blue-300 border-blue-700"
                          }`}
                        >
                          {EXPIRY_ACTION_LABEL[row.actionType]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono font-medium ${expiryTone}`}>
                          {row.daysToExpiry}일
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{row.affectedQty}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            row.status === "completed"
                              ? "bg-green-900/40 text-green-300 border-green-700"
                              : row.status === "in_progress"
                              ? "bg-amber-900/40 text-amber-300 border-amber-700"
                              : "bg-slate-700/60 text-slate-300 border-slate-600"
                          }`}
                        >
                          {row.status === "completed"
                            ? "완료"
                            : row.status === "in_progress"
                            ? "진행 중"
                            : "대기"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCompleteExpiry(row.id)}
                          disabled={row.status === "completed"}
                          className="text-xs h-7 px-2"
                        >
                          {row.status === "completed" ? "완료됨" : "조치 완료"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Decision Panel */}
      <div className="border border-bd rounded-xl bg-pn p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-200">위험 대응 현황</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "재주문 전환", readiness: reorderReadiness },
            { label: "만료 조치", readiness: expiryActionReadiness },
            { label: "구매 핸드오프", readiness: procurementHandoffReadiness },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-sm">
              <div
                className={`h-2 w-2 rounded-full ${
                  item.readiness === "ready" ? "bg-green-400" : "bg-amber-400"
                }`}
              />
              <span className="text-slate-400">{item.label}:</span>
              <span className={item.readiness === "ready" ? "text-green-400" : "text-amber-300"}>
                {item.readiness === "ready" ? "준비 완료" : "조치 필요"}
              </span>
            </div>
          ))}
        </div>

        <div className="text-sm text-slate-400 bg-el/30 rounded-lg px-3 py-2">
          <span className="text-slate-500">권장 조치:</span>{" "}
          {reorderRows.filter((r) => r.urgency === "critical").length > 0
            ? `긴급 재주문 ${reorderRows.filter((r) => r.urgency === "critical").length}건을 우선 처리하세요`
            : "현재 긴급 조치 항목이 없습니다"}
        </div>
      </div>
    </div>
  );
}
