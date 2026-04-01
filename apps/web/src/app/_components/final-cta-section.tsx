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
      className="py-16 md:py-24"
      style={{
        /* Transition band — desaturated slate, NOT body navy */
        backgroundColor: "#1E252F",
        borderTop: "1px solid #2A3240",
      }}
    >
      <div className="mx-auto max-w-lg px-4 md:px-6">
        {/* Muted conversion panel — compact, contained */}
        <div
          className="rounded-xl px-6 py-8 md:px-8 md:py-9 text-center"
          style={{
            backgroundColor: "#D8DFE9",
            border: "1px solid #C0C9D6",
          }}
        >
          <div className="space-y-2.5 mb-7">
            <h2
              className="text-lg md:text-[22px] font-bold tracking-tight leading-tight"
              style={{ color: "#1E293B" }}
            >
              구매 운영을 체계화하세요
            </h2>
            <p
              className="text-[13px] max-w-xs mx-auto leading-relaxed"
              style={{ color: "#4B5C72" }}
            >
              필요한 후보와 다음 단계를 먼저 정리해,
              운영자가 더 빠르게 선택할 수 있게 돕습니다.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mb-5">
            <Button
              className="w-full sm:w-auto h-10 px-7 font-bold text-[13px] flex items-center justify-center gap-2 rounded-lg"
              style={{
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                boxShadow: "0 1px 6px rgba(37,99,235,0.22)",
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
                className="w-full sm:w-auto h-9 px-5 font-medium text-[12px] rounded-lg"
                style={{
                  borderColor: "#A8B3C2",
                  color: "#4B5C72",
                  backgroundColor: "transparent",
                }}
              >
                도입 문의
              </Button>
            </Link>
          </div>

          <p className="text-[11px]" style={{ color: "#7A8A9E" }}>
            연구실·바이오팀의 반복 구매 운영에 최적화된 플랫폼입니다.
          </p>
        </div>
      </div>
    </section>
  );
}
