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
        src="/brand/bioinsight-icon.svg"
        alt="BioInsight Lab"
        width={40}
        height={40}
        className="h-10 w-10 md:h-9 md:w-9 rounded-lg object-contain"
      />

      {/* 텍스트: BioInsight Lab + Procurement & Research */}
      {showText && (
        <div className="leading-tight">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold tracking-tight text-blue-900">
              BioInsight
            </span>
            <span className="text-sm font-bold tracking-tight text-teal-500">
              Lab
            </span>
          </div>
          <div className="text-[10px] font-normal text-gray-600 mt-0.5">
            Procurement & Research
          </div>
        </div>
      )}
    </div>
  );
}