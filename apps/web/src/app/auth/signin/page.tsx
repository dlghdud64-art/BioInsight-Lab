"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ShieldCheck, Users, Zap } from "lucide-react";

const PIPELINE = ["Search", "Compare", "Request", "Order", "Receive", "Stock"];

const trustItems = [
  { icon: ShieldCheck, text: "256-bit 엔터프라이즈급 데이터 암호화" },
  { icon: Users, text: "조직 단위 역할 기반 접근 제어" },
  { icon: Zap, text: "구매-재고 운영 실시간 연결" },
];

/* ── Restrained 3D Background — delayed, dimmed, non-interactive ── */
function SplineBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    // Check reduced-motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) { setLoaded(true); return; }

    let app: any = null;
    // Delayed mount — auth card renders first
    const timer = setTimeout(async () => {
      try {
        const { Application } = await import("@splinetool/runtime");
        app = new Application(canvasRef.current!);
        await app.load("https://prod.spline.design/Nd9Ab5oDbi1kcWsV/scene.splinecode");
        setLoaded(true);
      } catch { setLoaded(true); }
    }, 1000);
    return () => { clearTimeout(timer); app?.dispose?.(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute w-[92%] h-[88%] right-[-8%] bottom-[-6%] transition-opacity duration-[2500ms] ${loaded ? "opacity-[0.22]" : "opacity-0"}`}
      style={{ pointerEvents: "none" }}
    />
  );
}

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "/dashboard";

  return (
    <div className="flex min-h-[100dvh]">

      {/* ══════ LEFT 48%: Deep Navy Branded Intro + 3D ══════ */}
      <div
        className="hidden lg:flex relative overflow-hidden flex-col"
        style={{
          width: "48%",
          background: "linear-gradient(165deg, #0A2142 0%, #07162D 50%, #050C18 100%)",
        }}
      >
        {/* Grid texture — fallback when Spline not loaded */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundSize: "40px 40px",
            backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)",
            maskImage: "radial-gradient(ellipse at 70% 60%, black 20%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse at 70% 60%, black 20%, transparent 80%)",
          }}
        />

        {/* 3D Scene — offset to lower-right, behind copy */}
        <div className="absolute inset-0 z-0">
          <SplineBg />
        </div>

        {/* Navy overlay — graded, not flat black */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background: [
              "linear-gradient(180deg, rgba(4,12,24,0.20) 0%, rgba(4,12,24,0.38) 100%)",
              "radial-gradient(circle at 22% 18%, rgba(16,50,98,0.22) 0%, rgba(16,50,98,0.00) 38%)",
            ].join(", "),
          }}
        />

        {/* Foreground copy — z above scene+overlay */}
        <div className="relative z-[2] flex-1 flex flex-col" style={{ paddingTop: 40, paddingLeft: 48, paddingRight: 40, paddingBottom: 40 }}>

          {/* Brand mark */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="text-[22px] font-bold tracking-tight text-white">LabAxis</span>
              <span className="text-[10px] font-semibold tracking-[0.2em] text-blue-400/50 uppercase mt-0.5">OS</span>
            </Link>
          </div>

          {/* Headline block — max-width 420px */}
          <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: 420 }}>
            <div className="space-y-4" style={{ marginBottom: 22 }}>
              <p className="text-[10px] font-semibold tracking-[0.2em] text-blue-400/60 uppercase">
                Research Procurement Operating System
              </p>
              <h1 className="text-[30px] font-extrabold leading-[1.35] text-white tracking-tight">
                연구 구매 운영을<br />
                하나의 흐름으로<br />
                연결합니다
              </h1>
              <p className="text-[14px] text-[#7b8da8] leading-[1.75] max-w-[380px]">
                시약 검색, 비교, 요청, 발주, 입고, 재고 관리를 분절된 도구가 아닌 하나의 운영 흐름으로 정리합니다.
              </p>
            </div>

            {/* Workflow caption — subtle signal line */}
            <div className="flex items-center gap-2 flex-wrap">
              {PIPELINE.map((step, i) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-white/30">{step}</span>
                  {i < PIPELINE.length - 1 && <span className="text-white/12 text-[9px]">→</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Trust reassurance */}
          <div className="space-y-3">
            {trustItems.map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <item.icon className="w-4 h-4 text-[#2e4264] shrink-0" />
                <span className="text-[12px] text-[#4d6380]">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════ RIGHT 52%: Clean Light Auth Surface ══════ */}
      <div className="w-full lg:flex-1 flex flex-col min-h-[100dvh]" style={{ backgroundColor: "#F5F7FB" }}>

        {/* Mobile: dark brand header */}
        <div className="lg:hidden flex justify-center pt-8 pb-4" style={{ backgroundColor: "#07162D" }}>
          <Link href="/" className="text-xl font-bold tracking-tight text-white">LabAxis</Link>
        </div>

        {/* Auth card — pulled left, slightly above center */}
        <div className="flex-1 flex items-start justify-start p-6 sm:p-10" style={{ paddingTop: "clamp(72px, 12vh, 128px)", paddingLeft: "clamp(32px, 5vw, 72px)" }}>
          <div className="w-full" style={{ maxWidth: 420 }}>

            <div className="bg-white rounded-[20px] border shadow-[0_6px_24px_rgba(0,0,0,0.06)]" style={{ borderColor: "rgba(12,24,44,0.08)", padding: 32 }}>
              {/* Back */}
              <Link href="/" className="inline-flex items-center text-xs text-slate-500 hover:text-slate-700 transition-colors mb-7">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />홈으로 돌아가기
              </Link>

              {/* Title */}
              <div className="space-y-2 mb-7">
                <h2 className="text-[21px] font-bold text-slate-800">로그인</h2>
                <p className="text-slate-500 text-[14px] leading-relaxed">
                  연구실의 구매 운영을 한곳에서 처리하세요.
                </p>
              </div>

              {/* Google — first action */}
              <Button
                className="w-full font-semibold text-[15px] rounded-xl transition-all bg-slate-900 text-white hover:bg-slate-800 hover:shadow-lg mb-6"
                style={{ height: 50 }}
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

              {/* Divider */}
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center">
                  <span className="px-4 text-[11px] text-slate-400 bg-white">또는 이메일로 계속하기</span>
                </div>
              </div>

              {/* Email/PW (disabled) */}
              <div className="space-y-3">
                <Input type="email" placeholder="이메일" disabled
                  className="border-slate-200 bg-slate-50 text-slate-500 placeholder:text-slate-400 cursor-not-allowed rounded-lg h-11"
                  style={{ fontSize: 16 }} />
                <Input type="password" placeholder="비밀번호" disabled
                  className="border-slate-200 bg-slate-50 text-slate-500 placeholder:text-slate-400 cursor-not-allowed rounded-lg h-11"
                  style={{ fontSize: 16 }} />
                <p className="text-[11px] text-slate-400 text-center pt-1">
                  이메일 로그인은 곧 제공될 예정입니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 sm:p-8 pt-0 space-y-2">
          <p className="text-center text-sm text-slate-500">
            계정이 없으신가요?{" "}
            <Link href="/test/search" className="font-semibold text-blue-600 hover:text-blue-500 underline underline-offset-2">무료로 시작하기</Link>
          </p>
          <p className="text-center text-[11px] text-slate-400">데이터 무결성과 ISMS 가이드를 준수합니다.</p>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[100dvh] items-center justify-center" style={{ backgroundColor: "#F5F7FB" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
