"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "@/components/auth/user-menu";
import { Menu, X, Info, Phone, Headset, LayoutDashboard, ClipboardList, ShoppingCart, Package, Compass } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { resetWorkbenchSessionOnLogout, invalidateWorkbenchQueryCache } from "@/lib/auth/workbench-session-reset";
import { useState, useEffect, useRef } from "react";
import { useOntologyContextLayerStore } from "@/lib/store/ontology-context-layer-store";
import { OntologyContextLayer } from "@/components/ontology-context-layer/ontology-context-layer";

interface MainHeaderProps {
  onMenuClick?: () => void;
  pageTitle?: string;
  showMenuIcon?: boolean;
}

export function MainHeader({ onMenuClick, pageTitle, showMenuIcon = false }: MainHeaderProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const openContextLayer = useOntologyContextLayerStore((s: { open: (pathname: string, context: Record<string, unknown>) => void }) => s.open);

  // ESC 키로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const close = () => setMenuOpen(false);

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-40 backdrop-blur-md h-14" style={{ backgroundColor: "rgba(11,17,32,0.95)", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
        <div className="w-full flex h-14 items-center justify-between px-4 md:max-w-6xl md:mx-auto">

          {/* ── LEFT: 로고 ── */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xl font-bold tracking-tight text-slate-100">LabAxis</span>
          </Link>

          {/* ── RIGHT: 데스크탑 nav + UserMenu + 햄버거 ── */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">

            {/* 데스크탑 네비게이션 */}
            <nav className="hidden md:flex items-center gap-1.5 mr-2">
              {session?.user ? (
                <>
                  <Link href="/intro" className="px-4 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap">
                    서비스 소개
                  </Link>
                  <Link href="/pricing" className="px-4 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap">
                    요금 &amp; 도입
                  </Link>
                  <Link href="/app/search" className="px-4 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap">
                    검색
                  </Link>
                  {pathname.startsWith("/dashboard") && (
                    <button
                      onClick={() => openContextLayer(pathname, {})}
                      className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-1.5 transition-colors whitespace-nowrap shadow-sm"
                    >
                      <Compass className="h-3.5 w-3.5" />
                      다음 작업
                    </button>
                  )}
                </>
              ) : (
                <>
                  <Link href="/intro" className="px-4 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap">
                    서비스 소개
                  </Link>
                  <Link href="/pricing" className="px-4 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap">
                    요금 &amp; 도입
                  </Link>
                  <Link href="/auth/signin" className="px-4 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap">
                    로그인
                  </Link>
                  <Link href="/search" className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-5 py-2 transition-colors whitespace-nowrap shadow-sm">
                    무료로 시작하기
                  </Link>
                </>
              )}
            </nav>

            {/* 프로필 메뉴 (데스크탑 전용) */}
            <div className="hidden md:block">
              <UserMenu />
            </div>

            {/* 햄버거 버튼 (모바일 전용) */}
            <button
              type="button"
              className="md:hidden p-2 -mr-1 text-slate-300 hover:text-slate-100 transition-colors flex-shrink-0 touch-manipulation"
              aria-label="전체 메뉴 열기"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── 모바일 메뉴 — contained top-right sheet ── */}
      {menuOpen && (
        <>
          {/* 배경 딤 — 원래 페이지가 약간 보이게 */}
          <div
            className="fixed inset-0 z-[999]"
            style={{ backgroundColor: "rgba(0,0,0,0.38)", backdropFilter: "blur(1px)" }}
            onClick={close}
            aria-hidden="true"
          />

          {/* 메뉴 시트 — 헤더 바로 아래 오른쪽에서 내려옴 */}
          <div
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label="사이트 메뉴"
            className="fixed right-3 z-[1000] flex flex-col overflow-hidden rounded-2xl"
            style={{
              top: "3.75rem",
              width: "min(88vw, 340px)",
              maxHeight: "78vh",
              backgroundColor: "#0D1A2D",
              border: "1px solid #1E3050",
              boxShadow: "0 20px 48px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)",
              animation: "mobileMenuIn 180ms cubic-bezier(0.16,1,0.3,1) forwards",
            }}
          >
            {/* ── 헤더: 로고 + 닫기 ── */}
            <div
              className="flex items-center justify-between px-4 py-3.5 flex-shrink-0"
              style={{ borderBottom: "1px solid #162640" }}
            >
              <span className="text-[15px] font-bold tracking-tight text-slate-100">LabAxis</span>
              <button
                type="button"
                onClick={close}
                aria-label="메뉴 닫기"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700/50 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ── 스크롤 가능한 메뉴 본문 ── */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {session?.user ? (
                <>
                  {/* 프로필 */}
                  <div className="px-4 py-3.5" style={{ borderBottom: "1px solid #162640" }}>
                    <div className="flex items-center gap-3">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "rgba(37,99,235,0.15)" }}
                      >
                        <span className="text-sm font-bold text-blue-400">
                          {session.user.name
                            ? session.user.name.charAt(0).toUpperCase()
                            : (session.user.email?.charAt(0).toUpperCase() ?? "U")}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100 truncate">{session.user.name || "사용자"}</p>
                        <p className="text-xs text-slate-400 truncate">{session.user.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* 다음 작업 (contextual entry) — 대시보드에서만 표시 */}
                  {pathname.startsWith("/dashboard") && (
                    <div className="px-2 py-1.5">
                      <button
                        onClick={() => {
                          close();
                          openContextLayer(pathname, {});
                        }}
                        className="w-full flex items-center gap-3 px-3 rounded-xl transition-colors"
                        style={{ paddingTop: 11, paddingBottom: 11, color: "#F1F5F9" }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#142840")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <Compass className="h-4 w-4 flex-shrink-0" style={{ color: "#2563EB" }} />
                        <span className="text-sm font-semibold">다음 작업</span>
                      </button>
                    </div>
                  )}

                  {/* 앱 이동 */}
                  <nav className="px-2 py-2">
                    {([
                      { href: "/dashboard",             icon: LayoutDashboard, label: "대시보드",  primary: false },
                      { href: "/dashboard/quotes",      icon: ClipboardList,   label: "견적 관리", primary: false },
                      { href: "/dashboard/purchases",   icon: ShoppingCart,    label: "구매 운영", primary: false },
                      { href: "/dashboard/inventory",   icon: Package,         label: "재고 관리", primary: false },
                    ] as const).map(({ href, icon: Icon, label, primary }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={close}
                        className="flex items-center gap-3 px-3 rounded-xl transition-colors"
                        style={{ paddingTop: 11, paddingBottom: 11, color: primary ? "#F1F5F9" : "#94A3B8" }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#142840")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" style={{ color: primary ? "#2563EB" : "#3D5570" }} />
                        <span className="text-sm font-medium">{label}</span>
                      </Link>
                    ))}
                  </nav>

                  {/* 지원 */}
                  <div className="px-2 pb-2" style={{ borderTop: "1px solid #162640", paddingTop: 6 }}>
                    <Link
                      href="/support"
                      onClick={close}
                      className="flex items-center gap-3 px-3 rounded-xl transition-colors"
                      style={{ paddingTop: 11, paddingBottom: 11, color: "#94A3B8" }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#142840")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <Headset className="h-4 w-4 flex-shrink-0" style={{ color: "#3D5570" }} />
                      <span className="text-sm font-medium">고객 지원 및 문의</span>
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  {/* 비로그인 — 3개 primary nav */}
                  <nav className="px-2 py-2">
                    {([
                      { href: "/intro",    icon: Info,    label: "서비스 소개" },
                      { href: "/pricing",  icon: Phone,   label: "요금 & 도입" },
                      { href: "/support",  icon: Headset, label: "고객 지원 및 문의" },
                    ] as const).map(({ href, icon: Icon, label }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={close}
                        className="flex items-center gap-3 px-3 rounded-xl transition-colors"
                        style={{ paddingTop: 11, paddingBottom: 11, color: "#E2E8F0" }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#142840")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" style={{ color: "#3D5570" }} />
                        <span className="text-sm font-medium">{label}</span>
                      </Link>
                    ))}
                  </nav>

                  {/* 로그인 */}
                  <div className="px-2 pb-2" style={{ borderTop: "1px solid #162640", paddingTop: 6 }}>
                    <Link
                      href="/auth/signin"
                      onClick={close}
                      className="flex items-center gap-3 px-3 rounded-xl transition-colors"
                      style={{ paddingTop: 11, paddingBottom: 11, color: "#94A3B8" }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#142840")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <span className="text-sm font-medium">로그인</span>
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* ── 하단 sticky CTA ── */}
            <div className="flex-shrink-0 px-3 py-3" style={{ borderTop: "1px solid #162640" }}>
              {session?.user ? (
                <button
                  type="button"
                  onClick={() => {
                    resetWorkbenchSessionOnLogout();
                    invalidateWorkbenchQueryCache(queryClient);
                    signOut({ callbackUrl: "/" });
                  }}
                  className="w-full px-3 py-3 text-left text-sm font-medium rounded-xl transition-colors"
                  style={{ color: "#F87171" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  로그아웃
                </button>
              ) : (
                <Link href="/search" onClick={close}>
                  <button
                    type="button"
                    className="w-full h-11 rounded-xl text-sm font-bold text-white transition-colors"
                    style={{ backgroundColor: "#2563EB" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#1D4ED8")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#2563EB")}
                  >
                    무료로 시작하기
                  </button>
                </Link>
              )}
            </div>
          </div>

          <style>{`
            @keyframes mobileMenuIn {
              from { opacity: 0; transform: translateY(-10px) scale(0.96); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </>
      )}

      {/* Ontology Context Layer — global overlay */}
      <OntologyContextLayer />
    </>
  );
}
