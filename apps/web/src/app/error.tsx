"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCcw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="bg-red-100 rounded-full p-4">
            <AlertCircle className="h-16 w-16 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          오류가 발생했습니다
        </h1>

        {/* Description */}
        <p className="text-slate-600 mb-2">
          예상치 못한 오류가 발생했습니다.
        </p>
        <p className="text-sm text-slate-500 mb-8">
          {error.message || "페이지를 불러오는 중 문제가 발생했습니다."}
        </p>

        {/* Error Details (Development) */}
        {process.env.NODE_ENV === "development" && error.digest && (
          <div className="mb-6 p-4 bg-slate-100 rounded-lg text-left">
            <p className="text-xs font-mono text-slate-700">
              Error ID: {error.digest}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} size="lg">
            <RefreshCcw className="h-4 w-4 mr-2" />
            다시 시도
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              홈으로 가기
            </Link>
          </Button>
        </div>

        {/* Help Text */}
        <div className="mt-8 pt-8 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            문제가 계속되면{" "}
            <a
              href="mailto:support@bioinsight-lab.com"
              className="text-blue-600 hover:underline"
            >
              지원팀에 문의
            </a>
            해주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
