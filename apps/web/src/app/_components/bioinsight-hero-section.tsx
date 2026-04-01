"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { resetWorkbenchSessionOnLogout, invalidateWorkbenchQueryCache } from "@/lib/auth/workbench-session-reset";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Search, GitCompare, FileText, ShoppingCart, PackageCheck,
  Warehouse, ChevronRight, Menu, X, LayoutDashboard, User, LogOut, Settings,
} from "lucide-react";

function AccountMenu({ userName }: { userName?: string | null }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
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
            <button onClick={() => { setOpen(false); resetWorkbenchSessionOnLogout(); invalidateWorkbenchQueryCache(queryClient); signOut({ callbackUrl: "/" }); }} className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-950/30 w-full text-left"><LogOut className="h-3.5 w-3.5" />로그아웃</button>
          </div>
        </>
      )}
    </div>
  );
}

function MobileMenu() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
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
            <span className="text-xl font-bold tracking-tight text-slate-100">LabAxis</span>
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
                <button onClick={() => { setOpen(false); resetWorkbenchSessionOnLogout(); invalidateWorkbenchQueryCache(queryClient); signOut({ callbackUrl: "/" }); }} className="text-lg font-medium text-red-400 hover:text-red-300 mt-4">로그아웃</button>
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
    <section className="relative w-full min-h-[90vh] flex flex-col overflow-hidden" style={{ background: "#071a33" }}>

      {/* Background — 4-layer controlled depth structure */}
      <div className="absolute inset-0 z-0 pointer-events-none">

        {/* Layer B: Directional depth — 상단 8~28%만 살짝 밝고 나머지 균일 */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(180deg, #0d2a50 0%, #091e3e 18%, #071a33 32%, #071a33 100%)"
        }} />

        {/* Layer C: Signal glow — 헤드라인/CTA 뒤에만, 현재 크기의 40% + 낮은 opacity */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: "18%",
            width: "320px",
            height: "260px",
            background: "radial-gradient(ellipse at center, rgba(47,109,246,0.10) 0%, rgba(47,109,246,0.04) 50%, transparent 75%)",
            filter: "blur(35px)",
          }}
        />

        {/* Layer D: Bottom boundary — white bloom 없음, 얇은 dark separator만 */}
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />

        {/* Plexus — opacity 낮춰서 gradient와 경쟁 안 하게 */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.22 }}>
          <PlexusCanvas />
        </div>
      </div>

      {/* Nav */}
      <nav className="relative z-20 flex justify-between items-center px-6 lg:px-12 py-5 max-w-[1400px] mx-auto w-full border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <span className="text-xl font-bold tracking-tight text-slate-100">LabAxis</span>
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
      <div className="relative z-20 flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-14 sm:pb-20 text-center w-full">
        <p className="text-blue-400 font-extrabold text-[10px] md:text-[11px] tracking-[0.25em] mb-4 md:mb-6 uppercase">Biotech Procurement Operations Platform</p>
        <h1 className="text-2xl md:text-5xl lg:text-[54px] font-extrabold tracking-tight leading-[1.3] text-white mb-4 md:mb-6">
          구매 요청부터 입고·재고까지,<br />
          <span className="text-blue-400">운영 상태를 한눈에</span>
        </h1>
        <p className="text-sm md:text-lg text-slate-300 mb-3 md:mb-4 font-medium leading-relaxed max-w-2xl" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}>
          검색부터 비교, 요청, 입고, 재고까지 하나의 운영 흐름으로 연결합니다.<br className="hidden sm:block" />AI는 각 단계에서 필요한 후보 정리와 다음 작업 준비를 돕습니다.
        </p>
        <p className="text-xs md:text-sm text-slate-400 mb-8 md:mb-10 max-w-xl leading-relaxed">
          LabAxis는 검색 결과 정리, 비교 판단, 요청 초안 준비를 돕는 AI 보조 기능을 제공합니다.<br className="hidden sm:block" />
          운영자는 더 빠르게 검토하고, 필요한 다음 단계로 바로 이어갈 수 있습니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto px-2 sm:px-0">
          <Link href={isLoggedIn ? "/app/search" : "/search"} className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[14px] sm:text-[15px] rounded-lg border border-blue-500/50 shadow-[0_2px_12px_rgba(37,99,235,0.25)]">
              {isLoggedIn ? "소싱 워크벤치 열기" : "무료로 시작하기"}<Search className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          {isLoggedIn ? (
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 bg-[#0E1B30] hover:bg-[#152436] text-white border-[#22344D] hover:border-[#2D496A] font-bold text-[14px] sm:text-[15px] rounded-lg shadow-lg">대시보드</Button>
            </Link>
          ) : (
            <Link href="/support" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 bg-[#0E1B30] hover:bg-[#152436] text-white border-[#22344D] hover:border-[#2D496A] font-bold text-[14px] sm:text-[15px] rounded-lg shadow-lg">도입 문의하기</Button>
            </Link>
          )}
        </div>

        {/* Pipeline */}
        <div className="mt-10 sm:mt-16 w-full max-w-4xl mx-auto border-t border-slate-700/80 pt-6 sm:pt-10">
          <p className="text-slate-400 font-bold text-[10px] sm:text-[11px] tracking-widest uppercase mb-4 sm:mb-6">End-to-End Operations Pipeline</p>
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
