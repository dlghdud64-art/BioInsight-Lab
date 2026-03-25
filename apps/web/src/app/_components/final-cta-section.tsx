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
    <section className="py-16 md:py-20 bg-[#111114] border-t border-[#333338]">
      <div className="mx-auto max-w-3xl px-4 md:px-6 text-center">
        <div className="space-y-3 mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Get Started
          </p>
          <h2 className="text-lg md:text-3xl font-bold text-slate-100 tracking-tight leading-tight">
            구매 운영을 체계화하세요
          </h2>
          <p className="text-sm md:text-base text-slate-400 max-w-md mx-auto leading-relaxed break-keep">
            비교·견적·발주·입고·재고까지 끊기지 않는 운영 파이프라인.
            <br />
            운영 콘솔에서 전 과정을 추적하고 통제합니다.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto h-11 px-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2">
              운영 콘솔 시작하기
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/support" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto h-11 px-8 border-[#333338] text-slate-400 hover:bg-[#222226] font-medium text-sm">
              도입 문의
            </Button>
          </Link>
        </div>

        <p className="text-[11px] text-slate-500">
          연구실·바이오팀의 반복 구매 운영에 최적화된 플랫폼입니다.
        </p>
      </div>
    </section>
  );
}
