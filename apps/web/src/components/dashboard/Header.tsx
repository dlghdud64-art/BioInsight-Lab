"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
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
import { Menu, Search, Bell, HelpCircle, ChevronRight, AlertTriangle, FileText, Truck, BookOpen, Headphones, Settings, CreditCard, LogOut } from "lucide-react";

interface DashboardHeaderProps {
  onMenuClick?: () => void;
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");

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
      purchases: "구매 내역",
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

  // 알림 아이콘 렌더링 함수
  const renderNotificationIcon = (type: string) => {
    switch (type) {
      case "alert":
        return (
          <div className="flex-shrink-0 rounded-md bg-red-100 p-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
        );
      case "quote":
        return (
          <div className="flex-shrink-0 rounded-md bg-blue-100 p-2">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
        );
      case "delivery":
        return (
          <div className="flex-shrink-0 rounded-md bg-green-100 p-2">
            <Truck className="h-4 w-4 text-green-600" />
          </div>
        );
      default:
        return null;
    }
  };

  // 알림 데이터 (Dummy Data)
  const notifications = [
    {
      id: 1,
      type: "alert",
      title: "재고 부족: FBS (남은 수량 1개)",
      time: "10분 전",
    },
    {
      id: 2,
      type: "quote",
      title: "견적 도착: Thermo Fisher 외 2건",
      time: "1시간 전",
    },
    {
      id: 3,
      type: "delivery",
      title: "입고 완료: 50ml Conical Tube",
      time: "어제",
    },
  ];

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="flex h-full items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        {/* 좌측 영역: 브레드크럼 + 햄버거 메뉴 */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* 모바일/태블릿 햄버거 메뉴 (lg 미만에서 사이드바 대신 표시) */}
          {onMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9 flex-shrink-0 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={onMenuClick}
              aria-label="메뉴 열기"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          {/* 브레드크럼 */}
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

          {/* 모바일에서 현재 페이지만 표시 */}
          <div className="md:hidden text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {breadcrumbs[breadcrumbs.length - 1]?.label || "Dashboard"}
          </div>
        </div>

        {/* 중앙/우측 영역: 검색창 + 유틸리티 + 프로필 */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial sm:justify-end">
          {/* 전역 검색창: 모바일 전체 확장, 데스크톱 고정 너비 */}
          <div className="flex items-center relative flex-1 md:flex-initial w-full min-w-0 md:w-56 lg:w-64 xl:w-96">
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

          {/* 알림 드롭다운 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 relative flex-shrink-0 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="알림"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500"></span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 min-w-[280px] p-0">
              <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">알림</h3>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-slate-500">새로운 알림이 없습니다</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="p-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation"
                    >
                        <div className="flex items-start gap-4 min-w-0">
                          {renderNotificationIcon(notification.type)}
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                              {notification.title}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {notification.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {notifications.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      href="/dashboard/notifications"
                      className="block w-full text-center text-xs py-2 text-slate-500 hover:text-blue-600 cursor-pointer hover:bg-slate-50"
                    >
                      모든 알림 보기
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 도움말 드롭다운 (sm 미만에서 공간 부족 시 숨김) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-shrink-0 cursor-pointer text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:flex"
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
        </div>
      </div>
    </header>
  );
}

