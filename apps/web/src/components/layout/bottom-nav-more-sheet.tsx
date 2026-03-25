"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
}

const menuGroups: { title: string; items: MoreMenuItem[] }[] = [
  {
    title: "운영",
    items: [
      { label: "발주", href: "/dashboard/purchase-orders", icon: ClipboardList },
      { label: "입고", href: "/dashboard/receiving", icon: Package },
      { label: "재고 위험", href: "/dashboard/stock-risk", icon: AlertTriangle },
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
  { label: "감사 증적", href: "/dashboard/audit", icon: ShieldCheck },
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

  const renderItem = (item: MoreMenuItem) => {
    const active = pathname.startsWith(item.href);
    return (
      <button
        key={item.href}
        type="button"
        onClick={() => handleNav(item.href)}
        className={cn(
          "flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium transition-colors touch-manipulation",
          active
            ? "bg-blue-950/30 text-blue-400"
            : "text-slate-300 hover:bg-[#222226]/50"
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
        className="rounded-t-2xl px-4 pb-8 safe-area-bottom bg-slate-900 border-t border-slate-800"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base font-bold text-slate-100">
            전체 메뉴
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-2">
          {menuGroups.map((group) => (
            <div key={group.title}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-3 mb-1">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map(renderItem)}
              </div>
            </div>
          ))}

          {isAdminOrOwner && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-3 mb-1">
                관리자
              </p>
              <div className="space-y-0.5">
                {adminItems.map(renderItem)}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
