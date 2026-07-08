"use client";

import { useState, useEffect } from "react";
import { useDialogA11y } from "@/lib/hooks/use-dialog-a11y";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { getFlag } from "@/lib/feature-flags";
import { Button } from "@/components/ui/button";
import { BioInsightLogo } from "@/components/bioinsight-logo";
import {
  LayoutDashboard,
  ShoppingCart,
  Building2,
  Package,
  Truck,
  FileText,
  BarChart3,
  Settings,
  Shield,
  ShieldCheck,
  X,
  CreditCard,
  PieChart,
  Home,
  ClipboardList,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

// ── 아이콘 박스 컨테이너 ──────────────────────────────────
// B2B SaaS 트렌드: 아이콘 뒤 부드러운 사각형 배경으로 시인성 강화
function IconBox({ icon: Icon, isActive, tint }: {
  icon: LucideIcon;
  isActive: boolean;
  tint: { active: string; inactive: string };
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-colors duration-150",
        isActive
          ? "bg-blue-500/25"
          : "bg-slate-800 group-hover/nav:bg-slate-700"
      )}
    >
      <Icon
        className={cn("h-[18px] w-[18px]", isActive ? tint.active : tint.inactive)}
        strokeWidth={2.25}
      />
    </span>
  );
}

interface SidebarGroup {
  label: string;
  items: NavItem[];
}

// 메뉴 그룹 정의
const sidebarGroups: SidebarGroup[] = [
  {
    label: "구매 및 예산 (PURCHASE)",
    items: [
      {
        title: "견적 관리",
        href: "/dashboard/quotes",
        icon: FileText,
      },
      {
        title: "구매 운영",
        href: "/dashboard/purchases",
        icon: ShoppingCart,
      },
      {
        // §11.83 #purchase-orders-sidebar-entry-add
        // §11.55 dead-end 패턴 9번째 회귀 정리 — `/dashboard/purchase-orders`
        // (643 lines alive surface) 가 desktop sidebar 진입점 부재였던 문제.
        // 모바일 bottom-nav-more-sheet 의 "발주" 항목 (ClipboardList icon) 과
        // 동일 entry. ontology 상 "구매 운영"(견적→발주 결정) vs "발주 관리"
        // (PO 발행 후 ready/needs_review/waiting_external/handoff) 는 분리된
        // stage 라 두 메뉴 정당.
        title: "발주 관리",
        href: "/dashboard/purchase-orders",
        icon: ClipboardList,
      },
      {
        // §11.365 — "지출 분석"을 상단 독립(dashboardLinks) → PURCHASE 그룹으로 이동
        //   (IA 정합). 구매·예산 분석류라 구매 리포트와 인접 배치. href/icon 보존.
        title: "지출 분석",
        href: "/dashboard/analytics",
        icon: PieChart,
      },
      {
        title: "구매 리포트",
        href: "/dashboard/reports",
        icon: BarChart3,
      },
      {
        title: "예산 관리",
        href: "/dashboard/budget",
        icon: CreditCard,
      },
    ],
  },
  {
    label: "랩 운영 (LAB MANAGEMENT)",
    items: [
      {
        title: "재고 관리",
        href: "/dashboard/inventory",
        icon: Package,
      },
      {
        // §nav-receiving(호영님 2026-07-08) — 입고 관리 사이드바 진입점 추가(라우트 존재했으나 메뉴 누락).
        title: "입고 관리",
        href: "/dashboard/receiving",
        icon: Truck,
      },
      {
        title: "조직 관리",
        href: "/dashboard/organizations",
        icon: Building2,
      },
      {
        title: "안전 관리",
        href: "/dashboard/safety",
        icon: Shield,
      },
    ],
  },
  {
    label: "시스템 (SYSTEM)",
    items: [
      {
        title: "운영 지원 센터",
        href: "/dashboard/support-center",
        icon: LifeBuoy,
      },
      {
        title: "설정",
        href: "/dashboard/settings",
        icon: Settings,
      },
    ],
  },
];

