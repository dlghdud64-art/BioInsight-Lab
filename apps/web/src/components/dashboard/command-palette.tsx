"use client";

/**
 * CommandPalette — 상단 검색창 통합 커맨드 팔레트
 *
 * Ctrl+K / Cmd+K 또는 검색창 클릭으로 열리며,
 * 추천 액션 + 최근 조회 + 실시간 검색/ontology 파싱을 제공.
 *
 * 기존 ontology-command-overlay의 무거운 모달 UX를
 * 가벼운 드롭다운으로 대체. 내부 용어(Ontology, dry-run 등) 숨김.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, FileText, CreditCard, Package, BarChart2,
  ArrowRight, Clock, Sparkles, Command, CornerDownLeft,
  ShoppingCart, ClipboardCheck, Loader2,
} from "lucide-react";
import {
  buildExecutionPlan,
  setNLLocalOrderProvider,
  type ExecutionPlan,
} from "@/lib/ontology";
import { useOrderQueueStore } from "@/lib/store/order-queue-store";
import { useOpenGovernedComposer } from "@/hooks/use-open-governed-composer";

// ── 추천 액션 ──
interface QuickAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  href?: string;
  ontologyQuery?: string;
}

/**
 * zero-state 우선 추천 액션.
 *
 * 원칙:
 * - "새 발주서 작성" 같은 고급 액션은 zero-state 에서 1순위가 아님.
 * - zero-state 에서 자연스러운 순서: 시약 검색 → 비교 → 견적 요청 → 재고 확인.
 * - "진행 중 작업 계속" 은 동적으로 추가 (아래 useQuickActions 에서 처리).
 * - 이 리스트는 Global Command Palette 의 기본 추천이며,
 *   Ontology 다음액션 resolver 와는 별개.
 */
const QUICK_ACTIONS: QuickAction[] = [
  { id: "search", icon: <Search className="h-4 w-4" />, label: "시약·장비 검색 시작", description: "500만+ 품목 통합 검색", href: "/app/search" },
  { id: "compare", icon: <ShoppingCart className="h-4 w-4" />, label: "비교 워크스페이스 열기", description: "후보 품목 나란히 비교", href: "/compare" },
  { id: "quote", icon: <FileText className="h-4 w-4" />, label: "견적 요청 생성", description: "공급사에 견적 요청", href: "/dashboard/quotes" },
  { id: "inventory", icon: <Package className="h-4 w-4" />, label: "재고 현황 확인", description: "입고·유효기간·안전재고", href: "/dashboard/inventory" },
];

