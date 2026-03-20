"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Package,
  FileText,
  AlertTriangle,
  Database,
  ChevronDown,
  ChevronUp,
  Truck,
  Beaker,
  ShieldAlert,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
type BatchStatus = "expected" | "arrived" | "inspecting" | "posting_ready" | "posted" | "issue_flagged" | "closed";
type InspectionStatus = "pending" | "passed" | "failed" | "waived";
type PostingReadiness = "ready" | "blocked";
type LotQuarantineStatus = "none" | "quarantined" | "released";

interface LotRecord {
  lotNumber: string;
  quantity: number;
  unit: string;
  expiryDate: string | null;
  expiryState: string;
  quarantineStatus: LotQuarantineStatus;
  documentCoverage: string;
}

interface ReceiptLine {
  lineNumber: number;
  itemLabel: string;
  orderedQty: string;
  receivedQty: string;
  condition: string;
  conditionBadge: string;
  documents: string;
  inspectionStatus: InspectionStatus;
  inspectionLabel: string;
  lotSummary: string;
  postingReadiness: string;
  lots: LotRecord[];
}

interface ReceivingDetailVM {
  id: string;
  receivingNumber: string;
  vendorName: string;
  batchStatus: BatchStatus;
  batchStatusLabel: string;
  poReference: string;
  receiptProgressLabel: string;
  inspectionProgressLabel: string;
  documentProgressLabel: string;
  lines: ReceiptLine[];
  inspectionReadiness: PostingReadiness;
  inspectionBlockedReason: string | null;
  postingReadiness: PostingReadiness;
  postingBlockedReason: string | null;
  inventoryReleaseReadiness: PostingReadiness;
  inventoryReleaseBlockedReason: string | null;
  recommendedNextAction: string;
  riskBadges: string[];
}

// ── Status config ──────────────────────────────────────────────────
const BATCH_BADGE: Record<BatchStatus, { label: string; className: string }> = {
  expected: { label: "입고 예정", className: "bg-slate-700/60 text-slate-300 border-slate-600" },
  arrived: { label: "도착", className: "bg-blue-900/40 text-blue-300 border-blue-700" },
  inspecting: { label: "검수 중", className: "bg-amber-900/40 text-amber-300 border-amber-700" },
  posting_ready: { label: "반영 준비", className: "bg-teal-900/40 text-teal-300 border-teal-700" },
  posted: { label: "반영 완료", className: "bg-green-900/40 text-green-300 border-green-700" },
  issue_flagged: { label: "이슈 발생", className: "bg-red-900/40 text-red-300 border-red-700" },
  closed: { label: "종료", className: "bg-slate-700/60 text-slate-300 border-slate-600" },
};

const INSPECTION_BADGE: Record<InspectionStatus, { label: string; className: string }> = {
  pending: { label: "대기", className: "bg-slate-700/60 text-slate-300 border-slate-600" },
  passed: { label: "합격", className: "bg-green-900/40 text-green-300 border-green-700" },
  failed: { label: "불합격", className: "bg-red-900/40 text-red-300 border-red-700" },
  waived: { label: "면제", className: "bg-slate-700/60 text-slate-400 border-slate-600" },
};

const CONDITION_BADGE_STYLE: Record<string, string> = {
  good: "text-green-400",
  damaged: "text-red-400",
  temperature_excursion: "text-red-400",
  partial: "text-amber-400",
};

const QUARANTINE_BADGE: Record<LotQuarantineStatus, { label: string; className: string }> = {
  none: { label: "—", className: "" },
  quarantined: { label: "격리 중", className: "bg-amber-900/30 text-amber-300 border-amber-700" },
  released: { label: "해제", className: "bg-green-900/30 text-green-300 border-green-700" },
};

const RISK_BADGE_STYLE: Record<string, string> = {
  damaged: "bg-red-900/30 text-red-300 border-red-700",
  temperature_excursion: "bg-red-900/30 text-red-300 border-red-700",
  coa_missing: "bg-orange-900/30 text-orange-300 border-orange-700",
  quarantine: "bg-amber-900/30 text-amber-300 border-amber-700",
};

const RISK_LABEL: Record<string, string> = {
  damaged: "파손",
  temperature_excursion: "온도 이탈",
  coa_missing: "COA 미수",
  quarantine: "격리",
};

