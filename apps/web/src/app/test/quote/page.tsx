"use client";

import { useMemo, useEffect } from "react";
import { useTestFlow } from "../_components/test-flow-provider";
import { useCompareStore } from "@/lib/store/compare-store";
import { useSession } from "next-auth/react";
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
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  // Auth gate — request 계열 route는 로그인 필요
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace(`/auth/signin?callbackUrl=${encodeURIComponent("/app/quote")}`);
    }
  }, [authStatus, router]);

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
        <div className="flex items-center justify-between px-4 md:px-6 py-2.5 md:py-3 border-b border-bd bg-el">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-1.5 shrink-0">
              <span className="text-base md:text-lg font-bold text-slate-100 tracking-tight">LabAxis</span>
              <span className="text-xs md:text-sm font-semibold text-slate-400">요청 조립</span>
            </Link>
            <div className="w-px h-5 bg-bd hidden sm:block" />
            <span className="text-xs text-slate-400 hidden sm:block">견적 요청 조립 워크벤치</span>
          </div>
          <Link href="/app/search" className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />소싱으로
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
            <button
              onClick={() => router.push("/app/compare")}
              className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-colors cursor-pointer"
            >
              <GitCompare className="h-2.5 w-2.5" />비교중 {summary.inCompareCount} →
            </button>
          )}
        </div>
      </div>

      {/* ═══ Grouped Request Work Surface — 2-panel desktop ═══ */}
      <div className="flex-1 overflow-hidden flex">
        {vendorGroups.length > 0 ? (
          <>
            {/* Main panel: vendor groups */}
            <div className="flex-1 overflow-y-auto px-3 md:px-6 py-3 space-y-3">
              {vendorGroups.map((group) => (
                <VendorGroupCard
                  key={group.vendorName}
                  group={group}
                  totalGroups={vendorGroups.length}
                  onUpdateQty={(itemId, qty) => updateQuoteItem(itemId, { quantity: qty })}
                  onRemove={(itemId) => removeQuoteItem(itemId)}
                />
              ))}

              {/* Blockers & Warnings — inline */}
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

            {/* Side rail — desktop only */}
            <div className="hidden lg:flex w-[320px] shrink-0 border-l border-bd flex-col overflow-y-auto" style={{ backgroundColor: '#393b3f' }}>
              {/* Readiness */}
              <div className="px-4 py-3 border-b border-bd">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">요청 준비 상태</div>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border font-medium ${config.color}`}>
                  <ReadinessIcon className="h-3.5 w-3.5" />
                  {label}
                </span>
                <p className="text-[10px] text-slate-400 mt-1.5">{detail}</p>
              </div>

              {/* Request Split */}
              <div className="px-4 py-3 border-b border-bd">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">요청 분리</div>
                <div className="space-y-1.5">
                  {vendorGroups.map((g) => (
                    <div key={g.vendorName} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 truncate max-w-[120px]">{g.vendorName}</span>
                      <span className="text-slate-400 tabular-nums">{g.itemCount}건 · ₩{g.subtotal.toLocaleString("ko-KR")}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-bd/50">
                  <span className="text-xs font-medium text-slate-300">합계</span>
                  <span className="text-sm font-bold tabular-nums text-slate-100">₩{summary.totalAmount.toLocaleString("ko-KR")}</span>
                </div>
              </div>

              {/* Compare State — informational */}
              {allCompareIds.length > 0 && (
                <div className="px-4 py-3 border-b border-bd">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">비교 상태</div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-300">비교 후보</span>
                    <span className="text-xs text-blue-400 font-medium">{allCompareIds.length}개</span>
                  </div>
                  {summary.inCompareCount > 0 && (
                    <p className="text-[10px] text-amber-400 mb-2">
                      {summary.inCompareCount}건이 비교 목록과 견적 목록에 모두 포함됨
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push("/app/compare")}
                    className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-1"
                  >
                    <GitCompare className="h-3 w-3" />
                    비교 결과 다시 확인
                  </button>
                </div>
              )}

              {/* Side rail actions */}
              <div className="px-4 py-3 space-y-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">다음 단계</div>
                {/* 비교 진행 중 후보가 있으면 blocker CTA */}
                {summary.inCompareCount > 0 && (
                  <div className="px-3 py-2 rounded border border-amber-600/20 bg-amber-600/5 mb-2">
                    <p className="text-[10px] text-amber-300 mb-1.5">비교 판단 미완료 후보 {summary.inCompareCount}건</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-[10px] text-amber-400 border-amber-600/30 hover:bg-amber-600/10"
                      onClick={() => router.push("/app/compare")}
                    >
                      <GitCompare className="h-3 w-3 mr-1.5" />
                      비교 판단 먼저
                    </Button>
                  </div>
                )}
                <Button
                  size="sm"
                  className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40"
                  disabled={!canProceed}
                  onClick={() => router.push("/app/quote/request")}
                >
                  요청서 작성
                  <ArrowRight className="h-3 w-3 ml-1.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full h-7 text-[10px] text-slate-500 hover:text-red-400"
                  onClick={() => { quoteItems.forEach((item: any) => removeQuoteItem(item.id)); }}
                >
                  전체 해제
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-6">
            <Package className="h-8 w-8 text-slate-600 mb-3" />
            <p className="text-sm text-slate-300 mb-1">견적 요청 후보가 없습니다</p>
            <p className="text-xs text-slate-500 mb-4">소싱 워크벤치에서 제품을 담아주세요</p>
            <Link href="/app/search">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs">
                <ArrowLeft className="h-3 w-3 mr-1.5" />
                소싱 워크벤치로
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* ═══ Sticky Action Dock — dual CTA ═══ */}
      {quoteItems.length > 0 && (
        <div className="shrink-0 border-t-2 border-bd px-4 md:px-6 py-3" style={{ backgroundColor: '#434548' }}>
          <div className="flex items-center justify-between">
            {/* Left: readiness + summary */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium shrink-0 ${config.color}`}>
                <ReadinessIcon className="h-3 w-3" />
                {label}
              </span>
              <span className="text-xs text-slate-400 tabular-nums font-medium hidden sm:block">
                {summary.totalItems}건 · ₩{summary.totalAmount.toLocaleString("ko-KR")}
              </span>
            </div>

            {/* Right: request-stage CTAs only — dock은 현재 단계 action 전용 */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2.5 text-xs text-slate-400 hover:text-red-400 lg:hidden"
                onClick={() => { quoteItems.forEach((item: any) => removeQuoteItem(item.id)); }}
              >
                전체 해제
              </Button>
              <Button
                size="sm"
                className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40"
                disabled={!canProceed}
                onClick={() => router.push("/app/quote/request")}
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
