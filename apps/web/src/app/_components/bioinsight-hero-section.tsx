"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Search, GitCompare, FileText, ShoppingCart, PackageCheck,
  Warehouse, ChevronRight,
} from "lucide-react";

const PIPELINE_STEPS = [
  { icon: Search, label: "검색", sub: "AI 기반 통합 검색" },
  { icon: GitCompare, label: "비교", sub: "비교·해석 보조" },
  { icon: FileText, label: "견적", sub: "견적 요청·SLA 추적" },
  { icon: ShoppingCart, label: "발주", sub: "승인·발주 전환" },
  { icon: PackageCheck, label: "입고/재고", sub: "상태 연동 추적" },
];

/** Low-opacity technical texture — not flashy, just depth signal */
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
      const count = Math.floor((canvas.width * canvas.height) / 20000);
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 1.2 + 0.5,
        });
      }
    };
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const rect = canvas.getBoundingClientRect();
      const adjY = mouse.y !== -9999 ? mouse.y - rect.top : -9999;
      // Subtle gray lines — technical texture, not blue mood
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x, dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(148,163,184,${0.15 - (dist / 140) * 0.15})`;
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
        // Mouse interaction — subtle blue signal only near cursor
        if (adjY !== -9999) {
          const dxm = p.x - mouse.x, dym = p.y - adjY;
          const distm = Math.sqrt(dxm * dxm + dym * dym);
          if (distm < 150) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, adjY);
            ctx.strokeStyle = `rgba(59,130,246,${0.25 - (distm / 150) * 0.25})`;
            ctx.lineWidth = 0.8; ctx.stroke();
          }
        }
      }
      for (const p of particles) {
        if (adjY !== -9999) {
          const dxm = p.x - mouse.x, dym = p.y - adjY;
          const distm = Math.sqrt(dxm * dxm + dym * dym);
          if (distm < 100) { p.x += dxm * 0.01; p.y += dym * 0.01; }
          else { p.x += p.vx; p.y += p.vy; }
        } else { p.x += p.vx; p.y += p.vy; }
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(148,163,184,0.4)"; ctx.fill();
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
  return (
    <section className="relative w-full min-h-[90vh] flex flex-col overflow-hidden border-b border-bd" style={{ backgroundColor: "#303236" }}>

      {/* Background: subtle technical texture, not blue domination */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Very subtle warm glow — depth, not mood */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vh] bg-slate-400/5 rounded-full blur-[80px] z-10" />
        <div className="absolute inset-0 z-10" style={{ background: "radial-gradient(circle at center, transparent 20%, #303236 85%)" }} />
        <div className="absolute inset-0 z-0 pointer-events-auto opacity-30">
          <PlexusCanvas />
        </div>
      </div>

      {/* Nav */}
      <nav className="relative z-20 flex justify-between items-center px-6 lg:px-12 py-4 max-w-[1400px] mx-auto w-full border-b border-bd">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-bold text-lg tracking-tight text-slate-100">LabAxis</span>
        </Link>
        <div className="flex items-center gap-5">
          <Link href="/pricing" className="text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors hidden md:block">요금 & 도입</Link>
          <Link href="/auth/signin" className="text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors hidden md:block">로그인</Link>
          <Link href="/test/search">
            <Button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-md">무료로 시작하기</Button>
          </Link>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto px-6 pt-12 pb-16 text-center w-full">

        {/* Eyebrow — AI deeptech signal, not mood */}
        <p className="text-blue-400 font-semibold text-[10px] tracking-[0.2em] mb-5 uppercase">
          AI-Powered Procurement Operations Platform
        </p>

        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[52px] font-extrabold tracking-tight leading-[1.3] text-slate-100 mb-5 max-w-[680px]">
          구매 요청부터 입고·재고까지,<br />
          연구 구매 운영을<br />
          <span className="text-blue-400">한곳에서</span> 연결합니다
        </h1>

        <p className="text-sm md:text-base text-slate-400 mb-8 font-medium leading-relaxed max-w-xl">
          시약·장비 검색, 비교, 견적, 발주, 입고, 재고 관리까지<br className="hidden sm:block" />
          AI 기반 판단 보조와 함께 하나의 운영 흐름으로 연결합니다.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-16">
          <Link href="/test/search">
            <Button className="h-11 px-7 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg">
              시약·장비 검색 시작하기<Search className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/support">
            <Button variant="outline" className="h-11 px-7 bg-el hover:bg-st text-slate-300 border-bd font-medium text-sm rounded-lg">도입 문의하기</Button>
          </Link>
        </div>

        {/* Pipeline — operating structure, not flashy cards */}
        <div className="w-full max-w-3xl mx-auto border-t border-bd pt-8">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-5">End-to-End Operations Pipeline</p>
          <div className="hidden md:flex items-center justify-center gap-0">
            {PIPELINE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-md hover:bg-el transition-colors cursor-pointer">
                    <div className="w-11 h-11 rounded-lg bg-el border border-bd flex items-center justify-center">
                      <Icon className="h-5 w-5 text-slate-300" strokeWidth={1.8} />
                    </div>
                    <span className="text-xs font-semibold text-slate-200">{step.label}</span>
                    <span className="text-[9px] text-slate-500 whitespace-nowrap">{step.sub}</span>
                  </div>
                  {idx < PIPELINE_STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-slate-600 flex-shrink-0 mx-1" />}
                </div>
              );
            })}
          </div>
          <div className="md:hidden grid grid-cols-3 gap-2 px-2">
            {PIPELINE_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex flex-col items-center gap-1 py-2 rounded-md bg-el border border-bd">
                  <Icon className="h-4 w-4 text-slate-300" strokeWidth={1.8} />
                  <span className="text-[10px] font-semibold text-slate-300">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
