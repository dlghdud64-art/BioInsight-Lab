"use client";

import { Suspense, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, Beaker, Package, FlaskConical, Microscope, LogIn, CheckCircle2, RefreshCw, Ban } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Link from "next/link";
import { savePendingAction } from "@/lib/auth/pending-action";

const exampleQueries = [
  { label: "Anti-GAPDH antibody", icon: Beaker },
  { label: "DMEM high glucose", icon: FlaskConical },
  { label: "Western blot kit", icon: Package },
  { label: "Cell counting slides", icon: Microscope },
];

const triageGroups = [
  {
    title: "Exact Match",
    count: 4,
    badge: "정확 일치",
    description: "카탈로그 번호와 규격이 바로 맞는 후보",
    sample: "PBS buffer 500mL · Cat. PBS-500",
    icon: CheckCircle2,
    tone: "emerald",
    actions: ["Shortlist", "Hold", "Exclude"],
  },
  {
    title: "Cross-Vendor Equivalent",
    count: 3,
    badge: "동등 대체",
    description: "동일 성분·동일 용량의 교차 공급사 후보",
    sample: "PBS 1X · vendor equivalent",
    icon: RefreshCw,
    tone: "blue",
    actions: ["Shortlist", "Hold", "Exclude"],
  },
  {
    title: "Substitute",
    count: 2,
    badge: "대체 가능",
    description: "용량 또는 pack 차이가 있어 확인이 필요한 후보",
    sample: "PBS tablets · dilution required",
    icon: Package,
    tone: "amber",
    actions: ["Shortlist", "Hold", "Exclude"],
  },
  {
    title: "Blocked",
    count: 1,
    badge: "차단",
    description: "구매 전 제외 사유가 있는 후보",
    sample: "PBS bulk pack · restricted vendor",
    blockedReason: "차단 사유: 미승인 공급사 · 냉장 배송 조건 없음",
    icon: Ban,
    tone: "red",
    actions: ["Hold", "Exclude"],
  },
];

function PublicSearchContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams?.get("q") || "");
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (session?.user) {
      router.push(`/app/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      savePendingAction({ action: "run_search", query: trimmed });
      setShowLoginModal(true);
    }
  }, [query, session, router]);

  const handleExampleClick = useCallback((exampleQuery: string) => {
    setQuery(exampleQuery);
    if (session?.user) {
      router.push(`/app/search?q=${encodeURIComponent(exampleQuery)}`);
    } else {
      savePendingAction({ action: "run_search", query: exampleQuery });
      setShowLoginModal(true);
    }
  }, [session, router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  }, [handleSearch]);

  return (
    <div className="min-h-screen bg-white">
      {/* §11.267b — 호영님 spec 검색 체험 페이지 상단 가입 배너 (logged-out 한정).
          검색 입력 전에도 가입 경로 visible — 기존에는 검색해야 비로소 로그인
          modal 노출 → 이탈 지점. 페이지 상단 sticky 영역 위 banner 로 상시 노출. */}
      {!session?.user && (
        <Link
          href="/auth/signin"
          data-testid="search-signup-banner"
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-3 px-4 text-sm md:text-[15px] font-semibold transition-colors"
        >
          무료 가입하고 비교·견적까지 한 번에 →
        </Link>
      )}

      {/* Header area */}
      <div className="mx-auto max-w-5xl px-4 pt-28 pb-20 text-center space-y-10">
        {/* Title */}
        <div className="space-y-4">
          <h1 className="text-3xl md:text-[42px] font-extrabold text-slate-900 tracking-tight leading-tight">
            연구 시약·장비 검색
          </h1>
          <p className="text-[15px] md:text-[17px] max-w-lg mx-auto leading-relaxed text-slate-500">
            제품명, 카탈로그 번호, 브랜드로 검색하세요.
            비교·견적 요청까지 한 번에 진행할 수 있습니다.
          </p>
        </div>

        {/* Search input */}
        <div className="relative max-w-xl mx-auto">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="제품명, 카탈로그 번호, 브랜드 검색..."
                className="pl-11 h-12 text-slate-900 placeholder:text-slate-400 text-base bg-white border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!query.trim()}
              className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-[15px] gap-1.5"
            >
              검색
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <section
          data-testid="search-result-triage"
          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4 text-left space-y-3"
          // §11.274c — aria-label 한국어 정합 lock.
          aria-label="소싱 결과 분류"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-blue-600">Sourcing Result Triage</p>
              <h2 className="mt-1 text-base font-extrabold text-slate-950">검색 후보를 비교·보류·제외로 바로 분류합니다</h2>
            </div>
            <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700">
              비교 진입: 같은 캔버스 우측 패널 전환
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {triageGroups.map((group) => {
              const Icon = group.icon;
              const toneClass = group.tone === "emerald"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : group.tone === "blue"
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : group.tone === "amber"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-red-200 bg-red-50 text-red-700";
              return (
                <article key={group.title} data-testid={`search-triage-${group.title.toLowerCase().replaceAll(" ", "-")}`} className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-950">{group.title}</h3>
                      <p className="text-xs text-slate-500">{group.count}건 · {group.description}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${toneClass}`}>
                      <Icon className="h-3 w-3" />
                      {group.badge}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
                    <p className="text-xs font-semibold text-slate-800">{group.sample}</p>
                    {group.blockedReason && (
                      <p data-testid="search-triage-blocked-reason" className="mt-1 text-[11px] font-semibold text-red-700">
                        {group.blockedReason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5" aria-label={`${group.title} 후보 액션`}>
                    {group.actions.map((action) => (
                      <button
                        key={action}
                        type="button"
                        className="min-h-[32px] rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
          <div data-testid="search-triage-compare-panel" className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm text-slate-700">
            <span className="font-bold text-slate-950">Compare panel</span>
            <span className="mx-2 text-slate-300">·</span>
            Shortlist 후보를 누르면 같은 화면에서 비교 패널이 열리고 검색 컨텍스트가 유지됩니다.
          </div>
        </section>

        {/* Example queries */}
        <div className="space-y-3">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">검색 예시</p>
          <div className="flex flex-wrap justify-center gap-2">
            {exampleQueries.map((eq) => {
              const Icon = eq.icon;
              return (
                <button
                  key={eq.label}
                  onClick={() => handleExampleClick(eq.label)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 transition-all hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {eq.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Searchable keys info */}
        <div className="pt-10 border-t border-slate-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { label: "제품명", desc: "한글/영문 제품명" },
              { label: "카탈로그 번호", desc: "제조사 Cat. No." },
              { label: "브랜드", desc: "제조사/유통사" },
              { label: "LOT 번호", desc: "배치 추적" },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <p className="text-[14px] font-extrabold text-slate-800">{item.label}</p>
                <p className="text-[12px] text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Login required modal */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="max-w-sm bg-white border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2">
              <LogIn className="h-5 w-5 text-blue-600" />
              로그인이 필요합니다
            </DialogTitle>
            <DialogDescription className="pt-2 text-slate-500">
              로그인 후 결과 확인과 비교·견적 요청을 진행할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(query.trim() ? `/app/search?q=${encodeURIComponent(query.trim())}` : "/app/search")}`}>
              <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold">
                로그인하기
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="text-slate-500 hover:text-slate-700"
              onClick={() => setShowLoginModal(false)}
            >
              취소
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-slate-400">로딩 중...</div>
      </div>
    }>
      <PublicSearchContent />
    </Suspense>
  );
}
