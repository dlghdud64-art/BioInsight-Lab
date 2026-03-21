"use client";

import { useMemo } from "react";
import { useTestFlow } from "../_components/test-flow-provider";
import { useCompareStore } from "@/lib/store/compare-store";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/products/price-display";
import {
  FileText,
  Trash2,
  Plus,
  Minus,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Package,
  GitCompare,
  Info,
} from "lucide-react";
import Link from "next/link";
import {
  calculateAssembly,
  type AssemblyReadinessLevel,
  type VendorGroup,
} from "../_components/request-assembly";

// ── Readiness Badge ──

const READINESS_CONFIG: Record<AssemblyReadinessLevel, { color: string; icon: any }> = {
  ready_to_write_request: { color: "text-emerald-400 bg-emerald-600/10 border-emerald-600/30", icon: CheckCircle2 },
  review_first: { color: "text-amber-400 bg-amber-600/10 border-amber-600/30", icon: AlertTriangle },
  blocked: { color: "text-red-400 bg-red-600/10 border-red-600/30", icon: AlertCircle },
  split_required: { color: "text-blue-400 bg-blue-600/10 border-blue-600/30", icon: Info },
};

// ── Page ──

export default function RequestAssemblyPage() {
  const {
    quoteItems,
    updateQuoteItem,
    removeQuoteItem,
    products,
    compareIds,
  } = useTestFlow();
  const { productIds: compareStoreIds } = useCompareStore();
  const router = useRouter();

  const allCompareIds = useMemo(
    () => [...new Set([...compareIds, ...compareStoreIds])],
    [compareIds, compareStoreIds],
  );

  const assembly = useMemo(
    () => calculateAssembly(quoteItems, allCompareIds, products),
    [quoteItems, allCompareIds, products],
  );

  const { level, label, detail, vendorGroups, summary, blockers, warnings } = assembly;
  const config = READINESS_CONFIG[level];
  const ReadinessIcon = config.icon;
  const canProceed = level !== "blocked";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden" style={{ backgroundColor: '#303236' }}>
      {/* ═══ Assembly Header ═══ */}
      <div className="shrink-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
          <div className="flex items-center gap-2">
            <Link href="/" className="shrink-0">
              <span className="text-sm font-bold text-slate-200 tracking-tight">LabAxis</span>
            </Link>
            <div className="w-px h-4 bg-bd" />
            <span className="text-xs font-medium text-slate-400">요청 조립</span>
          </div>
          <Link href="/test/search" className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            소싱으로
          </Link>
        </div>

        {/* Assembly status strip */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-bd flex-wrap" style={{ backgroundColor: '#393b3f' }}>
          {/* Readiness badge */}
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium ${config.color}`}>
            <ReadinessIcon className="h-3 w-3" />
            {label}
          </span>

          {/* KPI pills */}
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span>{summary.totalItems}건</span>
            <span className="text-slate-600">·</span>
            <span>{summary.vendorCount}곳</span>
            <span className="text-slate-600">·</span>
            <span>요청 {summary.requestCount}건</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-200 font-medium tabular-nums">₩{summary.totalAmount.toLocaleString("ko-KR")}</span>
          </div>

          {/* Warning pills */}
          {summary.noPriceCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-600/10 text-amber-400">
              <AlertTriangle className="h-2.5 w-2.5" />가격 미확인 {summary.noPriceCount}
            </span>
          )}
          {summary.inCompareCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-blue-600/10 text-blue-400">
              <GitCompare className="h-2.5 w-2.5" />비교중 {summary.inCompareCount}
            </span>
          )}
        </div>
      </div>

      {/* ═══ Grouped Request Work Surface ═══ */}
      <div className="flex-1 overflow-y-auto">
        {vendorGroups.length > 0 ? (
          <div className="px-3 py-3 space-y-3 max-w-4xl mx-auto">
            {vendorGroups.map((group) => (
              <VendorGroupCard
                key={group.vendorName}
                group={group}
                totalGroups={vendorGroups.length}
                onUpdateQty={(itemId, qty) => updateQuoteItem(itemId, { quantity: qty })}
                onRemove={(itemId) => removeQuoteItem(itemId)}
              />
            ))}

            {/* ═══ Vendor / Request Split Summary ═══ */}
            {vendorGroups.length > 1 && (
              <div className="rounded-lg border border-blue-600/20 bg-blue-600/5 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Info className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-xs font-medium text-blue-300">요청 분리 안내</span>
                </div>
                <p className="text-xs text-blue-300/80 mb-2">
                  공급사가 {vendorGroups.length}곳이므로 요청서가 {vendorGroups.length}건 생성됩니다.
                </p>
                <div className="space-y-1">
                  {vendorGroups.map((g) => (
                    <div key={g.vendorName} className="flex items-center justify-between text-xs">
                      <span className="text-blue-300">{g.vendorName}</span>
                      <span className="text-blue-400 font-medium tabular-nums">
                        {g.itemCount}건 · ₩{g.subtotal.toLocaleString("ko-KR")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Blockers & Warnings */}
            {(blockers.length > 0 || warnings.length > 0) && (
              <div className="space-y-2">
                {blockers.map((msg, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded border border-red-600/20 bg-red-600/5 text-xs text-red-300">
                    <AlertCircle className="h-3 w-3 shrink-0" />{msg}
                  </div>
                ))}
                {warnings.map((msg, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded border border-amber-600/20 bg-amber-600/5 text-xs text-amber-300">
                    <AlertTriangle className="h-3 w-3 shrink-0" />{msg}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-6">
            <Package className="h-8 w-8 text-slate-600 mb-3" />
            <p className="text-sm text-slate-300 mb-1">견적 요청 후보가 없습니다</p>
            <p className="text-xs text-slate-500 mb-4">소싱 워크벤치에서 제품을 담아주세요</p>
            <Link href="/test/search">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs">
                <ArrowLeft className="h-3 w-3 mr-1.5" />
                소싱 워크벤치로
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* ═══ Sticky Next-Step Action Area ═══ */}
      {quoteItems.length > 0 && (
        <div className="shrink-0 border-t border-bd px-4 py-2.5" style={{ backgroundColor: '#434548' }}>
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {/* Left: readiness summary */}
            <div className="flex items-center gap-2 min-w-0">
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium shrink-0 ${config.color}`}>
                <ReadinessIcon className="h-3 w-3" />
                {label}
              </span>
              <span className="text-[10px] text-slate-400 truncate hidden sm:block">{detail}</span>
            </div>

            {/* Right: CTAs */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2.5 text-[10px] text-slate-400 hover:text-red-400"
                onClick={() => { quoteItems.forEach((item: any) => removeQuoteItem(item.id)); }}
              >
                전체 해제
              </Button>
              <Button
                size="sm"
                className="h-7 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40"
                disabled={!canProceed}
                onClick={() => router.push("/test/quote/request")}
              >
                요청서 작성
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Vendor Group Card ──

function VendorGroupCard({
  group,
  totalGroups,
  onUpdateQty,
  onRemove,
}: {
  group: VendorGroup;
  totalGroups: number;
  onUpdateQty: (itemId: string, qty: number) => void;
  onRemove: (itemId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-bd overflow-hidden" style={{ backgroundColor: '#393b3f' }}>
      {/* Group header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-bd" style={{ backgroundColor: '#434548' }}>
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-200">{group.vendorName}</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-pn text-slate-400">{group.itemCount}건</Badge>
          {totalGroups > 1 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-blue-600/10 text-blue-400 border-blue-600/20">요청 1건</Badge>
          )}
        </div>
        <span className="text-sm font-semibold tabular-nums text-slate-100">
          ₩{group.subtotal.toLocaleString("ko-KR")}
        </span>
      </div>

      {/* Items */}
      <div className="divide-y divide-bd/50">
        {group.items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-100 truncate">{item.productName}</p>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                {item.catalogNumber && (
                  <span className="font-mono text-slate-500 truncate max-w-[100px]">Cat. {item.catalogNumber}</span>
                )}
                {item.isInCompare && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0 rounded bg-blue-600/10 text-blue-400">
                    <GitCompare className="h-2 w-2" />비교중
                  </span>
                )}
                {!item.hasPrice && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0 rounded bg-amber-600/10 text-amber-400">
                    가격 미확인
                  </span>
                )}
              </div>
            </div>

            {/* Quantity controls */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0 border-bd"
                onClick={() => onUpdateQty(item.id, Math.max(1, item.quantity - 1))}
                disabled={item.quantity <= 1}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-xs font-medium text-slate-200 w-7 text-center tabular-nums">{item.quantity}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0 border-bd"
                onClick={() => onUpdateQty(item.id, item.quantity + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {/* Price */}
            <div className="shrink-0 text-right w-20">
              {item.hasPrice ? (
                <span className="text-sm font-semibold tabular-nums text-slate-100 whitespace-nowrap">
                  <PriceDisplay price={item.lineTotal} currency="KRW" />
                </span>
              ) : (
                <span className="text-xs text-slate-500">문의</span>
              )}
            </div>

            {/* Remove */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-slate-500 hover:text-red-400 shrink-0"
              onClick={() => onRemove(item.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
