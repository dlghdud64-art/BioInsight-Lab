"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Home, RefreshCw, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function QuoteDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[QuoteDetail] Runtime error:", error);
  }, [error]);

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
          <span className="text-slate-400">상세</span>
        </nav>

        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto w-fit rounded-full bg-red-50 p-3">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200 mb-1">
                견적 상세를 불러오는 중 오류가 발생했습니다
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                네트워크 문제이거나 데이터 형식이 변경되었을 수 있습니다.
                문제가 반복되면 관리자에게 문의하세요.
              </p>
            </div>
            {error.digest && (
              <p className="text-[10px] text-slate-400 font-mono bg-pg px-3 py-1.5 rounded inline-block">
                오류 ID: {error.digest}
              </p>
            )}
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
