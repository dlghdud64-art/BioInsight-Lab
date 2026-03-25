"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Settings,
  FileText,
  LogOut,
} from "lucide-react";

const VENDOR_MENU_ITEMS = [
  {
    title: "Dashboard",
    href: "/vendor/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "My Products",
    href: "/vendor/products",
    icon: Package,
  },
  {
    title: "Quote Requests",
    href: "/vendor/requests",
    icon: FileText,
  },
  {
    title: "Settings",
    href: "/vendor/settings",
    icon: Settings,
  },
];

export function VendorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#1a1a1e] border-r border-[#2a2a2e] min-h-screen">
      <div className="p-4 border-b border-[#2a2a2e]">
        <h2 className="font-bold text-lg text-slate-100">Vendor Portal</h2>
        <p className="text-xs text-slate-600 mt-1">LabAxis</p>
      </div>

      <nav className="p-3 space-y-1">
        {VENDOR_MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-300 hover:bg-[#222226]"
              )}
            >
              <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-blue-600" : "")} />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-4 left-0 right-0 px-3">
        <Link
          href="/vendor/logout"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-[#222226] transition-colors"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </Link>
      </div>
    </aside>
  );
}

