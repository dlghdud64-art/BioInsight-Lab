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
import { OpsConsoleMockupContent } from "./ops-console-preview-section";

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

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="p-2 text-slate-300 hover:text-white touch-manipulation" aria-label="메뉴" aria-expanded={open}>
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <>
          {/* Dim backdrop */}
          <div
            className="fixed inset-0 z-[999]"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
            onClick={close}
            aria-hidden="true"
          />

          {/* Full-screen menu sheet — independent surface */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="사이트 메뉴"
            className="fixed inset-0 z-[1000] flex flex-col"
            style={{
              backgroundColor: "#080C14",
              paddingTop: "max(env(safe-area-inset-top, 0px), 12px)",
              paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)",
            }}
          >
            {/* ── Header: Logo + Close ── */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #1A2030" }}>
              <span className="text-lg font-bold tracking-tight text-slate-100">LabAxis</span>
              <button
                type="button"
                onClick={close}
                aria-label="메뉴 닫기"
                className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors touch-manipulation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ── Navigation items — left-aligned, independent scroll ── */}
            <nav className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">
              {isLoggedIn ? (
                <div className="flex flex-col gap-1">
                  {([
                    { href: "/dashboard", icon: LayoutDashboard, label: "대시보드", primary: true },
                    { href: "/app/search", icon: Search, label: "검색", primary: false },
                    { href: "/dashboard/settings", icon: Settings, label: "계정 설정", primary: false },
                  ] as const).map(({ href, icon: Icon, label, primary }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={close}
                      className="flex items-center gap-3.5 px-3 py-3 rounded-xl transition-colors"
                      style={{ color: primary ? "#F1F5F9" : "#C8D4E5" }}
                    >
                      <Icon className="h-4.5 w-4.5 flex-shrink-0" style={{ color: primary ? "#2563EB" : "#4A5E78" }} strokeWidth={1.8} />
                      <span className="text-[16px] font-semibold">{label}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {([
                    { href: "/intro", label: "제품 소개" },
                    { href: "/pricing", label: "요금 & 도입" },
                    { href: "/support", label: "고객 지원 및 문의" },
                  ] as const).map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={close}
                      className="flex items-center px-3 py-3.5 rounded-xl transition-colors"
                      style={{ color: "#C8D4E5" }}
                    >
                      <span className="text-[16px] font-semibold">{label}</span>
                    </Link>
                  ))}
                  <div className="my-3" style={{ borderTop: "1px solid #1A2030" }} />
                  <Link
                    href="/auth/signin"
                    onClick={close}
                    className="flex items-center px-3 py-3 rounded-xl transition-colors"
                    style={{ color: "#8A99AF" }}
                  >
                    <span className="text-[15px] font-medium">로그인</span>
                  </Link>
                </div>
              )}
            </nav>

            {/* ── Footer dock: sticky CTA ── */}
            <div className="flex-shrink-0 px-5 pb-2" style={{ borderTop: "1px solid #1A2030", paddingTop: 16 }}>
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={() => { close(); resetWorkbenchSessionOnLogout(); invalidateWorkbenchQueryCache(queryClient); signOut({ callbackUrl: "/" }); }}
                  className="w-full py-3 text-left px-3 text-[15px] font-medium rounded-xl transition-colors"
                  style={{ color: "#F87171" }}
                >
                  로그아웃
                </button>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <Link href="/search" onClick={close}>
                    <button
                      type="button"
                      className="w-full h-12 rounded-xl text-[15px] font-bold text-white transition-colors"
                      style={{ backgroundColor: "#3580FF" }}
                    >
                      무료로 시작하기
                    </button>
                  </Link>
                  <Link href="/support" onClick={close}>
                    <button
                      type="button"
                      className="w-full h-11 rounded-xl text-[14px] font-medium transition-colors"
                      style={{ color: "#8A99AF", border: "1px solid #1A2030" }}
                    >
                      도입 문의하기
                    </button>
                  </Link>
                </div>
              )}

              {/* Policy links */}
              <div className="flex items-center justify-center gap-4 mt-4 pb-1">
                <Link href="/terms" onClick={close} className="text-[11px]" style={{ color: "#4A5E78" }}>이용약관</Link>
                <Link href="/privacy" onClick={close} className="text-[11px]" style={{ color: "#4A5E78" }}>개인정보처리방침</Link>
              </div>
            </div>
          </div>
        </>
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
    let particles: { x: number; y: number; vx: number; vy: number; r: number; cluster: boolean }[] = [];
    let mouse = { x: -9999, y: -9999 };

    const init = () => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      const count = Math.floor((canvas.width * canvas.height) / 12000);
      particles = [];
      const cx = canvas.width / 2, cy = canvas.height / 2;
      for (let i = 0; i < count; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        // cluster = outer 30% of each edge → stronger visibility
        const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        const maxDist = Math.sqrt(cx * cx + cy * cy);
        const isCluster = distFromCenter > maxDist * 0.45;
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: isCluster ? Math.random() * 2.2 + 1.2 : Math.random() * 1.6 + 0.8,
          cluster: isCluster,
        });
      }
    };
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const rect = canvas.getBoundingClientRect();
      const adjMouseY = mouse.y !== -9999 ? mouse.y - rect.top : -9999;
      // Lines
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x, dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const bothCluster = p.cluster && p2.cluster;
            const alpha = bothCluster
              ? 0.45 - (dist / 150) * 0.35
              : 0.22 - (dist / 150) * 0.18;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = bothCluster
              ? `rgba(120,170,230,${alpha})`
              : `rgba(100,150,210,${alpha})`;
            ctx.lineWidth = bothCluster ? 1.1 : 0.7; ctx.stroke();
          }
        }
        // Mouse interaction lines
        if (adjMouseY !== -9999) {
          const dxm = p.x - mouse.x, dym = p.y - adjMouseY;
          const distm = Math.sqrt(dxm * dxm + dym * dym);
          if (distm < 200) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, adjMouseY);
            ctx.strokeStyle = `rgba(80,160,255,${0.5 - (distm / 200) * 0.5})`;
            ctx.lineWidth = 1.2; ctx.stroke();
          }
        }
      }
      // Nodes
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
        ctx.fillStyle = p.cluster
          ? "rgba(130,180,240,0.9)"
          : "rgba(100,150,210,0.6)";
        ctx.fill();
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
    <section className="relative w-full flex flex-col overflow-visible bg-public-brand-field-strong" style={{ background: "var(--public-brand-field-strong)" }}>

      {/* Background — hero 영역 내에서만 유효, support section 침범 금지 */}
      <div className="absolute z-0 pointer-events-none" style={{ top: 0, left: 0, right: 0, bottom: "-200px" }}>

        {/* Base gradient — hero 내부 */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(to bottom, #0C2240 0%, #081425 35%, #081425 60%, #152236 100%)",
        }} />

        {/* Plexus — hero 상단~중단까지 */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.4 }}>
          <PlexusCanvas />
        </div>

        {/* Central light field — headline 뒤 focal axis */}
        <div className="absolute inset-x-0 top-0 pointer-events-none" style={{
          height: "55%",
          background: "radial-gradient(ellipse 50% 45% at 50% 36%, rgba(40,90,180,0.18) 0%, rgba(30,60,140,0.05) 55%, transparent 100%)",
        }} />

        {/* Bottom fade — support band(#0E1B2E)로 자연스럽게 전환 */}
        <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{
          height: "40%",
          background: "linear-gradient(to bottom, transparent 0%, #0E1B2E 100%)",
        }} />
      </div>

      {/* Nav — fixed, 스크롤해도 항상 상단 고정 */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/8"
        style={{
          backgroundColor: "rgba(11,17,32,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="flex justify-between items-center px-6 lg:px-12 py-4 max-w-[1400px] mx-auto w-full">
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
                <Button className="text-sm font-semibold px-5 py-2.5 rounded-md text-white flex items-center gap-1.5" style={{ backgroundColor: "#3580FF" }}>
                  <LayoutDashboard className="h-3.5 w-3.5" />대시보드
                </Button>
              </Link>
              <AccountMenu userName={session?.user?.name} />
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">로그인</Link>
              <Link href="/search">
                <Button variant="outline" className="text-slate-200 hover:text-white text-sm font-medium px-5 py-2.5 rounded-md" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)" }}>무료로 시작하기</Button>
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
              <Button size="sm" className="text-xs px-3 py-1.5 text-white rounded-md flex items-center gap-1" style={{ backgroundColor: "#3580FF" }}>
                <LayoutDashboard className="h-3 w-3" />대시보드
              </Button>
            </Link>
          ) : (
            <Link href="/search">
              <Button size="sm" className="text-xs px-3 py-1.5 text-white rounded-md" style={{ backgroundColor: "#3580FF" }}>시작하기</Button>
            </Link>
          )}
          <MobileMenu />
        </div>
        </div>
      </nav>

      {/* Nav spacer — fixed nav 높이만큼 밀어줌 */}
      <div className="h-16" />

      {/* Hero content — 텍스트 최소화, 목업 주인공 */}
      <div className="relative z-20 flex flex-col items-center max-w-[960px] mx-auto px-4 sm:px-6 pt-12 sm:pt-16 text-center w-full">
        <h1 className="text-2xl md:text-[44px] lg:text-[50px] font-extrabold tracking-tight leading-[1.2] text-white mb-3 md:mb-4">
          연구 구매 운영을<br />하나의 흐름으로 연결합니다
        </h1>
        <p className="text-sm md:text-[15px] text-slate-300 mb-6 md:mb-7 font-medium max-w-lg">
          후보 정리, 비교, 요청, 발주 준비, 입고 반영까지 한 화면 흐름으로 이어집니다.
        </p>
        <div className="flex flex-row gap-3 mb-10 md:mb-12">
          <Link href={isLoggedIn ? "/app/search" : "/search"}>
            <Button className="h-10 sm:h-11 px-6 sm:px-7 text-white font-bold text-[13px] sm:text-[14px] rounded-lg shadow-[0_2px_16px_rgba(60,130,255,0.25)]" style={{ backgroundColor: "#3B82F6", border: "1px solid rgba(60,140,255,0.3)" }}>
              {isLoggedIn ? "워크벤치 열기" : "무료로 시작하기"}<Search className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
          <Link href={isLoggedIn ? "/dashboard" : "/support"}>
            <Button variant="outline" className="h-10 sm:h-11 px-6 sm:px-7 text-slate-300 font-semibold text-[13px] sm:text-[14px] rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)" }}>
              {isLoggedIn ? "대시보드" : "도입 문의"}
            </Button>
          </Link>
        </div>

        {/* ── Mockup 1 캡션 ── */}
        <p className="text-[11px] md:text-[13px] font-semibold tracking-wide mb-4 md:mb-5" style={{ color: "#94A3B8" }}>
          선택안 확정부터 발주 준비까지 한 화면에서 이어집니다
        </p>

        {/* ── Hero Mockup — 제품이 주인공 ── */}
        <div className="relative w-full" style={{ maxWidth: 1100 }}>
          {/* Shadow + restrained blue halo — enterprise object 분리감 */}
          <div
            className="absolute -inset-x-3 md:-inset-x-6 -top-3 md:-top-6 rounded-2xl pointer-events-none"
            style={{
              bottom: "0",
              background: "radial-gradient(ellipse 80% 50% at 50% 40%, rgba(30,60,120,0.15) 0%, transparent 100%)",
              filter: "blur(16px)",
            }}
          />

          {/* Product frame — 정제된 운영형 오브젝트 */}
          <div
            className="relative rounded-xl md:rounded-2xl overflow-hidden"
            style={{
              backgroundColor: "#131B2E",
              border: "1px solid rgba(148,163,184,0.16)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 16px 48px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3), 0 0 24px rgba(59,130,246,0.06)",
            }}
          >
            {/* Top edge highlight — 오브젝트 상단 빛 */}
            <div className="absolute inset-x-0 top-0 h-px pointer-events-none" style={{ background: "linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.18) 50%, transparent 90%)" }} />

            {/* Title bar — 장식 없는 단순 bar */}
            <div
              className="flex items-center px-3 md:px-4 py-2"
              style={{ backgroundColor: "#0C1322", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="text-[10px] md:text-[11px] font-medium" style={{ color: "#7A8BA3" }}>LabAxis — 발주 전환 큐</span>
            </div>

            {/* KPI bar — "작동 중" 인상 */}
            <div
              className="grid grid-cols-3 gap-px"
              style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              {[
                { label: "전환 대기", value: "12건", color: "#3B82F6" },
                { label: "금주 처리", value: "₩2,450,000", color: "#93C5FD" },
                { label: "검토 필요", value: "선택안 3건", color: "#CBD5E1" },
              ].map((kpi) => (
                <div key={kpi.label} className="px-3 md:px-5 py-2.5 md:py-3" style={{ backgroundColor: "#131B2E" }}>
                  <p className="text-[8px] md:text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: "#64748B" }}>{kpi.label}</p>
                  <p className="text-[12px] md:text-[14px] font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Inline mockup content */}
            <OpsConsoleMockupContent />
          </div>
        </div>
      </div>

      {/* Hero 하단 여유 — support 시작까지 리듬감 유지하되 narrative drop 방지 */}
      <div className="h-14 md:h-20" />
    </section>
  );
}
