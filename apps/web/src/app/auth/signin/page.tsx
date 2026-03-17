"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LabAxisLogo } from "@/components/bioinsight-logo";
import { ShieldCheck, ArrowRight, Users, ClipboardList, Lock } from "lucide-react";


function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "/dashboard";

  return (
    <div className="flex min-h-screen">
      {/* ── LEFT PANEL (desktop only) ── */}
      <div className="hidden lg:flex w-1/2 bg-[#060a12] relative min-h-screen flex-col overflow-hidden">
        {/* Brand top-left */}
        <div className="pt-10 pl-12">
          <Link href="/" className="inline-block">
            <LabAxisLogo size="sm" showText />
          </Link>
        </div>

        {/* Center copy */}
        <div className="flex-1 flex flex-col justify-center pl-12 pr-14 space-y-5">
          <h1 className="text-[2.25rem] font-bold leading-snug text-white tracking-tight antialiased">
            연구 구매 운영을<br />
            하나의 흐름으로 연결합니다
          </h1>
          <p className="text-slate-400 text-[15px] max-w-md leading-relaxed antialiased">
            검색, 비교, 견적, 발주, 입고, 재고 운영까지<br />
            LabAxis에서 이어집니다
          </p>
        </div>

        {/* Product proof strip */}
        <div className="pl-12 pr-14 pb-16 space-y-4">
          {/* Pipeline */}
          <div className="flex items-center gap-2 text-[13px] text-slate-500 antialiased">
            {["검색", "비교", "견적", "발주", "재고 운영"].map((step, i, arr) => (
              <span key={step} className="flex items-center gap-2">
                <span className="text-slate-300">{step}</span>
                {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-slate-600" />}
              </span>
            ))}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {["승인", "예산", "Lot", "Expiry", "역할 기반 워크스페이스 운영"].map((tag) => (
              <span
                key={tag}
                className="inline-block text-[11px] text-slate-400 border border-slate-700/60 rounded px-2 py-0.5"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Security line */}
          <div className="flex items-center gap-2 text-slate-500 text-[12px] pt-2 antialiased">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            256-bit 엔터프라이즈급 데이터 암호화 적용 중
          </div>
        </div>
      </div>

      {/* ── RIGHT AUTH PANEL ── */}
      <div className="w-full lg:w-1/2 flex flex-col min-h-screen bg-[#0a0d11]">
        {/* Mobile brand */}
        <div className="lg:hidden flex justify-center pt-8 pb-4">
          <Link href="/">
            <LabAxisLogo size="sm" showText />
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <div className="max-w-md w-full">
            {/* Auth form surface */}
            <div className="bg-[#121619] border border-[#1e2228] rounded-lg p-6 md:p-8 space-y-6">
              {/* Title */}
              <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-100">
                  로그인
                </h2>
                <p className="text-slate-400 mt-1.5 text-sm leading-relaxed">
                  워크스페이스에 접속해 오늘의<br className="sm:hidden" />
                  구매·재고 운영 상태를 확인하세요
                </p>
              </div>

              {/* Google sign-in */}
              <Button
                variant="outline"
                className="w-full h-12 border-[#1e2228] bg-[#181c22] hover:bg-[#1e2228] hover:border-blue-500/40 font-medium text-slate-200"
                onClick={() => signIn("google", { callbackUrl })}
              >
                <svg className="mr-3 h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google로 로그인
              </Button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-[#1e2228]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[#121619] px-3 text-xs text-slate-500">
                    또는 이메일로 계속하기
                  </span>
                </div>
              </div>

              {/* Email fields (disabled) */}
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="이메일"
                  disabled
                  className="bg-[#181c22] border-[#1e2228] cursor-not-allowed text-base placeholder:text-slate-600"
                  style={{ fontSize: "16px" }}
                />
                <Input
                  type="password"
                  placeholder="비밀번호"
                  disabled
                  className="bg-[#181c22] border-[#1e2228] cursor-not-allowed text-base placeholder:text-slate-600"
                  style={{ fontSize: "16px" }}
                />
                <p className="text-xs text-slate-500 text-center">
                  이메일 로그인은 곧 제공될 예정입니다.
                </p>
              </div>

              {/* Trust indicators */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px] text-slate-500 leading-tight">조직 권한 기반 접근</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px] text-slate-500 leading-tight">활동 이력 기록</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px] text-slate-500 leading-tight">팀 워크스페이스 지원</span>
                </div>
              </div>
            </div>

            {/* Footer below card */}
            <div className="mt-6 space-y-3">
              <p className="text-center text-sm text-slate-400">
                계정이 없으신가요?{" "}
                <Link
                  href="/test/search"
                  className="font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2"
                >
                  무료로 시작하기
                </Link>
              </p>
              <p className="text-center text-[11px] text-slate-500 leading-relaxed">
                LabAxis은 데이터 무결성과 CFR 21 Part 11 가이드를 준수합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#0a0d11]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
