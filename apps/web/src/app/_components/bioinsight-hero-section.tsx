"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Search, GitCompare, FileText, ShoppingCart, PackageCheck,
  Warehouse, ChevronRight,
} from "lucide-react";

const PIPELINE_STEPS = [
  { icon: Search, label: "검색", sub: "시약·장비 단일 검색" },
  { icon: GitCompare, label: "비교", sub: "벤더별 스펙 가격 비교" },
  { icon: FileText, label: "견적", sub: "견적 요청 및 자동 문서" },
  { icon: ShoppingCart, label: "발주", sub: "승인 라인 및 연동" },
  { icon: PackageCheck, label: "입고/재고", sub: "재고 연동 추적" },
];

/** Plexus Network — white-accent sharp nodes */
function PlexusCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    let particles: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    let mouse = { x: -9999, y: -9999 };

    const init = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const count = Math.floor((canvas.width * canvas.height) / 18000);
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() * 1.5 + 0.8,
        });
      }
    };
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // White lines
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x, dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(255,255,255,${0.3 - (dist / 150) * 0.3})`;
            ctx.lineWidth = 0.8; ctx.stroke();
          }
        }
        // Mouse lines — bright white
        const dxm = p.x - mouse.x, dym = p.y - mouse.y;
        const distm = Math.sqrt(dxm * dxm + dym * dym);
        if (distm < 180) {
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(255,255,255,${0.4 - (distm / 180) * 0.4})`;
          ctx.lineWidth = 1.0; ctx.stroke();
        }
      }
      // White nodes
      for (const p of particles) {
        const dxm = p.x - mouse.x, dym = p.y - mouse.y;
        const distm = Math.sqrt(dxm * dxm + dym * dym);
        if (distm < 100 && mouse.x !== -9999) { p.x += dxm * 0.01; p.y += dym * 0.01; }
        else { p.x += p.vx; p.y += p.vy; }
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,1)"; ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    init(); draw();
    const onResize = () => init();
    const onMove = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    window.addEventListener("resize", onResize);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    return () => { window.removeEventListener("resize", onResize); canvas.removeEventListener("mousemove", onMove); canvas.removeEventListener("mouseleave", onLeave); cancelAnimationFrame(animId); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

export function BioInsightHeroSection() {
  return (
    <section className="relative w-full min-h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#24252a" }}>

      {/* Background layers */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Blue glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vh] bg-blue-500/10 rounded-full blur-[100px] z-10" />
        {/* Radial mask */}
        <div className="absolute inset-0 z-10" style={{ background: "radial-gradient(circle at center, transparent 10%, #24252a 90%)" }} />
        {/* Network — 50% opacity for white-accent visibility */}
        <div className="absolute inset-0 z-0 pointer-events-auto opacity-50">
          <PlexusCanvas />
        </div>
      </div>

      {/* Nav */}
      <nav className="relative z-20 flex justify-between items-center px-6 lg:px-12 py-5 max-w-[1400px] mx-auto w-full border-b border-zinc-700/50">
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <span className="font-bold text-xl tracking-tight text-white">LabAxis</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/pricing" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors hidden md:block">요금 & 도입</Link>
          <Link href="/auth/signin" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors hidden md:block">로그인</Link>
          <Link href="/test/search">
            <Button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-md shadow-md shadow-blue-500/20">무료로 시작하기</Button>
          </Link>
        </div>
      </nav>

      {/* Hero content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 md:py-20 relative z-20">

        <p className="text-blue-400 font-bold text-[11px] tracking-[0.2em] mb-6 uppercase">
          Biotech Procurement Operations Platform
        </p>

        <h1 className="text-4xl md:text-5xl lg:text-[54px] font-extrabold tracking-tight leading-[1.3] text-white mb-6 text-center max-w-[680px]" style={{ filter: "drop-shadow(0 0 30px rgba(255,255,255,0.15))" }}>
          구매 요청부터 입고·재고까지,<br />
          연구 구매 운영을<br />
          <span className="text-blue-500" style={{ filter: "drop-shadow(0 0 20px rgba(59,130,246,0.3))" }}>한곳에서</span> 연결합니다
        </h1>

        <p className="text-base md:text-lg text-zinc-300 mb-10 font-medium leading-relaxed max-w-2xl text-center">
          시약·장비 검색, 비교, 견적, 발주, 입고, 재고 관리까지<br className="hidden sm:block" />
          흩어진 연구 구매 업무를 하나의 운영 흐름으로 연결하세요.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/test/search">
            <Button className="h-12 px-8 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[15px] rounded-lg border border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              시약·장비 검색 시작하기
              <Search className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/support">
            <Button variant="outline" className="h-12 px-8 bg-[#2d2e34] hover:bg-[#383a41] text-zinc-100 border-zinc-500/50 font-semibold text-[15px] rounded-lg shadow-lg">
              도입 문의하기
            </Button>
          </Link>
        </div>

        {/* Pipeline — white-accent icons */}
        <div className="mt-24 w-full max-w-4xl mx-auto border-t border-zinc-700/50 pt-12">
          <p className="text-zinc-400 font-bold text-[10px] tracking-widest uppercase mb-8 text-center">End-to-End Operations Pipeline</p>
          {/* Desktop */}
          <div className="hidden md:flex items-center justify-center gap-0">
            {PIPELINE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-md hover:bg-white/5 transition-colors cursor-pointer">
                    <div className="w-14 h-14 rounded-xl bg-[#2d2e34] border border-zinc-600/50 flex items-center justify-center shadow-xl hover:border-zinc-400 transition-colors">
                      <Icon className="h-6 w-6 text-white drop-shadow-md" strokeWidth={1.8} />
                    </div>
                    <span className="text-sm font-bold text-white drop-shadow-sm">{step.label}</span>
                    <span className="text-[10px] text-zinc-400 whitespace-nowrap">{step.sub}</span>
                  </div>
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <ChevronRight className="h-5 w-5 text-zinc-600 flex-shrink-0 mx-0.5" />
                  )}
                </div>
              );
            })}
          </div>
          {/* Mobile */}
          <div className="md:hidden grid grid-cols-3 gap-2 px-2">
            {PIPELINE_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex flex-col items-center gap-1 py-2.5 rounded-md bg-[#2d2e34] border border-zinc-600/50">
                  <Icon className="h-4 w-4 text-white" strokeWidth={1.8} />
                  <span className="text-[11px] font-semibold text-zinc-200">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
