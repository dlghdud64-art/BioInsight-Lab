"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { resetWorkbenchSessionOnLogout, invalidateWorkbenchQueryCache } from "@/lib/auth/workbench-session-reset";
// §11.209d-notification-inapp-web-bell-ui — eventType → 7 카테고리 + 한국어
// text/href/time 매핑 helper. canonical truth = /api/notifications response.
import {
  eventTypeToCategory,
  buildNotificationText,
  buildNotificationHref,
  formatNotificationTime,
  type NotificationCategory as MappedCategory,
} from "@/lib/notifications/event-category-map";
import type { NotificationItem } from "@/lib/notifications/notification-query";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
// §11.295/§11.296 Radix DropdownMenu* import 제거 — Header.tsx 3 dropdown
// (도움말/프로필/알림) 모두 plain button + useState pattern 으로 swap 완료.
import { useQRScanner } from "@/contexts/QRScannerContext";
import { Search, Bell, HelpCircle, ChevronRight, AlertTriangle, FileText, BookOpen, Headphones, Settings, CreditCard, LogOut, ShieldAlert, Clock, CheckCircle2, ClipboardCheck, Menu, Package, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { BioInsightLogo } from "@/components/bioinsight-logo";
import { CommandPalette } from "@/components/dashboard/command-palette";
// §11.271 — DashboardShell 의 fixed FAB 에서 헤더 inline 으로 이동 (운영 브리핑 FAB
// 좌표 충돌 해소). overlay/store/handler 변경 0, button className 만 fixed → relative.
import { BarcodeScanFab } from "@/components/layout/barcode-scan-fab";
// §11.309d — placeholder → 실제 ScannerModal swap (호영님 P0 2026-05-26 backend MVP D)
// SmartReceivingPlaceholderModal 컴포넌트는 보존 (다른 future placeholder 재사용 가능).
import { useOpenModal } from "@/lib/store/modal-store";

interface DashboardHeaderProps {
  onMenuClick?: () => void;
}

/* ── 알림 타입 시스템 ── */
/* §11.209d-notification-inapp-web-bell-ui — NotificationCategory 는
   lib/notifications/event-category-map 의 동일 이름과 정합. CATEGORY_CONFIG
   key 와 매칭 (dead 카테고리 0). */

type NotificationCategory = MappedCategory;

/** 카테고리별 아이콘 + 컬러 + 배경색 매핑 */
const CATEGORY_CONFIG: Record<
  NotificationCategory,
  { icon: React.ElementType; tint: string; unreadTint: string; bg: string; unreadBg: string; label: string }
> = {
  stock_alert:       { icon: AlertTriangle,  tint: "text-slate-400", unreadTint: "text-red-500",    bg: "bg-slate-100", unreadBg: "bg-red-50",    label: "재고" },
  quote_arrived:     { icon: FileText,       tint: "text-slate-400", unreadTint: "text-blue-500",   bg: "bg-slate-100", unreadBg: "bg-blue-50",   label: "견적" },
  delivery_complete: { icon: Package,        tint: "text-slate-400", unreadTint: "text-emerald-500",bg: "bg-slate-100", unreadBg: "bg-emerald-50", label: "입고" },
  approval_pending:  { icon: ClipboardCheck, tint: "text-slate-400", unreadTint: "text-violet-500", bg: "bg-slate-100", unreadBg: "bg-violet-50",  label: "승인" },
  // §11.302d-6a-1 — §11.302 신호등 정합 swap.
  //   expiry_warning (만료) = 긴급/주의 → amber → yellow (의미 보존).
  //   safety_alert (안전) = 위험 강도 상승 → orange → red (강한 경고로 격상).
  expiry_warning:    { icon: Clock,          tint: "text-slate-400", unreadTint: "text-yellow-500", bg: "bg-slate-100", unreadBg: "bg-yellow-50",  label: "만료" },
  safety_alert:      { icon: ShieldAlert,    tint: "text-slate-400", unreadTint: "text-red-500",    bg: "bg-slate-100", unreadBg: "bg-red-50",     label: "안전" },
  system:            { icon: Bell,           tint: "text-slate-400", unreadTint: "text-slate-600",  bg: "bg-slate-100", unreadBg: "bg-slate-100",  label: "시스템" },
};

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const { open: openQRScanner } = useQRScanner();
  const openModal = useOpenModal();
  const [searchQuery, setSearchQuery] = useState("");
  // §11.209d-notification-inapp-web-bell-ui — /api/notifications 실시간
  // 데이터. actionType=IN_APP 만 필터 (EMAIL_DRAFT / QUEUE_ITEM 별도). 1분
  // 폴링 (refetchInterval) — 향후 SSE/WebSocket 별도 batch.
  const { data: notificationData } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?actionType=IN_APP&limit=20");
      if (!res.ok) throw new Error("알림 조회 실패");
      return (await res.json()) as {
        notifications: NotificationItem[];
        unreadCount: number;
        limit: number;
        offset: number;
      };
    },
    refetchInterval: 60_000,
  });
  const notifications: NotificationItem[] = notificationData?.notifications ?? [];

  // §11.209d-notification-inapp-web-bell-ui — 개별 read mutation
  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      if (!res.ok) throw new Error("읽음 처리 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  // §11.295 도움말 + 프로필 dropdown plain state — §11.283b 정합. 호영님
  // 환경 Radix DropdownMenu silent fail 차단 (preemptive). 알림 dropdown
  // 은 별도 batch (복잡 logic 보존).
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  // §11.371-3 — 글로벌 스캔 허브 진입점. Header 버튼 → openModal("scan_hub").
  //   (이전 §11.308a-v2 로컬 open state → 통합 모달 store 로 이관.)

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
      audit: "감사 추적", // §11.337 — 브레드크럼 영문 "Audit" 한글 통일
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

  // §11.209d-notification-inapp-web-bell-ui — server response 의 unreadCount
  // 직접 사용 (canonical). client-side filter 는 partial sync 시 drift 위험.
  const unreadCount = notificationData?.unreadCount ?? 0;

  // §11.209d-notification-inapp-web-bell-ui — "모두 읽음" 은 unread 항목
  // 일괄 POST. 별도 read-all API 신설 회피 (작은 surgical).
  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => n.readAt === null);
    if (unread.length === 0) return;
    try {
      await Promise.all(
        unread.map((n) =>
          fetch(`/api/notifications/${n.id}/read`, { method: "POST" }),
        ),
      );
    } finally {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  };

  // §11.209d-notification-inapp-web-bell-ui — 개별 알림 click. unread 시
  // mark as read mutation + entityType-based navigation.
  const handleNotificationClick = (notification: NotificationItem) => {
    if (notification.readAt === null) {
      markRead.mutate(notification.id);
    }
    setIsNotificationOpen(false);
    router.push(buildNotificationHref(notification));
  };

  /** 알림 카테고리 아이콘 (둥근 배경 박스 + 카테고리별 색상) */
  const renderCategoryIcon = (category: NotificationCategory, isRead: boolean) => {
    const config = CATEGORY_CONFIG[category];
    const Icon = config.icon;
    const color = isRead ? config.tint : config.unreadTint;
    const bg = isRead ? config.bg : config.unreadBg;
    return (
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${bg} flex-shrink-0`}>
        <Icon className={`h-4 w-4 ${color}`} strokeWidth={2} />
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-50 h-14 md:h-16 border-b border-slate-200 backdrop-blur-sm bg-white/97">
      <div className="flex h-full items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        {/* 좌측 영역: 모바일=로고, 데스크탑=브레드크럼 */}
        <div className="flex items-center gap-4 min-w-0 flex-shrink-0">
          {/* 로고 (모바일 전용 - 데스크탑은 고정 사이드바에서 표시) */}
          {/* §11.254 — LabAxis 로고 destination 변경 (/dashboard → /).
              호영님 spec: "LabAxis" 로고는 메인 홈페이지 (labaxis.co.kr 루트)
              으로 이동. 소싱/대시보드/견적/재고/구매 운영 모든 서비스 영역에서
              동일 적용. 사유: 소싱은 구매 운영 대시보드와 별개 서비스 영역이며,
              사용자는 로고를 "최상위 홈" 으로 인지. /dashboard 는 사용자가 사이드바
              또는 검색으로 이동.
              #mobile-header-logo-home-link (이전) — 로고 탭 시 홈 이동 버그 fix
              (Link 자체 height/padding 0 → 터치 영역 ~28px) 가 본 fix 의 기반.
              min-h/min-w-[44px] + px-3 -mx-3 + hover/active + aria-label 보존. */}
          <Link
            href="/"
            className="flex-shrink-0 lg:hidden inline-flex items-center min-h-[44px] min-w-[44px] px-3 -mx-3 rounded-md hover:bg-slate-100 active:bg-slate-200 transition-colors"
            aria-label="LabAxis 홈으로 이동"
          >
            <span className="text-xl font-bold tracking-tight text-slate-900">LabAxis</span>
          </Link>

          {/* 브레드크럼 (데스크탑 전용) */}
          <nav
            className="hidden md:flex items-center gap-1.5 text-sm text-slate-500 min-w-0"
            aria-label="현재 위치"
          >
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href} className="flex items-center gap-1.5 min-w-0">
                {index > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                )}
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-normal text-sm text-slate-900 truncate">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="hover:text-slate-900 truncate transition-colors"
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
          {/* 전역 검색 + 커맨드 팔레트 (데스크톱) */}
          <CommandPalette />

          {/* 검색 아이콘 (모바일 전용) — 클릭 시 검색 페이지 이동 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 md:hidden flex-shrink-0 p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            onClick={() => router.push("/app/search")}
            aria-label="검색"
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* §11.271 — 바코드 스캔 모바일 trigger (BarcodeScanFab inline mount).
              운영 브리핑 FAB (bottom-[72px] right-4) 와 좌표 충돌 해소.
              component 안에 overlay/store/handler 그대로 보존, button 만 relative
              헤더 inline 으로 표시. lg:hidden 보존 (mobile only).
              §11.276 production env-gated (NEXT_PUBLIC_FEATURE_BARCODE_SCAN_MOCK)
              — production 노출 0, dev/staging mock 만. */}
          <BarcodeScanFab />

          {/* §11.371-3 — 글로벌 스캔 허브 진입점 (검색~알림 사이).
              1탭 → scan_hub picker(라벨 직접등록 / 거래명세서 입고 / QR 조회). */}
          <button
            type="button"
            data-testid="header-scan-entry"
            aria-label="스캔"
            onClick={() => {
              // §11.371-1 — 미인증/세션 만료 시 doomed 모달 open 대신 재로그인 유도.
              if (status !== "authenticated") {
                const cb = encodeURIComponent(window.location.pathname + window.location.search);
                router.push(`/auth/signin?callbackUrl=${cb}`);
                return;
              }
              openModal("scan_hub");
            }}
            className="inline-flex items-center justify-center h-10 w-10 md:h-9 md:w-9 flex-shrink-0 p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
          >
            <ScanLine className="h-5 w-5 pointer-events-none" />
          </button>


          {/* §11.296 알림 dropdown — Radix 제거 + plain button + useState
              (호영님 §11.283b/§11.295 패턴 정합, preemptive Radix silent
              fail 차단). Header.tsx 3 dropdown 마지막 단순화. notifications
              list + unreadCount + handleMarkAllRead + handleNotificationClick
              + helper 함수 모두 보존 — UI render layer 만 swap. */}
          <div className="relative">
            <button
              type="button"
              aria-label="알림"
              aria-expanded={isNotificationOpen}
              aria-haspopup="menu"
              onClick={() => setIsNotificationOpen((v) => !v)}
              className="inline-flex items-center justify-center h-10 w-10 md:h-9 md:w-9 relative flex-shrink-0 p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              <Bell className="h-5 w-5 pointer-events-none" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 text-[10px] font-bold rounded-full bg-blue-600 text-white ring-2 ring-white pointer-events-none">
                  {unreadCount}
                </span>
              )}
            </button>
            {isNotificationOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsNotificationOpen(false)} aria-hidden="true" />
                <div
                  role="menu"
                  aria-label="알림 메뉴"
                  // §11.372 — 알림 패널 모바일 클리핑 fix. 햄버거(<Menu> lg:hidden)가
                  //   종 우측에 있어 종은 모바일 최우측이 아님. 기존 absolute right-0 +
                  //   뷰포트폭(§11.359-2)은 폭만 맞추고 trigger(종)에 우측정렬돼 패널이
                  //   왼쪽으로 ~36px overflow → "림" 잘림. 모바일은 trigger 분리 후
                  //   viewport 고정(fixed left-3 right-3 top-14, 헤더 h-14 바로 아래),
                  //   md+는 기존 종 기준 absolute right-0 top-full 복원(데스크톱 무회귀).
                  className="fixed left-3 right-3 top-14 md:absolute md:left-auto md:right-0 md:top-full md:mt-2 w-auto md:w-[380px] max-w-[380px] p-0 bg-white shadow-2xl shadow-slate-300/40 border border-slate-200 rounded-xl overflow-hidden z-50"
                >
              {/* 헤더 */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold text-slate-900">알림</span>
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[11px] font-bold rounded-full bg-blue-600 text-white">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    모두 읽음
                  </button>
                )}
              </div>

              {/* 알림 목록 */}
              <div
                className="max-h-[420px] overflow-y-auto"
                style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}
              >
                {notifications.length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">새 알림이 없습니다</p>
                    <p className="text-xs text-slate-400 mt-1">모든 알림을 확인했습니다</p>
                  </div>
                ) : (
                  notifications.slice(0, 8).map((n, idx) => {
                    // §11.209d-notification-inapp-web-bell-ui — eventType →
                    // 7 카테고리 + readAt boolean + helper 의 text/href/time.
                    const category = eventTypeToCategory(n.event.eventType);
                    const isRead = n.readAt !== null;
                    const config = CATEGORY_CONFIG[category];
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={`w-full text-left flex items-start gap-3 px-5 py-3.5 transition-colors relative
                          ${!isRead ? "bg-blue-50/40 hover:bg-blue-50/70" : "hover:bg-slate-50"}
                          ${idx < notifications.slice(0, 8).length - 1 ? "border-b border-slate-100" : ""}
                        `}
                      >
                        {/* 카테고리 아이콘 박스 */}
                        {renderCategoryIcon(category, isRead)}

                        {/* 텍스트 영역 */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className={`text-[13px] leading-snug line-clamp-2 ${isRead ? "text-slate-500" : "text-slate-900 font-medium"}`}>
                            {buildNotificationText(n)}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${!isRead ? config.unreadBg + " " + config.unreadTint : "bg-slate-100 text-slate-400"}`}>
                              {config.label}
                            </span>
                            <span className="text-[11px] text-slate-400">{formatNotificationTime(n.createdAt)}</span>
                          </div>
                        </div>

                        {/* 미독 파란 점 */}
                        {!isRead && (
                          <span className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* 푸터 */}
              <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-center">
                <Link
                  href="/dashboard/notifications"
                  onClick={() => setIsNotificationOpen(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
                >
                  전체 알림 보기
                </Link>
              </div>
                </div>
              </>
            )}
          </div>

          {/* §11.295 도움말 dropdown — Radix 제거 + plain button + useState
              (호영님 §11.283b 패턴 정합, preemptive Radix silent fail 차단). */}
          <div className="relative hidden md:block">
            <button
              type="button"
              aria-label="도움말"
              aria-expanded={isHelpOpen}
              aria-haspopup="menu"
              onClick={() => setIsHelpOpen((v) => !v)}
              className="inline-flex items-center justify-center h-10 w-10 md:h-9 md:w-9 flex-shrink-0 p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              <HelpCircle className="h-5 w-5 pointer-events-none" />
            </button>
            {isHelpOpen && (() => {
              const isOnSupportCenter = pathname?.startsWith("/dashboard/support-center") ?? false;
              const fromParam = !isOnSupportCenter && pathname ? `&from=${encodeURIComponent(pathname)}` : "";
              return (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsHelpOpen(false)} aria-hidden="true" />
                  <div role="menu" aria-label="도움말 메뉴" className="absolute right-0 top-full mt-2 w-64 min-w-[240px] rounded-md border border-slate-200 bg-white shadow-xl shadow-slate-200/50 z-50 py-1">
                    <Link
                      href={`/dashboard/support-center?tab=manual${fromParam}`}
                      role="menuitem"
                      onClick={() => setIsHelpOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <BookOpen className="h-4 w-4" />
                      운영 매뉴얼
                    </Link>
                    <Link
                      href={`/dashboard/support-center?tab=troubleshoot${fromParam}`}
                      role="menuitem"
                      onClick={() => setIsHelpOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <HelpCircle className="h-4 w-4" />
                      문제 해결 런북
                    </Link>
                    <Link
                      href={`/dashboard/support-center?tab=ticket${fromParam}`}
                      role="menuitem"
                      onClick={() => setIsHelpOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <Headphones className="h-4 w-4" />
                      지원 티켓
                    </Link>
                  </div>
                </>
              );
            })()}
          </div>

          {/* §11.295 프로필 dropdown — Radix 제거 + plain button + useState
              (호영님 §11.283b 패턴 정합, preemptive Radix silent fail 차단). */}
          <div className="hidden lg:block relative">
            <button
              type="button"
              aria-label="사용자 프로필 메뉴"
              aria-expanded={isProfileOpen}
              aria-haspopup="menu"
              onClick={() => setIsProfileOpen((v) => !v)}
              className="flex items-center gap-2 pl-3 border-l border-slate-200 flex-shrink-0 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer min-h-[44px]"
            >
              <Avatar className="h-8 w-8 border border-slate-200">
                <AvatarImage src={user?.image || undefined} alt={user?.name || "User"} />
                <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-semibold">
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
                <div className="text-sm font-medium text-slate-900 truncate">
                  {user?.name || "사용자"}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {user?.email}
                </div>
              </div>
            </button>
            {isProfileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} aria-hidden="true" />
                <div role="menu" aria-label="프로필 메뉴" className="absolute right-0 top-full mt-2 w-72 min-w-[280px] rounded-md border border-slate-200 bg-white shadow-xl shadow-slate-200/50 z-50 p-2">
                  <div className="px-3 py-3">
                    <p className="text-sm font-medium text-slate-900">{user?.name || "사용자"}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <div className="h-px bg-slate-100 my-1" />
                  <Link
                    href="/dashboard/settings"
                    role="menuitem"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 text-sm text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                  >
                    <Settings className="h-4 w-4" />
                    설정
                  </Link>
                  <Link
                    href="/dashboard/settings?tab=billing"
                    role="menuitem"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 text-sm text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                  >
                    <CreditCard className="h-4 w-4" />
                    청구 및 구독
                  </Link>
                  <a
                    href="mailto:support@labaxis.io"
                    role="menuitem"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 text-sm text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                  >
                    <HelpCircle className="h-4 w-4" />
                    고객센터
                  </a>
                  <div className="h-px bg-slate-100 my-1" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsProfileOpen(false);
                      resetWorkbenchSessionOnLogout();
                      invalidateWorkbenchQueryCache(queryClient);
                      signOut({ callbackUrl: "/" });
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 text-sm text-red-400 hover:bg-red-50 rounded-md cursor-pointer text-left"
                  >
                    <LogOut className="h-4 w-4" />
                    로그아웃
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 햄버거 버튼 (모바일/태블릿 전용 - 데스크탑은 고정 사이드바)
              §11.282-a #dashboard-header-menu-icon-pointer-events-none — 대시보드
              햄버거 SVG icon hit-test trap (§11.280-2 와 동일 root cause, application-
              wide 회귀 첫 발견). <Menu /> SVG 가 PointerEvent target 으로 trap 되면
              Button 의 onClick handler 미발화. `pointer-events-none` 강제 → SVG hit-
              test 제외 → click 이 직접 Button 으로 dispatch. (호영님 iOS Safari P0+) */}
          {onMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 flex-shrink-0 text-slate-500 hover:bg-slate-100 mobile-menu-button lg:hidden -mr-1"
              onClick={onMenuClick}
              aria-label="메뉴 열기"
            >
              <Menu className="h-5 w-5 pointer-events-none" />
            </Button>
          )}
        </div>
      </div>

      {/* §11.371-3 — 스캔 허브/하위 모달은 전역 GlobalModal(modal store)이 렌더.
          Header 는 진입 트리거(openModal)만 담당. */}
    </header>
  );
}

