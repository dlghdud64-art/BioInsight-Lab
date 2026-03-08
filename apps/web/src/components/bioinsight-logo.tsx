import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type BioInsightLogoProps = {
  className?: string;
  showText?: boolean; // 아이콘만 쓰고 싶으면 false로
  variant?: "light" | "dark"; // dark: 어두운 배경용 (텍스트 흰색 계열)
  compact?: boolean; // Sheet·모바일 등 작은 공간용 (h-7 w-7, text-sm)
  size?: "sm" | "md" | "lg"; // sm=compact, md=사이드바(h-9 text-xl), lg=기본 반응형
};

export function BioInsightLogo({
  className,
  showText = true,
  variant = "light",
  compact = false,
  size,
}: BioInsightLogoProps) {
  const isDark = variant === "dark";

  // size prop 우선, 없으면 compact로 결정
  const resolvedSize = size ?? (compact ? "sm" : "lg");

  const iconClass =
    resolvedSize === "sm"
      ? "h-7 w-7 rounded-lg object-contain -translate-y-[1px]"
      : resolvedSize === "md"
      ? "h-12 w-12 rounded-lg object-contain -translate-y-[1px]"
      : "h-9 w-9 md:h-10 md:w-10 lg:h-11 lg:w-11 rounded-lg object-contain -translate-y-[1px]";

  const textClass =
    resolvedSize === "sm"
      ? "text-sm font-bold tracking-tight"
      : resolvedSize === "md"
      ? "text-2xl font-bold tracking-tight"
      : "text-base md:text-lg lg:text-xl font-bold tracking-tight";

  const showSubtitle = resolvedSize === "lg" && !compact;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* 아이콘: 이미지 파일 사용 */}
      <Image
        src="/brand/Bio-Insight.png"
        alt="BioInsight Lab"
        width={60}
        height={60}
        className={iconClass}
      />

      {/* 텍스트: BioInsight Lab */}
      {showText && (
        <div className="leading-tight">
          <div className="flex items-baseline gap-1">
            <span className={cn(textClass, isDark ? "text-white" : "text-blue-900")}>
              BioInsight
            </span>
            <span className={cn(textClass, isDark ? "text-teal-300" : "text-teal-500")}>
              Lab
            </span>
          </div>
          {showSubtitle && (
            <div
              className={cn(
                "hidden md:block text-[10px] font-normal mt-0.5",
                isDark ? "text-slate-400" : "text-gray-600"
              )}
            >
              Procurement & Research
            </div>
          )}
        </div>
      )}
    </div>
  );
}
