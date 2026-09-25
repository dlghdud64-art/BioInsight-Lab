"use client";

/**
 * §budget-detail-redesign — 비가역 작업 확인(이름을 입력해야 확인 버튼이 켜진다).
 *
 * ConfirmDialog 와 같은 React 모달이다(window.confirm 금지 · same-canvas).
 * 다른 점은 하나: `expected` 문자열을 그대로 입력해야 onConfirm 을 누를 수 있다.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TypeToConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** 사용자가 그대로 입력해야 하는 문자열(대개 대상 이름) */
  expected: string;
  confirmText: string;
  pending?: boolean;
  onConfirm: () => void;
}

export function TypeToConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  expected,
  confirmText,
  pending = false,
  onConfirm,
}: TypeToConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);
  const matches = typed.trim() === expected.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500">
            확인을 위해 <span className="font-semibold text-slate-800">{expected}</span> 을(를) 입력하세요.
          </p>
          <Input
            value={typed}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTyped(e.target.value)}
            placeholder={expected}
            className="h-11 rounded-xl border-slate-200"
            autoComplete="off"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)} disabled={pending}>
            취소
          </Button>
          <Button
            type="button"
            className="h-11 bg-red-600 hover:bg-red-700 text-white"
            disabled={!matches || pending}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
