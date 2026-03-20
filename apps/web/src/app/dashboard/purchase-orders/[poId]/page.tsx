"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Send,
  Truck,
  AlertTriangle,
  FileText,
  Shield,
  User,
  Package,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
type POStatus =
  | "draft"
  | "pending_approval"
  | "approval_in_progress"
  | "approved"
  | "ready_to_issue"
  | "issued"
  | "acknowledged"
  | "partially_received"
  | "received"
  | "closed"
  | "cancelled"
  | "on_hold";

type ApprovalStepStatus = "pending" | "in_progress" | "approved" | "rejected" | "skipped";

interface ApprovalStep {
  stepNumber: number;
  stepTypeLabel: string;
  statusLabel: string;
  status: ApprovalStepStatus;
  assignee: string;
  decisionSummary: string;
  decidedAt: string | null;
}

interface POLineItem {
  lineNumber: number;
  itemLabel: string;
  orderedSummary: string;
  priceSummary: string;
  fulfillmentLabel: string;
  documentCoverage: string;
  substituteFlag: boolean;
}

interface PODetailVM {
  id: string;
  poNumber: string;
  vendorName: string;
  status: POStatus;
  statusLabel: string;
  totalAmountText: string;
  approvalStatusLabel: string;
  issueStatusLabel: string;
  acknowledgementStatusLabel: string;
  requiredByState: string;
  createdAt: string;
  approvalSteps: ApprovalStep[];
  lines: POLineItem[];
  issueReadiness: "ready" | "blocked";
  issueBlockedReason: string | null;
  receivingHandoffReadiness: "ready" | "blocked";
  receivingBlockedReason: string | null;
  recommendedNextAction: string;
  acknowledgementSummary: string | null;
}

// ── Status badges ──────────────────────────────────────────────────
const STATUS_BADGE: Record<POStatus, { label: string; className: string }> = {
  draft: { label: "초안", className: "bg-slate-700/60 text-slate-300 border-slate-600" },
  pending_approval: { label: "승인 대기", className: "bg-amber-900/40 text-amber-300 border-amber-700" },
  approval_in_progress: { label: "승인 진행", className: "bg-amber-900/40 text-amber-300 border-amber-700" },
  approved: { label: "승인 완료", className: "bg-blue-900/40 text-blue-300 border-blue-700" },
  ready_to_issue: { label: "발행 준비", className: "bg-blue-900/40 text-blue-300 border-blue-700" },
  issued: { label: "발행 완료", className: "bg-teal-900/40 text-teal-300 border-teal-700" },
  acknowledged: { label: "공급사 확인", className: "bg-green-900/40 text-green-300 border-green-700" },
  partially_received: { label: "부분 입고", className: "bg-orange-900/40 text-orange-300 border-orange-700" },
  received: { label: "입고 완료", className: "bg-green-900/40 text-green-300 border-green-700" },
  closed: { label: "종료", className: "bg-slate-700/60 text-slate-300 border-slate-600" },
  cancelled: { label: "취소", className: "bg-red-900/40 text-red-300 border-red-700" },
  on_hold: { label: "보류", className: "bg-amber-900/40 text-amber-300 border-amber-700" },
};

const STEP_STATUS_BADGE: Record<ApprovalStepStatus, { className: string }> = {
  pending: { className: "bg-slate-700/60 text-slate-300 border-slate-600" },
  in_progress: { className: "bg-amber-900/40 text-amber-300 border-amber-700" },
  approved: { className: "bg-green-900/40 text-green-300 border-green-700" },
  rejected: { className: "bg-red-900/40 text-red-300 border-red-700" },
  skipped: { className: "bg-slate-700/60 text-slate-400 border-slate-600" },
};

