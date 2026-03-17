"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowRight,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Users,
  Calendar,
  CreditCard,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import type {
  CheckoutDialogProps,
  CheckoutStep,
  CheckoutStatus,
  BillingInfoData,
  CheckoutCompletionData,
  CheckoutErrorCode,
} from "./checkout-types";
import { CHECKOUT_ERROR_MESSAGES } from "./checkout-types";
import {
  buildPlanChangePreview,
  formatPrice,
  getStepLabel,
  CHECKOUT_STEPS,
  validateBillingInfo,
  formatSeatLimit,
  isUpgrade,
} from "./checkout-utils";
import { SubscriptionPlan, PLAN_DISPLAY, ENTERPRISE_INFO } from "@/lib/plans";

// ── 단계 표시 컴포넌트 ───────────────────────────────
function StepIndicator({
  steps,
  currentStep,
}: {
  steps: CheckoutStep[];
  currentStep: CheckoutStep;
}) {
  const currentIndex = steps.indexOf(currentStep);

  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((step, i) => {
        const isActive = i === currentIndex;
        const isCompleted = i < currentIndex;
        return (
          <div key={step} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                  ${isCompleted ? "bg-emerald-500 text-white" : ""}
                  ${isActive ? "bg-slate-900 text-white" : ""}
                  ${!isActive && !isCompleted ? "bg-slate-200 text-slate-500" : ""}
                `}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  isActive ? "text-slate-100" : "text-slate-400"
                }`}
              >
                {getStepLabel(step)}
              </span>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 주문 요약 사이드바 ───────────────────────────────
function OrderSummary({
  preview,
  billingCycle,
}: {
  preview: ReturnType<typeof buildPlanChangePreview>;
  billingCycle: "monthly" | "yearly";
}) {
  return (
    <div className="bg-slate-900 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">주문 요약</h3>
      <Separator />

      {/* 플랜 비교 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">현재 플랜</span>
          <span className="font-medium">{preview.currentPlanDisplay}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">변경 플랜</span>
          <Badge variant="default" className="text-xs">
            {preview.targetPlanDisplay}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* 가격 정보 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">결제 주기</span>
          <span className="font-medium">
            {billingCycle === "yearly" ? "연간" : "월간"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">월 요금</span>
          <span className="font-medium">
            {formatPrice(preview.pricing.effectiveMonthlyPrice)}
          </span>
        </div>
        {billingCycle === "yearly" && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">연간 합계</span>
            <span className="font-semibold">
              {formatPrice(preview.pricing.recurringAmount)}
            </span>
          </div>
        )}
      </div>

      <Separator />

      {/* 적용 시점 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs">
          <Calendar className="h-3 w-3 text-slate-400" />
          <span className="text-slate-500">적용 시점</span>
        </div>
        <p className="text-xs font-medium text-slate-300">
          {preview.pricing.effectiveDescription}
        </p>
      </div>

      {/* 다음 결제일 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs">
          <CreditCard className="h-3 w-3 text-slate-400" />
          <span className="text-slate-500">다음 결제일</span>
        </div>
        <p className="text-xs font-medium text-slate-300">
          {preview.pricing.nextBillingDate}
        </p>
      </div>

      {/* 좌석 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs">
          <Users className="h-3 w-3 text-slate-400" />
          <span className="text-slate-500">멤버 한도</span>
        </div>
        <p className="text-xs font-medium text-slate-300">
          {formatSeatLimit(preview.seatChanges.current)} →{" "}
          {formatSeatLimit(preview.seatChanges.target)}
        </p>
      </div>
    </div>
  );
}

// ── Step 1: 변경 확인 ────────────────────────────────
function ConfirmStep({
  preview,
}: {
  preview: ReturnType<typeof buildPlanChangePreview>;
}) {
  const upgrade = preview.effectiveDate === "immediate";

  return (
    <div className="space-y-5">
      {/* 플랜 비교 카드 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 p-3 rounded-lg border border-slate-800 bg-slate-900">
          <p className="text-xs text-slate-500 mb-1">현재 플랜</p>
          <p className="text-base font-semibold">{preview.currentPlanDisplay}</p>
          <p className="text-sm text-slate-400">{formatPrice(preview.currentPrice)}/월</p>
        </div>
        <ArrowRight className="h-5 w-5 text-slate-400 shrink-0" />
        <div className="flex-1 p-3 rounded-lg border-2 border-slate-900 bg-slate-900">
          <p className="text-xs text-slate-500 mb-1">변경 플랜</p>
          <p className="text-base font-semibold">{preview.targetPlanDisplay}</p>
          <p className="text-sm text-slate-400">{formatPrice(preview.targetPrice)}/월</p>
        </div>
      </div>

      {/* 적용 시점 안내 */}
      <div
        className={`p-3 rounded-lg text-sm ${
          upgrade
            ? "bg-blue-950/20 text-blue-800 border border-blue-800"
            : "bg-amber-950/30 text-amber-800 border border-amber-800"
        }`}
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">
              {upgrade ? "즉시 적용" : "다음 갱신일부터 적용"}
            </p>
            <p className="text-xs mt-0.5 opacity-80">
              {upgrade
                ? "플랜 변경 즉시 새 기능을 사용할 수 있습니다."
                : "현재 결제 주기가 끝난 후 변경된 플랜이 적용됩니다. 그때까지 기존 기능을 계속 사용할 수 있습니다."}
            </p>
          </div>
        </div>
      </div>

      {/* 기능 변경 */}
      {(preview.featureChanges.gained.length > 0 ||
        preview.featureChanges.lost.length > 0) && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-100">기능 변경 사항</h4>
          {preview.featureChanges.gained.length > 0 && (
            <div className="space-y-1.5">
              {preview.featureChanges.gained.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-2 text-sm text-emerald-700"
                >
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          )}
          {preview.featureChanges.lost.length > 0 && (
            <div className="space-y-1.5">
              {preview.featureChanges.lost.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-2 text-sm text-red-400"
                >
                  <X className="h-3.5 w-3.5 shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 좌석 변경 */}
      {preview.seatChanges.current !== preview.seatChanges.target && (
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-slate-500" />
            <span className="text-slate-400">멤버 한도:</span>
            <span className="font-medium">
              {formatSeatLimit(preview.seatChanges.current)}
            </span>
            <ArrowRight className="h-3 w-3 text-slate-400" />
            <span className="font-medium">
              {formatSeatLimit(preview.seatChanges.target)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 2: 청구 정보 ────────────────────────────────
function BillingStep({
  billingInfo,
  onChange,
  errors,
}: {
  billingInfo: BillingInfoData;
  onChange: (field: keyof BillingInfoData, value: string) => void;
  errors: string[];
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        세금계산서 발행을 위한 정보를 입력해 주세요.
      </p>

      {errors.length > 0 && (
        <div className="p-3 rounded-lg bg-red-950/30 border border-red-800 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>필수 항목을 입력해 주세요: {errors.join(", ")}</span>
          </div>
        </div>
      )}

      {/* 회사 정보 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="companyName" className="text-xs">
            회사명 <span className="text-red-500">*</span>
          </Label>
          <Input
            id="companyName"
            value={billingInfo.companyName}
            onChange={(e) => onChange("companyName", e.target.value)}
            placeholder="주식회사 바이오인사이트"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="businessNumber" className="text-xs">
            사업자등록번호
          </Label>
          <Input
            id="businessNumber"
            value={billingInfo.businessNumber || ""}
            onChange={(e) => onChange("businessNumber", e.target.value)}
            placeholder="000-00-00000"
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="representativeName" className="text-xs">
          대표자명
        </Label>
        <Input
          id="representativeName"
          value={billingInfo.representativeName || ""}
          onChange={(e) => onChange("representativeName", e.target.value)}
          placeholder="홍길동"
          className="h-9 text-sm"
        />
      </div>

      <Separator />

      {/* 담당자 정보 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contactName" className="text-xs">
            담당자명 <span className="text-red-500">*</span>
          </Label>
          <Input
            id="contactName"
            value={billingInfo.contactName}
            onChange={(e) => onChange("contactName", e.target.value)}
            placeholder="김담당"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactEmail" className="text-xs">
            청구 이메일 <span className="text-red-500">*</span>
          </Label>
          <Input
            id="contactEmail"
            type="email"
            value={billingInfo.contactEmail}
            onChange={(e) => onChange("contactEmail", e.target.value)}
            placeholder="billing@company.com"
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contactPhone" className="text-xs">
            연락처
          </Label>
          <Input
            id="contactPhone"
            value={billingInfo.contactPhone || ""}
            onChange={(e) => onChange("contactPhone", e.target.value)}
            placeholder="02-0000-0000"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="taxInvoiceEmail" className="text-xs">
            세금계산서 수신 이메일
          </Label>
          <Input
            id="taxInvoiceEmail"
            type="email"
            value={billingInfo.taxInvoiceEmail || ""}
            onChange={(e) => onChange("taxInvoiceEmail", e.target.value)}
            placeholder="tax@company.com"
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address" className="text-xs">
          주소
        </Label>
        <Input
          id="address"
          value={billingInfo.address || ""}
          onChange={(e) => onChange("address", e.target.value)}
          placeholder="서울시 강남구 ..."
          className="h-9 text-sm"
        />
      </div>
    </div>
  );
}

// ── Step 3: 최종 확인 ────────────────────────────────
function ReviewStep({
  preview,
  billingInfo,
  billingCycle,
  agreed,
  onAgreeChange,
}: {
  preview: ReturnType<typeof buildPlanChangePreview>;
  billingInfo: BillingInfoData;
  billingCycle: "monthly" | "yearly";
  agreed: boolean;
  onAgreeChange: (checked: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {/* 변경 요약 */}
      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
        <h4 className="text-sm font-medium text-slate-100">변경 요약</h4>
        <div className="grid grid-cols-2 gap-y-1.5 text-xs">
          <span className="text-slate-500">플랜</span>
          <span className="font-medium text-right">
            {preview.currentPlanDisplay} → {preview.targetPlanDisplay}
          </span>
          <span className="text-slate-500">결제 주기</span>
          <span className="font-medium text-right">
            {billingCycle === "yearly" ? "연간" : "월간"}
          </span>
          <span className="text-slate-500">월 요금</span>
          <span className="font-medium text-right">
            {formatPrice(preview.pricing.effectiveMonthlyPrice)}
          </span>
          <span className="text-slate-500">적용 시점</span>
          <span className="font-medium text-right">
            {preview.effectiveDate === "immediate"
              ? "즉시 적용"
              : "다음 갱신일"}
          </span>
          <span className="text-slate-500">다음 결제일</span>
          <span className="font-medium text-right">
            {preview.pricing.nextBillingDate}
          </span>
        </div>
      </div>

      {/* 청구 정보 요약 */}
      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
        <h4 className="text-sm font-medium text-slate-100">청구 정보</h4>
        <div className="grid grid-cols-2 gap-y-1.5 text-xs">
          <span className="text-slate-500">회사명</span>
          <span className="font-medium text-right">{billingInfo.companyName}</span>
          {billingInfo.businessNumber && (
            <>
              <span className="text-slate-500">사업자등록번호</span>
              <span className="font-medium text-right">
                {billingInfo.businessNumber}
              </span>
            </>
          )}
          <span className="text-slate-500">담당자</span>
          <span className="font-medium text-right">{billingInfo.contactName}</span>
          <span className="text-slate-500">이메일</span>
          <span className="font-medium text-right">{billingInfo.contactEmail}</span>
        </div>
      </div>

      {/* 동의 체크박스 */}
      <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-800">
        <Checkbox
          id="agree"
          checked={agreed}
          onCheckedChange={(checked) => onAgreeChange(checked === true)}
          className="mt-0.5"
        />
        <label htmlFor="agree" className="text-xs text-slate-400 leading-relaxed cursor-pointer">
          위 내용을 확인하였으며, 플랜 변경에 동의합니다.
          플랜 변경 후에는 새 요금이 적용됩니다.
        </label>
      </div>
    </div>
  );
}

// ── Step 4: 완료 ─────────────────────────────────────
function CompleteStep({
  completion,
}: {
  completion: CheckoutCompletionData | null;
}) {
  if (!completion) return null;

  return (
    <div className="flex flex-col items-center text-center py-6 space-y-4">
      <div className="w-12 h-12 rounded-full bg-emerald-900/40 flex items-center justify-center">
        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-100">
          플랜 변경이 완료되었습니다
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          {completion.newPlanDisplay} 플랜이 적용되었습니다.
        </p>
      </div>

      <div className="w-full p-4 rounded-lg bg-slate-900 border border-slate-800 text-left space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">현재 플랜</span>
          <span className="font-medium">{completion.newPlanDisplay}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">결제 주기</span>
          <span className="font-medium">
            {completion.billingCycle === "yearly" ? "연간" : "월간"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">다음 결제일</span>
          <span className="font-medium">{completion.nextBillingDate}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">정기 결제 금액</span>
          <span className="font-semibold">{formatPrice(completion.recurringAmount)}</span>
        </div>
      </div>
    </div>
  );
}

// ── 메인 CheckoutDialog ──────────────────────────────
export default function CheckoutDialog({
  open,
  onOpenChange,
  currentPlan,
  targetPlan,
  isAnnual,
  currentSeats,
  organizationId,
  onComplete,
}: CheckoutDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 상태
  const [step, setStep] = useState<CheckoutStep>("confirm");
  const [status, setStatus] = useState<CheckoutStatus>("reviewing_change");
  const [agreed, setAgreed] = useState(false);
  const [billingErrors, setBillingErrors] = useState<string[]>([]);
  const [completion, setCompletion] = useState<CheckoutCompletionData | null>(null);
  const [billingInfo, setBillingInfo] = useState<BillingInfoData>({
    companyName: "",
    businessNumber: "",
    representativeName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    taxInvoiceEmail: "",
  });

  const billingCycle = isAnnual ? "yearly" as const : "monthly" as const;

  // 프리뷰 계산
  const preview = useMemo(
    () => buildPlanChangePreview(currentPlan, targetPlan, billingCycle, currentSeats),
    [currentPlan, targetPlan, billingCycle, currentSeats],
  );

  // 기존 청구 정보 로드
  const { data: existingBilling } = useQuery({
    queryKey: ["billingInfo", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/billing-info`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.billingInfo as BillingInfoData | null;
    },
    enabled: open && !!organizationId,
  });

  // 기존 청구 정보 pre-fill
  useEffect(() => {
    if (existingBilling) {
      setBillingInfo({
        companyName: existingBilling.companyName || "",
        businessNumber: existingBilling.businessNumber || "",
        representativeName: existingBilling.representativeName || "",
        contactName: existingBilling.contactName || "",
        contactEmail: existingBilling.contactEmail || "",
        contactPhone: existingBilling.contactPhone || "",
        address: existingBilling.address || "",
        taxInvoiceEmail: existingBilling.taxInvoiceEmail || "",
      });
    }
  }, [existingBilling]);

  // Dialog 열릴 때 초기화
  useEffect(() => {
    if (open) {
      setStep("confirm");
      setStatus("reviewing_change");
      setAgreed(false);
      setBillingErrors([]);
      setCompletion(null);
    }
  }, [open]);

  // 청구 정보 저장 mutation
  const billingMutation = useMutation({
    mutationFn: async (data: BillingInfoData) => {
      const res = await fetch(`/api/organizations/${organizationId}/billing-info`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "청구 정보 저장 실패");
      }
      return res.json();
    },
  });

  // 플랜 변경 mutation
  const changePlanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: targetPlan,
          periodMonths: isAnnual ? 12 : 1,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "플랜 변경 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      setStatus("success");
      setStep("complete");
      setCompletion({
        newPlan: targetPlan,
        newPlanDisplay: PLAN_DISPLAY[targetPlan].displayName,
        nextBillingDate: preview.pricing.nextBillingDate,
        recurringAmount: preview.pricing.recurringAmount,
        billingCycle,
      });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["billingInfo"] });
    },
    onError: (error: Error) => {
      setStatus("failed");
      toast({
        title: "플랜 변경 실패",
        description: error.message || CHECKOUT_ERROR_MESSAGES.UNKNOWN_ERROR,
        variant: "destructive",
      });
    },
  });

  // 필드 변경 핸들러
  const handleBillingChange = (field: keyof BillingInfoData, value: string) => {
    setBillingInfo((prev) => ({ ...prev, [field]: value }));
    setBillingErrors([]);
  };

  // 다음 단계 핸들러
  const handleNext = async () => {
    if (step === "confirm") {
      setStep("billing");
      setStatus("entering_billing");
      return;
    }

    if (step === "billing") {
      // 필수 필드 검증
      const validation = validateBillingInfo(billingInfo);
      if (!validation.valid) {
        setBillingErrors(validation.missingFields);
        return;
      }
      // 청구 정보 저장
      try {
        await billingMutation.mutateAsync(billingInfo);
        setStep("review");
        setStatus("confirming");
      } catch {
        // 에러는 mutation에서 처리
      }
      return;
    }

    if (step === "review") {
      if (!agreed) return;
      setStatus("processing_payment");
      changePlanMutation.mutate();
      return;
    }

    if (step === "complete") {
      onOpenChange(false);
      onComplete();
      return;
    }
  };

  // 이전 단계 핸들러
  const handleBack = () => {
    if (step === "billing") {
      setStep("confirm");
      setStatus("reviewing_change");
    } else if (step === "review") {
      setStep("billing");
      setStatus("entering_billing");
    }
  };

  // 버튼 라벨
  const getNextLabel = () => {
    if (step === "confirm") return "다음: 청구 정보";
    if (step === "billing") return billingMutation.isPending ? "저장 중..." : "다음: 최종 확인";
    if (step === "review") {
      if (changePlanMutation.isPending || status === "processing_payment") return "처리 중...";
      return "플랜 변경 확정";
    }
    if (step === "complete") return "확인";
    return "다음";
  };

  const isNextDisabled = () => {
    if (step === "review" && !agreed) return true;
    if (billingMutation.isPending) return true;
    if (changePlanMutation.isPending || status === "processing_payment") return true;
    return false;
  };

  const isProcessing =
    billingMutation.isPending ||
    changePlanMutation.isPending ||
    status === "processing_payment";

  return (
    <Dialog open={open} onOpenChange={(v) => {
      // 처리 중에는 닫기 방지
      if (isProcessing) return;
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <div className="p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-lg">구독 플랜 변경</DialogTitle>
          </DialogHeader>

          {/* 단계 표시 */}
          <StepIndicator steps={CHECKOUT_STEPS} currentStep={step} />

          {/* 메인 레이아웃: 좌측 콘텐츠 + 우측 요약 */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* 좌측: 단계별 콘텐츠 */}
            <div className="lg:col-span-3">
              {step === "confirm" && <ConfirmStep preview={preview} />}
              {step === "billing" && (
                <BillingStep
                  billingInfo={billingInfo}
                  onChange={handleBillingChange}
                  errors={billingErrors}
                />
              )}
              {step === "review" && (
                <ReviewStep
                  preview={preview}
                  billingInfo={billingInfo}
                  billingCycle={billingCycle}
                  agreed={agreed}
                  onAgreeChange={setAgreed}
                />
              )}
              {step === "complete" && <CompleteStep completion={completion} />}
            </div>

            {/* 우측: 주문 요약 (완료 단계에서는 숨김) */}
            {step !== "complete" && (
              <div className="lg:col-span-2">
                <OrderSummary preview={preview} billingCycle={billingCycle} />
              </div>
            )}
          </div>

          {/* 하단 버튼 */}
          <Separator className="my-4" />
          <div className="flex items-center justify-between">
            <div>
              {step !== "confirm" && step !== "complete" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  disabled={isProcessing}
                  className="text-sm"
                >
                  이전
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {step !== "complete" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={isProcessing}
                  className="text-sm"
                >
                  취소
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                disabled={isNextDisabled()}
                className="text-sm min-w-[120px]"
              >
                {isProcessing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {getNextLabel()}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
