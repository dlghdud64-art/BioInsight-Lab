"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

/*
 * ── Final Action Surface — 명도 상향 ──────────────────────────────
 */

const FLOW_STEPS = [
  { label: "시약 검색", active: false },
  { label: "후보 정리", active: false },
  { label: "비교·선택안 확정", active: true },
  { label: "요청 생성", active: false },
  { label: "발주 준비", active: false },
];

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
      className="py-14 md:py-18"
      style={{ backgroundColor: "#0B1120", borderTop: "1px solid #1C2A42" }}
    >
      <div className="mx-auto max-w-[1000px] px-5 md:px-8">

        <div className="text-center mb-6">
          <h2 className="text-base md:text-lg font-bold text-white tracking-tight">
            시약 검색부터 발주 전환까지, 하나의 흐름으로
          </h2>
        </div>

        <div
          className="rounded-xl px-5 md:px-8 py-6 md:py-8 mb-8"
          style={{ backgroundColor: "#243044", border: "1px solid #344968" }}
        >
          {/* Horizontal flow (desktop) */}
          <div className="hidden md:flex items-center justify-center gap-0">
            {FLOW_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div
                  className="px-4 py-2 rounded-md text-[12px] font-medium"
                  style={{
                    backgroundColor: step.active ? "rgba(255,255,255,0.08)" : "transparent",
                    color: step.active ? "#F1F5F9" : "#8296B0",
                    border: step.active ? "1px solid #4A6080" : "1px solid #344968",
                  }}
                >
                  {step.label}
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <ArrowRight className="h-3 w-3 mx-2 flex-shrink-0" style={{ color: "#3A4D65" }} />
                )}
              </div>
            ))}
          </div>

          {/* Vertical flow (mobile) */}
          <div className="md:hidden space-y-2">
            {FLOW_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: step.active ? "#F1F5F9" : "#4A6080" }}
                />
                <span
                  className="text-[12px] font-medium"
                  style={{ color: step.active ? "#F1F5F9" : "#94A8C0" }}
                >
                  {step.label}
                </span>
                {i < FLOW_STEPS.length - 1 && (
                  <ArrowRight className="h-2.5 w-2.5 ml-auto" style={{ color: "#4A6080" }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            className="w-full sm:w-auto h-11 px-8 font-bold text-[14px] flex items-center justify-center gap-2 rounded-lg border border-blue-500/25"
            style={{
              backgroundColor: "#3B82F6",
              color: "#FFFFFF",
              boxShadow: "0 2px 12px rgba(59,130,246,0.2)",
            }}
            onClick={handleConsoleClick}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#2563EB"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#3B82F6"; }}
          >
            시약·장비 검색 시작하기
            <Search className="h-4 w-4" />
          </Button>
          <Link href="/support" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto h-10 px-7 font-medium text-[13px] rounded-lg"
              style={{
                borderColor: "#344968",
                color: "#94A8C0",
                backgroundColor: "transparent",
              }}
            >
              도입 문의
            </Button>
          </Link>
        </div>

      </div>
    </section>
  );
}
