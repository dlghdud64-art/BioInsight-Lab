"use client";

import { SearchPanel } from "../_components/search-panel";
import { useTestFlow } from "../_components/test-flow-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/products/price-display";
import { Loader2, GitCompare, X, Trash2, Search, FileText, Package, SlidersHorizontal, TrendingDown } from "lucide-react";
import Link from "next/link";
import { SourcingResultRow } from "../_components/sourcing-result-row";
import { SourcingContextRail } from "../_components/sourcing-context-rail";
import { CenterWorkWindow } from "@/components/work-window/center-work-window";
import { RequestReviewWindow } from "../_components/request-review-window";
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
import { AIInsightCard } from "@/components/ai-insight-card";
import { useCompareStore } from "@/lib/store/compare-store";

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
  const { data: session } = useSession();
  const router = useRouter();
  const [railProduct, setRailProduct] = useState<any>(null);
  const [workWindowMode, setWorkWindowMode] = useState<"compare" | "request" | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

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

  const callbackUrl = searchQuery ? `/test/search?q=${encodeURIComponent(searchQuery)}` : "/test/search";

  const handleProtectedAction = (action: () => void) => {
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

  // Compare 2+ 자동 work window hint
  const compareReady = compareIds.length >= 2;
  const requestReady = quoteItems.length > 0;

  return (
    <div className="h-screen flex flex-col bg-pg overflow-hidden">
      {/* ═══ A. Search Utility Bar — compact, not hero ═══ */}
      <SearchUtilityBar activeFilterCount={activeFilterCount} onOpenFilter={() => setIsMobileFilterOpen(true)} />

      {/* ═══ Mobile filter sheet ═══ */}
      <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
        <SheetContent side="bottom" className="h-[75vh] overflow-y-auto">
          <div className="pt-2"><SearchPanel /></div>
        </SheetContent>
      </Sheet>

      {/* ═══ B + C. Workbench Body ═══ */}
      {hasSearched ? (
        <div className="flex-1 overflow-hidden flex">
          {/* B. Result Workbench List — main scrollable canvas */}
          <div className="flex-1 overflow-y-auto">
            {/* Result header strip */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-bd bg-el/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">소싱 후보</span>
                {products.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-pn text-slate-300">
                    {products.length}건
                  </Badge>
                )}
                {isSearchLoading && <Loader2 className="h-3 w-3 animate-spin text-slate-500" />}
              </div>
              <div className="flex items-center gap-1.5">
                {/* Desktop filter trigger */}
                <Sheet>
                  <SheetTrigger asChild>
                    <button className="hidden md:inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-bd text-slate-400 hover:bg-el transition-colors">
                      <SlidersHorizontal className="h-3 w-3" />
                      필터
                      {activeFilterCount > 0 && (
                        <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] text-white font-medium">{activeFilterCount}</span>
                      )}
                    </button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[280px] p-4">
                    <SearchPanel />
                  </SheetContent>
                </Sheet>
                {session?.user && searchQuery && (
                  <Link href={`/dashboard/inventory?q=${encodeURIComponent(searchQuery)}`}>
                    <button className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-bd text-slate-400 hover:bg-el transition-colors">
                      <TrendingDown className="h-3 w-3" />
                      재고
                    </button>
                  </Link>
                )}
              </div>
            </div>

            {/* AI Insight — compact, inline */}
            {searchQuery && products.length > 0 && (
              <div className="px-4 pt-2">
                <AIInsightCard
                  query={searchQuery}
                  productCount={products.length}
                  isLoading={analysisLoading}
                  queryAnalysis={queryAnalysis}
                />
              </div>
            )}

            {/* Result rows */}
            <div className="px-3 py-2 space-y-0.5">
              {isSearchLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  <span className="ml-2 text-xs text-slate-400">검색 중...</span>
                </div>
              ) : products.length > 0 ? (
                products.map((product: any) => (
                  <SourcingResultRow
                    key={product.id}
                    product={product}
                    isInCompare={compareIds.includes(product.id)}
                    isInRequest={quoteItems.some((q: any) => q.productId === product.id)}
                    isSelected={railProduct?.id === product.id}
                    compareSessionCount={compareStatuses[product.id]?.activeCount}
                    onToggleCompare={() => toggleCompare(product.id, { name: product.name, brand: product.brand })}
                    onToggleRequest={() => handleProtectedAction(() => {
                      const existing = quoteItems.find((q: any) => q.productId === product.id);
                      if (existing) { removeQuoteItem(existing.id); } else { addProductToQuote(product); }
                    })}
                    onSelect={() => handleProtectedAction(() => setRailProduct(product))}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center text-center py-16">
                  <Package className="h-7 w-7 text-slate-500 mb-2" strokeWidth={1.5} />
                  <p className="text-sm text-slate-300 mb-1">검색 결과가 없습니다</p>
                  <p className="text-xs text-slate-500">다른 키워드로 검색해보세요</p>
                </div>
              )}
            </div>
          </div>

          {/* C. Right Context Rail — persistent panel */}
          <div className="hidden lg:flex w-[360px] shrink-0 border-l border-bd bg-pn flex-col overflow-hidden">
            {railProduct ? (
              <SourcingContextRail
                product={railProduct}
                isInCompare={compareIds.includes(railProduct.id)}
                isInRequest={quoteItems.some((q: any) => q.productId === railProduct.id)}
                onToggleCompare={() => toggleCompare(railProduct.id, { name: railProduct.name, brand: railProduct.brand })}
                onToggleRequest={() => handleProtectedAction(() => {
                  const existing = quoteItems.find((q: any) => q.productId === railProduct.id);
                  if (existing) { removeQuoteItem(existing.id); } else { addProductToQuote(railProduct); }
                })}
                onClose={() => setRailProduct(null)}
                onOpenCompareWindow={() => setWorkWindowMode("compare")}
                onOpenRequestWindow={() => setWorkWindowMode("request")}
                compareCount={compareIds.length}
                requestCount={quoteItems.length}
                searchQuery={searchQuery}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="w-10 h-10 rounded-lg bg-el border border-bd flex items-center justify-center mb-3">
                  <Package className="h-5 w-5 text-slate-600" />
                </div>
                <p className="text-xs text-slate-400 mb-1">제품을 선택하세요</p>
                <p className="text-[10px] text-slate-500">행을 클릭하면 상세 정보와<br />다음 액션을 확인할 수 있습니다</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Pre-search — compact landing, not hero */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="w-12 h-12 rounded-xl bg-el border border-bd flex items-center justify-center mx-auto mb-4">
              <Search className="h-6 w-6 text-slate-500" />
            </div>
            <h2 className="text-base font-semibold text-slate-200 mb-1">소싱 워크벤치</h2>
            <p className="text-xs text-slate-400 mb-4">시약명, CAS No., 제조사, 카탈로그 번호로 검색</p>
            <div className="flex items-center gap-1.5 flex-wrap justify-center mb-4">
              {["Trypsin", "FBS", "DMEM", "Tris-HCl", "67-66-3"].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => { setSearchQuery(term); runSearch(); }}
                  className="text-xs px-2.5 py-1 rounded-md bg-el border border-bd text-slate-400 hover:bg-st hover:text-slate-300 transition-all cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
              <Link href="/protocol/bom" className="hover:text-slate-300 transition-colors">BOM 등록</Link>
              <span>·</span>
              <Link href="/dashboard/inventory" className="hover:text-slate-300 transition-colors">재고 확인</Link>
              <span>·</span>
              <Link href="/test/compare" className="hover:text-slate-300 transition-colors">비교 목록</Link>
            </div>
          </div>
        </div>
      )}

      {/* ═══ D. Workbench Tray — always visible when hasSearched ═══ */}
      {hasSearched && (
        <div className="border-t border-bd bg-el px-4 py-2 flex items-center gap-3 shrink-0">
          {/* Compare segment */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <GitCompare className={`h-3.5 w-3.5 ${compareIds.length > 0 ? "text-blue-400" : "text-slate-600"}`} />
              <span className={`text-xs font-medium ${compareIds.length > 0 ? "text-slate-300" : "text-slate-500"}`}>비교</span>
              <Badge variant="secondary" className={`h-5 px-1.5 text-[10px] ${compareIds.length > 0 ? "bg-blue-600/10 text-blue-400" : "bg-pn text-slate-500"}`}>{compareIds.length}</Badge>
            </div>
            {compareIds.length > 0 && (
              <>
                <div className="flex items-center gap-1 max-w-[180px] overflow-x-auto">
                  {compareIds.slice(0, 3).map((id: string) => {
                    const p = products.find((pp: any) => pp.id === id);
                    const name = p?.name || getStoredName(id) || "—";
                    return (
                      <span key={id} className="text-[10px] text-slate-400 bg-pn border border-bd rounded px-1.5 py-0.5 truncate max-w-[60px]" title={name}>{name}</span>
                    );
                  })}
                  {compareIds.length > 3 && <span className="text-[10px] text-slate-500">+{compareIds.length - 3}</span>}
                </div>
                {compareReady ? (
                  <Button size="sm" className="h-6 px-2.5 text-[10px] bg-blue-600 hover:bg-blue-500 text-white" onClick={() => setWorkWindowMode("compare")}>
                    비교 검토 →
                  </Button>
                ) : (
                  <span className="text-[10px] text-amber-400">2개 이상 필요</span>
                )}
                <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-slate-500 hover:text-red-400" onClick={() => clearCompare()}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-bd" />

          {/* Request segment */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <FileText className={`h-3.5 w-3.5 ${quoteItems.length > 0 ? "text-emerald-400" : "text-slate-600"}`} />
              <span className={`text-xs font-medium ${quoteItems.length > 0 ? "text-slate-300" : "text-slate-500"}`}>견적</span>
              <Badge variant="secondary" className={`h-5 px-1.5 text-[10px] ${quoteItems.length > 0 ? "bg-emerald-600/10 text-emerald-400" : "bg-pn text-slate-500"}`}>{quoteItems.length}</Badge>
            </div>
            {quoteItems.length > 0 && (
              <>
                <span className="text-[10px] text-slate-500 tabular-nums">₩{totalAmount.toLocaleString("ko-KR")}</span>
                <Button size="sm" className="h-6 px-2.5 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => setWorkWindowMode("request")}>
                  견적 검토 →
                </Button>
                <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-slate-500 hover:text-red-400" onClick={() => { quoteItems.forEach((item: any) => removeQuoteItem(item.id)); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ E. Center Work Window — Compare Review ═══ */}
      <CenterWorkWindow
        open={workWindowMode === "compare"}
        onClose={() => setWorkWindowMode(null)}
        title="비교 검토"
        subtitle={`${compareIds.length}개 제품 비교`}
        phase="ready"
        primaryAction={{
          label: "비교 분석 시작",
          onClick: () => { router.push("/test/compare"); setWorkWindowMode(null); },
        }}
        secondaryAction={{ label: "닫기", onClick: () => setWorkWindowMode(null) }}
      >
        <div className="space-y-2">
          <p className="text-xs text-slate-400 mb-3">선택한 제품을 나란히 비교합니다. 공급사·가격·스펙을 확인하고 최적 후보를 선택하세요.</p>
          {compareIds.map((id: string) => {
            const p = products.find((pp: any) => pp.id === id);
            if (!p) return null;
            const v = p.vendors?.[0];
            return (
              <div key={id} className="flex items-center gap-3 px-3 py-2 rounded border border-bd bg-el">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">{v?.vendor?.name || "—"} · {p.catalogNumber || "—"}</p>
                </div>
                {v?.priceInKRW > 0 && (
                  <span className="text-sm font-semibold tabular-nums text-slate-100 shrink-0">
                    <PriceDisplay price={v.priceInKRW} currency="KRW" />
                  </span>
                )}
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-red-400" onClick={() => toggleCompare(id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      </CenterWorkWindow>

      {/* ═══ E. Center Work Window — Request Review (6-area) ═══ */}
      <RequestReviewWindow
        open={workWindowMode === "request"}
        onClose={() => setWorkWindowMode(null)}
        quoteItems={quoteItems}
        compareIds={compareIds}
        products={products}
        onRemoveItem={removeQuoteItem}
        onUpdateItem={updateQuoteItem}
        onClearAll={() => { quoteItems.forEach((item: any) => removeQuoteItem(item.id)); }}
        onCreateRequest={() => { router.push("/test/quote"); setWorkWindowMode(null); }}
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
            <DialogTitle>로그인이 필요합니다</DialogTitle>
            <DialogDescription>상세보기와 견적 담기 기능을 이용하려면 로그인해 주세요.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleLoginRedirect}>로그인하기</Button>
            <Button variant="ghost" className="w-full" onClick={() => setIsLoginPromptOpen(false)}>취소</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** ═══ A. Search Utility Bar — compact, not hero ═══ */
function SearchUtilityBar({ activeFilterCount, onOpenFilter }: { activeFilterCount: number; onOpenFilter: () => void }) {
  const { searchQuery, setSearchQuery, runSearch, hasSearched } = useTestFlow();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  useEffect(() => { setLocalQuery(searchQuery); }, [searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      setSearchQuery(localQuery);
      // save recent
      try {
        const stored = JSON.parse(localStorage.getItem("bioinsight-recent-searches") || "[]") as string[];
        const updated = [localQuery.trim(), ...stored.filter((s: string) => s !== localQuery.trim())].slice(0, 5);
        localStorage.setItem("bioinsight-recent-searches", JSON.stringify(updated));
      } catch {}
      runSearch();
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-bd bg-el shrink-0">
      {/* Title */}
      <span className="text-xs font-semibold text-slate-300 shrink-0 hidden md:block">소싱</span>

      {/* Search input — compact */}
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 flex-1 max-w-2xl">
        <div className="flex items-center flex-1 bg-pn border border-bd rounded-md focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
          <Search className="h-3.5 w-3.5 text-slate-500 ml-2.5 shrink-0" />
          <Input
            type="text"
            value={localQuery}
            onChange={(e) => { setLocalQuery(e.target.value); setSearchQuery(e.target.value); }}
            placeholder="시약명 / CAS / 제조사 / 카탈로그 번호"
            className="h-8 px-2 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-500"
          />
          <Button
            type="submit"
            size="sm"
            className="h-6 px-3 mr-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-medium rounded shrink-0"
            disabled={!localQuery.trim()}
          >
            검색
          </Button>
        </div>
      </form>

      {/* Filter trigger — mobile */}
      <button
        onClick={onOpenFilter}
        className="md:hidden inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-bd text-slate-400 hover:bg-st transition-colors"
      >
        <SlidersHorizontal className="h-3 w-3" />
        {activeFilterCount > 0 && (
          <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] text-white">{activeFilterCount}</span>
        )}
      </button>

      {/* Status pills */}
      {hasSearched && searchQuery && (
        <span className="text-[10px] text-slate-500 shrink-0 hidden sm:block">
          &ldquo;{searchQuery}&rdquo;
        </span>
      )}
    </div>
  );
}