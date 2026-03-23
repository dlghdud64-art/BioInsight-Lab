"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ShieldCheck, Users, Zap, Search, GitCompare, FileText, ShoppingCart, PackageCheck, Warehouse } from "lucide-react";

const pipelineSteps = [
  { icon: Search, label: "검색" },
  { icon: GitCompare, label: "비교" },
  { icon: FileText, label: "견적" },
  { icon: ShoppingCart, label: "발주" },
  { icon: PackageCheck, label: "입고" },
  { icon: Warehouse, label: "재고" },
];

const trustItems = [
  { icon: ShieldCheck, text: "256-bit 엔터프라이즈급 데이터 암호화" },
  { icon: Users, text: "조직 단위 역할 기반 접근 제어" },
  { icon: Zap, text: "구매-재고 운영 실시간 연결" },
];

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "/dashboard";

  return (
    <div className="flex min-h-screen">

      {/* ══════ LEFT: Light Brand Intro ══════ */}
      <div className="hidden lg:flex w-[52%] relative min-h-screen flex-col overflow-hidden bg-[#F4F7FB]">
        {/* Right edge subtle divider */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-slate-200/60" />

        {/* Brand logo — dark on light */}
        <div className="pt-14 pl-16">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="text-[26px] font-bold tracking-tight text-slate-900">LabAxis</span>
          </Link>
        </div>

        {/* Brand copy — dark text on light surface */}
        <div className="flex-1 flex flex-col justify-center pl-16 pr-12 space-y-12">
          <div className="space-y-6">
            <h1 className="text-[36px] font-extrabold leading-[1.25] text-slate-900 tracking-tight">
              연구실의 검색-견적-구매-재고<br />
              업무를 한곳에서.
            </h1>
            <p className="text-slate-500 text-[16px] max-w-[420px] leading-[1.7]">
              반복 검색, 수기 견적, 재고 공백을{" "}
              <span className="text-blue-600 font-semibold">운영 시스템</span>으로 전환합니다.
            </p>
          </div>

          {/* Pipeline signature strip — light version */}
          <div className="flex items-center gap-4 flex-wrap">
            {pipelineSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-4">
                <div className="flex items-center gap-3 rounded-xl px-5 py-3 bg-white border border-slate-200 shadow-sm">
                  <step.icon className="w-[18px] h-[18px] text-blue-500" />
                  <span className="text-[14px] text-slate-700 font-semibold">{step.label}</span>
                </div>
                {i < pipelineSteps.length - 1 && (
                  <span className="text-slate-300 text-sm select-none font-light">→</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Trust reassurance — dark text */}
        <div className="pb-14 pl-16 pr-12 space-y-4">
          {trustItems.map((item) => (
            <div key={item.text} className="flex items-center gap-3">
              <item.icon className="w-[18px] h-[18px] text-slate-400 shrink-0" />
              <span className="text-[14px] text-slate-500 font-medium">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══════ RIGHT: Dark Auth Entry Field ══════ */}
      <div className="w-full lg:w-[48%] flex flex-col min-h-screen bg-[#020817]">
        {/* Mobile: light brand header */}
        <div className="lg:hidden flex justify-center pt-8 pb-4 bg-[#F4F7FB]">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">LabAxis</Link>
        </div>

        {/* Card area — pulled center-ward */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:pr-16 lg:pl-10">
          <div className="w-full max-w-[420px]">
            {/* Auth Entry Card */}
            <div
              className="rounded-2xl p-10 space-y-8 bg-[#0B1530] border border-white/[0.08]"
              style={{ boxShadow: '0 16px 64px rgba(0,0,0,0.8)' }}
            >
              {/* Back link */}
              <Link href="/" className="inline-flex items-center text-xs text-slate-500 hover:text-white transition-colors">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                홈으로 돌아가기
              </Link>

              {/* Title */}
              <div className="space-y-2">
                <h2 className="text-[22px] font-bold text-white">로그인</h2>
                <p className="text-slate-400 text-[15px] leading-relaxed">
                  연구실의 검색-견적-구매-재고 업무를 한곳에서 처리하세요.
                </p>
              </div>

              {/* Google — WHITE primary control */}
              <Button
                className="w-full font-semibold text-[15px] rounded-xl transition-all hover:opacity-90 bg-white text-slate-900 border border-slate-900/[0.06]"
                style={{ height: 54, boxShadow: '0 4px 16px rgba(255,255,255,0.06)' }}
                onClick={() => signIn("google", { callbackUrl })}
              >
                <svg className="mr-3 h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google로 로그인
              </Button>

              <div className="pt-1" />

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/[0.06]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 text-[11px] text-slate-600 bg-[#0B1530]">
                    또는 이메일로 계속하기
                  </span>
                </div>
              </div>

              {/* Email/PW (disabled) */}
              <div className="space-y-3">
                <Input
                  type="email" placeholder="이메일" disabled
                  className="border border-white/[0.06] text-base placeholder:text-slate-700 opacity-50 cursor-not-allowed rounded-lg h-11 bg-[#060E20] text-slate-400"
                  style={{ fontSize: "16px" }}
                />
                <Input
                  type="password" placeholder="비밀번호" disabled
                  className="border border-white/[0.06] text-base placeholder:text-slate-700 opacity-50 cursor-not-allowed rounded-lg h-11 bg-[#060E20] text-slate-400"
                  style={{ fontSize: "16px" }}
                />
                <p className="text-[11px] text-slate-600 text-center pt-1">
                  이메일 로그인은 곧 제공될 예정입니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 sm:p-8 pt-0 space-y-3">
          <p className="text-center text-sm text-slate-500">
            계정이 없으신가요?{" "}
            <Link href="/test/search" className="font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2">
              무료로 시작하기
            </Link>
          </p>
          <p className="text-center text-[11px] text-slate-600 leading-relaxed">
            데이터 무결성과 ISMS 가이드를 준수합니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#020817]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
