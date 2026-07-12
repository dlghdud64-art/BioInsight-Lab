"use client";

/**
 * §11.297b ActionMenu — Radix DropdownMenu 대체 plain button helper.
 *
 * 호영님 §11.283b/§11.295/§11.296/§11.297 plain button pattern 정합.
 * row action 공통 — 사용자가 외부 state (openId) 로 mutually exclusive
 * 관리 (한 번에 1 menu 만 열림). 호영님 환경 Radix silent fail 차단.
 *
 * §inventory-action-menu-clip-fix (호영님 재고 지시문 §1) — 메뉴 잘림 수정.
 *   기존: 메뉴가 absolute top-full → 부모 카드 overflow-hidden /
 *         테이블 overflow-x-auto 경계에서 잘림.
 *   수정: 메뉴를 position:fixed + getBoundingClientRect 앵커로 렌더해
 *         모든 overflow 컨텍스트를 탈출. 뷰포트 하단 여백 부족 시 flip-up
 *         (위로 펼침). 스크롤/리사이즈 시 닫힘(fixed 오정렬 방지).
 *   backdrop(fixed inset-0) + 단일 open + role="menu" 는 보존.
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

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";

export interface ActionMenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean;
}

// w-40 = 10rem = 160px (기본 메뉴 폭). 위치 계산용 상수.
const MENU_WIDTH_PX = 160;

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
  const btnRef = useRef<HTMLButtonElement>(null);
  // fixed 앵커 좌표(뷰포트 기준). openUp 시 bottom, 아니면 top 사용.
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number }>({ left: 0 });

  // §inventory-action-menu-clip-fix — 열 때 버튼 위치 기준 fixed 좌표 산출 + flip-up.
  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const estHeight = Math.max(88, items.length * 40 + 12);
      const openUp = r.bottom + estHeight > window.innerHeight && r.top > estHeight;
      const left = Math.max(8, r.right - MENU_WIDTH_PX);
      setPos(
        openUp
          ? { left, bottom: window.innerHeight - r.top + 4 }
          : { left, top: r.bottom + 4 },
      );
    }
    onOpenChange(menuId);
  };

  // fixed 메뉴는 스크롤을 따라가지 못하므로 스크롤/리사이즈 시 닫는다(오정렬 방지).
  useEffect(() => {
    if (!isOpen) return;
    const close = () => onOpenChange(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-label="작업 메뉴"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) onOpenChange(null);
          else openMenu();
        }}
        className="inline-flex items-center justify-center h-7 w-7 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md ml-auto"
      >
        <MoreVertical className="h-3.5 w-3.5 pointer-events-none" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(null)} aria-hidden="true" />
          <div
            role="menu"
            style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom }}
            className={`${width} rounded-md border border-slate-200 bg-white shadow-lg z-50 py-1`}
          >
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
