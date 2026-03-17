import * as React from "react";
import Image from "next/image";
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

  const imgSize =
    resolvedSize === "sm" ? { w: 22, h: 22 } :
    resolvedSize === "md" ? { w: 26, h: 26 } :
    { w: 28, h: 28 };

  const textClass =
    resolvedSize === "sm" ? "text-sm font-semibold tracking-tight" :
    resolvedSize === "md" ? "text-lg font-semibold tracking-tight" :
    "text-base md:text-lg font-semibold tracking-tight";

  const showSubtitle = resolvedSize === "lg" && !compact;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/brand/Bio-Insight.png"
        alt="BioInsight Lab"
        width={imgSize.w}
        height={imgSize.h}
        className="flex-shrink-0"
        priority
      />

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
