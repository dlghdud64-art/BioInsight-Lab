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
        className="h-12 w-12 md:h-14 md:w-14 rounded-lg object-contain"
      />

      {/* 텍스트: BioInsight Lab + Procurement & Research */}
      {showText && (
        <div className="leading-tight">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold tracking-tight text-blue-900 md:text-xl">
              BioInsight
            </span>
            <span className="text-lg font-bold tracking-tight text-teal-500 md:text-xl">
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