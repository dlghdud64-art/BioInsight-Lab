"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ClipboardList,
  Package,
  AlertTriangle,
  Settings,
  Activity,
  ShieldCheck,
  BarChart3,
  Wallet,
  FileBarChart,
  Building2,
  Shield,
  LogOut,
  LayoutDashboard,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MoreMenuItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  // §11.359-2 — startsWith 매칭이 "/dashboard"(홈)에 과활성되지 않도록 정확 매칭 옵션.
  exact?: boolean;
}

const menuGroups: { title: string; items: MoreMenuItem[] }[] = [
  {
    // §11.359-2 — 더보기 시트 출구: 대시보드(홈) 직행 항목. 시트 갇힘 시 홈 복귀 동선.
    title: "바로가기",
    items: [
      { label: "대시보드", href: "/dashboard", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    title: "운영",
    items: [
      { label: "발주 전환 큐", href: "/dashboard/orders", icon: ClipboardList },
      { label: "발주", href: "/dashboard/purchase-orders", icon: ClipboardList },
      { label: "입고", href: "/dashboard/receiving", icon: Package },
      { label: "재고 위험", href: "/dashboard/stock-risk", icon: AlertTriangle },
    ],
  },
  {
    title: "분석 및 관리",
    items: [
      { label: "리포트", href: "/dashboard/reports", icon: FileBarChart },
      { label: "예산 관리", href: "/dashboard/budget", icon: Wallet },
      { label: "분석", href: "/dashboard/analytics", icon: BarChart3 },
      { label: "조직 관리", href: "/dashboard/organizations", icon: Building2 },
      { label: "안전 관리", href: "/dashboard/safety", icon: Shield },
    ],
  },
  {
    title: "시스템",
    items: [
      { label: "설정", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

const adminItems: MoreMenuItem[] = [
  { label: "활동 로그", href: "/dashboard/activity-logs", icon: Activity },
  { label: "감사 추적", href: "/dashboard/audit", icon: ShieldCheck },
];

export function BottomNavMoreSheet({ open, onOpenChange }: MoreSheetProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const userRole = (session?.user?.role as string) || "";
  const isAdminOrOwner = userRole === "ADMIN" || userRole === "OWNER";

  const handleNav = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  // §11.359 — 모바일 로그아웃 진입점(더보기 시트). 햄버거(계정/설정)와 역할 분리
  //   유지하되, 운영 메뉴 허브인 더보기에 로그아웃을 노출(기존 진입점 부재 해소).
  const handleSignOut = () => {
    onOpenChange(false);
    void signOut({ callbackUrl: "/" });
  };

  const renderItem = (item: MoreMenuItem) => {
    const active = item.exact
      ? pathname === item.href
      : pathname.startsWith(item.href);
    return (
      <button
        key={item.href}
        type="button"
        onClick={() => handleNav(item.href)}
        className={cn(
          "flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium transition-colors touch-manipulation",
          active
            ? "bg-blue-50 text-blue-700"
            : "text-slate-600 hover:bg-slate-100",
        )}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        // §11.359-2 — max-h + overflow: 시트가 화면 전체높이를 덮어 backdrop/닫기(X)가
        //   화면 밖으로 밀리던 "출구 부재" 체감 해소. 항목 초과 시 시트 내부 스크롤.
        className="rounded-t-2xl px-4 pb-8 safe-area-bottom bg-white border-t border-slate-200 max-h-[80vh] overflow-y-auto"
      >
        {/* §11.359-2 — 명시 닫기 동선: 기본 X(우상단, 작음) 외에 헤더에 라벨형
            닫기 버튼 추가. 시트=오버레이라 닫기=언마운트(라우팅 불요). */}
        <SheetHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-base font-bold text-slate-900">
            전체 메뉴
          </SheetTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="메뉴 닫기"
            className="inline-flex items-center justify-center h-10 w-10 -mr-2 rounded-lg text-slate-500 hover:bg-slate-100 active:scale-95 transition-colors touch-manipulation"
          >
            <X className="h-5 w-5" />
          </button>
        </SheetHeader>

        <div className="space-y-4 mt-2">
          {menuGroups.map((group) => (
            <div key={group.title}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-1">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map(renderItem)}
              </div>
            </div>
          ))}

          {isAdminOrOwner && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-1">
                관리자
              </p>
              <div className="space-y-0.5">
                {adminItems.map(renderItem)}
              </div>
            </div>
          )}

          {/* §11.359 — 로그아웃(모바일 진입점). 메뉴 항목과 구분선·red 톤으로 분리. */}
          <div className="pt-2 mt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors touch-manipulation"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span>로그아웃</span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
