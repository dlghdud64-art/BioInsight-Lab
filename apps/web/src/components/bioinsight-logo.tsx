import * as React from "react";
import { cn } from "@/lib/utils";

type LabAxisLogoProps = {
  className?: string;
  showText?: boolean;
  variant?: "light" | "dark";
  compact?: boolean;
  size?: "sm" | "md" | "lg";
};

export function LabAxisLogo({
  className,
  showText = true,
  compact = false,
  size,
}: LabAxisLogoProps) {
  const resolvedSize = size ?? (compact ? "sm" : "lg");

  const markSize =
    resolvedSize === "sm" ? "h-5 w-5" :
    resolvedSize === "md" ? "h-6 w-6" :
    "h-6 w-6 md:h-7 md:w-7";

  const textClass =
    resolvedSize === "sm" ? "text-sm font-semibold tracking-tight" :
    resolvedSize === "md" ? "text-lg font-semibold tracking-tight" :
    "text-base md:text-lg font-semibold tracking-tight";

  const showSubtitle = resolvedSize === "lg" && !compact;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Geometric mark — transparent SVG */}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(markSize, "flex-shrink-0")}
      >
        {/* Abstract axis cross — operational / precision */}
        <path
          d="M16 2L16 30M2 16L30 16"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="text-slate-500"
        />
        <circle cx="16" cy="16" r="6" fill="currentColor" className="text-blue-500" fillOpacity="0.8" />
        <circle cx="16" cy="16" r="3" fill="currentColor" className="text-slate-100" />
      </svg>

      {showText && (
        <div className="leading-tight">
          <div className="flex items-baseline">
            <span className={cn(textClass, "text-slate-100")}>
              Lab
            </span>
            <span className={cn(textClass, "text-blue-400")}>
              Axis
            </span>
          </div>
          {showSubtitle && (
            <div className="hidden md:block text-[9px] font-normal text-slate-500 tracking-wide uppercase">
              Procurement Operations
            </div>
          )}
        </div>
      )}
    </div>
  );
}
