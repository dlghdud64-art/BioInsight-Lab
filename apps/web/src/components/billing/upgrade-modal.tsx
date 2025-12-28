"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { SubscriptionPlan } from "@/lib/plans";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  requiredPlan: SubscriptionPlan;
  onUpgrade?: () => void;
}

const PLAN_FEATURES = {
  [SubscriptionPlan.TEAM]: [
    "멤버 20명까지",
    "월 100개 견적 요청",
    "고급 리포트",
    "예산 관리",
    "자동 재주문",
    "Export Pack",
  ],
  [SubscriptionPlan.ORGANIZATION]: [
    "무제한 멤버",
    "무제한 견적 요청",
    "벤더 포털",
    "SSO 인증",
    "온프레미스 지원",
    "우선 지원",
    "모든 Team 기능",
  ],
};

export function UpgradeModal({
  open,
  onOpenChange,
  feature,
  requiredPlan,
  onUpgrade,
}: UpgradeModalProps) {
  const planName = requiredPlan === SubscriptionPlan.TEAM ? "Team" : "Organization";
  const features = PLAN_FEATURES[requiredPlan] || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <Badge variant="secondary">{planName}</Badge>
              플랜이 필요합니다
            </span>
          </DialogTitle>
          <DialogDescription>
            <strong>{feature}</strong> 기능은 {planName} 플랜 이상에서 사용할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="text-sm font-medium mb-3">{planName} 플랜 주요 기능:</div>
          <ul className="space-y-2">
            {features.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            취소
          </Button>
          <Button
            onClick={() => {
              onUpgrade?.();
              onOpenChange(false);
            }}
            className="w-full sm:w-auto"
          >
            {planName} 플랜으로 업그레이드
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

