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
      className="pt-16 pb-14 md:pt-20 md:pb-16"
      style={{
        /* Transition band — desaturated slate-gray, NOT body navy */
        backgroundColor: "#1C222C",
        borderTop: "1px solid #2A3240",
      }}
    >
      <div className="mx-auto max-w-[340px] px-4 md:px-6">
        {/* Contained conversion panel — subtle lift, not a card */}
        <div
          className="rounded-lg px-5 py-6 md:px-6 md:py-7 text-center"
          style={{
            backgroundColor: "#252D3A",
            border: "1px solid #343E4E",
          }}
        >
          <div className="space-y-2 mb-6">
            <h2
              className="text-base md:text-lg font-bold tracking-tight leading-tight"
              style={{ color: "#D4DCE8" }}
            >
              구매 운영을 체계화하세요
            </h2>
            <p
              className="text-[12.5px] max-w-[280px] mx-auto leading-relaxed"
              style={{ color: "#8A99AF" }}
            >
              필요한 후보와 다음 단계를 먼저 정리해,
              운영자가 더 빠르게 선택할 수 있게 돕습니다.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mb-4">
            <Button
              className="w-full sm:w-auto h-9 px-6 font-bold text-[13px] flex items-center justify-center gap-2 rounded-lg"
              style={{
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                boxShadow: "0 1px 8px rgba(37,99,235,0.30)",
              }}
              onClick={handleConsoleClick}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#1D4ED8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#2563EB"; }}
            >
              운영 콘솔 시작하기
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Link href="/support" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto h-8 px-5 font-medium text-[12px] rounded-lg"
                style={{
                  borderColor: "#434E5E",
                  color: "#94A3B8",
                  backgroundColor: "transparent",
                }}
              >
                도입 문의
              </Button>
            </Link>
          </div>

          <p className="text-[11px]" style={{ color: "#5E6E82" }}>
            연구실·바이오팀의 반복 구매 운영에 최적화된 플랫폼입니다.
          </p>
        </div>
      </div>
    </section>
  );
}
