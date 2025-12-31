"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 에러를 로깅할 수 있습니다
    console.error("Test page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4 text-center">
        <div className="flex justify-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">문제가 발생했습니다</h2>
        <p className="text-gray-600">{error.message || "알 수 없는 오류가 발생했습니다."}</p>
        <div className="flex gap-2 justify-center">
          <Button onClick={reset} variant="default">
            다시 시도
          </Button>
          <Button onClick={() => window.location.href = "/"} variant="outline">
            홈으로 이동
          </Button>
        </div>
      </div>
    </div>
  );
}

