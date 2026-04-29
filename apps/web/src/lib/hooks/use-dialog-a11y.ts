"use client";

import { useEffect, useRef } from "react";

/**
 * §11.123 #admin-modal-keyboard-nav
 *
 * Reusable dialog accessibility hook.
 *
 * 책임:
 *   - Esc key → onClose
 *   - Tab focus trap (drawer 내부 first/last 순환)
 *   - dialog open 시 initial focus (autoFocusRef)
 *   - dialog close 시 previous active element 로 focus 복귀
 *
 * §11.122 AdminSidebar 의 inline 패턴을 hook 으로 추출 — admin/users 의 3
 * dialog (InviteUserDialog / ConfirmReject / 운영 정책 panel) 에 일관 적용.
 *
 * 사용 예:
 *   const { dialogRef, autoFocusRef } = useDialogA11y({
 *     open: isOpen,
 *     onClose: () => setIsOpen(false),
 *   });
 *   return (
 *     <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="...">
 *       <button ref={autoFocusRef}>닫기</button>
 *       ...
 *     </div>
 *   );
 */

export interface UseDialogA11yOptions {
  open: boolean;
  onClose: () => void;
  /** Esc key 처리 비활성화 (특수 케이스) */
  disableEscapeClose?: boolean;
}

export function useDialogA11y<TElement extends HTMLElement = HTMLDivElement>({
  open,
  onClose,
  disableEscapeClose = false,
}: UseDialogA11yOptions) {
  const dialogRef = useRef<TElement>(null);
  const autoFocusRef = useRef<HTMLElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // open 시 이전 active element 기억 + close 시 복귀
  useEffect(() => {
    if (open) {
      previousActiveElementRef.current =
        document.activeElement as HTMLElement | null;
    } else {
      // open → close 전이 시 복귀
      if (previousActiveElementRef.current) {
        try {
          previousActiveElementRef.current.focus();
        } catch {
          // focus 호출 실패 graceful (element unmount 됐을 수도)
        }
      }
    }
  }, [open]);

  // open 시 initial focus (autoFocusRef 우선, 없으면 dialog 안 첫 focusable)
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (autoFocusRef.current) {
        autoFocusRef.current.focus();
        return;
      }
      if (dialogRef.current) {
        const focusable =
          dialogRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
        focusable[0]?.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);

  // Esc + Tab focus trap
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!disableEscapeClose && e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, disableEscapeClose]);

  return { dialogRef, autoFocusRef };
}
