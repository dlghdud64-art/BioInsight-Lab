"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  ChevronRight,
  Truck,
  PackageCheck,
  ClipboardCheck,
  AlertTriangle,
  Clock,
  Database,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
type BatchStatus =
  | "expected"
  | "arrived"
  | "inspecting"
  | "posting_ready"
  | "posted"
  | "issue_flagged"
  | "closed";

interface ReceivingBatchListItemVM {
  id: string;
  receivingNumber: string;
  vendorName: string;
  batchStatus: BatchStatus;
  batchStatusLabel: string;
  poReference: string;
  lineProgressText: string;
  inspectionSummary: string;
  postingSummary: string;
  riskBadges: string[];
  receivedAt: string | null;
}

// ── Status config ──────────────────────────────────────────────────
const BATCH_STATUS_BADGE: Record<BatchStatus, { label: string; className: string }> = {
  expected: { label: "입고 예정", className: "bg-slate-700/60 text-slate-300 border-slate-600" },
  arrived: { label: "도착", className: "bg-blue-900/40 text-blue-300 border-blue-700" },
  inspecting: { label: "검수 중", className: "bg-amber-900/40 text-amber-300 border-amber-700" },
  posting_ready: { label: "반영 준비", className: "bg-teal-900/40 text-teal-300 border-teal-700" },
  posted: { label: "반영 완료", className: "bg-green-900/40 text-green-300 border-green-700" },
  issue_flagged: { label: "이슈 발생", className: "bg-red-900/40 text-red-300 border-red-700" },
  closed: { label: "종료", className: "bg-slate-700/60 text-slate-300 border-slate-600" },
};

const RISK_BADGE_STYLE: Record<string, string> = {
  damaged: "bg-red-900/30 text-red-300 border-red-700",
  temperature_excursion: "bg-red-900/30 text-red-300 border-red-700",
  coa_missing: "bg-orange-900/30 text-orange-300 border-orange-700",
  quarantine: "bg-amber-900/30 text-amber-300 border-amber-700",
  short_shipment: "bg-orange-900/30 text-orange-300 border-orange-700",
};

const RISK_LABEL: Record<string, string> = {
  damaged: "파손",
  temperature_excursion: "온도 이탈",
  coa_missing: "COA 미수",
  quarantine: "격리",
  short_shipment: "수량 부족",
};

// ── Summary pills ──────────────────────────────────────────────────
const PILL_DEFS: { key: string; label: string; statuses: BatchStatus[]; icon: typeof Clock }[] = [
  { key: "expected", label: "입고 예정", statuses: ["expected"], icon: Clock },
  { key: "arrived", label: "도착", statuses: ["arrived"], icon: Truck },
  { key: "inspecting", label: "검수 중", statuses: ["inspecting"], icon: ClipboardCheck },
  { key: "posting", label: "반영 준비", statuses: ["posting_ready"], icon: Database },
  { key: "issue", label: "이슈 발생", statuses: ["issue_flagged"], icon: AlertTriangle },
];

