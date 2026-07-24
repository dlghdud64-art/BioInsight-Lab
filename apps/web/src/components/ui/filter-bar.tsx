"use client";

/**
 * §global-filters P2 — 전역 필터 공용 컴포넌트: 데스크톱 툴바 인라인 필터 바.
 *
 * controlled 전용: 필터 값 상태는 화면(consumer)이 소유하고 props 로 주입.
 *   이 컴포넌트는 표시·트리거만 담당(필터 로직/상태 소유 0).
 * 열린 패널 = 전역 select.tsx 토큰 재사용(자체 트리거 스타일 재발명 0).
 * 라벨 병기 = `{label} · {현재값}` (라벨 없는 "전체" 금지) · 활성(비-allValue)만 파란 강조.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FilterMode = "dropdown" | "sheet";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * 표시 모드 판정을 정의 계층이 소유(P0 판정표와 1:1):
 *   단일 && 항목 ≤7 → "dropdown" · 멀티 || 항목 8+ → "sheet".
 * allValue = 비활성 sentinel(기본 "all"). inventory 규약("all"=비활성) 흡수.
 */
export interface FilterDef {
  key: string;
  label: string;
  options: FilterOption[];
  mode: FilterMode;
  allValue?: string;
}

export interface FilterBarProps {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  className?: string;
}

export function FilterBar({ filters, values, onChange, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-row items-center gap-2", className)}>
      {filters
        .filter((f) => f.mode === "dropdown")
        .map((f) => {
          const all = f.allValue ?? "all";
          const current = values[f.key] ?? all;
          const active = current !== all;
          const currentLabel =
            f.options.find((o) => o.value === current)?.label ?? current;
          return (
            <Select
              key={f.key}
              value={current}
              onValueChange={(v) => onChange(f.key, v)}
            >
              <SelectTrigger
                aria-label={f.label}
                className={cn(
                  "h-9 w-auto min-w-[120px] gap-1 text-xs",
                  active && "border-blue-400 text-blue-700",
                )}
              >
                <span className="text-slate-500">{f.label} ·</span>
                <span className="font-medium">{currentLabel}</span>
              </SelectTrigger>
              <SelectContent>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })}
    </div>
  );
}
