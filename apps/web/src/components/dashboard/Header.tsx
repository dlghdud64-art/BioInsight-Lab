"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Search, Bell, HelpCircle, ChevronRight, Home,
  AlertTriangle, FileText, Truck, BookOpen, Headphones,
  SlidersHorizontal, CreditCard, LogOut,
  ShieldAlert, Clock, ClipboardCheck, Menu,
} from "lucide-react";
import { LabAxisLogo } from "@/components/bioinsight-logo";

interface DashboardHeaderProps {
  onMenuClick?: () => void;
}

/* ── 알림 이벤트 피드 (경량 알림 센터) ── */

type NotificationCategory =
  | "stock_alert"
  | "quote_arrived"
  | "delivery_complete"
  | "approval_pending"
  | "expiry_warning"
  | "safety_alert"
  | "system";

interface EventNotification {
  id: number;
  category: NotificationCategory;
  message: string;
  href: string;
  time: string;
  read: boolean;
}

/** 카테고리별 아이콘/색상 매핑 */
const CATEGORY_CONFIG: Record<
  NotificationCategory,
  { icon: React.ElementType; text: string }
> = {
  stock_alert:       { icon: AlertTriangle,  text: "text-red-400" },
  quote_arrived:     { icon: FileText,       text: "text-blue-400" },
  delivery_complete: { icon: Truck,          text: "text-emerald-400" },
  approval_pending:  { icon: ClipboardCheck, text: "text-amber-400" },
  expiry_warning:    { icon: Clock,          text: "text-orange-400" },
  safety_alert:      { icon: ShieldAlert,    text: "text-purple-400" },
  system:            { icon: Bell,           text: "text-slate-400" },
};

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { open: openQRScanner } = useQRScanner();
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<EventNotification[]>([
    { id: 1, category: "quote_arrived",     message: "Thermo Fisher 견적 응답 수신",        href: "/dashboard/quotes",                time: "10분 전", read: false },
    { id: 2, category: "approval_pending",  message: "Antibody Kit 구매 승인 요청",         href: "/dashboard/purchases",             time: "30분 전", read: false },
    { id: 3, category: "stock_alert",       message: "FBS 재고 부족 — 안전재고 이하",       href: "/dashboard/inventory?filter=low",   time: "1시간 전", read: false },
    { id: 4, category: "delivery_complete", message: "50ml Conical Tube 입고 완료",         href: "/dashboard/inventory",             time: "2시간 전", read: true },
    { id: 5, category: "expiry_warning",    message: "DMEM Medium D-3 만료 임박",           href: "/dashboard/inventory",             time: "어제",    read: true },
    { id: 6, category: "system",            message: "시스템 점검 완료",                     href: "/dashboard/settings",              time: "2일 전",  read: true },
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
      router.push(`/test/search?q=${encodeURIComponent(searchQuery.trim())}`);
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

  // ── 경량 알림 이벤트 피드 ──
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleEventClick = (notification: EventNotification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );
    setIsNotificationOpen(false);
    router.push(notification.href);
  };

  return (
    <header className="sticky top-0 z-50 h-14 md:h-16 border-b border-[#1e1e23] bg-[#0c0c0f]">
      <div className="flex h-full items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        {/* 좌측 영역: 모바일=로고, 데스크탑=브레드크럼 */}
        <div className="flex items-center gap-4 min-w-0 flex-shrink-0">
          {/* 로고 (모바일 전용 - 데스크탑은 고정 사이드바에서 표시) */}
          <Link href="/dashboard" className="flex-shrink-0 lg:hidden">
            <LabAxisLogo showText={true} />
          </Link>

          {/* 브레드크럼 (데스크탑 전용) */}
          <nav className="hidden md:flex items-center gap-1.5 text-sm text-slate-400 min-w-0">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href} className="flex items-center gap-1.5 min-w-0">
                {index > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                )}
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-sm text-slate-200 truncate">
                    {crumb.label}
                  </span>
                ) : index === 0 ? (
                  <Link
                    href={crumb.href}
                    className="flex items-center gap-1 hover:text-slate-100 transition-colors"
                  >
                    <Home className="h-3.5 w-3.5 flex-shrink-0" />
                  </Link>
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
              className="pl-9 h-9 bg-[#131316] border-[#242429] focus:bg-[#1a1a1e] w-full min-w-0 text-slate-100"
            />
          </div>

          {/* 검색 아이콘 (모바일 전용) — 클릭 시 검색 페이지 이동 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 md:hidden flex-shrink-0 p-2 text-slate-400 hover:text-slate-100 hover:bg-transparent transition-colors"
            onClick={() => router.push("/test/search")}
            aria-label="검색"
          >
            <Search className="h-5 w-5" />
          </Button>


          {/* 알림 드롭다운 — 경량 이벤트 피드 */}
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
                  <span className="absolute top-1 right-1 flex items-center justify-center h-4 min-w-[16px] rounded-full text-[10px] font-bold text-white px-0.5 bg-red-500">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[340px] min-w-[300px] p-0 shadow-xl">
              {/* 상단 */}
              <div className="px-3 py-2.5 border-b border-[#1e1e23]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-100">알림</span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                      className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      모두 읽음
                    </button>
                  )}
                </div>
              </div>

              {/* 이벤트 목록 */}
              <div className="max-h-[320px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-xs text-slate-500">새 알림이 없습니다</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/50">
                    {notifications.map((n) => {
                      const config = CATEGORY_CONFIG[n.category];
                      const Icon = config.icon;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleEventClick(n)}
                          className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#1a1a1e]/50 transition-colors ${
                            n.read ? "opacity-50" : ""
                          }`}
                        >
                          <Icon className={`h-4 w-4 flex-shrink-0 ${config.text}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-200 truncate">{n.message}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{n.time}</p>
                          </div>
                          {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 하단 */}
              <div className="border-t border-[#1e1e23] px-3 py-2">
                <Link
                  href="/dashboard/notifications"
                  onClick={() => setIsNotificationOpen(false)}
                  className="block text-center text-[11px] text-slate-500 hover:text-slate-300 py-1 transition-colors"
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
                className="h-10 w-10 md:h-9 md:w-9 flex-shrink-0 cursor-pointer p-2 text-slate-400 hover:text-blue-400 hover:bg-transparent transition-colors hidden lg:flex"
                aria-label="도움말"
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 min-w-[240px]">
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
              <button className="flex items-center gap-2 pl-3 border-l border-[#242429] flex-shrink-0 px-3 py-2 rounded-lg hover:bg-[#1a1a1e] transition-colors cursor-pointer min-h-[44px]">
                <Avatar className="h-8 w-8 border border-[#242429]">
                  <AvatarImage src={user?.image || undefined} alt={user?.name || "User"} />
                  <AvatarFallback className="bg-[#1a1a1e] text-blue-400 text-xs font-semibold">
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
            <DropdownMenuContent align="end" className="w-72 min-w-[280px] p-2">
              <DropdownMenuLabel className="p-3">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-slate-100">{user?.name || "사용자"}</p>
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="flex items-center gap-3 py-3 text-sm cursor-pointer">
                  <SlidersHorizontal className="h-4 w-4" />
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
                onClick={() => signOut({ callbackUrl: "/" })}
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
              className="h-11 w-11 flex-shrink-0 text-slate-400 hover:bg-[#1a1a1e] mobile-menu-button lg:hidden -mr-1"
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

