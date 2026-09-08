"use client";

/**
 * §mobile-residual-5 1e — 시트/모달 내부용 인라인 확장 셀렉트 (호영님 핸드오프 2026-09-07).
 *
 * 배경: Radix Select 는 body 포털(z-50)로 뜨는데 Dialog/Sheet 는 z-[80] → 옵션 패널이 시트 뒤에
 *   렌더(멤버 초대 역할 드롭다운 버그). 시트/모달 내부에서는 **포털 금지, 인라인 확장** —
 *   트리거 아래 옵션 패널을 문서 흐름에 삽입해 시트가 자연 확장. 스태킹 컨텍스트 문제 원천 제거.
 *
 * 옵션 = 색 점(dotClass) + 이름 + 설명 1줄 + 선택 행 #eff6ff + ✓ (전역 드롭다운 토큰).
 * a11y: 트리거 aria-haspopup="listbox"/aria-expanded, 패널 role="listbox", 항목 role="option"
 *   /aria-selected, 키보드 ↑↓ 이동 · Enter 선택 · Esc 닫기. 외부 클릭 닫기.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InlineSelectOption<V extends string = string> {
  value: V;
  label: string;
  description?: string;
  /** 색 점 tailwind 클래스(예: bg-[#7c3aed]) — 없으면 점 생략 */
  dotClass?: string;
}

export interface InlineSelectProps<V extends string = string> {
  value: V;
  onChange: (value: V) => void;
  options: ReadonlyArray<InlineSelectOption<V>>;
  disabled?: boolean;
  id?: string;
  /** 트리거 aria-label(라벨 요소가 없을 때) */
  ariaLabel?: string;
  className?: string;
}

export function InlineSelect<V extends string = string>({
  value,
  onChange,
  options,
  disabled,
  id,
  ariaLabel,
  className,
}: InlineSelectProps<V>) {
  const [open, setOpen] = useState(false);
  const selectedIdx = Math.max(0, options.findIndex((o) => o.value === value));
  const [highlight, setHighlight] = useState(selectedIdx);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options[selectedIdx];

  // 열릴 때 하이라이트 = 현재 선택
  useEffect(() => {
    if (open) setHighlight(selectedIdx);
  }, [open, selectedIdx]);

  // 외부 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const commit = (idx: number) => {
    const opt = options[idx];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) setOpen(true);
        else setHighlight((h) => Math.min(options.length - 1, h + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) setOpen(true);
        else setHighlight((h) => Math.max(0, h - 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (!open) setOpen(true);
        else commit(highlight);
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          e.stopPropagation(); // 시트/Dialog Esc 닫힘보다 패널 닫힘 우선
          setOpen(false);
        }
        break;
      default:
        break;
    }
  };

  return (
    <div ref={rootRef} className={cn("w-full", className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-11 w-full items-center gap-2.5 rounded-xl border bg-white px-3 text-left text-sm text-slate-900 transition-colors touch-manipulation disabled:opacity-50",
          open ? "border-blue-600 shadow-[0_0_0_3px_rgba(37,99,235,.1)]" : "border-slate-200",
        )}
      >
        {selected?.dotClass && <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", selected.dotClass)} aria-hidden />}
        <span className="flex-1 min-w-0 truncate font-semibold">{selected?.label ?? ""}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-activedescendant={`${listId}-${highlight}`}
          className="mt-1.5 rounded-[13px] border border-slate-200 bg-white p-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.14)]"
        >
          {options.map((o, idx) => {
            const isSelected = o.value === value;
            const isHighlight = idx === highlight;
            return (
              <li
                key={o.value}
                id={`${listId}-${idx}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commit(idx)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2.5 touch-manipulation",
                  isSelected ? "bg-[#eff6ff]" : isHighlight ? "bg-slate-50" : "",
                )}
              >
                {o.dotClass && <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", o.dotClass)} aria-hidden />}
                <span className="flex-1 min-w-0">
                  <span className={cn("block text-[12.5px] font-bold", isSelected ? "text-blue-700" : "text-slate-900")}>{o.label}</span>
                  {o.description && (
                    <span className={cn("block text-[10.5px]", isSelected ? "text-slate-500" : "text-slate-400")}>{o.description}</span>
                  )}
                </span>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" strokeWidth={2.5} aria-hidden />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