// ── 최근 조회 (세션 기반) ──
const RECENT_KEY = "labaxis_recent_searches";
function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveRecent(items: string[]) {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 5))); } catch {}
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [nlResult, setNlResult] = useState<ExecutionPlan | null>(null);
  const [nlLoading, setNlLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openComposer = useOpenGovernedComposer();

  // ── Local canonical snapshot provider 주입 ──
  useEffect(() => {
    setNLLocalOrderProvider(() => {
      const orders = useOrderQueueStore.getState().orders;
      return orders.map((o) => ({
        id: o.id,
        status: o.status,
        totalAmount: o.totalAmount,
      }));
    });
    return () => setNLLocalOrderProvider(null);
  }, []);

  // ── 최근 조회 로드 ──
  useEffect(() => {
    setRecentSearches(loadRecent());
  }, []);

  // ── Ctrl+K / Cmd+K 글로벌 단축키 ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // ── 열릴 때 포커스 ──
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      setQuery("");
      setNlResult(null);
      setSelectedIndex(0);
    }
  }, [open]);

  // ── 외부 클릭 감지 ──
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // ── NL 파싱 (debounced) ──
  useEffect(() => {
    if (nlTimerRef.current) clearTimeout(nlTimerRef.current);
    const trimmed = query.trim();

    // 자연어 패턴 감지: 한글 포함 + 3자 이상
    const isNL = /[가-힣]/.test(trimmed) && trimmed.length >= 3;
    if (!isNL) {
      setNlResult(null);
      return;
    }

    nlTimerRef.current = setTimeout(async () => {
      setNlLoading(true);
      try {
        const plan = await buildExecutionPlan(trimmed);
        if (plan.steps.length > 0 && plan.totalTargetCount > 0) {
          setNlResult(plan);
        } else {
          setNlResult(null);
        }
      } catch {
        setNlResult(null);
      } finally {
        setNlLoading(false);
      }
    }, 400);

    return () => { if (nlTimerRef.current) clearTimeout(nlTimerRef.current); };
  }, [query]);

  // ── 네비게이션 항목 (검색 결과 기반) ──
  const navItems = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    const pages = [
      { label: "대시보드", href: "/dashboard", keywords: ["대시보드", "홈", "dashboard"] },
      { label: "지출 분석", href: "/dashboard/analytics", keywords: ["지출", "분석", "예산", "analytics", "통제"] },
      { label: "구매 운영", href: "/dashboard/purchases", keywords: ["구매", "발주", "승인", "purchase", "주문"] },
      { label: "견적 관리", href: "/dashboard/quotes", keywords: ["견적", "비교", "quote"] },
      { label: "재고 관리", href: "/dashboard/inventory", keywords: ["재고", "stock", "inventory", "수량"] },
      { label: "예산 관리", href: "/dashboard/budget", keywords: ["예산", "budget", "소진"] },
      { label: "안전 관리", href: "/dashboard/safety", keywords: ["안전", "msds", "safety"] },
      { label: "스마트 소싱", href: "/dashboard/smart-sourcing", keywords: ["소싱", "sourcing", "공급사"] },
      { label: "구매 리포트", href: "/dashboard/reports", keywords: ["리포트", "보고서", "report"] },
    ];

    return pages.filter(p =>
      p.keywords.some(k => k.includes(trimmed)) || p.label.includes(trimmed)
    );
  }, [query]);

  // ── 전체 선택 가능 항목 목록 ──
  const allItems = useMemo(() => {
    const items: { type: "action" | "nav" | "nl" | "search"; id: string; label: string }[] = [];

    if (!query.trim()) {
      QUICK_ACTIONS.forEach(a => items.push({ type: "action", id: a.id, label: a.label }));
    } else {
      navItems.forEach(n => items.push({ type: "nav", id: n.href, label: n.label }));
      if (nlResult) {
        items.push({ type: "nl", id: "nl-result", label: `${nlResult.totalTargetCount}건 발견` });
      }
      if (query.trim()) {
        items.push({ type: "search", id: "search", label: `"${query}" 제품 검색` });
      }
    }
    return items;
  }, [query, navItems, nlResult]);

  // ── 선택 인덱스 보정 ──
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // ── 실행 ──
  const executeItem = useCallback((index: number) => {
    const item = allItems[index];
    if (!item) return;

    if (item.type === "action") {
      const action = QUICK_ACTIONS.find(a => a.id === item.id);
      if (action?.href) {
        setOpen(false);
        router.push(action.href);
      }
    } else if (item.type === "nav") {
      setOpen(false);
      router.push(item.id);
    } else if (item.type === "nl") {
      // NL 결과 → governed action composer로 진입 (해당하는 경우)
      if (nlResult) {
        const primary = nlResult.steps[0];
        const GOVERNED_ACTION_TYPES = new Set([
          "APPROVE", "REJECT", "DISPATCH_NOW", "SCHEDULE_DISPATCH",
          "RECEIVE_ORDER", "TRIGGER_REORDER",
        ]);
        if (primary && GOVERNED_ACTION_TYPES.has(primary.actionType)) {
          setOpen(false);
          openComposer({
            origin: "command_palette",
            selectedEntityIds: nlResult.steps.flatMap((s) => s.targetIds),
            selectedEntityType: "purchase_order",
          });
        } else {
          const actionRouteMap: Record<string, string> = {
            APPROVE: "/dashboard/purchases",
            REJECT: "/dashboard/purchases",
            DISPATCH_NOW: "/dashboard/purchases",
            RECEIVE_ORDER: "/dashboard/inventory",
            TRIGGER_REORDER: "/dashboard/stock-risk",
          };
          const href = actionRouteMap[primary?.actionType] ?? "/dashboard/purchases";
          setOpen(false);
          router.push(href);
        }
      }
    } else if (item.type === "search") {
      const trimmed = query.trim();
      if (trimmed) {
        // 최근 검색에 추가
        const updated = [trimmed, ...recentSearches.filter(s => s !== trimmed)].slice(0, 5);
        setRecentSearches(updated);
        saveRecent(updated);
        setOpen(false);
        router.push(`/app/search?q=${encodeURIComponent(trimmed)}`);
      }
    }
  }, [allItems, nlResult, query, recentSearches, router]);

  // ── 키보드 네비게이션 ──
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeItem(selectedIndex);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }, [allItems.length, executeItem, selectedIndex]);

  // ── NL 결과에서 대상 주문 미리보기 ──
  const ordersStore = useOrderQueueStore((s) => s.orders);
  const nlPreviewRows = useMemo(() => {
    if (!nlResult) return [];
    const ids = new Set(nlResult.steps.flatMap(s => s.targetIds));
    return ordersStore
      .filter(o => ids.has(o.id))
      .slice(0, 3)
      .map(o => ({
        id: o.id,
        poNumber: o.poNumber,
        productName: o.productName,
        amount: o.totalAmount,
      }));
  }, [nlResult, ordersStore]);

  const nlActionLabel = useMemo(() => {
    if (!nlResult || nlResult.steps.length === 0) return "";
    const map: Record<string, string> = {
      APPROVE: "일괄 승인",
      REJECT: "일괄 반려",
      DISPATCH_NOW: "공급사 발송",
      SCHEDULE_DISPATCH: "발송 예약",
      RECEIVE_ORDER: "수령 처리",
      TRIGGER_REORDER: "재주문",
      HOLD_FOR_REVIEW: "검토 보류",
    };
    return map[nlResult.steps[0].actionType] ?? "작업 실행";
  }, [nlResult]);

  return (
    <div ref={containerRef} className="relative hidden md:block">
      {/* ── 검색 트리거 (상단 바에 표시) ── */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-56 lg:w-64 xl:w-96 h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-400 hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-text relative z-10"
        type="button"
        aria-label="빠른 검색 열기"
      >
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="flex-1 text-left truncate">검색하거나 빠른 실행... (시약, 예산, 견적)</span>
        <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-400">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      {/* ── 팔레트 드롭다운 ── */}
      {open && (
        <>
          {/* 백드롭 */}
          <div className="fixed inset-0 z-40" />

          <div className="absolute top-0 left-0 right-0 z-50 w-full min-w-[360px] lg:min-w-[420px] xl:min-w-[520px]">
            {/* 검색 입력 */}
            <div className="rounded-t-lg border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Search className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="검색하거나 빠른 실행... (예: 시약 검색, 재고 확인, 10만원 이하)"
                  className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent outline-none"
                  autoComplete="off"
                />
                {nlLoading && <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />}
                <kbd className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-400 cursor-pointer hover:bg-slate-200" onClick={() => setOpen(false)}>
                  ESC
                </kbd>
              </div>
            </div>

            {/* 결과 패널 */}
            <div className="rounded-b-lg border border-t-0 border-slate-200 bg-white shadow-xl max-h-[400px] overflow-y-auto">

              {/* 쿼리가 없을 때: 추천 액션 + 최근 조회 */}
              {!query.trim() && (
                <div className="py-2">
                  <div className="px-3 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">빠른 실행</p>
                  </div>
                  {QUICK_ACTIONS.map((action, idx) => (
                    <button
                      key={action.id}
                      onClick={() => executeItem(idx)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        selectedIndex === idx ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        selectedIndex === idx ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                      }`}>
                        {action.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">{action.label}</p>
                        <p className="text-xs text-slate-400">{action.description}</p>
                      </div>
                      {selectedIndex === idx && <ArrowRight className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
                    </button>
                  ))}

                  {recentSearches.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 mt-1">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">최근 조회</p>
                      </div>
                      {recentSearches.map((s, idx) => (
                        <button
                          key={s}
                          onClick={() => { setQuery(s); }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                        >
                          <Clock className="h-4 w-4 text-slate-300 shrink-0" />
                          <span className="text-sm text-slate-600">{s}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* 쿼리가 있을 때: NL 결과 + 네비게이션 + 검색 옵션 */}
              {query.trim() && (
                <div className="py-2">
                  {/* NL 파싱 결과 (ontology 기반) */}
                  {nlResult && (
                    <>
                      <div className="px-3 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500">AI 분석 결과</p>
                      </div>
                      <button
                        onClick={() => executeItem(allItems.findIndex(i => i.type === "nl"))}
                        onMouseEnter={() => setSelectedIndex(allItems.findIndex(i => i.type === "nl"))}
                        className={`w-full px-3 py-2.5 text-left transition-colors ${
                          allItems[selectedIndex]?.type === "nl" ? "bg-blue-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                            <Sparkles className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700">
                              {nlResult.totalTargetCount}건 발견 — {nlActionLabel}
                            </p>
                            <p className="text-xs text-slate-400">
                              신뢰도 {Math.round(nlResult.confidence * 100)}%
                            </p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        </div>
                        {/* 미리보기 행 */}
                        {nlPreviewRows.length > 0 && (
                          <div className="mt-2 ml-11 space-y-1">
                            {nlPreviewRows.map(row => (
                              <div key={row.id} className="flex items-center justify-between text-xs text-slate-500">
                                <span className="truncate">
                                  <span className="font-mono text-slate-400 mr-1">{row.poNumber}</span>
                                  {row.productName}
                                </span>
                                <span className="font-mono shrink-0 ml-2">₩{row.amount.toLocaleString()}</span>
                              </div>
                            ))}
                            {nlResult.totalTargetCount > nlPreviewRows.length && (
                              <p className="text-[10px] text-slate-400">외 {nlResult.totalTargetCount - nlPreviewRows.length}건</p>
                            )}
                          </div>
                        )}
                      </button>
                    </>
                  )}

                  {/* 페이지 네비게이션 */}
                  {navItems.length > 0 && (
                    <>
                      <div className="px-3 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">이동</p>
                      </div>
                      {navItems.map((nav) => {
                        const idx = allItems.findIndex(i => i.id === nav.href);
                        return (
                          <button
                            key={nav.href}
                            onClick={() => executeItem(idx)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                              selectedIndex === idx ? "bg-blue-50" : "hover:bg-slate-50"
                            }`}
                          >
                            <ArrowRight className="h-4 w-4 text-slate-300 shrink-0" />
                            <span className="text-sm text-slate-600">{nav.label}</span>
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* 제품 검색 (항상 마지막) */}
                  {query.trim() && (
                    <>
                      <div className="px-3 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">검색</p>
                      </div>
                      {(() => {
                        const idx = allItems.findIndex(i => i.type === "search");
                        return (
                          <button
                            onClick={() => executeItem(idx)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                              selectedIndex === idx ? "bg-blue-50" : "hover:bg-slate-50"
                            }`}
                          >
                            <Search className="h-4 w-4 text-slate-300 shrink-0" />
                            <span className="text-sm text-slate-600">
                              &quot;{query.trim()}&quot; 제품 검색
                            </span>
                          </button>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}

              {/* 하단 힌트 바 */}
              <div className="flex items-center gap-3 px-3 py-2 border-t border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono">↑↓</kbd>
                  <span>이동</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono">Enter</kbd>
                  <span>선택</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 ml-auto">
                  <Sparkles className="h-3 w-3" />
                  <span>AI 자연어 분석</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
