"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { BioInsightLogo } from "@/components/bioinsight-logo";

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "/";
  return (
    <div className="flex min-h-screen">
      {/* 좌측 비주얼 영역 (데스크톱 전용) - fixed 로고 + 절대 좌표 슬로건 */}
      <div className="hidden lg:flex w-1/2 bg-[#0b1120] relative min-h-screen flex-col overflow-hidden">
        {/* 1. 브랜드 로고: PNG 흰배경 없이 CSS 그라데이션 아이콘 + 텍스트 */}
        <div className="absolute top-12 left-12 z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 via-blue-500 to-purple-500 flex items-center justify-center shadow-lg shrink-0">
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" aria-hidden="true">
              <path d="M4 5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm8 8a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6zM4 14a1 1 0 0 1 1-1h3v-3a1 1 0 0 1 2 0v3h3a1 1 0 0 1 0 2h-3v3a1 1 0 0 1-2 0v-3H5a1 1 0 0 1-1-1z"/>
            </svg>
          </div>
          <div className="leading-tight">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold tracking-tight text-white">BioInsight</span>
              <span className="text-xl font-bold tracking-tight text-teal-300">Lab</span>
            </div>
            <div className="text-[11px] text-slate-400">Procurement & Research</div>
          </div>
        </div>

        {/* 2. 슬로건: 수직 중앙 배치 */}
        <div className="flex-1 flex flex-col justify-center pl-16 pr-16 space-y-8">
          <h1 className="text-5xl font-extrabold leading-tight text-white tracking-tighter antialiased">
            연구에만 집중하세요.
            <br />
            <span className="text-blue-500">시약 관리는 저희가 합니다.</span>
          </h1>
          <p className="text-slate-400 text-xl max-w-lg leading-relaxed antialiased">
            수천 개의 시약과 예산을 데이터로 증명하세요.
            <br />
            실사(Audit) 준비가 더 이상 두렵지 않습니다.
          </p>
        </div>

        {/* 3. 하단 보안 지표 */}
        <div className="absolute bottom-12 left-16 flex items-center gap-2 text-slate-500 text-sm antialiased">
          <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
          256-bit 엔터프라이즈급 데이터 암호화 적용 중
        </div>
      </div>

      {/* 우측 로그인 영역 */}
      <div className="w-full lg:w-1/2 flex flex-col min-h-screen bg-white dark:bg-slate-950">
        {/* 모바일: B BioInsight Lab 브랜드 마크 - 상단 중앙 정렬, 선명하게 */}
        <div className="lg:hidden flex justify-center pt-8 pb-4">
          <div className="flex items-center gap-3 font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xl shrink-0 shadow-lg">
              B
            </div>
            <span className="tracking-tighter">BioInsight Lab</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center lg:text-left">
              <Link
                href="/"
                className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 mb-8 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                홈으로 돌아가기
              </Link>
            </div>

            {/* 로고 상단 중앙 */}
            <div className="flex justify-center">
              <Link href="/" className="inline-block">
                <BioInsightLogo showText={true} />
              </Link>
            </div>

            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  로그인
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                  BioInsight Lab에 오신 것을 환영합니다.
                </p>
              </div>

              {/* Google 로그인 버튼 */}
              <Button
                variant="outline"
                className="w-full h-12 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-600 font-medium"
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

              {/* 또는 이메일로 계속하기 구분선 */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white dark:bg-slate-950 px-3 text-xs text-slate-500 dark:text-slate-400">
                    또는 이메일로 계속하기
                  </span>
                </div>
              </div>

              {/* 이메일/비밀번호 필드 (Disabled) - 16px로 iOS 자동 확대 방지 */}
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="이메일"
                  disabled
                  className="bg-slate-50 dark:bg-slate-900/50 cursor-not-allowed text-base"
                  style={{ fontSize: "16px" }}
                />
                <Input
                  type="password"
                  placeholder="비밀번호"
                  disabled
                  className="bg-slate-50 dark:bg-slate-900/50 cursor-not-allowed text-base"
                  style={{ fontSize: "16px" }}
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                  이메일 로그인은 곧 제공될 예정입니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 푸터 */}
        <div className="p-6 sm:p-8 pt-0 space-y-4">
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            계정이 없으신가요?{" "}
            <Link
              href="/test/search"
              className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2"
            >
              무료로 시작하기
            </Link>
          </p>
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
            BioInsight Lab은 데이터 무결성과 CFR 21 Part 11 가이드를 준수합니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
