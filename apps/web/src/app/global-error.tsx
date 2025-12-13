"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 전역 에러 로깅
    console.error("Global application error:", error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">심각한 오류가 발생했습니다</CardTitle>
                  <CardDescription className="mt-1">
                    애플리케이션을 다시 시작해야 합니다
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">
                  {error.message || "알 수 없는 오류가 발생했습니다. 페이지를 새로고침하거나 잠시 후 다시 시도해주세요."}
                </p>
                {error.digest && (
                  <p className="text-xs text-slate-400 mt-2">
                    오류 ID: {error.digest}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={reset} variant="default" className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  다시 시도
                </Button>
                <Button
                  onClick={() => {
                    window.location.href = "/";
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <Home className="h-4 w-4 mr-2" />
                  홈으로 이동
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  );
}

