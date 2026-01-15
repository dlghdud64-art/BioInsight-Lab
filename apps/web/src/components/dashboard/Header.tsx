"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Menu, Search, Bell, HelpCircle, ChevronRight, AlertTriangle, FileText, Truck } from "lucide-react";

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

  // 브레드크럼 생성
  const generateBreadcrumbs = () => {
    const paths = pathname?.split("/").filter(Boolean) || [];
    const breadcrumbs = [{ label: "Home", href: "/" }];

    let currentPath = "";
    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      const label = path
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      breadcrumbs.push({
        label: index === 0 ? "Dashboard" : label,
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
    <header className="sticky top-0 z-50 h-16 border-b border-slate-200 bg-white">
      <div className="flex h-full items-center justify-between px-8">
        {/* 좌측 영역: 브레드크럼 + 햄버거 메뉴 */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* 모바일 햄버거 메뉴 */}
          {onMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 flex-shrink-0"
              onClick={onMenuClick}
              aria-label="메뉴 열기"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          {/* 브레드크럼 */}
          <nav className="hidden md:flex items-center gap-1.5 text-sm text-slate-600 min-w-0">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href} className="flex items-center gap-1.5 min-w-0">
                {index > 0 && (
                  <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                )}
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-slate-900 truncate">
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

          {/* 모바일에서 현재 페이지만 표시 */}
          <div className="md:hidden text-sm font-medium text-slate-900 truncate">
            {breadcrumbs[breadcrumbs.length - 1]?.label || "Dashboard"}
          </div>
        </div>

        {/* 중앙/우측 영역: 검색창 + 유틸리티 + 프로필 */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* 전역 검색창 */}
          <div className="hidden lg:flex items-center relative w-64 xl:w-96">
            <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              type="search"
              placeholder="시약, 재고 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              className="pl-9 h-9 bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>

          {/* 모바일 검색 아이콘 */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9"
            aria-label="검색"
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* 알림 드롭다운 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 relative"
                aria-label="알림"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500"></span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="p-3 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">알림</h3>
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
                        className="p-3 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start gap-4">
                          {renderNotificationIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">
                              {notification.title}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
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

          {/* 도움말 드롭다운 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 cursor-pointer hover:text-blue-600 transition-colors"
                aria-label="도움말"
              >
                <HelpCircle className="h-5 w-5 text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link
                  href="/help/guide"
                  className="flex items-center gap-2 w-full cursor-pointer"
                >
                  <span>📖</span>
                  <span>이용 가이드</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/help/faq"
                  className="flex items-center gap-2 w-full cursor-pointer"
                >
                  <span>❓</span>
                  <span>자주 묻는 질문</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/help/support"
                  className="flex items-center gap-2 w-full cursor-pointer"
                >
                  <span>🎧</span>
                  <span>1:1 문의하기</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 사용자 프로필 */}
          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            <Avatar className="h-8 w-8">
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
            <div className="hidden xl:block min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">
                {user?.name || "사용자"}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {user?.email}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

