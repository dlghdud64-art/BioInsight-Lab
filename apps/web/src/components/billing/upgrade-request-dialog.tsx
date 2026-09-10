"use client";

/**
 * §billing-redesign P5: 업그레이드 요청 모달.
 *
 * 결제 연동 전 `업그레이드` 버튼의 종착지다. 클릭이 무반응이면 dead button 이고,
 *   보내지 않은 요청을 "완료" 라 말하면 placeholder success 다. 둘 다 만들지 않는다.
 *
 * 실패는 모달 **안에** 남긴다. 토스트만 쓰면 모달은 열린 채인데 사유가 사라진다
 *   (조직 초대 모달이 같은 이유로 인라인 오류를 쓴다).
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { csrfFetch } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import {
  UPGRADE_INQUIRY_TYPE,
  buildUpgradeMessage,
  describeUpgradeFailure,
  validateUpgradeRequest,
} from "@/lib/billing/upgrade-request";

export interface UpgradeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 요청 대상 플랜의 표시 라벨(Basic / Pro 등) */
  planLabel: string;
  /** 세션에서 온 기본값. 사용자가 고칠 수 있다. */
  defaultName?: string | null;
  defaultEmail?: string | null;
  organizationName?: string | null;
}

export function UpgradeRequestDialog({
  open,
  onOpenChange,
  planLabel,
  defaultName,
  defaultEmail,
  organizationName,
}: UpgradeRequestDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // 열릴 때마다 세션 값으로 다시 채운다(controlled 규약 - 이전 입력 잔상 0).
  useEffect(() => {
    if (!open) return;
    setName(defaultName?.trim() || "");
    setEmail(defaultEmail?.trim() || "");
    setMessage(buildUpgradeMessage(planLabel, organizationName));
    setError(null);
    setPending(false);
  }, [open, defaultName, defaultEmail, planLabel, organizationName]);

  const submit = async () => {
    const form = { name, email, message };
    const check = validateUpgradeRequest(form);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await csrfFetch("/api/support/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryType: UPGRADE_INQUIRY_TYPE, ...form }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        /* 🛑 429(5분 중복)·400(검증)을 성공으로 덮지 않는다. 사유를 그대로 남긴다. */
        setError(describeUpgradeFailure(res.status, (payload as { error?: string }).error));
        return;
      }
      const ref = (payload as { referenceId?: string }).referenceId;
      toast({
        title: "업그레이드 요청을 접수했습니다",
        description: ref
          ? `접수번호 ${ref} · 영업팀이 확인 후 연락드립니다.`
          : "영업팀이 확인 후 연락드립니다.",
      });
      onOpenChange(false);
    } catch {
      setError("요청을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-white border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-slate-900">{planLabel} 업그레이드 요청</DialogTitle>
          <DialogDescription className="text-slate-500">
            결제 연동 전이라 영업팀이 도입 절차를 안내드립니다. 연락처를 확인해 주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="upgrade-name" className="text-sm font-semibold text-slate-700">
              이름 또는 기관명
            </Label>
            <Input
              id="upgrade-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
              placeholder="홍길동 / OO대학교 OO연구실"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="upgrade-email" className="text-sm font-semibold text-slate-700">
              이메일
            </Label>
            <Input
              id="upgrade-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
              placeholder="colleague@univ.edu"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="upgrade-message" className="text-sm font-semibold text-slate-700">
              문의 내용
            </Label>
            <Textarea
              id="upgrade-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="rounded-xl border-slate-200 bg-white text-slate-900"
            />
          </div>

          {/* 실패 사유는 여기 남는다. 모달이 열린 채 사유만 사라지지 않게. */}
          {error && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3" role="alert">
              <p className="text-sm text-yellow-800">{error}</p>
            </div>
          )}

          <Button
            className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            disabled={pending}
            onClick={submit}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                접수 중...
              </>
            ) : (
              "요청 보내기"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
