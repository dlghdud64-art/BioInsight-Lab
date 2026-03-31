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
    <section className="py-20 md:py-28" style={{ backgroundColor: "#1F2940", borderTop: "1px solid #344A68" }}>
      <div className="mx-auto max-w-2xl px-4 md:px-6 text-center">
        <div className="space-y-4 mb-10">
          <h2 className="text-xl md:text-[28px] font-bold text-white tracking-tight leading-tight">
            구매 운영을 체계화하세요
          </h2>
          <p className="text-sm md:text-[15px] text-[#C8D4E5] max-w-md mx-auto leading-relaxed">
            AI는 결정을 대신하지 않습니다.
            <br />
            필요한 후보와 다음 단계를 먼저 정리해, 운영자가 더 빠르게 선택할 수 있게 돕습니다.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <Button
            className="w-full sm:w-auto h-12 px-10 bg-white hover:bg-slate-100 text-[#0B1016] font-bold text-[15px] flex items-center justify-center gap-2 shadow-xl shadow-white/10"
            onClick={handleConsoleClick}
          >
            운영 콘솔 시작하기
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Link href="/support" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto h-11 px-7 border-[#3A4E6A] text-[#C8D4E5] hover:text-white hover:border-[#5A7090] font-medium text-sm">
              도입 문의
            </Button>
          </Link>
        </div>

        <p className="text-[11px] text-[#8A99AF]">
          연구실·바이오팀의 반복 구매 운영에 최적화된 플랫폼입니다.
        </p>
      </div>
    </section>
  );
}
