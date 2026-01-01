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
} from "lucide-react";

const ADMIN_MENU_ITEMS = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Quotes",
    href: "/admin/quotes",
    icon: FileText,
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Organizations",
    href: "/admin/organizations",
    icon: Database,
  },
  {
    title: "Activity Logs",
    href: "/admin/activity",
    icon: Activity,
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-5 w-5 text-blue-400" />
          <h2 className="font-bold text-lg">Admin Portal</h2>
        </div>
        <p className="text-xs text-slate-400 mt-1">BioInsight Lab</p>
      </div>

      <nav className="p-3 space-y-1">
        {ADMIN_MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

