"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface UserBudget {
  id: string;
  name: string;
  totalAmount: number;
  usedAmount: number;
  remainingAmount: number;
  currency: string;
  endDate: string | null;
  daysRemaining: number | null;
}

export function GrantWalletWidget() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data, isLoading } = useQuery<{ budgets: UserBudget[] }>({
    queryKey: ["user-budgets"],
    queryFn: async () => {
      const response = await fetch("/api/user-budgets");
      if (!response.ok) throw new Error("Failed to fetch budgets");
      return response.json();
    },
  });

  const budgets = data?.budgets || [];

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-48">
          <div className="text-sm text-muted-foreground">로딩 중...</div>
        </div>
      </Card>
    );
  }

  if (budgets.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center h-48 space-y-2">
          <Wallet className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">등록된 예산이 없습니다</p>
        </div>
      </Card>
    );
  }

  const currentBudget = budgets[currentIndex];
  const usageRate = currentBudget.totalAmount > 0 
    ? (currentBudget.usedAmount / currentBudget.totalAmount) * 100 
    : 0;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? budgets.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === budgets.length - 1 ? 0 : prev + 1));
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">내 지갑</h3>
          {budgets.length > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPrevious}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {currentIndex + 1} / {budgets.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNext}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* 신용카드 형태의 예산 카드 */}
        <div className="relative">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6 shadow-lg">
            {/* 배경 패턴 */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -mr-32 -mt-32 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full -ml-24 -mb-24 blur-3xl" />
            </div>

            <div className="relative z-10 space-y-4">
              {/* 과제명 */}
              <div>
                <p className="text-xs text-white/70 mb-1">과제명</p>
                <p className="text-lg font-bold text-white">{currentBudget.name}</p>
              </div>

              {/* 잔액 */}
              <div>
                <p className="text-xs text-white/70 mb-1">잔액</p>
                <p className="text-3xl font-bold text-white">
                  ₩ {currentBudget.remainingAmount.toLocaleString()}
                </p>
              </div>

              {/* 유효기간 */}
              {currentBudget.daysRemaining !== null && (
                <div className="flex items-center justify-between pt-2 border-t border-white/20">
                  <span className="text-xs text-white/70">유효기간</span>
                  <span className={cn(
                    "text-sm font-semibold",
                    currentBudget.daysRemaining < 30 
                      ? "text-red-200" 
                      : currentBudget.daysRemaining < 60 
                      ? "text-yellow-200" 
                      : "text-white"
                  )}>
                    D-{currentBudget.daysRemaining}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">예산 사용률</span>
            <span className="font-semibold">{usageRate.toFixed(1)}%</span>
          </div>
          <Progress 
            value={usageRate} 
            className={cn(
              "h-3",
              usageRate > 90 ? "bg-red-100" : usageRate > 70 ? "bg-yellow-100" : "bg-green-100"
            )}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>사용: ₩ {currentBudget.usedAmount.toLocaleString()}</span>
            <span>전체: ₩ {currentBudget.totalAmount.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}


