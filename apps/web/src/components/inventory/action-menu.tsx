"use client";

/**
 * §11.297b ActionMenu — Radix DropdownMenu 대체 plain button helper.
 *
 * 호영님 §11.283b/§11.295/§11.296/§11.297 plain button pattern 정합.
 * row action 공통 — 사용자가 외부 state (openId) 로 mutually exclusive
 * 관리 (한 번에 1 menu 만 열림). 호영님 환경 Radix silent fail 차단.
 *
 * Usage:
 *   const [openId, setOpenId] = useState<string | null>(null);
 *   <ActionMenu
 *     menuId={`row-${row.id}`}
 *     currentOpenId={openId}
 *     onOpenChange={setOpenId}
 *     items={[
 *       { label: "수정", icon: <Pencil />, onClick: () => onEdit(row) },
 *       { label: "삭제", icon: <Trash2 />, onClick: () => onDelete(row), danger: true, separator: true },
 *     ]}
 *   />
 */

import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";

export interface ActionMenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean;
}

export function ActionMenu({
  menuId,
  currentOpenId,
  onOpenChange,
  items,
  width = "w-40",
}: {
  menuId: string;
  currentOpenId: string | null;
  onOpenChange: (id: string | null) => void;
  items: ActionMenuItem[];
  width?: string;
}) {
  const isOpen = currentOpenId === menuId;
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="작업 메뉴"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(isOpen ? null : menuId);
        }}
        className="inline-flex items-center justify-center h-7 w-7 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md ml-auto"
      >
        <MoreVertical className="h-3.5 w-3.5 pointer-events-none" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(null)} aria-hidden="true" />
          <div role="menu" className={`absolute right-0 top-full mt-1 ${width} rounded-md border border-slate-200 bg-white shadow-lg z-50 py-1`}>
            {items.map((item, idx) => (
              <div key={idx}>
                {item.separator && idx > 0 && <div className="h-px bg-slate-100 mx-1 my-1" />}
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onClick();
                    onOpenChange(null);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-100 ${item.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700"}`}
                >
                  {item.icon}
                  {item.label}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
