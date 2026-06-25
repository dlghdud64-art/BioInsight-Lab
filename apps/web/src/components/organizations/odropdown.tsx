"use client";

/**
 * §org-management-redesign P1 — ODropdown 커스텀 드롭다운 (시안 정합)
 *
 * 시안 org-app.jsx ODropdown 1:1 이식(Tailwind/TS). 기존 native <select> 통일 대상.
 *   - click-outside 닫힘 · 선택값 체크 · 키보드 접근(Esc 닫힘) · 토큰 정합(blue-600/slate).
 *   - value/options = string(기존 organizationType 저장값과 호환). placeholder 지원.
 */

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface ODropdownProps {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  width?: string;
  placeholder?: string;
  ariaLabel?: string;
}

export function ODropdown({
  value,
  options,
  onChange,
  icon,
  width,
  placeholder = "선택",
  ariaLabel,
}: ODropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className={`relative ${width ?? ""}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 h-10 text-sm transition-colors ${
          open ? "border-blue-500 ring-1 ring-blue-200" : "border-slate-300 hover:border-slate-400"
        }`}
      >
        {icon && <span className="flex-none text-slate-400">{icon}</span>}
        <span className={`flex-1 truncate text-left ${value ? "text-slate-900" : "text-slate-400"}`}>
          {value || placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 flex-none text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="listbox" className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={opt === value}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                opt === value ? "font-semibold text-blue-600" : "text-slate-700"
              }`}
            >
              <span className="truncate">{opt}</span>
              {opt === value && <Check className="h-3.5 w-3.5 flex-none" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
