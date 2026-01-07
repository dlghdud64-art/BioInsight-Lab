"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Production 환경에서만 에러 로깅 (개발 환경에서는 console.error 유지)
    if (process.env.NODE_ENV === "production") {
      // Production에서는 에러 추적 서비스로 전송 가능
      // 예: Sentry, LogRocket 등
    } else {
      console.error("Application error:", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-lg w-full space-y-6 text-center bg-white p-8 md:p-12 rounded-xl shadow-lg border border-slate-200">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-50 p-4">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">일시적인 오류가 발생했습니다</h2>
          <p className="text-sm md:text-base text-slate-600">
            잠시 후 다시 시도해주세요. 문제가 계속되면 고객지원팀에 문의해주세요.
          </p>
        </div>
        {error.digest && (
          <div className="text-xs text-slate-400 font-mono bg-slate-50 p-2 rounded">
            오류 ID: {error.digest}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button 
            onClick={reset} 
            variant="default"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            다시 시도
          </Button>
          <Button 
            asChild
            variant="outline"
            size="lg"
            className="border-slate-300"
          >
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              홈으로 이동
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
