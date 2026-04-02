"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

/*
 * ── Conversion Surface ─────────────────────────────────────────────
 *  Role: Proof 흐름의 종착점 — 운영 판단 후 행동 전환
 *  Tone: dark product surface 유지, proof보다 한 단계 깊은 배경
 *  NOT: light B2B 전환 — dark surface grammar를 끝까지 유지
 * ────────────────────────────────────────────────────────────────────
 */

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
      className="py-16 md:py-20"
      style={{ backgroundColor: "#0A1525", borderTop: "1px solid #162A42" }}
    >
      <div className="mx-auto max-w-[1100px] px-5 md:px-8">
        <div
          className="rounded-xl px-8 pt-10 pb-8 md:px-16 md:pt-14 md:pb-12"
          style={{
            backgroundColor: "#0D1E35",
            border: "1px solid #1E3050",
          }}
        >
          <div className="text-center max-w-2xl mx-auto">
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-3"
              style={{ color: "#60A5FA" }}
            >
              Get Started
            </p>
            <h2
              className="text-xl md:text-2xl font-bold tracking-tight leading-tight mb-3 text-white"
            >
              구매 운영을 체계화하세요
            </h2>
            <p
              className="text-[12px] md:text-[13px] leading-relaxed mb-8"
              style={{ color: "#8A99AF" }}
            >
              필요한 후보와 다음 단계를 먼저 정리해,
              팀이 더 빠르게 검토하고 진행할 수 있게 돕습니다.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <Button
                className="w-full sm:w-auto h-11 px-9 font-bold text-[14px] flex items-center justify-center gap-2 rounded-lg"
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
                    borderColor: "#1E3050",
                    color: "#8A99AF",
                    backgroundColor: "transparent",
                  }}
                >
                  도입 문의
                </Button>
              </Link>
            </div>

            <p className="text-[11px]" style={{ color: "#4A5E78" }}>
              연구실·바이오팀의 반복 구매 운영에 최적화된 플랫폼입니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
