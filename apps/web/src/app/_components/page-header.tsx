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
    <div className={cn("flex flex-col gap-4 mb-8", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {badge && <div className="mb-2">{badge}</div>}
          <div className="flex items-center gap-3 mb-2">
            {Icon && (
              <div className={cn("p-2 bg-blue-50 rounded-lg flex-shrink-0", iconColor.includes("blue") && "bg-blue-50", iconColor.includes("green") && "bg-green-50", iconColor.includes("purple") && "bg-purple-50", iconColor.includes("orange") && "bg-orange-50")}>
                <Icon className={cn("h-6 w-6", iconColor)} />
              </div>
            )}
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 break-words">{title}</h1>
          </div>
          {description && (
            <div className="text-muted-foreground max-w-2xl">
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

