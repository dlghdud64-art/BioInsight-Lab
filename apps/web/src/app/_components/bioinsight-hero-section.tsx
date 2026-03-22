"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Search, GitCompare, FileText, ShoppingCart, PackageCheck,
  Warehouse, ChevronRight,
} from "lucide-react";

const PIPELINE_STEPS = [
  { icon: Search, label: "검색", sub: "시약·장비 통합 검색" },
  { icon: GitCompare, label: "비교", sub: "벤더별 스펙·가격 비교" },
  { icon: FileText, label: "견적", sub: "견적 요청·회신 관리" },
  { icon: ShoppingCart, label: "발주", sub: "승인·발주 전환" },
  { icon: PackageCheck, label: "입고", sub: "수령 확인·검수" },
  { icon: Warehouse, label: "재고", sub: "재고·운영 추적" },
];

/** Plexus Network Canvas — sharp nodes + silver lines + mouse interaction */
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
      const count = Math.floor((canvas.width * canvas.height) / 20000);
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() * 1.2 + 0.5,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Lines
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x, dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(148,163,184,${0.2 - (dist / 150) * 0.2})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
        // Mouse lines
        const dxm = p.x - mouse.x, dym = p.y - mouse.y;
        const distm = Math.sqrt(dxm * dxm + dym * dym);
        if (distm < 180) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(59,130,246,${0.3 - (distm / 180) * 0.3})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      // Nodes
      for (const p of particles) {
        const dxm = p.x - mouse.x, dym = p.y - mouse.y;
        const distm = Math.sqrt(dxm * dxm + dym * dym);
        if (distm < 100 && mouse.x !== -9999) {
          p.x += dxm * 0.01;
          p.y += dym * 0.01;
        } else {
          p.x += p.vx;
          p.y += p.vy;
        }
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(203,213,225,0.8)";
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };

    init();
    draw();

    const onResize = () => init();
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };

    window.addEventListener("resize", onResize);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

export function BioInsightHeroSection() {
  return (
    <section className="relative w-full min-h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#24252a" }}>

      {/* Plexus background */}
      <div className="absolute inset-0 z-0 opacity-60">
        <PlexusCanvas />
      </div>
      {/* Radial mask */}
      <div className="absolute inset-0 z-[1] pointer-events-none" style={{ background: "radial-gradient(circle at center, transparent 10%, #24252a 100%)" }} />

      {/* Self-contained Nav */}
      <nav className="relative z-20 flex justify-between items-center px-6 lg:px-12 py-5 max-w-[1400px] mx-auto w-full border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <span className="font-bold text-xl tracking-tight text-white">LabAxis</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/pricing" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors hidden md:block">요금 & 도입</Link>
          <Link href="/auth/signin" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors hidden md:block">로그인</Link>
          <Link href="/test/search">
            <Button className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-md">무료로 시작하기</Button>
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-6 py-16 md:py-20 relative z-10">
        {/* Value Proposition */}
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-500 mb-6 md:mb-8">
            Biotech Procurement Operations Platform
          </p>
          <h1 className="text-[1.625rem] sm:text-4xl md:text-[3.25rem] font-extrabold tracking-tight text-white leading-[1.4] md:leading-[1.3] break-keep mb-8 md:mb-10 max-w-[680px] mx-auto" style={{ filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.5))" }}>
            구매 요청부터 입고·재고까지,
            <br />
            연구 구매 운영을
            <br className="hidden sm:block" />
            <span className="text-blue-500">한곳에서</span> 연결합니다
          </h1>
          <p className="text-sm md:text-lg text-zinc-400 max-w-[520px] mx-auto leading-[1.7] break-keep mb-10 md:mb-12 font-medium">
            시약·장비 검색, 비교, 견적, 발주, 입고, 재고 관리까지
            <br className="hidden sm:block" />
            흩어진 연구 구매 업무를 하나의 운영 흐름으로 연결하세요.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-3 mb-12 md:mb-16">
            <Link href="/test/search">
              <Button className="h-12 px-10 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm rounded-lg shadow-sm">
                시약·장비 검색 시작하기
                <Search className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/support">
              <Button variant="outline" className="h-12 px-8 border-zinc-700/50 bg-[#2a2b30] hover:bg-[#35363c] text-zinc-200 font-medium text-sm rounded-lg">
                도입 문의하기
              </Button>
            </Link>
          </div>
        </div>

        {/* 6-Step Pipeline */}
        <div className="max-w-4xl mx-auto border-t border-white/5 pt-10">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 text-center mb-6">
            End-to-End Operations Pipeline
          </p>

          {/* Desktop: horizontal */}
          <div className="hidden md:flex items-center justify-center gap-0">
            {PIPELINE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-md hover:bg-white/5 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-[#2a2b30] border border-zinc-700/50 flex items-center justify-center shadow-md">
                      <Icon className="h-5 w-5 text-blue-500" strokeWidth={1.8} />
                    </div>
                    <span className="text-sm font-bold text-zinc-200">{step.label}</span>
                    <span className="text-[10px] text-zinc-500 whitespace-nowrap">{step.sub}</span>
                  </div>
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-zinc-700 flex-shrink-0 mx-0.5" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile: 2x3 grid */}
          <div className="md:hidden grid grid-cols-3 gap-2 px-2">
            {PIPELINE_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex flex-col items-center gap-1 py-2.5 rounded-md bg-[#2a2b30] border border-zinc-700/50">
                  <Icon className="h-4 w-4 text-blue-500" strokeWidth={1.8} />
                  <span className="text-[11px] font-semibold text-zinc-300">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
