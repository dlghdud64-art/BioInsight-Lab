"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Search,
  ChevronRight,
  Clock,
  CheckCircle2,
  Send,
  Truck,
  Package,
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

interface PurchaseOrderListItemVM {
  id: string;
  poNumber: string;
  vendorName: string;
  status: POStatus;
  statusLabel: string;
  approvalStatusLabel: string;
  totalAmountText: string;
  requiredByState: string;
  lineProgressText: string;
  createdAt: string;
}

// ── Status config ──────────────────────────────────────────────────
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

// ── Summary pill categories ────────────────────────────────────────
const PILL_DEFS: { key: string; label: string; statuses: POStatus[]; icon: typeof Clock }[] = [
  { key: "approval", label: "승인 대기", statuses: ["pending_approval", "approval_in_progress"], icon: Clock },
  { key: "issue", label: "발행 준비", statuses: ["approved", "ready_to_issue"], icon: Send },
  { key: "ack", label: "공급사 확인 대기", statuses: ["issued"], icon: CheckCircle2 },
  { key: "receiving", label: "입고 진행", statuses: ["acknowledged", "partially_received"], icon: Truck },
];

// ── Mock data ──────────────────────────────────────────────────────
const MOCK_POS: PurchaseOrderListItemVM[] = [
  {
    id: "po-001",
    poNumber: "PO-2026-0041",
    vendorName: "Sigma-Aldrich Korea",
    status: "pending_approval",
    statusLabel: "승인 대기",
    approvalStatusLabel: "1/3 단계",
    totalAmountText: "₩2,450,000",
    requiredByState: "2026-04-05 (16일 후)",
    lineProgressText: "3 품목",
    createdAt: "2026-03-18",
  },
  {
    id: "po-002",
    poNumber: "PO-2026-0040",
    vendorName: "Thermo Fisher Scientific",
    status: "issued",
    statusLabel: "발행 완료",
    approvalStatusLabel: "승인 완료",
    totalAmountText: "₩5,120,000",
    requiredByState: "2026-04-01 (12일 후)",
    lineProgressText: "5 품목",
    createdAt: "2026-03-15",
  },
  {
    id: "po-003",
    poNumber: "PO-2026-0039",
    vendorName: "Bio-Rad Laboratories",
    status: "acknowledged",
    statusLabel: "공급사 확인",
    approvalStatusLabel: "승인 완료",
    totalAmountText: "₩1,870,000",
    requiredByState: "2026-03-28 (8일 후)",
    lineProgressText: "2 품목",
    createdAt: "2026-03-12",
  },
  {
    id: "po-004",
    poNumber: "PO-2026-0038",
    vendorName: "Merck Millipore",
    status: "partially_received",
    statusLabel: "부분 입고",
    approvalStatusLabel: "승인 완료",
    totalAmountText: "₩3,200,000",
    requiredByState: "2026-03-25 (5일 후)",
    lineProgressText: "4/6 품목 입고",
    createdAt: "2026-03-10",
  },
  {
    id: "po-005",
    poNumber: "PO-2026-0037",
    vendorName: "VWR International",
    status: "approved",
    statusLabel: "승인 완료",
    approvalStatusLabel: "승인 완료",
    totalAmountText: "₩980,000",
    requiredByState: "2026-04-10 (21일 후)",
    lineProgressText: "2 품목",
    createdAt: "2026-03-08",
  },
  {
    id: "po-006",
    poNumber: "PO-2026-0036",
    vendorName: "Agilent Technologies",
    status: "received",
    statusLabel: "입고 완료",
    approvalStatusLabel: "승인 완료",
    totalAmountText: "₩7,650,000",
    requiredByState: "완료",
    lineProgressText: "8/8 품목 입고",
    createdAt: "2026-03-01",
  },
  {
    id: "po-007",
    poNumber: "PO-2026-0035",
    vendorName: "Corning Inc.",
    status: "cancelled",
    statusLabel: "취소",
    approvalStatusLabel: "-",
    totalAmountText: "₩450,000",
    requiredByState: "-",
    lineProgressText: "1 품목",
    createdAt: "2026-02-28",
  },
];

// ── Component ──────────────────────────────────────────────────────
export default function PurchaseOrderListPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // TODO: Replace with useOpsStore().purchaseOrders + adapters
  const purchaseOrders = MOCK_POS;

  const filtered = useMemo(() => {
    let list = purchaseOrders;
    if (statusFilter) {
      const pill = PILL_DEFS.find((p) => p.key === statusFilter);
      if (pill) list = list.filter((po) => pill.statuses.includes(po.status));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (po) =>
          po.poNumber.toLowerCase().includes(q) ||
          po.vendorName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [purchaseOrders, statusFilter, search]);

  const pillCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const pill of PILL_DEFS) {
      counts[pill.key] = purchaseOrders.filter((po) =>
        pill.statuses.includes(po.status)
      ).length;
    }
    return counts;
  }, [purchaseOrders]);

  return (
    <div className="p-4 md:p-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">발주 관리</h1>
        <p className="text-sm text-slate-400 mt-1">
          승인, 발행, 공급사 확인, 입고 핸드오프 현황을 관리합니다
        </p>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {PILL_DEFS.map((pill) => {
          const Icon = pill.icon;
          const active = statusFilter === pill.key;
          return (
            <button
              key={pill.key}
              onClick={() => setStatusFilter(active ? null : pill.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? "bg-blue-900/40 text-blue-300 border-blue-700"
                  : "bg-el text-slate-400 border-bd hover:border-slate-500"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {pill.label}
              <span className="ml-1 tabular-nums">{pillCounts[pill.key]}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          placeholder="발주번호 또는 공급사 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-el border-bd text-sm"
        />
      </div>

      {/* Table */}
      <div className="border border-bd rounded-xl overflow-hidden bg-pn">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bd bg-el/50">
                <th className="text-left px-4 py-3 font-medium text-slate-400">발주번호</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">공급사</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">상태</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">승인</th>
                <th className="text-right px-4 py-3 font-medium text-slate-400">금액</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">납기</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">입고현황</th>
                <th className="text-center px-4 py-3 font-medium text-slate-400">액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    조건에 맞는 발주가 없습니다
                  </td>
                </tr>
              )}
              {filtered.map((po) => {
                const badge = STATUS_BADGE[po.status];
                return (
                  <tr
                    key={po.id}
                    onClick={() => router.push(`/dashboard/purchase-orders/${po.id}`)}
                    className="border-b border-bd last:border-b-0 hover:bg-el/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-slate-200">{po.poNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{po.vendorName}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${badge.className}`}>
                        {badge.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{po.approvalStatusLabel}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-200">
                      {po.totalAmountText}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{po.requiredByState}</td>
                    <td className="px-4 py-3 text-slate-400">{po.lineProgressText}</td>
                    <td className="px-4 py-3 text-center">
                      <ChevronRight className="h-4 w-4 text-slate-500 mx-auto" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