// ── Mock data ──────────────────────────────────────────────────────
const MOCK_DETAIL: ReceivingDetailVM = {
  id: "rcv-001",
  receivingNumber: "RCV-2026-0018",
  vendorName: "Sigma-Aldrich Korea",
  batchStatus: "inspecting",
  batchStatusLabel: "검수 중",
  poReference: "PO-2026-0038",
  receiptProgressLabel: "3/4 수령",
  inspectionProgressLabel: "2/3 완료",
  documentProgressLabel: "2/3 수령",
  lines: [
    {
      lineNumber: 1,
      itemLabel: "Fetal Bovine Serum, 500ml",
      orderedQty: "2 EA",
      receivedQty: "2 EA",
      condition: "good",
      conditionBadge: "양호",
      documents: "COA 수령",
      inspectionStatus: "passed",
      inspectionLabel: "합격",
      lotSummary: "2 lots",
      postingReadiness: "준비 완료",
      lots: [
        {
          lotNumber: "FBS-2026-A01",
          quantity: 1,
          unit: "EA",
          expiryDate: "2027-06-15",
          expiryState: "15개월 (안전)",
          quarantineStatus: "none",
          documentCoverage: "COA 확인",
        },
        {
          lotNumber: "FBS-2026-A02",
          quantity: 1,
          unit: "EA",
          expiryDate: "2027-03-01",
          expiryState: "12개월 (안전)",
          quarantineStatus: "none",
          documentCoverage: "COA 확인",
        },
      ],
    },
    {
      lineNumber: 2,
      itemLabel: "DMEM/F-12 Medium, 500ml",
      orderedQty: "5 EA",
      receivedQty: "5 EA",
      condition: "good",
      conditionBadge: "양호",
      documents: "완료",
      inspectionStatus: "passed",
      inspectionLabel: "합격",
      lotSummary: "1 lot",
      postingReadiness: "준비 완료",
      lots: [
        {
          lotNumber: "DMEM-2026-B15",
          quantity: 5,
          unit: "EA",
          expiryDate: "2026-09-30",
          expiryState: "6개월 (주의)",
          quarantineStatus: "none",
          documentCoverage: "완료",
        },
      ],
    },
    {
      lineNumber: 3,
      itemLabel: "Trypsin-EDTA 0.25%, 100ml",
      orderedQty: "10 EA",
      receivedQty: "8 EA",
      condition: "partial",
      conditionBadge: "부분 수령",
      documents: "COA 대기",
      inspectionStatus: "pending",
      inspectionLabel: "대기",
      lotSummary: "1 lot",
      postingReadiness: "차단 (COA 미수)",
      lots: [
        {
          lotNumber: "TRP-2026-C08",
          quantity: 8,
          unit: "EA",
          expiryDate: "2026-12-15",
          expiryState: "9개월 (안전)",
          quarantineStatus: "quarantined",
          documentCoverage: "COA 대기",
        },
      ],
    },
  ],
  inspectionReadiness: "blocked",
  inspectionBlockedReason: "라인 3 검수 미완료",
  postingReadiness: "blocked",
  postingBlockedReason: "검수 완료 후 반영 가능 (라인 3 COA 대기)",
  inventoryReleaseReadiness: "blocked",
  inventoryReleaseBlockedReason: "재고 반영 미완료",
  recommendedNextAction: "라인 3 COA 수령 후 검수를 완료하고 재고 반영을 진행하세요",
  riskBadges: ["coa_missing"],
};

