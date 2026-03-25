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
    <section className="py-16 md:py-24" style={{ backgroundColor: "#131920", borderTop: "1px solid #2A3442" }}>
      <div className="mx-auto max-w-2xl px-4 md:px-6 text-center">
        <div className="space-y-3 mb-8">
          <h2 className="text-lg md:text-2xl font-bold text-[#F4F7FF] tracking-tight leading-tight">
            구매 운영을 체계화하세요
          </h2>
          <p className="text-xs md:text-sm text-[#BAC6D9] max-w-md mx-auto leading-relaxed">
            AI는 결정을 대신하지 않습니다.
            <br />
            필요한 후보와 다음 단계를 먼저 정리해, 운영자가 더 빠르게 선택할 수 있게 돕습니다.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <Button
            className="w-full sm:w-auto h-11 px-8 bg-white hover:bg-slate-100 text-[#0B1016] font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
            onClick={handleConsoleClick}
          >
            운영 콘솔 시작하기
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Link href="/support" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto h-10 px-6 border-[#2A3442] text-[#BAC6D9] hover:text-[#F3F7FF] hover:border-[#354459] font-medium text-sm">
              도입 문의
            </Button>
          </Link>
        </div>

        <p className="text-[10px] text-[#667389]">
          연구실·바이오팀의 반복 구매 운영에 최적화된 플랫폼입니다.
        </p>
      </div>
    </section>
  );
}
