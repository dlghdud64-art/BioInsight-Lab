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
  Menu, Search, Bell, HelpCircle, ChevronRight,
  AlertTriangle, FileText, Truck, BookOpen, Headphones,
  Settings, CreditCard, LogOut, ScanLine,
  Package, ShieldAlert, Clock, CheckCircle2, ArrowRight,
  Flame, ClipboardCheck,
} from "lucide-react";
import { BioInsightLogo } from "@/components/bioinsight-logo";

interface DashboardHeaderProps {
  onMenuClick?: () => void;
}

/* ── 알림 타입 시스템 (운영 미니 작업 허브) ── */

type NotificationCategory =
  | "stock_alert"      // 재고 부족
  | "quote_arrived"    // 견적 도착
  | "delivery_complete"// 입고 완료
  | "approval_pending" // 승인 대기
  | "expiry_warning"   // 유효기간 경고
  | "safety_alert"     // 안전 관련
  | "system";          // 시스템

type NotificationPriority = "urgent" | "normal";
type ProcessingStatus = "pending" | "completed";

interface TaskNotification {
  id: number;
  category: NotificationCategory;
  priority: NotificationPriority;
  status: ProcessingStatus;
  /** 유형 라벨 (예: "재고 부족") */
  typeLabel: string;
  /** 대상 이름 (예: "FBS", "Thermo Fisher") */
  targetName: string;
  /** 상태/긴급도 (예: "남은 수량 1개") */
  statusText: string;
  /** 다음 액션 안내 (예: "재발주 필요") */
  nextAction: string;
  /** CTA 버튼 텍스트 */
  ctaLabel: string;
  /** CTA 클릭 시 이동 경로 */
  ctaHref: string;
  /** 발생 시간 */
  time: string;
}

/** 카테고리별 아이콘/색상 매핑 */
const CATEGORY_CONFIG: Record<
  NotificationCategory,
  { icon: React.ElementType; bg: string; text: string; darkBg: string; darkText: string; label: string }