// ── Component ──────────────────────────────────────────────────────
export default function ReceivingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const receivingId = params.receivingId as string;
  const [expandedLots, setExpandedLots] = useState<Record<number, boolean>>({});

  // TODO: Replace with useOpsStore() lookup by receivingId
  const detail = MOCK_DETAIL;
  const badge = BATCH_BADGE[detail.batchStatus];

  const toggleLots = (lineNumber: number) => {
    setExpandedLots((prev) => ({ ...prev, [lineNumber]: !prev[lineNumber] }));
  };

  const handleCompleteInspection = (lineNumber: number) => {
    // TODO: store.completeInspection(receivingId, lineNumber)
    alert(`라인 ${lineNumber} 검수를 완료합니다`);
  };

  const handlePostToInventory = () => {
    // TODO: store.postToInventory(receivingId)
    alert("재고 반영을 시작합니다");
  };

  return (
    <div className="p-4 md:p-8 space-y-5">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/receiving")}
          className="p-1.5 rounded-lg hover:bg-el transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-slate-400" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-100">{detail.receivingNumber}</h1>
            <Badge variant="outline" className={`text-xs ${badge.className}`}>
              {badge.label}
            </Badge>
            {detail.riskBadges.map((risk) => (
              <Badge
                key={risk}
                variant="outline"
                className={`text-xs ${RISK_BADGE_STYLE[risk] || ""}`}
              >
                {RISK_LABEL[risk] || risk}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            {detail.vendorName} &middot; PO {detail.poReference}
          </p>
        </div>
      </div>

      {/* 3-info bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "수령 현황", value: detail.receiptProgressLabel, icon: Package },
          { label: "검수 현황", value: detail.inspectionProgressLabel, icon: ClipboardCheck },
          { label: "문서 현황", value: detail.documentProgressLabel, icon: FileText },
        ].map((info) => (
          <div
            key={info.label}
            className="flex items-center gap-3 px-4 py-3 bg-el/50 border border-bd rounded-lg"
          >
            <info.icon className="h-4 w-4 text-slate-500 shrink-0" />
            <div>
              <div className="text-xs text-slate-500">{info.label}</div>
              <div className="text-sm font-medium text-slate-200">{info.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Line Receipts Table */}
      <div className="border border-bd rounded-xl bg-pn overflow-hidden">
        <div className="px-4 py-3 border-b border-bd flex items-center gap-2">
          <Truck className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-200">수령 라인</span>
          <span className="text-xs text-slate-500">{detail.lines.length}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bd bg-el/30">
                <th className="text-left px-4 py-2.5 font-medium text-slate-400 w-10">#</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-400">품목</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-400">주문</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-400">수령</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-400">상태</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-400">문서</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-400">검수</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-400">Lot</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-400">반영</th>
                <th className="text-center px-4 py-2.5 font-medium text-slate-400">액션</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((line) => {
                const insBadge = INSPECTION_BADGE[line.inspectionStatus];
                const isExpanded = expandedLots[line.lineNumber];
                return (
                  <>
                    <tr
                      key={line.lineNumber}
                      className="border-b border-bd last:border-b-0"
                    >
                      <td className="px-4 py-2.5 text-slate-500 font-mono">{line.lineNumber}</td>
                      <td className="px-4 py-2.5 text-slate-200">{line.itemLabel}</td>
                      <td className="px-4 py-2.5 text-slate-400">{line.orderedQty}</td>
                      <td className="px-4 py-2.5 text-slate-300">{line.receivedQty}</td>
                      <td className="px-4 py-2.5">
                        <span className={CONDITION_BADGE_STYLE[line.condition] || "text-slate-400"}>
                          {line.conditionBadge}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={
                            line.documents === "완료" || line.documents.includes("수령")
                              ? "text-green-400"
                              : "text-amber-400"
                          }
                        >
                          {line.documents}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={`text-xs ${insBadge.className}`}>
                          {insBadge.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => toggleLots(line.lineNumber)}
                          className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {line.lotSummary}
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{line.postingReadiness}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCompleteInspection(line.lineNumber)}
                          disabled={line.inspectionStatus !== "pending"}
                          className="text-xs h-7 px-2"
                        >
                          검수 완료
                        </Button>
                      </td>
                    </tr>
                    {/* Lot expansion */}
                    {isExpanded && (
                      <tr key={`lot-${line.lineNumber}`} className="border-b border-bd">
                        <td colSpan={10} className="px-4 py-0">
                          <div className="py-3 pl-6 space-y-2">
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                              <Beaker className="h-3 w-3" />
                              Lot 기록
                            </div>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-500">
                                  <th className="text-left py-1 pr-4 font-medium">Lot 번호</th>
                                  <th className="text-left py-1 pr-4 font-medium">수량</th>
                                  <th className="text-left py-1 pr-4 font-medium">유효기한</th>
                                  <th className="text-left py-1 pr-4 font-medium">만료 상태</th>
                                  <th className="text-left py-1 pr-4 font-medium">격리</th>
                                  <th className="text-left py-1 font-medium">문서</th>
                                </tr>
                              </thead>
                              <tbody>
                                {line.lots.map((lot) => {
                                  const qBadge = QUARANTINE_BADGE[lot.quarantineStatus];
                                  const expiryRisk =
                                    lot.expiryState.includes("주의") || lot.expiryState.includes("위험");
                                  return (
                                    <tr key={lot.lotNumber} className="text-slate-300">
                                      <td className="py-1.5 pr-4 font-mono">{lot.lotNumber}</td>
                                      <td className="py-1.5 pr-4">
                                        {lot.quantity} {lot.unit}
                                      </td>
                                      <td className="py-1.5 pr-4 font-mono">
                                        {lot.expiryDate || "—"}
                                      </td>
                                      <td className="py-1.5 pr-4">
                                        <span
                                          className={expiryRisk ? "text-orange-400" : "text-green-400"}
                                        >
                                          {lot.expiryState}
                                        </span>
                                      </td>
                                      <td className="py-1.5 pr-4">
                                        {lot.quarantineStatus !== "none" ? (
                                          <Badge
                                            variant="outline"
                                            className={`text-xs ${qBadge.className}`}
                                          >
                                            {qBadge.label}
                                          </Badge>
                                        ) : (
                                          <span className="text-slate-600">—</span>
                                        )}
                                      </td>
                                      <td className="py-1.5">
                                        <span
                                          className={
                                            lot.documentCoverage.includes("대기")
                                              ? "text-amber-400"
                                              : "text-green-400"
                                          }
                                        >
                                          {lot.documentCoverage}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspection Summary */}
      <div className="border border-bd rounded-xl bg-pn p-4">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardCheck className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-200">검수 요약</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">전체 라인</div>
            <div className="text-slate-200 font-medium">{detail.lines.length}건</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">합격</div>
            <div className="text-green-400 font-medium">
              {detail.lines.filter((l) => l.inspectionStatus === "passed").length}건
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">대기</div>
            <div className="text-amber-400 font-medium">
              {detail.lines.filter((l) => l.inspectionStatus === "pending").length}건
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">불합격</div>
            <div className="text-red-400 font-medium">
              {detail.lines.filter((l) => l.inspectionStatus === "failed").length}건
            </div>
          </div>
        </div>
      </div>

      {/* Decision Panel */}
      <div className="border border-bd rounded-xl bg-pn p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-200">다음 단계</span>
        </div>

        {/* Readiness */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              label: "검수 완료",
              readiness: detail.inspectionReadiness,
              reason: detail.inspectionBlockedReason,
            },
            {
              label: "재고 반영",
              readiness: detail.postingReadiness,
              reason: detail.postingBlockedReason,
            },
            {
              label: "재고 출고",
              readiness: detail.inventoryReleaseReadiness,
              reason: detail.inventoryReleaseBlockedReason,
            },
          ].map((item) => (
            <div key={item.label} className="text-sm">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    item.readiness === "ready" ? "bg-green-400" : "bg-amber-400"
                  }`}
                />
                <span className="text-slate-400">{item.label}:</span>
                <span
                  className={item.readiness === "ready" ? "text-green-400" : "text-amber-300"}
                >
                  {item.readiness === "ready" ? "준비 완료" : "차단됨"}
                </span>
              </div>
              {item.reason && item.readiness !== "ready" && (
                <p className="text-xs text-red-400 mt-0.5 ml-4">{item.reason}</p>
              )}
            </div>
          ))}
        </div>

        {/* Recommended action */}
        <div className="text-sm text-slate-400 bg-el/30 rounded-lg px-3 py-2">
          <span className="text-slate-500">권장 조치:</span> {detail.recommendedNextAction}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Button
              size="sm"
              onClick={handlePostToInventory}
              disabled={detail.postingReadiness !== "ready"}
              className="gap-1.5"
            >
              <Database className="h-3.5 w-3.5" />
              재고 반영
            </Button>
            {detail.postingBlockedReason && detail.postingReadiness !== "ready" && (
              <p className="text-xs text-red-400">{detail.postingBlockedReason}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
