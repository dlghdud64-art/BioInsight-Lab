"use client";

/**
 * §global-filters P2 — 모바일 필터 바텀 시트 (멀티/8+ 항목). inventory Sheet 규약 정합.
 *
 * controlled: 확정 선택값(selected)은 화면이 소유·주입. onApply 로만 반영.
 *   시트 내 draft 는 적용 전 임시 UI 상태(표시 계층) — 열릴 때 selected 로 리셋.
 * side="bottom" · 항목 h-11(44px) · 멀티 draft → `필터 적용 · N개`.
 */

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FilterOption } from "./filter-bar";

export interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  options: FilterOption[];
  selected: string[];
  onApply: (next: string[]) => void;
}

export function FilterSheet({
  open,
  onOpenChange,
  title,
  options,
  selected,
  onApply,
}: FilterSheetProps) {
  // draft = 적용 전 임시 선택(표시 계층). canonical 선택값은 화면 소유(selected prop).
  const [draft, setDraft] = useState<string[]>(selected);
  useEffect(() => {
    if (open) setDraft(selected);
  }, [open, selected]);

  const toggle = (v: string) =>
    setDraft((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-2 flex flex-col gap-1">
          {options.map((o) => {
            const on = draft.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className={cn(
                  "flex h-11 items-center justify-between rounded-lg px-3 text-sm",
                  on ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700",
                )}
              >
                {o.label}
                {on && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="h-11 flex-1"
            onClick={() => setDraft([])}
          >
            초기화
          </Button>
          <Button
            className="h-11 flex-1"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            필터 적용 · {draft.length}개
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
