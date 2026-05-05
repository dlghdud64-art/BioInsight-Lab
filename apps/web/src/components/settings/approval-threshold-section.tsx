"use client";

/**
 * §11.209d-approver-routing — 결재 임계치 admin form section.
 *
 * canonical truth = Workspace.approvalThresholdKrw (DB).
 * default 10,000,000 (1,000만원) — 이 금액 이상 결재 요청은 organization
 * OWNER escalation. selectApproverByAmount helper 가 사용.
 *
 * Lock:
 *   - ADMIN role 만 visible (form section 자체 hide)
 *   - PATCH /api/workspaces/[id] — server zod 검증 + verifyWorkspaceAccess('ADMIN')
 *   - default 10,000,000 fallback (helper 상수와 동일)
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { csrfFetch } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface WorkspaceDetail {
  id: string;
  approvalThresholdKrw: number;
  members?: Array<{
    userId: string;
    role: string;
  }>;
}

interface Props {
  workspaceId: string;
  currentUserId: string;
}

export function ApprovalThresholdSection({ workspaceId, currentUserId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [thresholdInput, setThresholdInput] = useState<string>("");

  const { data: workspace } = useQuery<WorkspaceDetail | null>({
    queryKey: ["workspace-detail", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.workspace ?? json;
    },
    enabled: !!workspaceId,
    staleTime: 60_000,
  });

  // sync state with fetched value
  useEffect(() => {
    if (workspace?.approvalThresholdKrw != null) {
      setThresholdInput(String(workspace.approvalThresholdKrw));
    }
  }, [workspace?.approvalThresholdKrw]);

  const isAdmin =
    workspace?.members?.find((m) => m.userId === currentUserId)?.role === "ADMIN";

  const mutation = useMutation({
    mutationFn: async (newThreshold: number) => {
      const res = await csrfFetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalThresholdKrw: newThreshold }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "결재 임계치 저장 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-detail", workspaceId] });
      toast({ title: "결재 임계치 저장 완료", description: "다음 결재 요청부터 반영됩니다." });
    },
    onError: (err: Error) => {
      toast({ title: "저장 실패", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    const parsed = parseInt(thresholdInput, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast({ title: "잘못된 값", description: "0 이상 정수를 입력해 주세요.", variant: "destructive" });
      return;
    }
    if (parsed > 10_000_000_000) {
      toast({ title: "임계치 너무 큼", description: "100억(KRW) 이하로 설정해 주세요.", variant: "destructive" });
      return;
    }
    mutation.mutate(parsed);
  };

  // ADMIN 외 — form section hide (dead button 0)
  if (!isAdmin) return null;

  const currentValue = workspace?.approvalThresholdKrw ?? 10_000_000;
  const isDirty = parseInt(thresholdInput, 10) !== currentValue;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900">결재 임계치</h3>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          이 금액 (KRW) 이상의 결재 요청은 자동으로 organization OWNER 또는 ADMIN 에게 escalation 됩니다.
          기본값 10,000,000 KRW (1,000만원).
        </p>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label htmlFor="approval-threshold-krw" className="text-xs font-medium text-slate-600">
            금액 (KRW)
          </Label>
          <Input
            id="approval-threshold-krw"
            type="number"
            min={0}
            max={10_000_000_000}
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
            placeholder="10000000"
            className="mt-1 bg-white border-slate-200 text-slate-900 h-9 text-sm font-mono"
          />
        </div>
        <Button
          onClick={handleSave}
          disabled={!isDirty || mutation.isPending}
          className="h-9"
        >
          {mutation.isPending ? "저장 중..." : "저장"}
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        현재 적용 값: {currentValue.toLocaleString("ko-KR")} KRW
      </p>
    </div>
  );
}