// 관리자 전용 메뉴 (role === ADMIN || OWNER 시에만 표시)
// §log-consolidation P3 — 활동 로그 + 감사 추적 2항목 → 통합 단일 진입.
//   통합 host = /dashboard/audit (활동/감사 모드 토글, 각 모드 자기 모델 읽기).
//   구 /dashboard/activity-logs 는 통합 route 로 영구 redirect (dead link 0).
const adminMenuItems: NavItem[] = [
  { title: "활동 · 감사 로그", href: "/dashboard/audit", icon: ShieldCheck },
];

// 대시보드 링크 (상단에 별도 배치)
// §11.365 — "지출 분석"은 PURCHASE 그룹으로 이동(위 sidebarGroups). 상단은 대시보드만.
const dashboardLinks = [
  {
    title: "대시보드",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
];

// 사이드바 아이콘 색상 매핑. active = 카테고리별 선명(흰 알약 위), inactive = 같은 hue 밝은 솔리드.
// §sidebar-handoff(호영님 2026-07-08): 네이비 #222d47 로 어두워져 기존 400/70 흐린톤은 잘 안 보임
//   → inactive 를 400 솔리드로 시인성 상향. 활성 카테고리색은 §11.302 정체성 보존(안전=sky 등).
//   settings/audit active 는 흰 알약 위 가독 위해 slate-600(구 slate-200 은 흰 배경서 안 보임).
const ICON_TINT: Record<string, { active: string; inactive: string }> = {
  "/dashboard":              { active: "text-blue-600",    inactive: "text-blue-400" },
  "/dashboard/analytics":    { active: "text-indigo-600",  inactive: "text-indigo-300" },
  "/dashboard/quotes":       { active: "text-blue-600",    inactive: "text-blue-400" },
  "/dashboard/purchases":    { active: "text-blue-600",    inactive: "text-blue-400" },
  // §11.83 #purchase-orders-sidebar-entry-add — 발주 단계 (PO 관리) blue 동계
  "/dashboard/purchase-orders": { active: "text-blue-600", inactive: "text-blue-400" },
  "/dashboard/reports":      { active: "text-blue-600",    inactive: "text-blue-400" },
  "/dashboard/budget":       { active: "text-emerald-600", inactive: "text-emerald-400" },
  "/dashboard/inventory":    { active: "text-teal-600",    inactive: "text-teal-400" },
  "/dashboard/organizations":{ active: "text-indigo-600",  inactive: "text-indigo-300" },
  "/dashboard/safety":       { active: "text-sky-500",     inactive: "text-sky-400" },
  "/dashboard/support-center":{ active: "text-blue-600",   inactive: "text-blue-400" },
  "/dashboard/settings":     { active: "text-slate-600",   inactive: "text-slate-400" },
  "/dashboard/activity-logs":{ active: "text-slate-600",   inactive: "text-slate-400" },
  "/dashboard/audit":        { active: "text-slate-600",   inactive: "text-slate-400" },
};

interface DashboardSidebarProps {
  isMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function DashboardSidebar({ isMobileOpen: externalIsMobileOpen, onMobileOpenChange }: DashboardSidebarProps = {}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [internalIsMobileOpen, setInternalIsMobileOpen] = useState(false);

  const userRole = (session?.user?.role as string) || "";
  const isAdminOrOwner = userRole === "ADMIN" || userRole === "OWNER";

  // §quote-management-redesign(호영님) — ENABLE_PURCHASING off 시 "발주 관리" 메뉴 숨김(발주 라이브 표면 hide 정합,
  //   §purchasing-hide). NavItem 정의(소스 문자열)는 보존(rollback / on 복귀) — 렌더 목록만 필터(dead 링크 0).
  const purchasingOn = getFlag("ENABLE_PURCHASING");
  const visibleGroups = sidebarGroups.map((g) => ({
    ...g,
    items: g.items.filter((it) => purchasingOn || it.href !== "/dashboard/purchase-orders"),
  }));
  
  // 외부에서 제어하는 경우와 내부에서 제어하는 경우를 모두 지원
  const isMobileOpen = externalIsMobileOpen !== undefined ? externalIsMobileOpen : internalIsMobileOpen;
  const setIsMobileOpen = (open: boolean) => {
    if (onMobileOpenChange) {
      onMobileOpenChange(open);
    } else {
      setInternalIsMobileOpen(open);
    }
  };

  // 모바일에서 링크 클릭 시 사이드바 닫기
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // 모바일에서 외부 클릭 시 사이드바 닫기
  useEffect(() => {
    if (isMobileOpen) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.mobile-sidebar') && !target.closest('.mobile-menu-button')) {
          setIsMobileOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMobileOpen]);

  // §11.124 — Esc + Tab focus trap + return-focus (useDialogA11y hook)
  const mobileDialog = useDialogA11y<HTMLElement>({
    open: isMobileOpen,
    onClose: () => setIsMobileOpen(false),
  });

  const SidebarContent = () => (
    <div className="h-full flex flex-col">
      {/* 사이드바 헤더 (로고) - 데스크탑 전용 */}
      {/* §11.254 — LabAxis 사이드바 로고 destination 변경 (/dashboard → /).
          호영님 spec: 모든 서비스 영역 (대시보드/소싱/견적/재고/구매 운영) 의
          "LabAxis" 로고는 메인 홈페이지로 통일. 이전 #mobile-header-logo-home-link
          결정 ("양쪽 모두 /dashboard") 를 의도적으로 reversal — 사용자 mental
          model 정합 ("LabAxis" = 최상위 홈, /dashboard = 구매 운영 surface).
          aria-label / hover/opacity 시각 피드백 / w-full 보존. */}
      {/* §sidebar-navy-top(호영님 2026-07-08) — 로고칸을 네이비로 되돌림(§11.333 흰칸 reversal).
          로고가 흰 바닥 위에 떠 보이던 상단 이음매 제거. 로고칸+메뉴를 하나의 네이비 바닥으로
          감싸고, 흰 헤더는 오른쪽 콘텐츠 영역(.main)에서만 시작. 로고 텍스트 흰색.
          네이비 톤은 --sidebar-navy 전역 토큰(globals.css :root) 한 곳에서 조정. */}
      <div className="h-16 hidden lg:flex items-center px-4 bg-[var(--sidebar-navy)] flex-shrink-0">
        <Link
          href="/"
          aria-label="LabAxis 홈으로 이동"
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity relative z-50 w-full"
        >
          <span className="text-xl font-bold tracking-tight text-white">LabAxis</span>
        </Link>
      </div>

      {/* 메뉴 영역 (스크롤 가능) — §사이드바 스크롤 개선: 페이드 마스크 + 얇은 오버레이 바 + overscroll-contain.
          헤더(h-16 flex-shrink-0)·푸터(mt-auto flex-shrink-0)는 이미 고정, 이 영역만 스크롤. */}
      <div className="flex-1 overflow-y-auto overscroll-contain sidebar-scroll p-3 md:p-4 pt-16 lg:pt-8">
        {/* 모바일/태블릿 헤더 */}
        <div className="flex items-center justify-between mb-6 lg:hidden">
          <h2 className="text-xs font-semibold text-white">메뉴</h2>
            <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileOpen(false)}
            className="h-7 w-7 text-slate-400"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* 데스크톱 헤더 */}
        <h2 className="hidden lg:block text-xs lg:text-sm font-semibold text-white mb-6">메뉴</h2>

        {/* 대시보드 링크 (상단) */}
        <div className="mb-6">
          <nav className="space-y-0.5" aria-label="대시보드 메뉴">
            {dashboardLinks.map((item) => {
              const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : (pathname === item.href || pathname?.startsWith(item.href + "/"));
              const tint = ICON_TINT[item.href] || { active: "text-blue-600", inactive: "text-slate-400" };

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "group/nav flex items-center gap-2.5 px-2 md:px-2.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white text-[#222d47] font-bold"
                      : "text-[#c7d0e4] hover:text-white hover:bg-[var(--sidebar-navy-hover)]"
                  )}
                >
                  <IconBox icon={item.icon} isActive={isActive} tint={tint} />
                  <span className="truncate whitespace-nowrap">{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* 메뉴 그룹 */}
        <div className="space-y-6">
          {visibleGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2 px-2 md:px-3 mt-6 first:mt-0" style={{ color: "#7b88a8" }}>
                {group.label}
              </h3>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : (pathname === item.href || pathname?.startsWith(item.href + "/"));
                  const tint = ICON_TINT[item.href] || { active: "text-blue-600", inactive: "text-slate-400" };

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={cn(
                        "group/nav flex items-center gap-2.5 px-2 md:px-2.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors",
                        isActive
                          ? "bg-white text-[#222d47] font-bold"
                          : "text-[#c7d0e4] hover:text-white hover:bg-[var(--sidebar-navy-hover)]"
                      )}
                    >
                      <IconBox icon={item.icon} isActive={isActive} tint={tint} />
                      <span className="truncate whitespace-nowrap">{item.title}</span>
                      {item.badge && (
                        <span className="ml-auto text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(37,99,235,0.08)", color: "#2563EB" }}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* 관리자 전용 메뉴 (시스템 관리) */}
        {isAdminOrOwner && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="mb-2 px-2 md:px-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7b88a8" }}>
              시스템 관리
            </p>
            <nav className="space-y-0.5">
              {adminMenuItems.map((item) => {
                const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : (pathname === item.href || pathname?.startsWith(item.href + "/"));
                const tint = ICON_TINT[item.href] || { active: "text-slate-700", inactive: "text-slate-400" };
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      "group/nav flex items-center gap-2.5 px-2 md:px-2.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors",
                      isActive
                        ? "bg-white text-[#222d47] font-bold"
                        : "text-[#c7d0e4] hover:text-white hover:bg-[var(--sidebar-navy-hover)]"
                    )}
                  >
                    <IconBox icon={item.icon} isActive={isActive} tint={tint} />
                    <span className="truncate whitespace-nowrap">{item.title}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* 웹사이트 기본 링크 (서비스 소개 / 요금제 / 고객 지원) */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="mb-2 px-2 md:px-3 text-[10px] font-semibold text-[#7b88a8] uppercase tracking-wider">
            LabAxis
          </p>
          <nav className="space-y-1">
            {[
              { title: "서비스 소개", href: "/intro" },
              { title: "요금 & 도입", href: "/pricing" },
              { title: "고객 지원 및 문의", href: "/support" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className="flex items-center px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium text-[#93a0bd] hover:bg-[var(--sidebar-navy-hover)] hover:text-white transition-colors"
              >
                <span className="truncate whitespace-nowrap">{item.title}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* 하단 고정 영역 (서비스 홈으로) - 브랜드 컬러 강조 */}
      <div className="mt-auto p-4 border-t border-white/10 flex-shrink-0">
        <Link
          href="/"
          onClick={() => setIsMobileOpen(false)}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 group"
          style={{ backgroundColor: "rgba(96,165,250,0.08)", borderColor: "rgba(96,165,250,0.28)" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(96,165,250,0.16)"; e.currentTarget.style.borderColor = "rgba(96,165,250,0.5)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(96,165,250,0.08)"; e.currentTarget.style.borderColor = "rgba(96,165,250,0.28)"; }}
        >
          <Home className="h-4 w-4 text-[#93a0bd] group-hover:text-[#60a5fa] transition-colors" />
          <span className="text-xs font-bold tracking-wider text-[#c7d0e4] group-hover:text-white truncate whitespace-nowrap">
            서비스 홈으로
          </span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* ── 데스크탑 고정 사이드바 (lg 이상) ──
          §nav-hotfix(호영님 2026-07-08) — 사이드바↔본문 세로 구분선(border-r) 제거.
          네이비 사이드바 ↔ 흰 본문은 색 대비로 이미 구분되므로 선 불필요. */}
      <aside className="hidden lg:flex lg:flex-col fixed inset-y-0 left-0 w-64 bg-[var(--sidebar-navy)] z-30">
        <SidebarContent />
      </aside>

      {/* ── 모바일/태블릿 오버레이 + 슬라이드 사이드바 (lg 미만) ── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      <aside
        ref={mobileDialog.dialogRef}
        role="dialog"
        aria-modal={isMobileOpen ? "true" : undefined}
        aria-label="대시보드 메뉴"
        className={cn(
          "fixed top-0 left-0 h-full w-64 min-w-[16rem] bg-[var(--sidebar-navy)] border-r border-white/10 z-50 mobile-sidebar transition-transform duration-300 shrink-0 lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