> = {
  stock_alert:       { icon: AlertTriangle, bg: "bg-red-100",    text: "text-red-600",    darkBg: "dark:bg-red-950/40",    darkText: "dark:text-red-400",    label: "재고 부족" },
  quote_arrived:     { icon: FileText,      bg: "bg-blue-100",   text: "text-blue-600",   darkBg: "dark:bg-blue-950/40",   darkText: "dark:text-blue-400",   label: "견적 도착" },
  delivery_complete: { icon: Truck,         bg: "bg-emerald-100",text: "text-emerald-600",darkBg: "dark:bg-emerald-950/40",darkText: "dark:text-emerald-400",label: "입고 완료" },
  approval_pending:  { icon: ClipboardCheck,bg: "bg-amber-100",  text: "text-amber-600",  darkBg: "dark:bg-amber-950/40",  darkText: "dark:text-amber-400",  label: "승인 대기" },
  expiry_warning:    { icon: Clock,         bg: "bg-orange-100", text: "text-orange-600", darkBg: "dark:bg-orange-950/40", darkText: "dark:text-orange-400", label: "유효기간 경고" },
  safety_alert:      { icon: ShieldAlert,   bg: "bg-purple-100", text: "text-purple-600", darkBg: "dark:bg-purple-950/40", darkText: "dark:text-purple-400", label: "안전 관리" },
  system:            { icon: Bell,          bg: "bg-slate-100",  text: "text-slate-600",  darkBg: "dark:bg-slate-800",     darkText: "dark:text-slate-400",  label: "시스템" },
};

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { open: openQRScanner } = useQRScanner();
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<TaskNotification[]>([
    {
      id: 1,
      category: "stock_alert",
      priority: "urgent",
      status: "pending",
      typeLabel: "재고 부족",
      targetName: "FBS (Fetal Bovine Serum)",
      statusText: "남은 수량 1개 · 안전재고 5개",
      nextAction: "재발주 필요",
      ctaLabel: "재발주 보기",
      ctaHref: "/dashboard/inventory?filter=low",
      time: "10분 전",
    },
    {
      id: 2,
      category: "expiry_warning",
      priority: "urgent",
      status: "pending",
      typeLabel: "유효기간 경고",
      targetName: "DMEM Medium (Lot #2024-A12)",
      statusText: "D-3일 후 만료",
      nextAction: "사용 또는 재주문",
      ctaLabel: "재고 확인",
      ctaHref: "/dashboard/inventory",
      time: "30분 전",
    },
    {
      id: 3,
      category: "approval_pending",
      priority: "urgent",
      status: "pending",
      typeLabel: "승인 대기",
      targetName: "Antibody Kit 구매 요청",
      statusText: "₩1,250,000 · 김연구원 요청",
      nextAction: "승인 필요",
      ctaLabel: "승인하기",
      ctaHref: "/dashboard/purchases",
      time: "1시간 전",
    },
    {
      id: 4,
      category: "quote_arrived",
      priority: "normal",
      status: "pending",
      typeLabel: "견적 도착",
      targetName: "Thermo Fisher 외 2건",
      statusText: "3개 벤더 견적 비교 가능",
      nextAction: "견적 확인 필요",
      ctaLabel: "견적 확인",
      ctaHref: "/dashboard/quotes",
      time: "2시간 전",
    },
    {
      id: 5,
      category: "delivery_complete",
      priority: "normal",
      status: "pending",
      typeLabel: "입고 완료",
      targetName: "50ml Conical Tube (100개)",
      statusText: "배송 완료 · 검수 대기",
      nextAction: "재고 반영 필요",
      ctaLabel: "재고 반영",
      ctaHref: "/dashboard/inventory",
      time: "어제",
    },
    {
      id: 6,
      category: "safety_alert",
      priority: "normal",
      status: "completed",
      typeLabel: "안전 관리",
      targetName: "에탄올 (Ethanol, 99.5%)",
      statusText: "MSDS 미등록",
      nextAction: "MSDS 등록 권장",
      ctaLabel: "MSDS 등록",
      ctaHref: "/dashboard/safety",
      time: "2일 전",
    },
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

  // ── 알림 집계 ──
  const pendingNotifications = notifications.filter((n) => n.status === "pending");
  const urgentCount = pendingNotifications.filter((n) => n.priority === "urgent").length;
  const todayActionCount = pendingNotifications.length;

  // 긴급 → 일반 순, 각 그룹 내에서 미처리 우선
  const sortedNotifications = [...notifications].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
    if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
    return 0;
  });

  const urgentNotifications = sortedNotifications.filter((n) => n.priority === "urgent");
  const normalNotifications = sortedNotifications.filter((n) => n.priority === "normal");

  const handleMarkAllCompleted = () => {
    // TODO: PATCH /api/notifications/complete-all
    setNotifications((prev) => prev.map((n) => ({ ...n, status: "completed" as ProcessingStatus })));
  };

  const handleNotificationCTA = (e: React.MouseEvent, notification: TaskNotification) => {
    e.stopPropagation();
    // 처리 완료로 변경
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, status: "completed" as ProcessingStatus } : n))
    );
    setIsNotificationOpen(false);
    router.push(notification.ctaHref);
  };

  const handleNotificationClick = (notification: TaskNotification) => {
    setIsNotificationOpen(false);
    router.push(notification.ctaHref);
  };

  /** 알림 아이콘 렌더링 */
  const renderCategoryIcon = (category: NotificationCategory, size: "sm" | "md" = "md") => {
    const config = CATEGORY_CONFIG[category];
    const Icon = config.icon;
    const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
    const padSize = size === "sm" ? "p-1.5" : "p-2";
    return (
      <div className={`flex-shrink-0 rounded-lg ${config.bg} ${config.darkBg} ${padSize}`}>
        <Icon className={`${iconSize} ${config.text} ${config.darkText}`} />
      </div>
    );
  };

  /** 단일 알림 아이템 렌더링 */
  const renderNotificationItem = (notification: TaskNotification) => {
    const isCompleted = notification.status === "completed";
    const isUrgent = notification.priority === "urgent";

    return (
      <button
        key={notification.id}
        type="button"
        onClick={() => handleNotificationClick(notification)}
        className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 min-w-0 transition-colors touch-manipulation group ${
          isCompleted
            ? "opacity-50 hover:opacity-70 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
            : isUrgent
            ? "bg-red-50/30 dark:bg-red-950/10 hover:bg-red-50/60 dark:hover:bg-red-950/20"
            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
        }`}
      >
        {renderCategoryIcon(notification.category, "sm")}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* 1행: 유형 라벨 + 상태 배지 */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${
              CATEGORY_CONFIG[notification.category].text
            } ${CATEGORY_CONFIG[notification.category].darkText}`}>
              {notification.typeLabel}
            </span>
            {isUrgent && !isCompleted && (
              <Badge variant="destructive" className="h-3.5 px-1 text-[9px] font-bold leading-none rounded-sm">
                긴급
              </Badge>
            )}
            {isCompleted && (
              <Badge variant="secondary" className="h-3.5 px-1 text-[9px] font-medium leading-none rounded-sm bg-slate-200 dark:bg-slate-700">
                완료
              </Badge>
            )}
          </div>
          {/* 2행: 대상 이름 */}
          <p className={`text-xs font-medium truncate ${
            isCompleted
              ? "text-slate-400 dark:text-slate-500 line-through"
              : "text-slate-900 dark:text-slate-100"
          }`}>
            {notification.targetName}
          </p>
          {/* 3행: 상태 텍스트 + 시간 */}
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {notification.statusText}
            <span className="mx-1 text-slate-300 dark:text-slate-600">·</span>
            {notification.time}
          </p>
          {/* 4행: 다음 액션 + CTA 버튼 */}
          {!isCompleted && (
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                → {notification.nextAction}
              </span>
              <button
                type="button"
                onClick={(e) => handleNotificationCTA(e, notification)}
                className={`flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                  isUrgent
                    ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50"
                    : "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50"
                }`}
              >
                {notification.ctaLabel}
                <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="flex h-full items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        {/* 좌측 영역: 모바일=로고, 데스크탑=브레드크럼 */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* 로고 (모바일 전용 - 데스크탑은 고정 사이드바에서 표시) */}
          <Link href="/" className="flex-shrink-0 lg:hidden">
            <BioInsightLogo showText={true} />
          </Link>

          {/* 브레드크럼 (데스크탑 전용) */}
          <nav className="hidden md:flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 min-w-0">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href} className="flex items-center gap-1.5 min-w-0">
                {index > 0 && (
                  <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                )}
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="hover:text-slate-900 dark:hover:text-slate-100 truncate transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* 중앙/우측 영역: 검색창 + 유틸리티 + 프로필 */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 sm:flex-initial sm:justify-end">
          {/* 전역 검색창: 데스크톱 전용 (모바일은 하단 플로팅 검색 사용) */}
          <div className="hidden md:flex items-center relative flex-1 md:flex-initial w-full min-w-0 md:w-56 lg:w-64 xl:w-96">
            <Search className="absolute left-3 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none flex-shrink-0" />
            <Input
              type="search"
              placeholder="시약, 재고 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              className="pl-9 h-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 w-full min-w-0 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* QR 스캔 버튼 - 모바일 전용 */}
          <div className="md:hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 flex-shrink-0 p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-transparent dark:hover:bg-transparent transition-colors"
                  aria-label="QR 스캔"
                  title="QR 스캔 (단축키: Ctrl+Q)"
                  onClick={openQRScanner}
                >
                  <ScanLine className="h-5 w-5" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>QR 스캔 (단축키: Ctrl+Q)</TooltipContent>
            </Tooltip>
          </div>

          {/* 알림 드롭다운 — 운영 미니 작업 허브 */}
          <DropdownMenu open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 md:h-9 md:w-9 relative flex-shrink-0 p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-transparent dark:hover:bg-transparent"
                aria-label="알림"
              >
                <Bell className="h-5 w-5" />
                {todayActionCount > 0 && (
                  <span className={`absolute top-1 right-1 flex items-center justify-center h-4 min-w-[16px] rounded-full text-[10px] font-bold text-white px-0.5 ${
                    urgentCount > 0 ? "bg-red-500 animate-pulse" : "bg-blue-500"
                  }`}>
                    {todayActionCount > 9 ? "9+" : todayActionCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[360px] min-w-[320px] p-0 shadow-xl">
              {/* ── 상단 요약 바 ── */}
              <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    작업 알림
                  </h3>
                  {pendingNotifications.length > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllCompleted}
                      className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors cursor-pointer"
                    >
                      모두 완료 처리
                    </button>
                  )}
                </div>
                {/* 요약 카운터 */}
                <div className="flex items-center gap-3">
                  {urgentCount > 0 && (
                    <div className="flex items-center gap-1">
                      <Flame className="h-3 w-3 text-red-500" />
                      <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                        긴급 {urgentCount}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <ClipboardCheck className="h-3 w-3 text-slate-400" />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      오늘 처리 필요 {todayActionCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── 알림 목록 ── */}
              <div className="max-h-[420px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="h-8 w-8 text-emerald-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">모든 작업이 처리되었습니다</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">새 알림이 발생하면 여기에 표시됩니다</p>
                  </div>
                ) : (
                  <>
                    {/* 긴급 알림 그룹 */}
                    {urgentNotifications.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 bg-red-50/50 dark:bg-red-950/10 border-b border-red-100 dark:border-red-900/30">
                          <span className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
                            <Flame className="h-3 w-3" />
                            긴급 처리
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100/80 dark:divide-slate-800/40">
                          {urgentNotifications.map(renderNotificationItem)}
                        </div>
                      </div>
                    )}

                    {/* 일반 알림 그룹 */}
                    {normalNotifications.length > 0 && (
                      <div>
                        {urgentNotifications.length > 0 && (
                          <div className="px-3 py-1.5 bg-slate-50/50 dark:bg-slate-900/30 border-y border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                              일반
                            </span>
                          </div>
                        )}
                        <div className="divide-y divide-slate-100/80 dark:divide-slate-800/40">
                          {normalNotifications.map(renderNotificationItem)}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ── 하단 링크 바 ── */}
              {notifications.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30">
                  <div className="flex items-center divide-x divide-slate-200 dark:divide-slate-700">
                    <Link
                      href="/dashboard/notifications"
                      onClick={() => setIsNotificationOpen(false)}
                      className="flex-1 text-center text-[11px] font-medium py-2.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                    >
                      전체 알림 보기
                    </Link>
                    <Link
                      href="/dashboard/notifications?tab=pending"
                      onClick={() => setIsNotificationOpen(false)}
                      className="flex-1 text-center text-[11px] font-medium py-2.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                    >
                      작업함 보기
                    </Link>
                  </div>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 도움말 드롭다운 (sm 미만에서 공간 부족 시 숨김) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 md:h-9 md:w-9 flex-shrink-0 cursor-pointer p-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:bg-transparent dark:hover:bg-transparent transition-colors hidden sm:flex"
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

          {/* 사용자 프로필 - 클릭 시 메뉴 (모바일 터치 영역 확대) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200 dark:border-slate-700 flex-shrink-0 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px] touch-manipulation">
                <Avatar className="h-8 w-8 border border-slate-200 dark:border-slate-700">
                  <AvatarImage src={user?.image || undefined} alt={user?.name || "User"} />
                  <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-semibold">
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
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {user?.name || "사용자"}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user?.email}
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 min-w-[280px] p-2">
              <DropdownMenuLabel className="p-3">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user?.name || "사용자"}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
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
              <a href="mailto:support@bioinsight.com">
                <DropdownMenuItem className="flex items-center gap-3 py-3 text-sm cursor-pointer">
                  <HelpCircle className="h-4 w-4" />
                  고객센터
                </DropdownMenuItem>
              </a>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-3 py-3 text-sm cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 햄버거 버튼 (모바일/태블릿 전용 - 데스크탑은 고정 사이드바) */}
          {onMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 flex-shrink-0 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 mobile-menu-button lg:hidden"
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

