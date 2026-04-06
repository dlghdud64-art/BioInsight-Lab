"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { resetWorkbenchSessionOnLogout, invalidateWorkbenchQueryCache } from "@/lib/auth/workbench-session-reset";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useQRScanner } from "@/contexts/QRScannerContext";
import {
  Search, Bell, HelpCircle, ChevronRight,
  AlertTriangle, FileText, Truck, BookOpen, Headphones,
  Settings, CreditCard, LogOut,
  ShieldAlert, Clock, CheckCircle2,
  ClipboardCheck, Menu,
} from "lucide-react";
import { BioInsightLogo } from "@/components/bioinsight-logo";

interface DashboardHeaderProps {
  onMenuClick?: () => void;
}

/* ── 알림 타입 시스템 ── */

type NotificationCategory =
  | "stock_alert"      // 재고 부족
  | "quote_arrived"    // 견적 도착
  | "delivery_complete"// 입고 완료
  | "approval_pending" // 승인 대기
  | "expiry_warning"   // 유효기간 경고
  | "safety_alert"     // 안전 관련
  | "system";          // 시스템

interface Notification {
  id: number;
  category: NotificationCategory;
  read: boolean;
  /** 알림 텍스트 */
  text: string;
  /** 클릭 시 이동 경로 */
  href: string;
  /** 발생 시간 */
  time: string;
}

/** 카테고리별 아이콘 + tint 매핑 */
const CATEGORY_CONFIG: Record<
  NotificationCategory,
  { icon: React.ElementType; tint: string; unreadTint: string }
