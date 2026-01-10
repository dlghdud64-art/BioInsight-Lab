"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MainHeader } from "@/app/_components/main-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { Wallet, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function GrantsPage() {
  const { toast } = useToast();

  const { data: budgetsData, isLoading } = useQuery<{ budgets: any[] }>({
    queryKey: ["user-budgets"],
    queryFn: async () => {
      const response = await fetch("/api/user-budgets");
      if (!response.ok) throw new Error("Failed to fetch budgets");
      return response.json();
    },
  });

  const budgets = budgetsData?.budgets || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto min-w-0 pt-20 md:pt-16">
          <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 mb-4 md:mb-6">
                <div>
                  <h1 className="text-xl md:text-3xl font-bold">연구비 관리</h1>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">
                    연구비 예산을 관리하고 사용 내역을 확인합니다.
                  </p>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  예산 추가
                </Button>
              </div>

              {isLoading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">로딩 중...</p>
                </div>
              ) : budgets.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">등록된 예산이 없습니다</p>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      첫 예산 추가하기
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {budgets.map((budget) => (
                    <Card key={budget.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">{budget.name}</CardTitle>
                        <CardDescription>
                          {budget.endDate && budget.daysRemaining !== null
                            ? `D-${budget.daysRemaining}`
                            : "기간 무제한"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">잔액</span>
                            <span className="text-lg font-bold">
                              ₩ {budget.remainingAmount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">사용</span>
                            <span className="text-sm">
                              ₩ {budget.usedAmount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">전체</span>
                            <span className="text-sm">
                              ₩ {budget.totalAmount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


