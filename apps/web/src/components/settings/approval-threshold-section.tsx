"use client";

/**
 * §11.209d-approver-routing — 결재 임계치 admin form section.
 * #approver-routing-multi-tier-threshold — 3 tier (저액/중액/고액) 매트릭스.
 *
 * canonical truth = Workspace.approvalLowThresholdKrw + approvalThresholdKrw.
 * default 1,000,000 (100만원) / 10,000,000 (1,000만원) — selectApproverByAmount
 * helper 가 사용:
 *   - amount < approvalLowThresholdKrw → workspace_admin (low)
 *   - low ≤ amount < approvalThresholdKrw → org_admin (mid)
 *   - amount ≥ approvalThresholdKrw → org_owner (high)
 *
 * Lock:
 *   - ADMIN role 만 visible (form section 자체 hide — dead button 0)
 *   - PATCH /api/workspaces/[id] — server zod 검증 + verifyWorkspaceAccess('ADMIN')
 *   - low ≤ high 강제 (form-level validation)
 *   - default fallback (helper 상수와 동일)
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
  approvalLowThresholdKrw: number;
  members?: Array<{
    userId: string;
    role: string;
  }>;
}

interface Props {
  workspaceId: string;
  currentUserId: string;
}

const DEFAULT_LOW = 1_000_000;
const DEFAULT_HIGH = 10_000_000;
const MAX_CAP = 10_000_000_000;

export function ApprovalThresholdSection({ workspaceId, currentUserId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [lowInput, setLowInput] = useState<string>("");
  const [highInput, setHighInput] = useState<string>("");

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

  // sync state with fetched values
  useEffect(() => {
    if (workspace?.approvalLowThresholdKrw != null) {
      setLowInput(String(workspace.approvalLowThresholdKrw));
    }
    if (workspace?.approvalThresholdKrw != null) {
      setHighInput(String(workspace.approvalThresholdKrw));
    }
  }, [workspace?.approvalLowThresholdKrw, workspace?.approvalThresholdKrw]);

  const isAdmin =
    workspace?.members?.find((m) => m.userId === currentUserId)?.role === "ADMIN";

  const mutation = useMutation({
    mutationFn: async (body: {
      approvalLowThresholdKrw: number;
      approvalThresholdKrw: number;
    }) => {
      const res = await csrfFetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    const lowParsed = parseInt(lowInput, 10);
    const highParsed = parseInt(highInput, 10);

    if (Number.isNaN(lowParsed) || lowParsed < 0) {
      toast({ title: "잘못된 값", description: "저액 임계치는 0 이상 정수여야 합니다.", variant: "destructive" });
      return;
    }
    if (Number.isNaN(highParsed) || highParsed < 0) {
      toast({ title: "잘못된 값", description: "고액 임계치는 0 이상 정수여야 합니다.", variant: "destructive" });
      return;
    }
    if (lowParsed > MAX_CAP || highParsed > MAX_CAP) {
      toast({ title: "임계치 너무 큼", description: "100억(KRW) 이하로 설정해 주세요.", variant: "destructive" });
      return;
    }
    // form-level validation — low ≤ high (mid tier 가 정합 가능 범위)
    if (lowParsed > highParsed) {
      toast({
        title: "저액 ≤ 고액 필요",
        description: "저액 임계치는 고액 임계치 이하여야 합니다.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate({
      approvalLowThresholdKrw: lowParsed,
      approvalThresholdKrw: highParsed,
    });
  };

  // ADMIN 외 — form section hide (dead button 0)
  if (!isAdmin) return null;

  const currentLow = workspace?.approvalLowThresholdKrw ?? DEFAULT_LOW;
  const currentHigh = workspace?.approvalThresholdKrw ?? DEFAULT_HIGH;
  const isDirty =
    parseInt(lowInput, 10) !== currentLow ||
    parseInt(highInput, 10) !== currentHigh;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900">결재 임계치 (3 tier 매트릭스)</h3>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          저액·중액·고액 결재의 자동 매핑 임계치입니다. 저액 미만은 워크스페이스 관리자,
          중액(저액 이상 ~ 고액 미만)은 조직 관리자, 고액 이상은 조직 OWNER 에게 자동 매핑됩니다.
          기본값: 저액 1,000,000 KRW / 고액 10,000,000 KRW.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <Label htmlFor="approval-low-threshold" className="text-xs font-medium text-slate-600">
            저액 임계치 (KRW)
          </Label>
          <Input
            id="approval-low-threshold"
            type="number"
            min={0}
            max={MAX_CAP}
            value={lowInput}
            onChange={(e) => setLowInput(e.target.value)}
            placeholder="1000000"
            className="mt-1 bg-white border-slate-200 text-slate-900 h-9 text-sm font-mono"
          />
          <p className="mt-1 text-[10px] text-slate-400">
            현재: {currentLow.toLocaleString("ko-KR")} KRW
          </p>
        </div>
        <div>
          <Label htmlFor="approval-high-threshold" className="text-xs font-medium text-slate-600">
            고액 임계치 (KRW)
          </Label>
          <Input
            id="approval-high-threshold"
            type="number"
            min={0}
            max={MAX_CAP}
            value={highInput}
            onChange={(e) => setHighInput(e.target.value)}
            placeholder="10000000"
            className="mt-1 bg-white border-slate-200 text-slate-900 h-9 text-sm font-mono"
          />
          <p className="mt-1 text-[10px] text-slate-400">
            현재: {currentHigh.toLocaleString("ko-KR")} KRW
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400">
          저액 ≤ 고액 이어야 합니다. 변경 시 다음 결재 요청부터 즉시 반영됩니다.
        </p>
        <Button
          onClick={handleSave}
          disabled={!isDirty || mutation.isPending}
          className="h-9"
        >
          {mutation.isPending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </div>
  );
}
