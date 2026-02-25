"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/app/_components/page-header";
import { trackEvent } from "@/lib/analytics";

interface Budget {
  id: string;
  name: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  organizationId?: string | null;
  targetDepartment?: string | null;
  projectName?: string | null;
  description?: string | null;
  usage?: {
    totalSpent: number;
    usageRate: number;
    remaining: number;
  };
}

const BUDGET_DEPARTMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "부서를 선택해주세요" },
  { value: "공정개발팀", label: "공정개발팀" },
  { value: "기초연구팀", label: "기초연구팀" },
  { value: "품질관리(QC)팀", label: "품질관리(QC)팀" },
  { value: "전체(공용 예산)", label: "전체(공용 예산)" },
];

export default function BudgetPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading } = useQuery<{ budgets: Budget[] }>({
    queryKey: ["budgets"],
    queryFn: async () => {
      const response = await fetch("/api/budgets");
      if (!response.ok) throw new Error("Failed to fetch budgets");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // API 데이터를 로컬 budgets에 동기화 (최초/갱신 시)
  useEffect(() => {
    if (data?.budgets && Array.isArray(data.budgets)) {
      setBudgets(data.budgets);
    }
  }, [data?.budgets]);

  /** 데모용: 가상 저장 (API 호출 없이 로컬 상태만 갱신) */
  const handleMockSubmit = async (formData: {
    name: string;
    amount: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    targetDepartment?: string | null;
    projectName?: string | null;
    description?: string | null;
  }) => {
    setIsSubmitting(true);
    // 1초 가상 로딩
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newBudget: Budget = {
      id: String(Date.now()),
      name: formData.name || "신규 예산",
      amount: formData.amount ?? 0,
      currency: formData.currency || "KRW",
      periodStart: formData.periodStart,
      periodEnd: formData.periodEnd,
      targetDepartment: formData.targetDepartment ?? null,
      projectName: formData.projectName ?? null,
      description: formData.description ?? null,
      usage: {
        totalSpent: 0,
        usageRate: 0,
        remaining: formData.amount ?? 0,
      },
    };

    setBudgets((prev) => [newBudget, ...prev]);
    toast({
      title: "예산이 성공적으로 등록되었습니다.",
      description: "데모 모드로 저장되었습니다.",
    });
    setIsDialogOpen(false);
    setEditingBudget(null);
    setIsSubmitting(false);
  };

  const createOrUpdateMutation = useMutation({
    mutationFn: async (data: {
      id?: string;
      name: string;
      amount: number;
      currency: string;
      periodStart: string;
      periodEnd: string;
      organizationId?: string | null;
      targetDepartment?: string | null;
      projectName?: string | null;
      description?: string | null;
    }) => {
      const url = data.id ? `/api/budgets/${data.id}` : "/api/budgets";
      const method = data.id ? "PATCH" : "POST";
      
      // 콤마 제거 및 숫자 변환 (이중 체크)
      const cleanAmount = typeof data.amount === 'string' 
        ? Number(String(data.amount).replace(/,/g, ''))
        : Number(data.amount);
      
      const payload = {
        ...data,
        amount: cleanAmount, // 순수 숫자로 변환
      };

      console.log("[Budget Page] Sending request:", { url, method, payload });

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("[Budget Page] Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[Budget Page] Error response:", errorData);
        const errorMessage = errorData.error || errorData.details || "Failed to save budget";
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("[Budget Page] Success response:", result);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-reports"] });
      
      // Analytics: budget_set 이벤트 추적
      trackEvent("budget_set", {
        budget_id: data.id,
        budget_amount: data.amount,
        currency: data.currency,
      });
      
      setIsDialogOpen(false);
      setEditingBudget(null);
      toast({
        title: "예산 저장 완료",
        description: "예산이 성공적으로 저장되었습니다.",
      });
    },
    onError: (error: Error) => {
      console.error("[Budget Page] Save error:", error);
      toast({
        title: "예산 저장 실패",
        description: error.message || "예산 저장에 실패했습니다. 다시 시도해주세요.",
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
      <div className="w-full px-4 md:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // 개발 단계: 로그인 체크 제거
  // if (status === "unauthenticated") {
  //   router.push("/auth/signin?callbackUrl=/dashboard/budget");
  //   return null;
  // }

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="예산 관리"
          description="조직/팀/프로젝트별 예산을 설정하고 사용률을 추적합니다."
          icon={DollarSign}
          actions={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingBudget(null)} size="sm" className="text-xs md:text-sm h-8 md:h-10">
                  <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">예산 추가</span>
                  <span className="sm:hidden">추가</span>
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
                  isSubmitting={isSubmitting}
                  onSubmit={(data) => {
                    // 데모용: 가상 저장 (실제 API 호출 주석 처리)
                    // createOrUpdateMutation.mutate({ ...data, id: editingBudget?.id });
                    handleMockSubmit(data);
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
        ) : (budgets.length === 0 ? (
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
          <div className="grid gap-6 md:grid-cols-2 mt-6">
            {Array.isArray(budgets) &&
              budgets.map((budget) => {
                const used = budget.usage?.totalSpent ?? 0;
                const total = budget.amount;
                const rate = total > 0 ? Math.round((used / total) * 100) : 0;
                const startStr =
                  budget.periodStart &&
                  new Date(budget.periodStart).toLocaleDateString("ko-KR");
                const endStr =
                  budget.periodEnd &&
                  new Date(budget.periodEnd).toLocaleDateString("ko-KR");
                return (
                  <Card
                    key={budget.id}
                    className="shadow-sm border-slate-200"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex justify-between items-center">
                        {budget.name}
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-200"
                        >
                          운영 중
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {startStr} ~ {endStr}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-500">
                            사용 금액 ({rate}%)
                          </span>
                          <span className="font-bold">
                            ₩{used.toLocaleString("ko-KR")} / ₩
                            {total.toLocaleString("ko-KR")}
                          </span>
                        </div>
                        <Progress value={rate} className="h-2" />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingBudget(budget);
                            setIsDialogOpen(true);
                          }}
                        >
                          상세 보기
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm("정말 이 예산을 삭제하시겠습니까?")) {
                              setBudgets((prev) =>
                                prev.filter((b) => b.id !== budget.id)
                              );
                            }
                          }}
                        >
                          삭제
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        ))}
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
    <Card className={`p-3 md:p-6 ${isOverBudget ? "border-red-300 bg-red-50" : isWarning ? "border-orange-300 bg-orange-50" : ""}`}>
      <CardHeader className="px-0 pt-0 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm md:text-lg truncate">{budget.name}</CardTitle>
            <CardDescription className="mt-1 text-xs md:text-sm">
              {budget.projectName && <span className="mr-2">프로젝트: {budget.projectName}</span>}
              <span className="whitespace-nowrap">
                {new Date(budget.periodStart).toLocaleDateString("ko-KR")} ~{" "}
                {new Date(budget.periodEnd).toLocaleDateString("ko-KR")}
              </span>
            </CardDescription>
          </div>
          <div className="flex gap-1 md:gap-2 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={onEdit} className="text-xs md:text-sm h-7 md:h-9 px-2 md:px-3">
              <Edit className="h-3 w-3 md:h-4 md:w-4 mr-0 md:mr-1" />
              <span className="hidden sm:inline">수정</span>
            </Button>
            <Button size="sm" variant="outline" onClick={onDelete} className="text-xs md:text-sm h-7 md:h-9 px-2 md:px-3">
              <Trash2 className="h-3 w-3 md:h-4 md:w-4 mr-0 md:mr-1" />
              <span className="hidden sm:inline">삭제</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 space-y-3 md:space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div>
            <div className="text-xs md:text-sm text-muted-foreground">예산 금액</div>
            <div className="text-base md:text-lg font-semibold break-words">
              {budget.amount.toLocaleString()} {budget.currency}
            </div>
          </div>
          {usage && (
            <>
              <div>
                <div className="text-xs md:text-sm text-muted-foreground">사용 금액</div>
                <div className="text-base md:text-lg font-semibold break-words">
                  {usage.totalSpent.toLocaleString()} {budget.currency}
                </div>
              </div>
              <div>
                <div className="text-xs md:text-sm text-muted-foreground">잔여 금액</div>
                <div className={`text-base md:text-lg font-semibold break-words ${usage.remaining < 0 ? "text-red-600" : ""}`}>
                  {usage.remaining.toLocaleString()} {budget.currency}
                </div>
              </div>
              <div>
                <div className="text-xs md:text-sm text-muted-foreground">사용률</div>
                <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                  <div className="text-base md:text-lg font-semibold">{usageRate.toFixed(1)}%</div>
                  {isOverBudget && (
                    <Badge variant="destructive" className="text-[10px] md:text-xs">
                      <AlertTriangle className="h-2.5 w-2.5 md:h-3 md:w-3 mr-0.5 md:mr-1" />
                      초과
                    </Badge>
                  )}
                  {isWarning && !isOverBudget && (
                    <Badge variant="outline" className="bg-orange-100 text-orange-800 text-[10px] md:text-xs">
                      경고
                    </Badge>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {usage && (
          <div className="space-y-1.5 md:space-y-2">
            <div className="flex items-center justify-between text-xs md:text-sm">
              <span className="text-muted-foreground">예산 사용률</span>
              <span className="font-medium">{usageRate.toFixed(1)}%</span>
            </div>
            <Progress
              value={Math.min(usageRate, 100)}
              className={`h-1.5 md:h-2 ${isOverBudget ? "bg-red-200" : isWarning ? "bg-orange-200" : ""}`}
            />
          </div>
        )}

        {budget.description && (
          <div className="text-xs md:text-sm text-muted-foreground pt-2 border-t">
            {budget.description}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BudgetForm({
  budget,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: {
  budget?: Budget | null;
  isSubmitting?: boolean;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  
  // 기본값 설정: 시작일 = 오늘, 종료일 = 올해 12월 31일
  const getDefaultStartDate = (): Date => {
    if (budget?.periodStart) {
      return new Date(budget.periodStart);
    }
    return new Date();
  };

  const getDefaultEndDate = (): Date => {
    if (budget?.periodEnd) {
      return new Date(budget.periodEnd);
    }
    const now = new Date();
    return new Date(now.getFullYear(), 11, 31); // 12월 31일 (월은 0-based)
  };

  const [name, setName] = useState(budget?.name || "");
  const [amount, setAmount] = useState(budget?.amount?.toString() || "");
  const [currency, setCurrency] = useState(budget?.currency || "KRW");
  const [periodStart, setPeriodStart] = useState<Date | null>(getDefaultStartDate());
  const [periodEnd, setPeriodEnd] = useState<Date | null>(getDefaultEndDate());
  const [targetDepartment, setTargetDepartment] = useState(budget?.targetDepartment || "");
  const [projectName, setProjectName] = useState(budget?.projectName || "");
  const [description, setDescription] = useState(budget?.description || "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 금액 포맷팅 (천 단위 구분)
  const formatAmount = (value: string) => {
    const numValue = value.replace(/,/g, "");
    if (!numValue) return "";
    const num = parseFloat(numValue);
    if (isNaN(num)) return value;
    return num.toLocaleString("ko-KR");
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/,/g, "");
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      if (errors.amount) {
        setErrors((prev) => ({ ...prev, amount: "" }));
      }
    }
  };

  const handlePeriodStartChange = (date: Date | undefined) => {
    if (!date) {
      setPeriodStart(null);
      return;
    }
    setPeriodStart(date);
    if (periodEnd && date > periodEnd) {
      setErrors((prev) => ({ ...prev, periodStart: "시작일은 종료일보다 이전이어야 합니다." }));
    } else {
      setErrors((prev) => ({ ...prev, periodStart: "" }));
    }
  };

  const handlePeriodEndChange = (date: Date | undefined) => {
    if (!date) {
      setPeriodEnd(null);
      return;
    }
    setPeriodEnd(date);
    if (periodStart && date < periodStart) {
      setErrors((prev) => ({ ...prev, periodEnd: "종료일은 시작일보다 이후여야 합니다." }));
    } else {
      setErrors((prev) => ({ ...prev, periodEnd: "" }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "예산 이름을 입력해주세요.";
    }

    const amountNum = parseFloat(amount.replace(/,/g, ""));
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = "올바른 예산 금액을 입력해주세요.";
    }

    if (!periodStart) {
      newErrors.periodStart = "시작일을 선택해주세요.";
    }

    if (!periodEnd) {
      newErrors.periodEnd = "종료일을 선택해주세요.";
    }

    if (periodStart && periodEnd && periodStart.getTime() > periodEnd.getTime()) {
      newErrors.periodEnd = "종료일은 시작일보다 이후여야 합니다.";
    }

    if (!targetDepartment.trim()) {
      newErrors.targetDepartment = "대상 부서/팀을 선택해주세요.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      toast({
        title: "입력 오류",
        description: "입력한 정보를 확인해주세요.",
        variant: "destructive",
      });
      return;
    }

    // 콤마 제거 및 숫자 변환
    const cleanAmount = Number(String(amount).replace(/,/g, ""));
    
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      toast({
        title: "입력 오류",
        description: "올바른 예산 금액을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    onSubmit({
      name: name.trim(),
      amount: cleanAmount,
      currency,
      periodStart: periodStart ? periodStart.toISOString().split("T")[0] : "",
      periodEnd: periodEnd ? periodEnd.toISOString().split("T")[0] : "",
      targetDepartment: targetDepartment.trim() || undefined,
      projectName: projectName.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">예산 이름 *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) {
              setErrors((prev) => ({ ...prev, name: "" }));
            }
          }}
          placeholder="예: 2024년 R&D 예산"
          required
          className={errors.name ? "border-red-500" : ""}
        />
        {errors.name && (
          <p className="text-xs text-red-500 mt-1">{errors.name}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount">예산 금액 *</Label>
          <div className="relative">
            <Input
              id="amount"
              type="text"
              value={formatAmount(amount)}
              onChange={handleAmountChange}
              placeholder="예: 10,000,000"
              required
              className={errors.amount ? "border-red-500" : ""}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {currency}
            </span>
          </div>
          {errors.amount && (
            <p className="text-xs text-red-500 mt-1">{errors.amount}</p>
          )}
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
              <SelectItem value="JPY">JPY (엔)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="periodStart">기간 시작 *</Label>
          <DatePicker
            date={periodStart || undefined}
            onDateChange={handlePeriodStartChange}
            placeholder="날짜를 선택하세요"
            maxDate={periodEnd || undefined}
            className={errors.periodStart ? "border-red-500" : ""}
          />
          {errors.periodStart && (
            <p className="text-xs text-red-500 mt-1">{errors.periodStart}</p>
          )}
        </div>
        <div>
          <Label htmlFor="periodEnd">기간 종료 *</Label>
          <DatePicker
            date={periodEnd || undefined}
            onDateChange={handlePeriodEndChange}
            placeholder="날짜를 선택하세요"
            minDate={periodStart || undefined}
            className={errors.periodEnd ? "border-red-500" : ""}
          />
          {errors.periodEnd && (
            <p className="text-xs text-red-500 mt-1">{errors.periodEnd}</p>
          )}
        </div>
      </div>

      {periodStart && periodEnd && (
        <div className="p-3 bg-slate-50 rounded-lg text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 inline mr-1" />
          예산 기간: {periodStart.toLocaleDateString("ko-KR")} ~ {periodEnd.toLocaleDateString("ko-KR")}
          {" "}
          ({Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))}일)
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="targetDepartment">
          대상 부서/팀 <span className="text-red-500">*</span>
        </Label>
        <Select
          value={targetDepartment}
          onValueChange={(v) => {
            setTargetDepartment(v);
            if (errors.targetDepartment) setErrors((prev) => ({ ...prev, targetDepartment: "" }));
          }}
        >
          <SelectTrigger id="targetDepartment" className={errors.targetDepartment ? "border-red-500" : ""}>
            <SelectValue placeholder="부서를 선택해주세요" />
          </SelectTrigger>
          <SelectContent>
            {BUDGET_DEPARTMENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || "empty"} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.targetDepartment && (
          <p className="text-xs text-red-500 mt-1">{errors.targetDepartment}</p>
        )}
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
          className="resize-none"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          취소
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? (budget ? "수정 중..." : "저장 중...") : budget ? "수정" : "저장"}
        </Button>
      </div>
    </form>
  );
}