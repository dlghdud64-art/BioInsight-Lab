"use client";

/**
 * §budget-detail-redesign — 예산 상세의 `예산 편집` 모달.
 *
 * 편집 가능한 것은 **PATCH /api/budgets/[id] 가 저장하는 필드뿐**이다:
 *   이름 · 총액 · 기간 · 프로젝트 · 설명.
 * 소유자·부서·통제 규칙은 DB 에 열이 없다 — 저장되지 않는 입력은 두지 않는다
 * (§budget-fabricated-figures 「대상 부서/팀」 입력 제거와 같은 원칙).
 *
 * 날짜는 `<input type="date">` 의 "YYYY-MM-DD" 문자열로만 다룬다(Date 왕복 0 · §budget-period-axis).
 * 바뀐 필드만 보낸다 — 시작일이 안 바뀌었는데 보내면 서버가 yearMonth 를 다시 계산한다.
 */

import { useEffect, useRef, useState } from "react";
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

export interface EditableBudget {
  id: string;
  name: string;
  amount: number;
  periodStartDate: string;
  periodEndDate: string;
  projectName: string | null;
  note: string | null;
}

export type BudgetEditFocus = "projectName" | null;

interface BudgetEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: EditableBudget;
  focus?: BudgetEditFocus;
  onSaved: () => void;
}

export function BudgetEditDialog({ open, onOpenChange, budget, focus = null, onSaved }: BudgetEditDialogProps) {
  const [name, setName] = useState(budget.name);
  const [amount, setAmount] = useState(String(budget.amount));
  const [start, setStart] = useState(budget.periodStartDate);
  const [end, setEnd] = useState(budget.periodEndDate);
  const [projectName, setProjectName] = useState(budget.projectName ?? "");
  const [note, setNote] = useState(budget.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const projectRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(budget.name);
    setAmount(String(budget.amount));
    setStart(budget.periodStartDate);
    setEnd(budget.periodEndDate);
    setProjectName(budget.projectName ?? "");
    setNote(budget.note ?? "");
    setError(null);
    if (focus === "projectName") {
      const t = setTimeout(() => projectRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, budget, focus]);

  const amountNum = Number(amount.replace(/[^0-9]/g, ""));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("예산 이름을 입력하세요.");
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setError("총액은 0보다 커야 합니다.");
    if (!start || !end) return setError("기간을 입력하세요.");
    if (start > end) return setError("종료일은 시작일 이후여야 합니다.");

    const body: Record<string, unknown> = {};
    if (name.trim() !== budget.name) body.name = name.trim();
    if (amountNum !== budget.amount) body.amount = amountNum;
    if (start !== budget.periodStartDate) body.periodStart = start;
    if (end !== budget.periodEndDate) body.periodEnd = end;
    if ((projectName.trim() || null) !== (budget.projectName ?? null)) body.projectName = projectName.trim() || null;
    if ((note.trim() || null) !== (budget.note ?? null)) body.description = note.trim() || null;
    if (Object.keys(body).length === 0) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      const res = await csrfFetch(`/api/budgets/${budget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: { message: string }[];
      };
      if (!res.ok) {
        setError(json.details?.[0]?.message || json.error || "저장하지 못했습니다.");
        return;
      }
      onOpenChange(false);
      onSaved();
    } catch {
      setError("통신 오류로 저장하지 못했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>예산 편집</DialogTitle>
          <DialogDescription>저장하면 사용률과 예상 소진일이 새 값으로 다시 계산됩니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label htmlFor="be-name" className="text-sm font-semibold text-slate-700">예산 이름</Label>
            <Input id="be-name" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} className="mt-1.5 h-11 rounded-xl border-slate-200" />
          </div>
          <div>
            <Label htmlFor="be-amount" className="text-sm font-semibold text-slate-700">총액</Label>
            <div className="relative mt-1.5">
              <Input
                id="be-amount"
                inputMode="numeric"
                value={amountNum > 0 ? amountNum.toLocaleString("ko-KR") : amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                className="h-11 rounded-xl border-slate-200 pr-8 tabular-nums"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">원</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="be-start" className="text-sm font-semibold text-slate-700">시작일</Label>
              <Input id="be-start" type="date" value={start} max={end || undefined} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStart(e.target.value)} className="mt-1.5 h-11 rounded-xl border-slate-200" />
            </div>
            <div>
              <Label htmlFor="be-end" className="text-sm font-semibold text-slate-700">종료일</Label>
              <Input id="be-end" type="date" value={end} min={start || undefined} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnd(e.target.value)} className="mt-1.5 h-11 rounded-xl border-slate-200" />
            </div>
          </div>
          <div>
            <Label htmlFor="be-project" className="text-sm font-semibold text-slate-700">프로젝트</Label>
            <Input id="be-project" ref={projectRef} value={projectName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProjectName(e.target.value)} placeholder="예: 4분기 소모품" className="mt-1.5 h-11 rounded-xl border-slate-200" />
          </div>
          <div>
            <Label htmlFor="be-note" className="text-sm font-semibold text-slate-700">설명</Label>
            <Textarea id="be-note" value={note} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)} rows={2} className="mt-1.5 rounded-xl border-slate-200 resize-none" />
          </div>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-[12px] font-medium text-red-600">{error}</p>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => onOpenChange(false)} disabled={saving}>
              취소
            </Button>
            <Button type="submit" className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold" disabled={saving}>
              {saving ? "저장 중…" : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
