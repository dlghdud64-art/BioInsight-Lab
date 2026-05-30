"use client";

import { Suspense, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, Beaker, Package, FlaskConical, Microscope, GitCompare, FileText } from "lucide-react";
import Link from "next/link";
import { savePendingAction, type PendingActionType } from "@/lib/auth/pending-action";

const exampleQueries = [
  { label: "Anti-GAPDH antibody", icon: Beaker },
  { label: "DMEM high glucose", icon: FlaskConical },
  { label: "Western blot kit", icon: Package },
  { label: "Cell counting slides", icon: Microscope },
];

// §11.324 — 3단계 다이어그램 (검색/비교/견적). 옛 triageGroups (Exact Match/Cross-Vendor/
//   Substitute/Blocked + Shortlist/Hold/Exclude) 제거: 비로그인 랜딩 = 가치 제안 + 가입 유도
//   페이지, 실제 사용 UI 노출은 인지 부하 + dead button 위험 + 가입 conversion 저해.
const flowSteps = [
  {
    no: "①",
    title: "검색",
    icon: Search,
    description: "제품명·CAS·카탈로그·브랜드로 빠르게 찾기",
  },
  {
    no: "②",
    title: "비교",
    icon: GitCompare,
    description: "같은 제품 다른 공급사를 한눈에 비교",
  },
  {
    no: "③",
    title: "견적",
    icon: FileText,
    description: "여러 공급사에 한 번에 견적 요청",
  },
];

function PublicSearchContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams?.get("q") || "");
  // §11.324 — publicTriageStage / publicTriageAction state 제거 (Triage 데모 영역 함께 제거).

  const buildWorkbenchPath = useCallback((stage?: "compare" | "request") => {
    const trimmed = query.trim() || searchParams?.get("q") || "PBS";
    const params = new URLSearchParams({ q: trimmed });
    if (stage) params.set("stage", stage);
    return `/app/search?${params.toString()}`;
  }, [query, searchParams]);

  // §11.278 — continueToAuth action 파라미터 type narrowing 회복.
  //   b1aea5c4 "fix: make public search steps nonblocking" 이 시그니처를
  //   `action: string` 으로 설계 → savePendingAction({ action: PendingActionType })
  //   호출 시 TS strict (ignoreBuildErrors=false) 에서 build fail.
  //   caller 1개 (line 91 `continueToAuth("run_search")`) 모두 valid literal.
  //   런타임 동작 0 변경, type narrowing 만 강화.
  const continueToAuth = useCallback((action: PendingActionType, stage?: "compare" | "request") => {
    const target = buildWorkbenchPath(stage);
    savePendingAction({ action, query: query.trim() || searchParams?.get("q") || "PBS" });
    router.push(`/auth/signin?callbackUrl=${encodeURIComponent(target)}`);
  }, [buildWorkbenchPath, query, router, searchParams]);

  const handleSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (session?.user) {
      router.push(`/app/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      continueToAuth("run_search");
    }
  }, [continueToAuth, query, session, router]);

  const handleExampleClick = useCallback((exampleQuery: string) => {
    setQuery(exampleQuery);
    if (session?.user) {
      router.push(`/app/search?q=${encodeURIComponent(exampleQuery)}`);
    } else {
      savePendingAction({ action: "run_search", query: exampleQuery });
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/app/search?q=${encodeURIComponent(exampleQuery)}`)}`);
    }
  }, [session, router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  }, [handleSearch]);

  // §11.324 — handleTriageAction / handleStepAction 제거 (Triage 데모 + Step 2/3 button 함께 제거).

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
                // §11.251b-redo — placeholder 모바일 잘림 방지 (호영님 P1 spec, §11.251b 원안 재진입).
                //   "제품명, 카탈로그 번호, 브랜드 검색..." → "시약명·CAS·제조사" (3 항목, 중점 분리).
                placeholder="시약명·CAS·제조사"
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

        {/* §11.324 — 옛 Triage 데모 section (search-result-triage, line ~185-286) 전체 제거.
            비로그인 랜딩 = 가치 제안 + 가입 유도 페이지로 단순화. 호영님 A안 정합. */}

        {/* §11.324 — 3단계 다이어그램 (검색/비교/견적). 사용자 멘탈 모델 명확화. */}
        <section
          data-testid="landing-search-flow-steps"
          aria-label="LabAxis 사용 흐름 3단계"
          className="grid grid-cols-3 gap-3 sm:gap-4 text-left"
        >
          {flowSteps.map((step) => {
            const Icon = step.icon;
            return (
              <article
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-2.5 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 text-base font-extrabold">{step.no}</span>
                  <Icon className="h-5 w-5 text-blue-600" />
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">{step.title}</h3>
                </div>
                <p className="text-xs sm:text-[13px] leading-relaxed text-slate-500">{step.description}</p>
              </article>
            );
          })}
        </section>

        {/* §11.324 — 큰 가입 CTA (primary conversion). 옛 Step 2/3 button + 로그인 후 계속 link 흡수. */}
        {!session?.user && (
          <div className="flex flex-col items-center gap-3 pt-2">
            <Link
              href="/auth/signin"
              data-testid="landing-search-primary-cta"
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[15px] font-bold transition-colors shadow-sm hover:shadow-md"
            >
              무료로 시작하기 — 30초 가입
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/auth/signin"
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              이미 회원이세요? 로그인
            </Link>
          </div>
        )}

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
