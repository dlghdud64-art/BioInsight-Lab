"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/app/_components/page-header";
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
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="연구비 관리"
        description="연구비 예산을 관리하고 사용 내역을 확인합니다."
        icon={Wallet}
        actions={
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            예산 추가
          </Button>
        }
      />

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
  );
}


