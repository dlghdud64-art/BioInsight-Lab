"use client";

/**
 * #approver-routing-per-user-limit-admin-ui Phase 2 — workspace ADMIN
 * 별 결재 한도 admin form section.
 *
 * canonical truth = WorkspaceMember.approvalLimit (DB).
 * null = 무제한 (default), 값 = 단일 건 결재 한도 (KRW).
 *
 * Lock:
 *   - workspace 의 ADMIN role 사용자만 list (MEMBER 제외 — 결재자 0)
 *   - current user ADMIN role 일 때만 form section visible (dead button 0)
 *   - PATCH /api/workspaces/[id]/members/[memberId] — server zod 검증 +
 *     verifyAdminAccess (ADMIN only)
 *   - null 명시 시 무제한 reset, 빈 input → null 처리
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { csrfFetch } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface MemberDetail {
  id: string;
  userId: string;
  role: string;
  approvalLimit: number | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface Props {
  workspaceId: string;
  currentUserId: string;
}

const MAX_CAP = 10_000_000_000;

export function WorkspaceMembersApprovalLimitSection({ workspaceId, currentUserId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data } = useQuery<{ members: MemberDetail[] }>({
    queryKey: ["workspace-members", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`);
      if (!res.ok) return { members: [] };
      return res.json();
    },
    enabled: !!workspaceId,
    staleTime: 60_000,
  });

  const members = data?.members ?? [];
  const isAdmin =
    members.find((m) => m.userId === currentUserId)?.role === "ADMIN";

  // ADMIN role member 만 list (MEMBER 는 결재자 0)
  const adminMembers = members.filter((m) => m.role === "ADMIN");

  // 각 member 별 input 상태 — string (number 변환은 저장 시)
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const m of adminMembers) {
      next[m.id] = m.approvalLimit == null ? "" : String(m.approvalLimit);
    }
    setDrafts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (args: { memberId: string; approvalLimit: number | null }) => {
      const res = await csrfFetch(
        `/api/workspaces/${workspaceId}/members/${args.memberId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalLimit: args.approvalLimit }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "결재 한도 저장 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      toast({ title: "결재 한도 저장 완료", description: "다음 결재 요청부터 반영됩니다." });
    },
    onError: (err: Error) => {
      toast({ title: "저장 실패", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = (memberId: string) => {
    const draft = drafts[memberId] ?? "";
    if (draft.trim() === "") {
      // 빈 input → null (무제한 reset)
      mutation.mutate({ memberId, approvalLimit: null });
      return;
    }
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast({
        title: "잘못된 값",
        description: "0 이상 정수 또는 빈 입력 (무제한) 만 허용됩니다.",
        variant: "destructive",
      });
      return;
    }
    if (parsed > MAX_CAP) {
      toast({
        title: "한도 너무 큼",
        description: "100억(KRW) 이하로 설정해 주세요.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate({ memberId, approvalLimit: parsed });
  };

  // ADMIN 외 — form section hide (dead button 0)
  if (!isAdmin) return null;

  if (adminMembers.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900">관리자별 결재 한도</h3>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          각 워크스페이스 관리자(ADMIN)의 단일 건 결재 한도(KRW)를 설정합니다.
          빈 입력은 무제한으로 처리됩니다. 한도 초과 결재는 자동으로 다음 결재자
          (조직 관리자/OWNER)에게 escalation 됩니다.
        </p>
      </div>
      <div className="space-y-3">
        {adminMembers.map((m) => {
          const currentValue = m.approvalLimit;
          const draftStr = drafts[m.id] ?? "";
          const draftNum =
            draftStr.trim() === "" ? null : parseInt(draftStr, 10);
          const isDirty = draftNum !== currentValue;
          return (
            <div
              key={m.id}
              className="flex items-end gap-3 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0"
            >
              <div className="flex-1 min-w-0">
                <Label className="text-xs font-medium text-slate-600">
                  {m.user.name || m.user.email}
                  {m.userId === currentUserId && (
                    <span className="ml-1 text-[10px] text-slate-400">(본인)</span>
                  )}
                </Label>
                <p className="text-[11px] text-slate-400 mt-0.5">{m.user.email}</p>
              </div>
              <div className="w-44">
                <Input
                  type="number"
                  min={0}
                  max={MAX_CAP}
                  value={draftStr}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))
                  }
                  placeholder="무제한"
                  className="bg-white border-slate-200 text-slate-900 h-9 text-sm font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  현재:{" "}
                  {currentValue == null
                    ? "무제한"
                    : `${currentValue.toLocaleString("ko-KR")} KRW`}
                </p>
              </div>
              <Button
                onClick={() => handleSave(m.id)}
                disabled={!isDirty || mutation.isPending}
                size="sm"
                className="h-9"
              >
                {mutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
