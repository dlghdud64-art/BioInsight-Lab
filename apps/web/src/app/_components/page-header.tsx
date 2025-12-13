"use client";

import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string | ReactNode;
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
    <div className={cn("mb-4 md:mb-6 border-b border-slate-200 pb-4 md:pb-6", className)}>
      <div className="flex items-start justify-between gap-2 md:gap-4">
        <div className="flex-1 min-w-0">
          {badge && <div className="mb-2">{badge}</div>}
          <div className="flex items-center gap-2 md:gap-3 mb-2">
            {Icon && (
              <div className={cn("p-1.5 md:p-2 bg-blue-50 rounded-lg flex-shrink-0", iconColor.includes("blue") && "bg-blue-50", iconColor.includes("green") && "bg-green-50", iconColor.includes("purple") && "bg-purple-50", iconColor.includes("orange") && "bg-orange-50")}>
                <Icon className={cn("h-4 w-4 md:h-6 md:w-6", iconColor)} />
              </div>
            )}
            <h1 className="text-lg md:text-3xl font-bold text-slate-900 break-words">{title}</h1>
          </div>
          {description && (
            <div className="text-xs md:text-sm text-slate-600 max-w-2xl">
              {typeof description === "string" ? (
                <p>{description}</p>
              ) : (
                description
              )}
            </div>
          )}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

