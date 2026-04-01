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
      style={{ backgroundColor: "#D8E2EE" }}
    >
      <div className="mx-auto max-w-[1120px] px-5 md:px-8">
        <div
          className="rounded-2xl px-8 pt-12 pb-10 md:px-20 md:pt-16 md:pb-14"
          style={{
            backgroundColor: "#F7FAFD",
            border: "1px solid #D0DAE8",
            boxShadow: "0 1px 4px rgba(15,23,42,0.04), 0 4px 20px rgba(51,65,85,0.06)",
          }}
        >
          <div className="text-center max-w-2xl mx-auto">
            <p
              className="text-[11px] font-bold uppercase tracking-widest mb-4"
              style={{ color: "#2563EB" }}
            >
              Get Started
            </p>
            <h2
              className="text-2xl md:text-[28px] font-bold tracking-tight leading-tight mb-3.5"
              style={{ color: "#0F1728" }}
            >
              구매 운영을 체계화하세요
            </h2>
            <p
              className="text-sm md:text-[15px] leading-relaxed mb-10"
              style={{ color: "#5B6678" }}
            >
              필요한 후보와 다음 단계를 먼저 정리해,
              팀이 더 빠르게 검토하고 진행할 수 있게 돕습니다.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-8">
              <Button
                className="w-full sm:w-auto h-12 px-10 font-bold text-[15px] flex items-center justify-center gap-2 rounded-lg"
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
                  className="w-full sm:w-auto h-11 px-8 font-medium text-[14px] rounded-lg"
                  style={{
                    borderColor: "#D0DAE8",
                    color: "#5B6678",
                    backgroundColor: "transparent",
                  }}
                >
                  도입 문의
                </Button>
              </Link>
            </div>

            <p className="text-[12px]" style={{ color: "#94A3B8" }}>
              연구실·바이오팀의 반복 구매 운영에 최적화된 플랫폼입니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
