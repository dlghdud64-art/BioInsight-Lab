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
      className="pt-12 pb-16 md:pt-14 md:pb-20"
      style={{
        backgroundColor: "#ECEAE6",
        borderTop: "1px solid #D5D3CE",
      }}
    >
      <div className="mx-auto max-w-2xl px-5 md:px-8">
        <div
          className="rounded-xl px-8 pt-10 pb-9 md:px-14 md:pt-12 md:pb-11 text-center"
          style={{
            backgroundColor: "#FAFAF8",
            border: "1px solid #D5D3CE",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <div className="space-y-3 mb-8">
            <h2
              className="text-xl md:text-2xl font-bold tracking-tight leading-tight"
              style={{ color: "#1E293B" }}
            >
              구매 운영을 체계화하세요
            </h2>
            <p
              className="text-[13.5px] max-w-md mx-auto leading-relaxed"
              style={{ color: "#64748B" }}
            >
              필요한 후보와 다음 단계를 먼저 정리해,
              운영자가 더 빠르게 선택할 수 있게 돕습니다.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-6">
            <Button
              className="w-full sm:w-auto h-11 px-8 font-bold text-[14px] flex items-center justify-center gap-2 rounded-lg"
              style={{
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                boxShadow: "0 1px 8px rgba(37,99,235,0.22)",
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
                className="w-full sm:w-auto h-10 px-7 font-medium text-[13px] rounded-lg"
                style={{
                  borderColor: "#C5C3BE",
                  color: "#64748B",
                  backgroundColor: "transparent",
                }}
              >
                도입 문의
              </Button>
            </Link>
          </div>

          <p className="text-[11.5px]" style={{ color: "#94A3B8" }}>
            연구실·바이오팀의 반복 구매 운영에 최적화된 플랫폼입니다.
          </p>
        </div>
      </div>
    </section>
  );
}