// ── Mock data ──────────────────────────────────────────────────────
const MOCK_BATCHES: ReceivingBatchListItemVM[] = [
  {
    id: "rcv-001",
    receivingNumber: "RCV-2026-0018",
    vendorName: "Sigma-Aldrich Korea",
    batchStatus: "inspecting",
    batchStatusLabel: "검수 중",
    poReference: "PO-2026-0038",
    lineProgressText: "3/4 수령",
    inspectionSummary: "2/3 완료",
    postingSummary: "미반영",
    riskBadges: ["coa_missing"],
    receivedAt: "2026-03-19",
  },
  {
    id: "rcv-002",
    receivingNumber: "RCV-2026-0017",
    vendorName: "Thermo Fisher Scientific",
    batchStatus: "arrived",
    batchStatusLabel: "도착",
    poReference: "PO-2026-0040",
    lineProgressText: "5/5 수령",
    inspectionSummary: "미시작",
    postingSummary: "미반영",
    riskBadges: [],
    receivedAt: "2026-03-19",
  },
  {
    id: "rcv-003",
    receivingNumber: "RCV-2026-0016",
    vendorName: "Bio-Rad Laboratories",
    batchStatus: "issue_flagged",
    batchStatusLabel: "이슈 발생",
    poReference: "PO-2026-0035",
    lineProgressText: "2/2 수령",
    inspectionSummary: "1/2 완료",
    postingSummary: "미반영",
    riskBadges: ["damaged", "temperature_excursion"],
    receivedAt: "2026-03-17",
  },
  {
    id: "rcv-004",
    receivingNumber: "RCV-2026-0015",
    vendorName: "Merck Millipore",
    batchStatus: "posting_ready",
    batchStatusLabel: "반영 준비",
    poReference: "PO-2026-0037",
    lineProgressText: "4/4 수령",
    inspectionSummary: "4/4 완료",
    postingSummary: "준비 완료",
    riskBadges: [],
    receivedAt: "2026-03-16",
  },
  {
    id: "rcv-005",
    receivingNumber: "RCV-2026-0014",
    vendorName: "VWR International",
    batchStatus: "expected",
    batchStatusLabel: "입고 예정",
    poReference: "PO-2026-0039",
    lineProgressText: "0/2 수령",
    inspectionSummary: "—",
    postingSummary: "—",
    riskBadges: [],
    receivedAt: null,
  },
  {
    id: "rcv-006",
    receivingNumber: "RCV-2026-0013",
    vendorName: "Agilent Technologies",
    batchStatus: "posted",
    batchStatusLabel: "반영 완료",
    poReference: "PO-2026-0036",
    lineProgressText: "8/8 수령",
    inspectionSummary: "8/8 완료",
    postingSummary: "반영 완료",
    riskBadges: [],
    receivedAt: "2026-03-14",
  },
];

// ── Component ──────────────────────────────────────────────────────
export default function ReceivingListPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // TODO: Replace with useOpsStore().receivingBatches + adapters
  const batches = MOCK_BATCHES;

  const filtered = useMemo(() => {
    let list = batches;
    if (statusFilter) {
      const pill = PILL_DEFS.find((p) => p.key === statusFilter);
      if (pill) list = list.filter((b) => pill.statuses.includes(b.batchStatus));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.receivingNumber.toLowerCase().includes(q) ||
          b.vendorName.toLowerCase().includes(q) ||
          b.poReference.toLowerCase().includes(q)
      );
    }
    return list;
  }, [batches, statusFilter, search]);

  const pillCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const pill of PILL_DEFS) {
      counts[pill.key] = batches.filter((b) => pill.statuses.includes(b.batchStatus)).length;
    }
    return counts;
  }, [batches]);

  return (
    <div className="p-4 md:p-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">입고 관리</h1>
        <p className="text-sm text-slate-400 mt-1">
          입고 기록, 검수, lot 관리, 재고 반영을 처리합니다
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
          placeholder="입고번호, 공급사, PO번호 검색..."
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
                <th className="text-left px-4 py-3 font-medium text-slate-400">입고번호</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">공급사</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">상태</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">PO</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">수령현황</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">검수</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">반영</th>
                <th className="text-left px-4 py-3 font-medium text-slate-400">이슈</th>
                <th className="text-center px-4 py-3 font-medium text-slate-400 w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500">
                    조건에 맞는 입고 건이 없습니다
                  </td>
                </tr>
              )}
              {filtered.map((batch) => {
                const badge = BATCH_STATUS_BADGE[batch.batchStatus];
                return (
                  <tr
                    key={batch.id}
                    onClick={() => router.push(`/dashboard/receiving/${batch.id}`)}
                    className="border-b border-bd last:border-b-0 hover:bg-el/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-slate-200">{batch.receivingNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{batch.vendorName}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${badge.className}`}>
                        {badge.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">{batch.poReference}</td>
                    <td className="px-4 py-3 text-slate-400">{batch.lineProgressText}</td>
                    <td className="px-4 py-3 text-slate-400">{batch.inspectionSummary}</td>
                    <td className="px-4 py-3 text-slate-400">{batch.postingSummary}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {batch.riskBadges.length === 0 && (
                          <span className="text-slate-600">—</span>
                        )}
                        {batch.riskBadges.map((risk) => (
                          <Badge
                            key={risk}
                            variant="outline"
                            className={`text-xs ${RISK_BADGE_STYLE[risk] || "bg-slate-700/60 text-slate-300 border-slate-600"}`}
                          >
                            {RISK_LABEL[risk] || risk}
                          </Badge>
                        ))}
                      </div>
                    </td>
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
