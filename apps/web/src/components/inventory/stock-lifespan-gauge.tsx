"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";

interface StockLifespanGaugeProps {
  inventoryId: string;
  currentQuantity: number;
  safetyStock: number | null;
  unit: string;
  onReorder?: () => void;
}

/**
 * 재고 수명 게이지 컴포넌트
 * 예상 소진 시점을 직관적인 게이지로 표시
 */
export function StockLifespanGauge({
  inventoryId,
  currentQuantity,
  safetyStock,
  unit,
  onReorder,
}: StockLifespanGaugeProps) {
  const router = useRouter();

  // 사용 이력 조회 (예상 소진 시점 계산용)
  const { data: usageData, isLoading } = useQuery<{
    records: Array<{
      id: string;
      quantity: number;
      usageDate: string;
    }>;
  }>({
    queryKey: ["inventory-usage", inventoryId],
    queryFn: async () => {
      const response = await fetch(`/api/inventory/usage?inventoryId=${inventoryId}&limit=30`);
      if (!response.ok) throw new Error("Failed to fetch usage");
      return response.json();
    },
    enabled: !!inventoryId,
  });

  // 예상 소진 시점 계산
  const calculateDepletionDays = (): number | null => {
    if (!usageData?.records || usageData.records.length === 0) {
      return null; // 사용 이력이 없으면 계산 불가
    }

    const records = usageData.records;
    const totalUsage = records.reduce((sum, record) => sum + record.quantity, 0);

    // 가장 오래된 기록과 최신 기록 사이의 기간 계산
    const oldestDate = new Date(records[records.length - 1].usageDate);
    const newestDate = new Date(records[0].usageDate);
    const daysDiff = Math.max(
      1,
      Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // 일일 평균 사용량 계산
    const dailyUsage = totalUsage / daysDiff;

    // 현재 수량을 일일 사용량으로 나누어 예상 소진 일수 계산
    if (dailyUsage <= 0) return null;

    const daysUntilDepletion = Math.ceil(currentQuantity / dailyUsage);

    return daysUntilDepletion;
  };

  const daysUntilDepletion = calculateDepletionDays();

  // 게이지 상태 계산
  const getGaugeState = () => {
    if (currentQuantity <= 0) {
      return { level: 0, color: "red", status: "depleted" };
    }

    if (!safetyStock || safetyStock <= 0) {
      // 안전 재고가 없으면 날짜 기반으로만 계산
      if (!daysUntilDepletion) {
        return { level: 50, color: "gray", status: "unknown" };
      }
      if (daysUntilDepletion <= 7) {
        return { level: (daysUntilDepletion / 30) * 100, color: "red", status: "critical" };
      }
      if (daysUntilDepletion <= 15) {
        return { level: (daysUntilDepletion / 30) * 100, color: "yellow", status: "warning" };
      }
      return { level: Math.min((daysUntilDepletion / 60) * 100, 100), color: "green", status: "good" };
    }

    // 안전 재고 기준으로 계산
    const safetyRatio = safetyStock / (currentQuantity + safetyStock);
    const currentRatio = currentQuantity / (currentQuantity + safetyStock);

    if (currentQuantity <= safetyStock * 0.3) {
      return { level: currentRatio * 100, color: "red", status: "critical" };
    }
    if (currentQuantity <= safetyStock) {
      return { level: currentRatio * 100, color: "yellow", status: "warning" };
    }

    // 안전 재고보다 많으면 날짜 기반으로 계산
    if (daysUntilDepletion && daysUntilDepletion <= 30) {
      const ratio = daysUntilDepletion / 60;
      return {
        level: Math.max(ratio * 100, 60),
        color: daysUntilDepletion <= 15 ? "yellow" : "green",
        status: daysUntilDepletion <= 15 ? "warning" : "good",
      };
    }

    return { level: 80, color: "green", status: "good" };
  };

  const gaugeState = getGaugeState();

  // 배터리 바 렌더링 (5단계)
  const renderBatteryBars = () => {
    const level = gaugeState.level;
    const bars = 5;
    const filledBars = Math.round((level / 100) * bars);
    const isCritical = gaugeState.status === "critical" || gaugeState.status === "depleted";

    return (
      <div className={cn("flex items-center gap-0.5", isCritical && "animate-shake")}>
        {Array.from({ length: bars }).map((_, index) => {
          const isFilled = index < filledBars;
          const barColor =
            gaugeState.color === "red"
              ? "bg-red-500"
              : gaugeState.color === "yellow"
              ? "bg-yellow-500"
              : "bg-green-500";

          return (
            <div
              key={index}
              className={cn(
                "h-6 w-4 rounded-sm transition-colors duration-300",
                isFilled ? barColor : "bg-gray-200"
              )}
            />
          );
        })}
      </div>
    );
  };

  const isCritical = gaugeState.status === "critical" || gaugeState.status === "depleted";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          {renderBatteryBars()}
          <div className="flex-1">
            {isLoading ? (
              <span className="text-xs text-muted-foreground">계산 중...</span>
            ) : daysUntilDepletion !== null ? (
              <span
                className={cn(
                  "text-xs font-medium",
                  isCritical
                    ? "text-red-600 animate-pulse"
                    : gaugeState.color === "yellow"
                    ? "text-yellow-600"
                    : "text-green-600"
                )}
              >
                예상 소진까지 D-{daysUntilDepletion}일
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">사용 이력 없음</span>
            )}
          </div>
        </div>
        {isCritical && onReorder && (
          <Button
            size="sm"
            variant="destructive"
            onClick={onReorder}
            className={cn(
              "h-7 text-xs whitespace-nowrap",
              "animate-shake"
            )}
          >
            <ShoppingCart className="h-3 w-3 mr-1" />
            재주문
          </Button>
        )}
      </div>
    </div>
  );
}

