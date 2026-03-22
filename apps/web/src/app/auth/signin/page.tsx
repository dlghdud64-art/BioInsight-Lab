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
      {/* 좌측 브랜딩 영역 (데스크톱 전용) */}
      <div className="hidden lg:flex w-[55%] relative min-h-screen flex-col overflow-hidden" style={{ backgroundColor: '#2d2f33' }}>
        {/* 상단: 회사명 텍스트 */}
        <div className="pt-12 pl-12">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-bold tracking-tight text-slate-100">LabAxis</span>
          </Link>
        </div>

        {/* 중앙: 운영형 카피 */}
        <div className="flex-1 flex flex-col justify-center pl-12 pr-12 space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold leading-snug text-slate-100 tracking-tight">
              연구실의 검색-견적-구매-재고<br />
              업무를 한곳에서.
            </h1>
            <p className="text-slate-300 text-[15px] max-w-md leading-relaxed">
              반복 검색, 수기 견적, 재고 공백을 운영 시스템으로 전환합니다.
            </p>
          </div>

          {/* 파이프라인 6단계 */}
          <div className="flex items-center gap-2 flex-wrap">
            {pipelineSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-pn border border-bd rounded-md px-3 py-1.5">
                  <step.icon className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-slate-300 font-medium">{step.label}</span>
                </div>
                {i < pipelineSteps.length - 1 && (
                  <span className="text-slate-500 text-xs select-none">→</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 하단 신뢰 정보 */}
        <div className="pb-10 pl-12 pr-12 space-y-3">
          {trustItems.map((item) => (
            <div key={item.text} className="flex items-center gap-2.5">
              <item.icon className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-sm text-slate-400">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 우측 auth 영역 */}
      <div className="w-full lg:w-[45%] flex flex-col min-h-screen bg-sh">
        {/* 모바일: 상단 회사명 텍스트 */}
        <div className="lg:hidden flex justify-center pt-8 pb-4">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-100">
            LabAxis
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-sm">
            {/* Elevated auth panel */}
            <div className="border rounded-xl p-8 space-y-6" style={{ backgroundColor: '#3a3c40', borderColor: '#505258' }}>
              {/* 홈으로 돌아가기 */}
              <Link
                href="/"
                className="inline-flex items-center text-xs text-slate-400 hover:text-slate-100 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                홈으로 돌아가기
              </Link>

              {/* 타이틀 */}
              <div>
                <h2 className="text-xl font-bold text-slate-100">로그인</h2>
                <p className="text-slate-400 mt-1.5 text-sm leading-relaxed">
                  연구실의 검색-견적-구매-재고 업무를 한곳에서 처리하세요.
                </p>
              </div>

              {/* Google 로그인 = primary */}
              <Button
                variant="outline"
                className="w-full h-12 bg-pn border-bd hover:bg-el font-medium text-slate-100"
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

              {/* divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-bd" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-pn px-3 text-xs text-slate-500">
                    또는 이메일로 계속하기
                  </span>
                </div>
              </div>

              {/* 이메일/비밀번호 필드 (Disabled) */}
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="이메일"
                  disabled
                  className="bg-el border-bd text-base text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 opacity-60 cursor-not-allowed"
                  style={{ fontSize: "16px" }}
                />
                <Input
                  type="password"
                  placeholder="비밀번호"
                  disabled
                  className="bg-el border-bd text-base text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 opacity-60 cursor-not-allowed"
                  style={{ fontSize: "16px" }}
                />
                <p className="text-xs text-slate-500 text-center">
                  이메일 로그인은 곧 제공될 예정입니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 푸터 */}
        <div className="p-6 sm:p-8 pt-0 space-y-3">
          <p className="text-center text-sm text-slate-400">
            계정이 없으신가요?{" "}
            <Link
              href="/test/search"
              className="font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
              무료로 시작하기
            </Link>
          </p>
          <p className="text-center text-xs text-slate-500 leading-relaxed">
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
      <div className="flex min-h-screen items-center justify-center bg-pg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
