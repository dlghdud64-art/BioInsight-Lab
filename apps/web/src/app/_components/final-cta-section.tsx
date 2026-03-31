"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export function FinalCTASection() {
  const { data: session } = useSession();
  const router = useRouter();
  const isLoggedIn = !!session?.user;

  const handleConsoleClick = () => {
    if (isLoggedIn) {
      router.push("/dashboard");
    } else {
      router.push("/auth/signin?callbackUrl=%2Fdashboard");
    }
  };

  return (
    <section
      className="py-20 md:py-28"
      style={{
        backgroundColor: "#131A24",
        borderTop: "1px solid #1E2A3A",
      }}
    >
      <div className="mx-auto max-w-2xl px-4 md:px-6">
        {/* Contained light-neutral CTA panel */}
        <div
          className="rounded-2xl px-8 py-12 md:px-12 md:py-14 text-center"
          style={{
            backgroundColor: "#E9EDF3",
            border: "1px solid #D5DBE5",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.10)",
          }}
        >
          <div className="space-y-4 mb-10">
            <h2
              className="text-xl md:text-[28px] font-bold tracking-tight leading-tight"
              style={{ color: "#1E293B" }}
            >
              구매 운영을 체계화하세요
            </h2>
            <p
              className="text-sm md:text-[15px] max-w-md mx-auto leading-relaxed"
              style={{ color: "#546175" }}
            >
              AI는 결정을 대신하지 않습니다.
              <br />
              필요한 후보와 다음 단계를 먼저 정리해, 운영자가 더 빠르게 선택할 수 있게 돕습니다.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <Button
              className="w-full sm:w-auto h-12 px-10 font-bold text-[15px] flex items-center justify-center gap-2 rounded-xl shadow-lg"
              style={{
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
              }}
              onClick={handleConsoleClick}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#1D4ED8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#2563EB"; }}
            >
              운영 콘솔 시작하기
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Link href="/support" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto h-11 px-7 font-medium text-sm rounded-xl"
                style={{
                  borderColor: "#B8C2D1",
                  color: "#475569",
                  backgroundColor: "transparent",
                }}
              >
                도입 문의
              </Button>
            </Link>
          </div>

          <p className="text-[11px]" style={{ color: "#8494A7" }}>
            연구실·바이오팀의 반복 구매 운영에 최적화된 플랫폼입니다.
          </p>
        </div>
      </div>
    </section>
  );
}
