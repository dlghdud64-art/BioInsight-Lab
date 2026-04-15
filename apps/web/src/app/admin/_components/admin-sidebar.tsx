"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Settings,
  Database,
  Activity,
  Shield,
  FileText,
  LogOut,
} from "lucide-react";

const ADMIN_MENU_ITEMS = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Quotes", href: "/admin/quotes", icon: FileText },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Organizations", href: "/admin/organizations", icon: Database },
  { title: "Activity Logs", href: "/admin/activity", icon: Activity },
  { title: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-slate-900 text-white min-h-screen flex flex-col">
      {/* 헤더 */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-400" />
          <div>
            <h2 className="font-bold text-sm">LabAxis</h2>
            <span className="text-[10px] text-blue-400 font-medium">Admin</span>
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 p-3 space-y-0.5">
        {ADMIN_MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* 하단 */}
      <div className="p-3 border-t border-slate-700">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Link>
      </div>
    </aside>
  );
}
