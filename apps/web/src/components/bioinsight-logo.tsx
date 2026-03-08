import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type BioInsightLogoProps = {
  className?: string;
  showText?: boolean; // 아이콘만 쓰고 싶으면 false로
  variant?: "light" | "dark"; // dark: 어두운 배경용 (텍스트 흰색 계열)
};

export function BioInsightLogo({
  className,
  showText = true,
  variant = "light",
}: BioInsightLogoProps) {
  const isDark = variant === "dark";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* 아이콘: 이미지 파일 사용 */}
      <Image
        src="/brand/Bio-Insight.png"
        alt="BioInsight Lab"
        width={60}
        height={60}
        className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 lg:h-16 lg:w-16 rounded-lg object-contain -translate-y-[1px]"
      />

      {/* 텍스트: BioInsight Lab - 모바일에서 겹침 방지 유동 크기 */}
      {showText && (
        <div className="leading-tight">
          <div className="flex items-baseline gap-1">
            <span className={cn(
              "text-base sm:text-lg md:text-xl lg:text-2xl font-bold tracking-tight",
              isDark ? "text-white" : "text-blue-900"
            )}>
              BioInsight
            </span>
            <span className={cn(
              "text-base sm:text-lg md:text-xl lg:text-2xl font-bold tracking-tight",
              isDark ? "text-teal-300" : "text-teal-500"
            )}>
              Lab
            </span>
          </div>
          <div className={cn(
            "hidden md:block text-[10px] font-normal mt-0.5",
            isDark ? "text-slate-400" : "text-gray-600"
          )}>
            Procurement & Research
          </div>
        </div>
      )}
    </div>
  );
}