// ── Mock data ──────────────────────────────────────────────────────
const MOCK_PO: PODetailVM = {
  id: "po-001",
  poNumber: "PO-2026-0041",
  vendorName: "Sigma-Aldrich Korea",
  status: "pending_approval",
  statusLabel: "승인 대기",
  totalAmountText: "₩2,450,000",
  approvalStatusLabel: "1/3 단계 진행 중",
  issueStatusLabel: "미발행",
  acknowledgementStatusLabel: "대기 중",
  requiredByState: "2026-04-05",
  createdAt: "2026-03-18",
  approvalSteps: [
    {
      stepNumber: 1,
      stepTypeLabel: "부서장 승인",
      statusLabel: "승인 완료",
      status: "approved",
      assignee: "김연구",
      decisionSummary: "승인 — 예산 범위 내",
      decidedAt: "2026-03-18 14:30",
    },
    {
      stepNumber: 2,
      stepTypeLabel: "구매팀 검토",
      statusLabel: "진행 중",
      status: "in_progress",
      assignee: "이구매",
      decisionSummary: "",
      decidedAt: null,
    },
    {
      stepNumber: 3,
      stepTypeLabel: "재무팀 승인",
      statusLabel: "대기",
      status: "pending",
      assignee: "박재무",
      decisionSummary: "",
      decidedAt: null,
    },
  ],
  lines: [
    {
      lineNumber: 1,
      itemLabel: "Fetal Bovine Serum, 500ml",
      orderedSummary: "2 EA",
      priceSummary: "₩850,000 × 2",
      fulfillmentLabel: "미입고",
      documentCoverage: "COA 대기",
      substituteFlag: false,
    },
    {
      lineNumber: 2,
      itemLabel: "DMEM/F-12 Medium, 500ml",
      orderedSummary: "5 EA",
      priceSummary: "₩45,000 × 5",
      fulfillmentLabel: "미입고",
      documentCoverage: "완료",
      substituteFlag: false,
    },
    {
      lineNumber: 3,
      itemLabel: "Trypsin-EDTA 0.25%, 100ml",
      orderedSummary: "10 EA",
      priceSummary: "₩52,500 × 10",
      fulfillmentLabel: "미입고",
      documentCoverage: "완료",
      substituteFlag: true,
    },
  ],
  issueReadiness: "blocked",
  issueBlockedReason: "승인 프로세스 미완료 (2/3 단계 대기)",
  receivingHandoffReadiness: "blocked",
  receivingBlockedReason: "발주 미발행 상태",
  recommendedNextAction: "구매팀 검토 완료 후 재무팀 승인을 진행하세요",
  acknowledgementSummary: null,
};

