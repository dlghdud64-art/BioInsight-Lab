import * as React from "react";
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
      {/* 아이콘: 라운드 스퀘어 안에 초록 유리관 + 느낌표 점 */}
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        role="img"
        className="h-8 w-8"
      >
        {/* 바깥 라운드 스퀘어 */}
        <rect
          x="4"
          y="4"
          width="24"
          height="24"
          rx="8"
          fill="#F9FAFB" // 아주 연한 배경 (거의 흰색)
          stroke="#0F172A" // 짙은 네이비 테두리
          strokeWidth="1.4"
        />

        {/* 유리관(시험관) 몸통 */}
        <rect
          x="11"
          y="8"
          width="6"
          height="14"
          rx="3"
          fill="#ECFDF5" // emerald-50
          stroke="#059669" // emerald-500
          strokeWidth="1.5"
        />

        {/* 유리관 안 액체 (아래쪽만 채워진 시약) */}
        <path
          d="M12 16.5
             C13 16 14 16.1 15 16.5
             C16 16.9 17 17.1 18 16.7
             V18.8
             C18 20.6 16.7 22 15 22
             H14
             C12.3 22 11 20.6 11 18.8
             V17 Z"
          fill="#22C55E" // emerald-500
          opacity="0.9"
        />

        {/* 유리관 유리 하이라이트 (왼쪽 위에 살짝) */}
        <path
          d="M12.3 9.8 C13 9.4 13.7 9.3 14.4 9.4"
          stroke="#A7F3D0" // emerald-200
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* 느낌표: 위쪽 긴 막대 */}
        <rect
          x="20.5"
          y="9"
          width="2"
          height="9"
          rx="1"
          fill="#059669" // emerald-500
        />

        {/* 느낌표: 아래쪽 작은 점 */}
        <circle cx="21.5" cy="21" r="1.4" fill="#22C55E" />
      </svg>

      {/* 텍스트: 전부 모노톤(검정/회색) */}
      {showText && (
        <div className="leading-none">
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            BioInsight
          </span>
          <span className="ml-1 text-[11px] font-medium text-slate-500">
            Lab
          </span>
        </div>
      )}
    </div>
  );
}


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
      {/* 아이콘: 라운드 스퀘어 안에 초록 유리관 + 느낌표 점 */}
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        role="img"
        className="h-8 w-8"
      >
        {/* 바깥 라운드 스퀘어 */}
        <rect
          x="4"
          y="4"
          width="24"
          height="24"
          rx="8"
          fill="#F9FAFB" // 아주 연한 배경 (거의 흰색)
          stroke="#0F172A" // 짙은 네이비 테두리
          strokeWidth="1.4"
        />

        {/* 유리관(시험관) 몸통 */}
        <rect
          x="11"
          y="8"
          width="6"
          height="14"
          rx="3"
          fill="#ECFDF5" // emerald-50
          stroke="#059669" // emerald-500
          strokeWidth="1.5"
        />

        {/* 유리관 안 액체 (아래쪽만 채워진 시약) */}
        <path
          d="M12 16.5
             C13 16 14 16.1 15 16.5
             C16 16.9 17 17.1 18 16.7
             V18.8
             C18 20.6 16.7 22 15 22
             H14
             C12.3 22 11 20.6 11 18.8
             V17 Z"
          fill="#22C55E" // emerald-500
          opacity="0.9"
        />

        {/* 유리관 유리 하이라이트 (왼쪽 위에 살짝) */}
        <path
          d="M12.3 9.8 C13 9.4 13.7 9.3 14.4 9.4"
          stroke="#A7F3D0" // emerald-200
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* 느낌표: 위쪽 긴 막대 */}
        <rect
          x="20.5"
          y="9"
          width="2"
          height="9"
          rx="1"
          fill="#059669" // emerald-500
        />

        {/* 느낌표: 아래쪽 작은 점 */}
        <circle cx="21.5" cy="21" r="1.4" fill="#22C55E" />
      </svg>

      {/* 텍스트: 전부 모노톤(검정/회색) */}
      {showText && (
        <div className="leading-none">
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            BioInsight
          </span>
          <span className="ml-1 text-[11px] font-medium text-slate-500">
            Lab
          </span>
        </div>
      )}
    </div>
  );
}


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
      {/* 아이콘: 라운드 스퀘어 안에 초록 유리관 + 느낌표 점 */}
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        role="img"
        className="h-8 w-8"
      >
        {/* 바깥 라운드 스퀘어 */}
        <rect
          x="4"
          y="4"
          width="24"
          height="24"
          rx="8"
          fill="#F9FAFB" // 아주 연한 배경 (거의 흰색)
          stroke="#0F172A" // 짙은 네이비 테두리
          strokeWidth="1.4"
        />

        {/* 유리관(시험관) 몸통 */}
        <rect
          x="11"
          y="8"
          width="6"
          height="14"
          rx="3"
          fill="#ECFDF5" // emerald-50
          stroke="#059669" // emerald-500
          strokeWidth="1.5"
        />

        {/* 유리관 안 액체 (아래쪽만 채워진 시약) */}
        <path
          d="M12 16.5
             C13 16 14 16.1 15 16.5
             C16 16.9 17 17.1 18 16.7
             V18.8
             C18 20.6 16.7 22 15 22
             H14
             C12.3 22 11 20.6 11 18.8
             V17 Z"
          fill="#22C55E" // emerald-500
          opacity="0.9"
        />

        {/* 유리관 유리 하이라이트 (왼쪽 위에 살짝) */}
        <path
          d="M12.3 9.8 C13 9.4 13.7 9.3 14.4 9.4"
          stroke="#A7F3D0" // emerald-200
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* 느낌표: 위쪽 긴 막대 */}
        <rect
          x="20.5"
          y="9"
          width="2"
          height="9"
          rx="1"
          fill="#059669" // emerald-500
        />

        {/* 느낌표: 아래쪽 작은 점 */}
        <circle cx="21.5" cy="21" r="1.4" fill="#22C55E" />
      </svg>

      {/* 텍스트: 전부 모노톤(검정/회색) */}
      {showText && (
        <div className="leading-none">
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            BioInsight
          </span>
          <span className="ml-1 text-[11px] font-medium text-slate-500">
            Lab
          </span>
        </div>
      )}
    </div>
  );
}
