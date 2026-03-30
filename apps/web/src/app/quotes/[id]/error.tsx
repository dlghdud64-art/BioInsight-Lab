"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Home, RefreshCw, ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

export default function QuoteDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const quoteId = params?.id as string | undefined;
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    // 구조화된 에러 로그: 사후 디버깅을 위해 최소 정보를 남김
    console.error("[QuoteDetail:ErrorBoundary]", {
      quoteId: quoteId || "unknown",
      errorMessage: error?.message || "no message",
      errorName: error?.name || "unknown",
      errorDigest: error?.digest || null,
      errorStack: error?.stack?.split("\n").slice(0, 5).join("\n") || "no stack",
      url: typeof window !== "undefined" ? window.location.href : "ssr",
      timestamp: new Date().toISOString(),
    });
  }, [error, quoteId]);

  return (
    <div className="min-h-screen bg-pg">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/dashboard" className="hover:text-slate-100">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <Link href="/dashboard/quotes" className="hover:text-slate-100">
            견적 관리
          </Link>
          <span>/</span>
          <span className="text-slate-400">상세{quoteId ? ` (${quoteId.slice(0, 8)}…)` : ""}</span>
        </nav>

        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto w-fit rounded-full bg-red-600/10 p-3">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200 mb-1">
                견적 상세를 불러오는 중 오류가 발생했습니다
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                네트워크 문제이거나 데이터 형식이 변경되었을 수 있습니다.
                문제가 반복되면 아래 오류 정보와 함께 관리자에게 문의하세요.
              </p>
            </div>

            {/* 오류 식별 정보 */}
            <div className="inline-flex flex-col gap-1.5">
              {error.digest && (
                <p className="text-[10px] text-slate-400 font-mono bg-pg px-3 py-1.5 rounded">
                  오류 ID: {error.digest}
                </p>
              )}
              {quoteId && (
                <p className="text-[10px] text-slate-500 font-mono">
                  견적 ID: {quoteId}
                </p>
              )}
            </div>

            {/* 개발 디버그 정보 (접힘) */}
            <div className="max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setShowDebug(!showDebug)}
                className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors mx-auto"
              >
                {showDebug ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                오류 상세
              </button>
              {showDebug && (
                <div className="mt-2 text-left bg-[#1a1c20] border border-bd rounded-md px-3 py-2 overflow-x-auto">
                  <p className="text-[10px] text-red-400 font-mono break-all">{error?.message || "Unknown error"}</p>
                  {error?.stack && (
                    <pre className="text-[9px] text-slate-600 font-mono mt-1 whitespace-pre-wrap break-all leading-relaxed">
                      {error.stack.split("\n").slice(0, 8).join("\n")}
                    </pre>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <Button size="sm" onClick={reset}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                다시 시도
              </Button>
              <Link href="/dashboard/quotes">
                <Button variant="outline" size="sm">
                  <ChevronLeft className="h-3.5 w-3.5 mr-1.5" />
                  견적 목록
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
