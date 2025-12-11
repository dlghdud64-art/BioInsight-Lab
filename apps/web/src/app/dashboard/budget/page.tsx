"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Calendar, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";

interface Budget {
  id: string;
  name: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  organizationId?: string | null;
  projectName?: string | null;
  description?: string | null;
  usage?: {
    totalSpent: number;
    usageRate: number;
    remaining: number;
  };
}

export default function BudgetPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const { data, isLoading } = useQuery<{ budgets: Budget[] }>({
    queryKey: ["budgets"],
    queryFn: async () => {
      const response = await fetch("/api/budgets");
      if (!response.ok) throw new Error("Failed to fetch budgets");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const createOrUpdateMutation = useMutation({
    mutationFn: async (data: {
      id?: string;
      name: string;
      amount: number;
      currency: string;
      periodStart: string;
      periodEnd: string;
      organizationId?: string | null;
      projectName?: string | null;
      description?: string | null;
    }) => {
      const url = data.id ? `/api/budgets/${data.id}` : "/api/budgets";
      const method = data.id ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save budget");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-reports"] });
      setIsDialogOpen(false);
      setEditingBudget(null);
      toast({
        title: "예산 저장 완료",
        description: "예산이 성공적으로 저장되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "예산 저장 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/budgets/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete budget");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast({
        title: "예산 삭제 완료",
        description: "예산이 삭제되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "예산 삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 개발 단계: 로그인 체크 제거
  // if (status === "unauthenticated") {
  //   router.push("/auth/signin?callbackUrl=/dashboard/budget");
  //   return null;
  // }

  const budgets = data?.budgets || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-6xl mx-auto">
        <PageHeader
          title="예산 관리"
          description="조직/팀/프로젝트별 예산을 설정하고 사용률을 추적합니다."
          icon={DollarSign}
          actions={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingBudget(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  예산 추가
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingBudget ? "예산 수정" : "예산 추가"}
                </DialogTitle>
                <DialogDescription>
                  예산 정보를 입력하고 기간을 설정합니다.
                </DialogDescription>
              </DialogHeader>
              <BudgetForm
                budget={editingBudget}
                onSubmit={(data) => {
                  createOrUpdateMutation.mutate({
                    ...data,
                    id: editingBudget?.id,
                  });
                }}
                onCancel={() => {
                  setIsDialogOpen(false);
                  setEditingBudget(null);
                }}
              />
            </DialogContent>
          </Dialog>
          }
        />

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">예산 목록을 불러오는 중...</p>
            </CardContent>
          </Card>
        ) : budgets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">등록된 예산이 없습니다.</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                첫 예산 추가하기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                onEdit={() => {
                  setEditingBudget(budget);
                  setIsDialogOpen(true);
                }}
                onDelete={() => {
                  if (confirm("정말 이 예산을 삭제하시겠습니까?")) {
                    deleteMutation.mutate(budget.id);
                  }
                }}
              />
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

function BudgetCard({
  budget,
  onEdit,
  onDelete,
}: {
  budget: Budget;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const usage = budget.usage;
  const usageRate = usage?.usageRate || 0;
  const isOverBudget = usageRate > 100;
  const isWarning = usageRate > 80 && usageRate <= 100;

  return (
    <Card className={isOverBudget ? "border-red-300 bg-red-50" : isWarning ? "border-orange-300 bg-orange-50" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{budget.name}</CardTitle>
            <CardDescription className="mt-1">
              {budget.projectName && <span className="mr-2">프로젝트: {budget.projectName}</span>}
              <span>
                {new Date(budget.periodStart).toLocaleDateString("ko-KR")} ~{" "}
                {new Date(budget.periodEnd).toLocaleDateString("ko-KR")}
              </span>
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-1" />
              수정
            </Button>
            <Button size="sm" variant="outline" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              삭제
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">예산 금액</div>
            <div className="text-lg font-semibold">
              {budget.amount.toLocaleString()} {budget.currency}
            </div>
          </div>
          {usage && (
            <>
              <div>
                <div className="text-sm text-muted-foreground">사용 금액</div>
                <div className="text-lg font-semibold">
                  {usage.totalSpent.toLocaleString()} {budget.currency}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">잔여 금액</div>
                <div className={`text-lg font-semibold ${usage.remaining < 0 ? "text-red-600" : ""}`}>
                  {usage.remaining.toLocaleString()} {budget.currency}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">사용률</div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold">{usageRate.toFixed(1)}%</div>
                  {isOverBudget && (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      초과
                    </Badge>
                  )}
                  {isWarning && !isOverBudget && (
                    <Badge variant="outline" className="bg-orange-100 text-orange-800">
                      경고
                    </Badge>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {usage && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">예산 사용률</span>
              <span className="font-medium">{usageRate.toFixed(1)}%</span>
            </div>
            <Progress
              value={Math.min(usageRate, 100)}
              className={isOverBudget ? "bg-red-200" : isWarning ? "bg-orange-200" : ""}
            />
          </div>
        )}

        {budget.description && (
          <div className="text-sm text-muted-foreground pt-2 border-t">
            {budget.description}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BudgetForm({
  budget,
  onSubmit,
  onCancel,
}: {
  budget?: Budget | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(budget?.name || "");
  const [amount, setAmount] = useState(budget?.amount?.toString() || "");
  const [currency, setCurrency] = useState(budget?.currency || "KRW");
  const [periodStart, setPeriodStart] = useState(
    budget?.periodStart ? new Date(budget.periodStart).toISOString().split("T")[0] : ""
  );
  const [periodEnd, setPeriodEnd] = useState(
    budget?.periodEnd ? new Date(budget.periodEnd).toISOString().split("T")[0] : ""
  );
  const [projectName, setProjectName] = useState(budget?.projectName || "");
  const [description, setDescription] = useState(budget?.description || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      amount: parseFloat(amount) || 0,
      currency,
      periodStart,
      periodEnd,
      projectName: projectName || undefined,
      description: description || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">예산 이름 *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 2024년 R&D 예산"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount">예산 금액 *</Label>
          <Input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="currency">통화 *</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="KRW">KRW (원)</SelectItem>
              <SelectItem value="USD">USD (달러)</SelectItem>
              <SelectItem value="EUR">EUR (유로)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="periodStart">기간 시작 *</Label>
          <Input
            id="periodStart"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="periodEnd">기간 종료 *</Label>
          <Input
            id="periodEnd"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="projectName">프로젝트/과제명 (선택)</Label>
        <Input
          id="projectName"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="예: 신약 개발 프로젝트"
        />
      </div>

      <div>
        <Label htmlFor="description">설명 (선택)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예산에 대한 추가 설명"
          rows={3}
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          취소
        </Button>
        <Button type="submit" className="flex-1">
          저장
        </Button>
      </div>
    </form>
  );
}