// ── Component ──────────────────────────────────────────────────────
export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.poId as string;
  const [showApproval, setShowApproval] = useState(true);

  // TODO: Replace with useOpsStore() lookup by poId
  const po = MOCK_PO;
  const badge = STATUS_BADGE[po.status];

  const handleIssuePO = () => {
    // TODO: store.issuePO(poId)
    alert("발주를 발행합니다");
  };

  const handleRequestAck = () => {
    // TODO: store.requestAcknowledgement(poId)
    alert("공급사 확인을 요청합니다");
  };

  const handleStartReceiving = () => {
    router.push("/dashboard/receiving");
  };

  return (
    <div className="p-4 md:p-8 space-y-5">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/purchase-orders")}
          className="p-1.5 rounded-lg hover:bg-el transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-slate-400" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-100">{po.poNumber}</h1>
            <Badge variant="outline" className={`text-xs ${badge.className}`}>
              {badge.label}
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            {po.vendorName} &middot; {po.totalAmountText} &middot; 납기 {po.requiredByState}
          </p>
        </div>
      </div>

      {/* 3-column info bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "승인 상태", value: po.approvalStatusLabel, icon: Shield },
          { label: "발행 상태", value: po.issueStatusLabel, icon: Send },
          { label: "공급사 확인", value: po.acknowledgementStatusLabel, icon: CheckCircle2 },
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

      {/* Approval Timeline */}
      <div className="border border-bd rounded-xl bg-pn overflow-hidden">
        <button
          onClick={() => setShowApproval(!showApproval)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-el/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-200">승인 타임라인</span>
            <span className="text-xs text-slate-500">{po.approvalStatusLabel}</span>
          </div>
          {showApproval ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </button>
        {showApproval && (
          <div className="border-t border-bd">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bd bg-el/30">
                  <th className="text-left px-4 py-2.5 font-medium text-slate-400 w-12">#</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-400">단계</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-400">상태</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-400">담당자</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-400">결정 요약</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-400">일시</th>
                </tr>
              </thead>
              <tbody>
                {po.approvalSteps.map((step) => {
                  const stepBadge = STEP_STATUS_BADGE[step.status];
                  const isCurrent = step.status === "in_progress";
                  return (
                    <tr
                      key={step.stepNumber}
                      className={`border-b border-bd last:border-b-0 ${
                        isCurrent ? "bg-amber-900/10" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 text-slate-500 font-mono">{step.stepNumber}</td>
                      <td className="px-4 py-2.5 text-slate-200">{step.stepTypeLabel}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={`text-xs ${stepBadge.className}`}>
                          {step.statusLabel}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-500" />
                          {step.assignee}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">
                        {step.decisionSummary || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">
                        {step.decidedAt || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Line Table */}
      <div className="border border-bd rounded-xl bg-pn overflow-hidden">
        <div className="px-4 py-3 border-b border-bd flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-200">발주 품목</span>
          <span className="text-xs text-slate-500">{po.lines.length}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bd bg-el/30">
                <th className="text-left px-4 py-2.5 font-medium text-slate-400 w-12">#</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-400">품목</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-400">주문량</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-400">금액</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-400">입고</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-400">문서</th>
                <th className="text-center px-4 py-2.5 font-medium text-slate-400">대체</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line) => (
                <tr key={line.lineNumber} className="border-b border-bd last:border-b-0">
                  <td className="px-4 py-2.5 text-slate-500 font-mono">{line.lineNumber}</td>
                  <td className="px-4 py-2.5 text-slate-200">{line.itemLabel}</td>
                  <td className="px-4 py-2.5 text-slate-300">{line.orderedSummary}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                    {line.priceSummary}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{line.fulfillmentLabel}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs ${
                        line.documentCoverage === "완료" ? "text-green-400" : "text-amber-400"
                      }`}
                    >
                      {line.documentCoverage}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {line.substituteFlag && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-orange-900/30 text-orange-300 border-orange-700"
                      >
                        대체
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Acknowledgement Summary */}
      {po.acknowledgementSummary && (
        <div className="border border-bd rounded-xl bg-pn p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span className="text-sm font-medium text-slate-200">공급사 확인 요약</span>
          </div>
          <p className="text-sm text-slate-400">{po.acknowledgementSummary}</p>
        </div>
      )}

      {/* Decision Panel */}
      <div className="border border-bd rounded-xl bg-pn p-4 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-200">다음 단계</span>
        </div>

        {/* Readiness indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`h-2 w-2 rounded-full ${
                po.issueReadiness === "ready" ? "bg-green-400" : "bg-amber-400"
              }`}
            />
            <span className="text-slate-400">발행 준비:</span>
            <span className={po.issueReadiness === "ready" ? "text-green-400" : "text-amber-300"}>
              {po.issueReadiness === "ready" ? "준비 완료" : "차단됨"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`h-2 w-2 rounded-full ${
                po.receivingHandoffReadiness === "ready" ? "bg-green-400" : "bg-amber-400"
              }`}
            />
            <span className="text-slate-400">입고 핸드오프:</span>
            <span
              className={
                po.receivingHandoffReadiness === "ready" ? "text-green-400" : "text-amber-300"
              }
            >
              {po.receivingHandoffReadiness === "ready" ? "준비 완료" : "차단됨"}
            </span>
          </div>
        </div>

        {/* Recommended action */}
        <div className="text-sm text-slate-400 bg-el/30 rounded-lg px-3 py-2">
          <span className="text-slate-500">권장 조치:</span> {po.recommendedNextAction}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Button
              size="sm"
              onClick={handleIssuePO}
              disabled={po.issueReadiness !== "ready"}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              발주 발행
            </Button>
            {po.issueBlockedReason && po.issueReadiness !== "ready" && (
              <p className="text-xs text-red-400">{po.issueBlockedReason}</p>
            )}
          </div>
          <div className="space-y-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRequestAck}
              disabled={po.status !== "issued"}
              className="gap-1.5 border-bd"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              공급사 확인 요청
            </Button>
            {po.status !== "issued" && (
              <p className="text-xs text-slate-500">발행 후 요청 가능</p>
            )}
          </div>
          <div className="space-y-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleStartReceiving}
              disabled={po.receivingHandoffReadiness !== "ready"}
              className="gap-1.5 border-bd"
            >
              <Truck className="h-3.5 w-3.5" />
              입고 시작
            </Button>
            {po.receivingBlockedReason && po.receivingHandoffReadiness !== "ready" && (
              <p className="text-xs text-red-400">{po.receivingBlockedReason}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
