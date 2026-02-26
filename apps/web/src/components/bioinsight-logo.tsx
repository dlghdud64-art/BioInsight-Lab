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
        className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 lg:h-14 lg:w-14 rounded-lg object-contain"
      />

      {/* 텍스트: BioInsight Lab - 모바일에서 겹침 방지 유동 크기 */}
      {showText && (
        <div className="leading-tight">
          <div className="flex items-baseline gap-1">
            <span className={cn(
              "text-sm sm:text-base md:text-lg lg:text-xl font-bold tracking-tight",
              isDark ? "text-white" : "text-blue-900"
            )}>
              BioInsight
            </span>
            <span className={cn(
              "text-sm sm:text-base md:text-lg lg:text-xl font-bold tracking-tight",
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