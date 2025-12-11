"use client";

import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  iconColor = "text-blue-600",
  badge,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 border-b border-slate-200 pb-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          {Icon && (
            <div className={cn("p-2 bg-blue-50 rounded-lg flex-shrink-0", iconColor.includes("blue") && "bg-blue-50", iconColor.includes("green") && "bg-green-50", iconColor.includes("purple") && "bg-purple-50", iconColor.includes("orange") && "bg-orange-50")}>
              <Icon className={cn("h-6 w-6", iconColor)} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
              {badge && <div className="flex-shrink-0">{badge}</div>}
            </div>
            {description && (
              <p className="text-sm text-slate-600 max-w-2xl">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

