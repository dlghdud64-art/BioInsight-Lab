"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ShieldCheck, Users, Zap } from "lucide-react";

const PIPELINE = ["Search", "Compare", "Request", "Order", "Receive", "Inventory"];

const trustItems = [
  { icon: ShieldCheck, text: "256-bit 엔터프라이즈급 데이터 암호화" },
  { icon: Users, text: "조직 단위 역할 기반 접근 제어" },
  { icon: Zap, text: "구매-재고 운영 실시간 연결" },
];

/* ── 3D Pipeline Background — autoplay loop, restrained motion ── */
function SplineBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(prefersReducedMotion);

    let app: any = null;
    // Delayed mount — auth card renders first, then 3D fades in
    const timer = setTimeout(async () => {
      try {
        const { Application } = await import("@splinetool/runtime");
        app = new Application(canvasRef.current!);
        await app.load("https://prod.spline.design/Nd9Ab5oDbi1kcWsV/scene.splinecode?v=2");

        // Ensure scene animations autoplay + loop
        if (typeof app.play === "function") {
          app.play();
        }

        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      app?.dispose?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{
        pointerEvents: "none",
        opacity: loaded ? 0.88 : 0,
        filter: reducedMotion
          ? "brightness(1.08) contrast(1.04) saturate(1.0)"
          : "brightness(1.14) contrast(1.06) saturate(1.06)",
        transition: "opacity 2.4s ease",
      }}
    />
  );
}

function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();

  // plan intent 를 callbackUrl 에 보존.
  // pricing 카드에서 ?plan=team 만 들고 들어오는 legacy 경로도 지원.
  const rawCallback = searchParams?.get("callbackUrl");
  const planParam = searchParams?.get("plan");
  const callbackUrl = rawCallback
    ? rawCallback
    : planParam
      ? `/pricing/continue?plan=${encodeURIComponent(planParam)}`
      : "/";

  // 이미 로그인된 사용자는 로그인 화면을 보지 않고 callbackUrl 로 이동.
  // 특히 /pricing → /auth/signin?plan=... 로 잘못 라우팅된 경우에도
  // 여기서 /pricing/continue 로 되돌려 올바른 목적지로 reroute 된다.
  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [status, callbackUrl, router]);

  if (status === "authenticated") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center" style={{ backgroundColor: "#F5F7FB" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh]">

      {/* ══════ LEFT: Operation Flow Context + 3D Pipeline ══════ */}
      <div
        className="hidden lg:flex relative overflow-hidden flex-col"
        style={{
          width: "64%",
          background: "linear-gradient(165deg, #0E2A52 0%, #091D3A 50%, #061224 100%)",
        }}
      >
        {/* Grid texture — structural fallback when Spline loading */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundSize: "40px 40px",
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
            maskImage: "radial-gradient(ellipse at 70% 60%, black 20%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse at 70% 60%, black 20%, transparent 80%)",
          }}
        />

        {/* 3D Scene — pushed right, copy zone protected via gradient mask */}
        <div
          className="absolute inset-0 z-0 origin-center"
          style={{
            transform: "translateX(14%) translateY(2%) scale(0.90)",
            maskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.10) 16%, black 38%, black 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.10) 16%, black 38%, black 100%)",
          }}
        >
          <SplineBg />
        </div>

        {/* Subtle breathing overlay — gives 3D a living-pipeline feel via CSS */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 65% 50%, rgba(59,130,246,0.06) 0%, transparent 60%)",
            animation: "signin-pulse 10s ease-in-out infinite",
          }}
        />

        {/* Navy overlay — graded, not flat */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background: [
              "linear-gradient(180deg, rgba(7,22,45,0.04) 0%, rgba(5,12,24,0.10) 100%)",
              "radial-gradient(circle at 25% 20%, rgba(30,90,180,0.10) 0%, transparent 45%)",
            ].join(", "),
          }}
        />

        {/* Foreground copy — z above scene+overlay */}
        <div
          className="relative z-[2] flex-1 flex flex-col"
          style={{ paddingTop: 40, paddingLeft: 48, paddingRight: 40, paddingBottom: 40 }}
        >
          {/* Brand wordmark — sole brand role */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-100">LabAxis</span>
            </Link>
          </div>

          {/* Headline + body — operation flow context */}
          <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: 400 }}>
            <div className="space-y-4" style={{ marginBottom: 24 }}>
              <p className="text-[10px] font-semibold tracking-[0.2em] text-blue-400/80 uppercase">
                Research Procurement Operating System
              </p>
              <h1 className="text-[30px] font-extrabold leading-[1.35] text-white tracking-tight">
                반복되는 구매 업무,<br />
                하나의 운영 흐름으로<br />
                정리하세요
              </h1>
              <p className="text-[14px] text-[#a0b4cc] leading-[1.75] max-w-[400px]">
                시약 검색, 비교, 요청, 발주, 입고, 재고 관리까지 —
                분절된 도구를 오가는 대신 하나의 흐름 안에서 운영합니다.
              </p>
            </div>

            {/* Micro-flow — 3D pipeline stages, exact 1:1 alignment */}
            <div className="flex items-center gap-2 flex-wrap">
              {PIPELINE.map((step, i) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-white/55">{step}</span>
                  {i < PIPELINE.length - 1 && (
                    <span className="text-blue-400/40 text-[9px]">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Trust reassurance */}
          <div className="space-y-3">
            {trustItems.map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <item.icon className="w-4 h-4 text-[#4a6a90] shrink-0" />
                <span className="text-[12px] text-[#6e89a8]">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CSS keyframes for breathing overlay */}
        <style jsx>{`
          @keyframes signin-pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.8; }
          }
          @media (prefers-reduced-motion: reduce) {
            .signin-pulse-overlay { animation: none !important; opacity: 0.5 !important; }
          }
        `}</style>
      </div>

      {/* ══════ RIGHT: Clean Light Auth Surface ══════ */}
      <div className="w-full lg:flex-1 relative flex flex-col min-h-[100dvh]" style={{ backgroundColor: "#F3F5F9" }}>

        {/* Mobile: dark brand header */}
        <div className="lg:hidden flex justify-center pt-8 pb-4" style={{ backgroundColor: "#07162D" }}>
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-100">LabAxis</Link>
        </div>

        {/* Auth Stack — centered, slightly above middle */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-12 lg:px-16">
          <div className="w-full max-w-[376px] -translate-y-4">

            {/* Back link */}
            <Link href="/" className="inline-flex items-center text-xs text-slate-500 hover:text-slate-700 transition-colors mb-5">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />홈으로 돌아가기
            </Link>

            {/* Auth Card */}
            <div className="bg-white rounded-[24px] border border-slate-200/70 p-8 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">

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

            {/* Signup Block */}
            <div className="mt-6 text-center space-y-1.5">
              <p className="text-sm text-slate-500">
                계정이 없으신가요?{" "}
                <Link href="/search" className="font-semibold text-blue-600 hover:text-blue-500 underline underline-offset-2">무료로 시작하기</Link>
              </p>
              <p className="text-[11px] text-slate-400">데이터 무결성과 ISMS 가이드를 준수합니다.</p>
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
      <div className="flex min-h-[100dvh] items-center justify-center" style={{ backgroundColor: "#F5F7FB" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
