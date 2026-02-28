"use client";

import { Search, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface InventorySearchProps {
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export function InventorySearch({
  value,
  onChange,
  isLoading = false,
  placeholder = "품목명, 제조사, CAS No. 또는 카탈로그 번호로 검색하세요",
  className,
}: InventorySearchProps) {
  return (
    <div className={`relative flex-1 min-w-0 w-full sm:w-80 ${className ?? ""}`}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none flex-shrink-0" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-10 min-w-0 w-full"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors pointer-events-auto"
            aria-label="검색어 지우기"
          >
            <X className="h-4 w-4" />
          </button>
        ) : isLoading ? (
          <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
        ) : (
          <Search className="h-4 w-4 text-slate-400" />
        )}
      </div>
    </div>
  );
}
