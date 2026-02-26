import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type BioInsightLogoProps = {
  className?: string;
  showText?: boolean; // 아이콘만 쓰고 싶으면 false로
};

export function BioInsightLogo({
  className,
  showText = true,
}: BioInsightLogoProps) {
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
            <span className="text-sm sm:text-base md:text-lg lg:text-xl font-bold tracking-tight text-blue-900">
              BioInsight
            </span>
            <span className="text-sm sm:text-base md:text-lg lg:text-xl font-bold tracking-tight text-teal-500">
              Lab
            </span>
          </div>
          <div className="hidden md:block text-[10px] font-normal text-gray-600 mt-0.5">
            Procurement & Research
          </div>
        </div>
      )}
    </div>
  );
}