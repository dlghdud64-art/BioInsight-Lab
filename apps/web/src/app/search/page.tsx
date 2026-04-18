"use client";

import { Suspense, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, Beaker, Package, FlaskConical, Microscope, LogIn } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Link from "next/link";
import { savePendingAction } from "@/lib/auth/pending-action";

const exampleQueries = [
  { label: "Anti-GAPDH antibody", icon: Beaker },
  { label: "DMEM high glucose", icon: FlaskConical },
  { label: "Western blot kit", icon: Package },
  { label: "Cell counting slides", icon: Microscope },
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
      {/* Header area */}
      <div className="mx-auto max-w-3xl px-4 pt-28 pb-20 text-center space-y-10">
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
