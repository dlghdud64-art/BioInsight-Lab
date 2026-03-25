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
      // 로그인 상태: /app/search로 이동
      router.push(`/app/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      // 비로그인: pending state 저장 + 로그인 모달
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
    <div className="min-h-screen bg-[#111114]">
      {/* Header area */}
      <div className="mx-auto max-w-3xl px-4 pt-24 pb-16 text-center space-y-8">
        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-100 tracking-tight">
            연구 시약·장비 검색
          </h1>
          <p className="text-base md:text-lg text-slate-400 max-w-lg mx-auto">
            제품명, 카탈로그 번호, 브랜드로 검색하세요.
            비교·견적 요청까지 한 번에 진행할 수 있습니다.
          </p>
        </div>

        {/* Search input */}
        <div className="relative max-w-xl mx-auto">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="제품명, 카탈로그 번호, 브랜드 검색..."
                className="pl-10 h-12 bg-[#1a1a1e] border-[#333338] text-slate-100 placeholder:text-slate-500 text-base"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!query.trim()}
              className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white"
            >
              검색
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Example queries */}
        <div className="space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">검색 예시</p>
          <div className="flex flex-wrap justify-center gap-2">
            {exampleQueries.map((eq) => {
              const Icon = eq.icon;
              return (
                <button
                  key={eq.label}
                  onClick={() => handleExampleClick(eq.label)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-slate-400 bg-[#1a1a1e] border border-[#2a2a2e] hover:border-slate-500 hover:text-slate-300 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {eq.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Searchable keys info */}
        <div className="pt-8 border-t border-[#2a2a2e]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { label: "제품명", desc: "한글/영문 제품명" },
              { label: "카탈로그 번호", desc: "제조사 Cat. No." },
              { label: "브랜드", desc: "제조사/유통사" },
              { label: "LOT 번호", desc: "배치 추적" },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <p className="text-sm font-medium text-slate-300">{item.label}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Login required modal */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="bg-[#1a1a1e] border-[#333338] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-100 flex items-center gap-2">
              <LogIn className="h-5 w-5 text-blue-400" />
              로그인이 필요합니다
            </DialogTitle>
            <DialogDescription className="text-slate-400 pt-2">
              로그인 후 결과 확인과 비교·견적 요청을 진행할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(query.trim() ? `/app/search?q=${encodeURIComponent(query.trim())}` : "/app/search")}`}>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                로그인하기
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="text-slate-400 hover:text-slate-300"
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
      <div className="min-h-screen bg-[#111114] flex items-center justify-center">
        <div className="text-slate-500">로딩 중...</div>
      </div>
    }>
      <PublicSearchContent />
    </Suspense>
  );
}
