"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * BatteryIndicator Component
 *
 * 시간 기반 재고 추정 상태를 배터리 아이콘으로 시각화합니다.
 *
 * Props:
 * - percentage: 0~100 (추정 잔여량 %)
 * - status: "HIGH" | "MEDIUM" | "LOW" | "CRITICAL" | "UNKNOWN"
 * - showLabel: 라벨 표시 여부 (기본: true)
 * - size: "sm" | "md" | "lg" (기본: "md")
 */

export type EstimatedStatus = "HIGH" | "MEDIUM" | "LOW" | "CRITICAL" | "UNKNOWN";

export interface BatteryIndicatorProps {
  percentage: number;
  status: EstimatedStatus;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function BatteryIndicator({
  percentage,
  status,
  showLabel = true,
  size = "md",
  className,
}: BatteryIndicatorProps) {
  // 크기 설정
  const sizeClasses = {
    sm: "h-3 w-8",
    md: "h-4 w-12",
    lg: "h-6 w-16",
  };

  const labelSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  // 상태별 색상
  const colorClasses = {
    HIGH: "bg-green-500",
    MEDIUM: "bg-yellow-500",
    LOW: "bg-orange-500",
    CRITICAL: "bg-red-500",
    UNKNOWN: "bg-gray-400",
  };

  // 라벨 텍스트
  const labelText = {
    HIGH: "풍부",
    MEDIUM: "보통",
    LOW: "부족",
    CRITICAL: "긴급",
    UNKNOWN: "알 수 없음",
  };

  // 이모지
  const emoji = {
    HIGH: "🔋",
    MEDIUM: "🪫",
    LOW: "🪫",
    CRITICAL: "🔴",
    UNKNOWN: "❓",
  };

  // percentage를 0~100 범위로 제한
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* 배터리 아이콘 */}
      <div className="flex items-center gap-1">
        <span className={labelSizeClasses[size]}>{emoji[status]}</span>
        <div
          className={cn(
            "relative rounded border-2 border-gray-400",
            sizeClasses[size]
          )}
        >
          {/* 배터리 내부 (충전량) */}
          <div
            className={cn(
              "absolute inset-0.5 rounded-sm transition-all duration-300",
              colorClasses[status]
            )}
            style={{ width: `calc(${clampedPercentage}% - 4px)` }}
          />
        </div>
      </div>

      {/* 라벨 (옵션) */}
      {showLabel && (
        <span
          className={cn(
            "font-medium",
            labelSizeClasses[size],
            status === "CRITICAL" && "text-red-600",
            status === "LOW" && "text-orange-600",
            status === "MEDIUM" && "text-yellow-600",
            status === "HIGH" && "text-green-600",
            status === "UNKNOWN" && "text-gray-500"
          )}
        >
          {labelText[status]} ({clampedPercentage}%)
        </span>
      )}
    </div>
  );
}

/**
 * BatteryIndicatorCompact Component
 *
 * 공간이 제한된 곳에 사용하는 간소화된 버전 (이모지만 표시)
 */
export interface BatteryIndicatorCompactProps {
  percentage: number;
  status: EstimatedStatus;
  showPercentage?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function BatteryIndicatorCompact({
  percentage,
  status,
  showPercentage = true,
  size = "md",
  className,
}: BatteryIndicatorCompactProps) {
  const emoji = {
    HIGH: "🔋",
    MEDIUM: "🪫",
    LOW: "🪫",
    CRITICAL: "🔴",
    UNKNOWN: "❓",
  };

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span className={sizeClasses[size]}>{emoji[status]}</span>
      {showPercentage && (
        <span
          className={cn(
            "font-medium tabular-nums",
            sizeClasses[size],
            status === "CRITICAL" && "text-red-600",
            status === "LOW" && "text-orange-600",
            status === "MEDIUM" && "text-yellow-600",
            status === "HIGH" && "text-green-600",
            status === "UNKNOWN" && "text-gray-500"
          )}
        >
          {clampedPercentage}%
        </span>
      )}
    </div>
  );
}