> = {
  stock_alert:       { icon: AlertTriangle, tint: "text-slate-500", unreadTint: "text-red-400" },
  quote_arrived:     { icon: FileText,      tint: "text-slate-500", unreadTint: "text-blue-400" },
  delivery_complete: { icon: Truck,         tint: "text-slate-500", unreadTint: "text-blue-400" },
  approval_pending:  { icon: ClipboardCheck,tint: "text-slate-500", unreadTint: "text-blue-400" },
  expiry_warning:    { icon: Clock,         tint: "text-slate-500", unreadTint: "text-amber-400" },
  safety_alert:      { icon: ShieldAlert,   tint: "text-slate-500", unreadTint: "text-amber-400" },
  system:            { icon: Bell,          tint: "text-slate-500", unreadTint: "text-slate-300" },
};

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { open: openQRScanner } = useQRScanner();
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: 1, category: "stock_alert", read: false, text: "재고 부족 품목 3건 — 재주문 검토 필요", href: "/dashboard/inventory?filter=low", time: "10분 전" },
    { id: 2, category: "expiry_warning", read: false, text: "만료 임박 Lot 1건 (D-3) — 확인 필요", href: "/dashboard/inventory", time: "30분 전" },
    { id: 3, category: "approval_pending", read: false, text: "승인 대기 견적 2건 — 구매 승인 페이지", href: "/dashboard/purchases", time: "1시간 전" },
    { id: 4, category: "quote_arrived", read: false, text: "공급사 견적 도착 — Thermo Fisher 외 2건", href: "/dashboard/quotes", time: "2시간 전" },
    { id: 5, category: "delivery_complete", read: true, text: "입고 완료 — 50ml Conical Tube (100개)", href: "/dashboard/inventory", time: "어제" },
    { id: 6, category: "safety_alert", read: true, text: "MSDS 등록 완료 — Ethanol 99.5%", href: "/dashboard/safety", time: "2일 전" },
    { id: 7, category: "system", read: true, text: "일일 요약 메일 발송 완료", href: "/dashboard/notifications", time: "2일 전" },
    { id: 8, category: "quote_arrived", read: true, text: "PDF BOM 분석 실패 — 텍스트 붙여넣기로 재시도", href: "/protocol/bom", time: "3일 전" },
  ]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // 글로벌 단축키: Ctrl+Q → QR 스캐너 열기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "q") {
        e.preventDefault();
        openQRScanner();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openQRScanner]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      e.preventDefault();
      router.push(`/app/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // ID 패턴 감지 (숫자 ID, UUID, CUID 등)
  const isIdSegment = (path: string): boolean => {
    if (!path) return false;
    // 10자리 이상 숫자 ID
    if (/^\d{10,}$/.test(path)) return true;
    // UUID 패턴 (8-4-4-4-12)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(path)) return true;
    // Prisma CUID 패턴 (20자 이상 소문자 + 숫자 조합, 숫자 포함 필수)
    if (path.length >= 20 && /^[a-z][a-z0-9]+$/.test(path) && /\d/.test(path)) return true;
    return false;
  };

  // 경로 세그먼트를 한글로 표시용 라벨로 변환 (Raw ID·UUID·CUID 숨김, 영문→한글 매핑)
  const formatPathName = (path: string, isLastSegment: boolean): string => {
    if (!path) return "";
    // 숫자 ID / UUID / CUID 패턴 → "상세 관리" / "상세 정보"
    if (isIdSegment(path)) {
      return isLastSegment ? "상세 정보" : "상세 관리";
    }
    const pathLabelMap: Record<string, string> = {
      dashboard: "대시보드",
      analytics: "지출 분석",
      inventory: "재고 관리",
      purchases: "구매 운영",
      quotes: "견적 관리",
      organizations: "조직 관리",
      safety: "안전 관리",
      settings: "설정",
      budget: "예산 관리",
      reports: "구매 리포트",
      notifications: "알림 센터",
      guide: "이용 가이드",
      faq: "자주 묻는 질문",
      support: "1:1 문의",
      orders: "견적 및 구매 내역",
      admin: "관리자",
      my: "내 정보",
      test: "테스트",
    };
    const mapped = pathLabelMap[path];
    if (mapped) return mapped;
    return path
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // 브레드크럼 생성
  const generateBreadcrumbs = () => {
    const paths = pathname?.split("/").filter(Boolean) || [];
    const breadcrumbs = [{ label: "Home", href: "/" }];

    let currentPath = "";
    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      const isLast = index === paths.length - 1;
      const prevSegment = index > 0 ? paths[index - 1] : null;

      let label: string;
      if (index === 0) {
        // 첫 번째 세그먼트는 보통 "dashboard" → "대시보드"
        label = formatPathName(path, isLast);
      } else if (prevSegment === "organizations" && isIdSegment(path)) {
        // 조직 상세 페이지의 Raw ID(숫자/UUID/CUID 모두)는 "조직 상세"로 치환
        label = "조직 상세";
      } else {
        label = formatPathName(path, isLast);
      }
      breadcrumbs.push({
        label,
        href: currentPath,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();
  const user = session?.user;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationClick = (notification: Notification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );
    setIsNotificationOpen(false);
    router.push(notification.href);
  };

  /** 알림 카테고리 아이콘 (bare, unread시 tint 적용) */
  const renderCategoryIcon = (category: NotificationCategory, isRead: boolean) => {
    const config = CATEGORY_CONFIG[category];
    const Icon = config.icon;
    const color = isRead ? config.tint : config.unreadTint;
    return <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} />;
  };

  return (
    <header className="sticky top-0 z-50 h-14 md:h-16 border-b border-slate-800/50 backdrop-blur-sm" style={{ backgroundColor: "rgba(17,24,39,0.97)" }}>
      <div className="flex h-full items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        {/* 좌측 영역: 모바일=로고, 데스크탑=브레드크럼 */}
        <div className="flex items-center gap-4 min-w-0 flex-shrink-0">
          {/* 로고 (모바일 전용 - 데스크탑은 고정 사이드바에서 표시) */}
          <Link href="/dashboard" className="flex-shrink-0 lg:hidden">
            <span className="text-xl font-bold tracking-tight text-slate-100">LabAxis</span>
          </Link>

          {/* 브레드크럼 (데스크탑 전용) */}
          <nav className="hidden md:flex items-center gap-1.5 text-sm text-slate-400 min-w-0">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href} className="flex items-center gap-1.5 min-w-0">
                {index > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                )}
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-normal text-sm text-slate-200 truncate">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="hover:text-slate-100 truncate transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* 우측 영역: 검색창 + 유틸리티 + 프로필 + 햄버거 */}
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          {/* 전역 검색창: 데스크톱 전용 (모바일은 하단 플로팅 검색 사용) */}
          <div className="hidden md:flex items-center relative flex-1 md:flex-initial w-full min-w-0 md:w-56 lg:w-64 xl:w-96">
            <Search className="absolute left-3 h-4 w-4 text-slate-500 pointer-events-none flex-shrink-0" />
            <Input
              type="search"
              placeholder="시약, 재고 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              className="pl-9 h-9 bg-[#273449] border-[#455264] focus:bg-[#273449] w-full min-w-0 text-slate-100"
            />
          </div>

          {/* 검색 아이콘 (모바일 전용) — 클릭 시 검색 페이지 이동 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 md:hidden flex-shrink-0 p-2 text-slate-400 hover:text-slate-100 hover:bg-transparent transition-colors"
            onClick={() => router.push("/app/search")}
            aria-label="검색"
          >
            <Search className="h-5 w-5" />
          </Button>


          {/* 알림 드롭다운 — 이벤트 피드 */}
          <DropdownMenu open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 md:h-9 md:w-9 relative flex-shrink-0 p-2 text-slate-400 hover:text-slate-100 hover:bg-transparent"
                aria-label="알림"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[360px] p-0 !bg-[#1F2937] shadow-2xl shadow-black/40 border border-[#374151] ring-1 ring-black/20">
              {/* 헤더 */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#374151]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-200">알림</span>
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[11px] font-semibold rounded-full bg-blue-600 text-white">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    모두 읽음
                  </button>
                )}
              </div>

              {/* 알림 목록 */}
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="h-6 w-6 text-slate-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">새 알림이 없습니다</p>
                  </div>
                ) : (
                  notifications.slice(0, 8).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-[#273449] transition-colors"
                    >
                      {/* unread 파란 점 */}
                      <div className="flex items-center gap-2 pt-0.5">
                        {!n.read ? (
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                        ) : (
                          <span className="w-1.5 h-1.5 flex-shrink-0" />
                        )}
                        {renderCategoryIcon(n.category, n.read)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-snug line-clamp-2 ${n.read ? "text-slate-400" : "text-slate-200"}`}>{n.text}</p>
                        <span className="text-[11px] text-slate-500 mt-0.5 block">{n.time}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* 푸터 */}
              <div className="border-t border-[#374151] px-4 py-2.5 text-center">
                <Link
                  href="/dashboard/notifications"
                  onClick={() => setIsNotificationOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  전체 알림 보기
                </Link>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 도움말 드롭다운 (sm 미만에서 공간 부족 시 숨김) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 md:h-9 md:w-9 flex-shrink-0 cursor-pointer p-2 text-slate-400 hover:text-slate-100 hover:bg-transparent transition-colors hidden lg:flex"
                aria-label="도움말"
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 min-w-[240px] !bg-[#1F2937] border-[#374151] shadow-2xl shadow-black/40">
              <DropdownMenuItem asChild>
                <Link href="/dashboard/guide" className="cursor-pointer w-full flex items-center gap-3 py-3">
                  <BookOpen className="mr-2 h-4 w-4" />
                  이용 가이드
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/faq" className="cursor-pointer w-full flex items-center gap-3 py-3">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  자주 묻는 질문
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/support" className="cursor-pointer w-full flex items-center gap-3 py-3">
                  <Headphones className="mr-2 h-4 w-4" />
                  1:1 문의하기
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 사용자 프로필 (데스크탑 전용 — 모바일은 사이드바 프로필 사용) */}
          <div className="hidden lg:block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 pl-3 border-l border-[#455264] flex-shrink-0 px-3 py-2 rounded-lg hover:bg-[#273449] transition-colors cursor-pointer min-h-[44px]">
                <Avatar className="h-8 w-8 border border-[#455264]">
                  <AvatarImage src={user?.image || undefined} alt={user?.name || "User"} />
                  <AvatarFallback className="bg-blue-900/50 text-blue-400 text-xs font-semibold">
                    {user?.name
                      ? user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)
                      : user?.email?.[0].toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden xl:block min-w-0 text-left">
                  <div className="text-sm font-medium text-slate-100 truncate">
                    {user?.name || "사용자"}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {user?.email}
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 min-w-[280px] p-2 !bg-[#1F2937] border-[#374151] shadow-2xl shadow-black/40">
              <DropdownMenuLabel className="p-3">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-slate-100">{user?.name || "사용자"}</p>
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="flex items-center gap-3 py-3 text-sm cursor-pointer">
                  <Settings className="h-4 w-4" />
                  설정
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings?tab=billing" className="flex items-center gap-3 py-3 text-sm cursor-pointer">
                  <CreditCard className="h-4 w-4" />
                  청구 및 구독
                </Link>
              </DropdownMenuItem>
              <a href="mailto:support@labaxis.io">
                <DropdownMenuItem className="flex items-center gap-3 py-3 text-sm cursor-pointer">
                  <HelpCircle className="h-4 w-4" />
                  고객센터
                </DropdownMenuItem>
              </a>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  resetWorkbenchSessionOnLogout();
                  invalidateWorkbenchQueryCache(queryClient);
                  signOut({ callbackUrl: "/" });
                }}
                className="flex items-center gap-3 py-3 text-sm cursor-pointer text-red-400 focus:text-red-400"
              >
                <LogOut className="h-4 w-4" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>

          {/* 햄버거 버튼 (모바일/태블릿 전용 - 데스크탑은 고정 사이드바) */}
          {onMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 flex-shrink-0 text-slate-400 hover:bg-[#273449] mobile-menu-button lg:hidden -mr-1"
              onClick={onMenuClick}
              aria-label="메뉴 열기"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

