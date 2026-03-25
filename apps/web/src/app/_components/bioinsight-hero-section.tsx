"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Search, GitCompare, FileText, ShoppingCart, PackageCheck,
  Warehouse, ChevronRight, Menu, X, LayoutDashboard, User, LogOut, Settings,
} from "lucide-react";

function AccountMenu({ userName }: { userName?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
        <User className="h-4 w-4" />
        <span className="hidden xl:inline max-w-[80px] truncate">{userName || "계정"}</span>
        <ChevronRight className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 z-50 rounded-lg border border-white/10 shadow-xl py-1" style={{ backgroundColor: "#1a1e26" }}>
            <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"><LayoutDashboard className="h-3.5 w-3.5 text-slate-400" />대시보드</Link>
            <Link href="/app/search" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"><Search className="h-3.5 w-3.5 text-slate-400" />검색</Link>
            <Link href="/dashboard/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"><Settings className="h-3.5 w-3.5 text-slate-400" />계정 설정</Link>
            <div className="border-t border-white/10 my-1" />
            <button onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }); }} className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-950/30 w-full text-left"><LogOut className="h-3.5 w-3.5" />로그아웃</button>
          </div>
        </>
      )}
    </div>
  );
}

function MobileMenu() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="p-2 text-slate-300 hover:text-white" aria-label="메뉴">
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-[#06142E]/95 backdrop-blur-md flex flex-col">
          <div className="flex justify-between items-center px-6 py-5">
            <span className="font-bold text-xl text-white">LabAxis</span>
            <button onClick={() => setOpen(false)} className="p-2 text-slate-300 hover:text-white" aria-label="닫기">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 flex flex-col items-center justify-center gap-6">
            <Link href="/intro" onClick={() => setOpen(false)} className="text-lg font-medium text-slate-200 hover:text-white">서비스 소개</Link>
            <Link href="/pricing" onClick={() => setOpen(false)} className="text-lg font-medium text-slate-200 hover:text-white">요금 & 도입</Link>
            {isLoggedIn ? (
              <>
                <Link href="/dashboard" onClick={() => setOpen(false)} className="text-lg font-medium text-slate-200 hover:text-white">대시보드</Link>
                <Link href="/app/search" onClick={() => setOpen(false)} className="text-lg font-medium text-slate-200 hover:text-white">검색</Link>
                <Link href="/dashboard/settings" onClick={() => setOpen(false)} className="text-lg font-medium text-slate-200 hover:text-white">계정 설정</Link>
                <button onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }); }} className="text-lg font-medium text-red-400 hover:text-red-300 mt-4">로그아웃</button>
              </>
            ) : (
              <>
                <Link href="/auth/signin" onClick={() => setOpen(false)} className="text-lg font-medium text-slate-200 hover:text-white">로그인</Link>
                <Link href="/search" onClick={() => setOpen(false)}>
                  <Button className="mt-4 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg">무료로 시작하기</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </>
  );
}

const PIPELINE_STEPS = [
  { icon: Search, label: "검색", sub: "시약·장비 단일 검색" },
  { icon: GitCompare, label: "비교", sub: "벤더별 스펙 가격 비교" },
  { icon: FileText, label: "견적", sub: "견적 요청 초안 준비" },
  { icon: ShoppingCart, label: "발주", sub: "승인 라인 및 연동" },
  { icon: PackageCheck, label: "입고/재고", sub: "재고 연동 추적" },
];

function PlexusCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    let animId: number;
    let particles: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    let mouse = { x: -9999, y: -9999 };

    const init = () => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      const count = Math.floor((canvas.width * canvas.height) / 15000);
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          r: Math.random() * 2.0 + 1.0,
        });
      }
    };
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const rect = canvas.getBoundingClientRect();
      const adjMouseY = mouse.y !== -9999 ? mouse.y - rect.top : -9999;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x, dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 160) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(255,255,255,${0.5 - (dist / 160) * 0.5})`;
            ctx.lineWidth = 1.2; ctx.stroke();
          }
        }
        if (adjMouseY !== -9999) {
          const dxm = p.x - mouse.x, dym = p.y - adjMouseY;
          const distm = Math.sqrt(dxm * dxm + dym * dym);
          if (distm < 200) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, adjMouseY);
            ctx.strokeStyle = `rgba(96,165,250,${0.6 - (distm / 200) * 0.6})`;
            ctx.lineWidth = 1.5; ctx.stroke();
          }
        }
      }
      for (const p of particles) {
        if (adjMouseY !== -9999) {
          const dxm = p.x - mouse.x, dym = p.y - adjMouseY;
          const distm = Math.sqrt(dxm * dxm + dym * dym);
          if (distm < 120) { p.x += dxm * 0.015; p.y += dym * 0.015; }
          else { p.x += p.vx; p.y += p.vy; }
        } else { p.x += p.vx; p.y += p.vy; }
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,1)"; ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    init(); draw();
    const onResize = () => init();
    const onMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseleave", onLeave); cancelAnimationFrame(animId); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

export function BioInsightHeroSection() {
  const { data: session, status } = useSession();
  const isLoggedIn = !!session?.user;
  const isAuthLoading = status === "loading";

  return (
    <section className="relative w-full min-h-[90vh] flex flex-col overflow-hidden border-b border-[#1A2840]" style={{ background: "linear-gradient(180deg, #06142E 0%, #0A214A 50%, #081936 100%)" }}>

      {/* Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vh] bg-blue-500/10 rounded-full blur-[100px] z-10" />
        <div className="absolute inset-0 z-10" style={{ background: "radial-gradient(circle at 50% 34%, rgba(78,138,255,0.22) 0%, rgba(78,138,255,0.12) 24%, rgba(78,138,255,0.00) 56%), radial-gradient(circle at 50% 42%, rgba(37,99,235,0.14) 0%, rgba(37,99,235,0.00) 62%), radial-gradient(circle at center, transparent 0%, #081936 92%)" }} />
        <div className="absolute inset-0 z-0 pointer-events-auto opacity-40">
          <PlexusCanvas />
        </div>
      </div>

      {/* Nav */}
      <nav className="relative z-20 flex justify-between items-center px-6 lg:px-12 py-5 max-w-[1400px] mx-auto w-full border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <span className="font-bold text-xl tracking-tight text-white">LabAxis</span>
        </Link>

        {/* Desktop nav links — session-aware, loading-safe */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/intro" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">서비스 소개</Link>
          <Link href="/pricing" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">요금 & 도입</Link>
          {isAuthLoading ? (
            <div className="w-24 h-8 rounded-md bg-white/5 animate-pulse" />
          ) : isLoggedIn ? (
            <>
              <Link href="/app/search" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">검색</Link>
              <Link href="/dashboard">
                <Button className="text-sm font-semibold px-5 py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5">
                  <LayoutDashboard className="h-3.5 w-3.5" />대시보드
                </Button>
              </Link>
              <AccountMenu userName={session?.user?.name} />
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">로그인</Link>
              <Link href="/search">
                <Button variant="outline" className="text-[#EAF2FF] hover:text-white text-sm font-medium px-5 py-2.5 rounded-md" style={{ backgroundColor: "rgba(91,132,230,0.14)", borderColor: "rgba(121,165,255,0.24)" }}>무료로 시작하기</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile: hamburger + CTA */}
        <div className="flex md:hidden items-center gap-3">
          {isAuthLoading ? (
            <div className="w-16 h-7 rounded-md bg-white/5 animate-pulse" />
          ) : isLoggedIn ? (
            <Link href="/dashboard">
              <Button size="sm" className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md flex items-center gap-1">
                <LayoutDashboard className="h-3 w-3" />대시보드
              </Button>
            </Link>
          ) : (
            <Link href="/search">
              <Button size="sm" className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md">시작하기</Button>
            </Link>
          )}
          <MobileMenu />
        </div>
      </nav>

      {/* Hero */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto px-6 pt-16 pb-20 text-center w-full">
        <p className="text-blue-400 font-extrabold text-[11px] tracking-[0.25em] mb-6 uppercase">Biotech Procurement Operations Platform</p>
        <h1 className="text-4xl md:text-5xl lg:text-[54px] font-extrabold tracking-tight leading-[1.3] text-white mb-6" style={{ filter: "drop-shadow(0 0 40px rgba(255,255,255,0.2))" }}>
          구매 요청부터 입고·재고까지,<br />
          <span className="text-blue-500" style={{ filter: "drop-shadow(0 0 25px rgba(59,130,246,0.4))" }}>운영 상태를 한눈에</span>
        </h1>
        <p className="text-base md:text-lg text-slate-300 mb-10 font-medium leading-relaxed max-w-2xl" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}>
          시약·장비 검색, 비교, 견적, 발주, 입고, 재고 관리까지<br className="hidden sm:block" />흩어진 연구 구매 업무를 하나의 운영 흐름으로 연결하세요.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href={isLoggedIn ? "/app/search" : "/search"}>
            <Button className="h-12 px-8 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[15px] rounded-lg border border-blue-400 shadow-[0_0_25px_rgba(59,130,246,0.4)]">
              {isLoggedIn ? "소싱 워크벤치 열기" : "무료로 시작하기"}<Search className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          {isLoggedIn ? (
            <Link href="/dashboard">
              <Button variant="outline" className="h-12 px-8 bg-[#0E1B30] hover:bg-[#152436] text-white border-[#22344D] hover:border-[#2D496A] font-bold text-[15px] rounded-lg shadow-lg">대시보드</Button>
            </Link>
          ) : (
            <Link href="/support">
              <Button variant="outline" className="h-12 px-8 bg-[#0E1B30] hover:bg-[#152436] text-white border-[#22344D] hover:border-[#2D496A] font-bold text-[15px] rounded-lg shadow-lg">도입 문의하기</Button>
            </Link>
          )}
        </div>

        {/* Pipeline */}
        <div className="mt-16 w-full max-w-4xl mx-auto border-t border-slate-700/80 pt-10">
          <p className="text-slate-400 font-bold text-[11px] tracking-widest uppercase mb-6">End-to-End Operations Pipeline</p>
          <div className="hidden md:flex items-center justify-center gap-0">
            {PIPELINE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-md hover:bg-white/5 transition-colors cursor-pointer">
                    <div className="w-14 h-14 rounded-xl bg-[#0E1B30] border border-[#1E3455] flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:border-slate-300 transition-colors">
                      <Icon className="h-6 w-6 text-white drop-shadow-lg" strokeWidth={1.8} />
                    </div>
                    <span className="text-sm font-bold text-white drop-shadow-md">{step.label}</span>
                    <span className="text-[10px] text-slate-300 font-medium whitespace-nowrap">{step.sub}</span>
                  </div>
                  {idx < PIPELINE_STEPS.length - 1 && <ChevronRight className="h-5 w-5 text-slate-500 flex-shrink-0 mx-2 md:mx-6" />}
                </div>
              );
            })}
          </div>
          <div className="md:hidden flex items-center justify-center gap-1.5 px-2 overflow-x-auto">
            {PIPELINE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center shrink-0">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#0E1B30] border border-[#1E3455]">
                    <Icon className="h-3.5 w-3.5 text-white" strokeWidth={1.8} />
                    <span className="text-[11px] font-semibold text-slate-200 whitespace-nowrap">{step.label}</span>
                  </div>
                  {idx < PIPELINE_STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-slate-600 mx-0.5 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
