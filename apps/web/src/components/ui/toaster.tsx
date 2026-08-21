"use client"

import { useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { Check, AlertTriangle, X, Loader2, RotateCcw, Info } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * §global-toast(호영님 2026-08-21 핸드오프) — 상태 아이콘 칩 30px 원형.
 *   success #f0fdf4/#16a34a · error #fef2f2/#dc2626 · info(안내) #eff6ff/#2563eb
 *   warning amber(§11.302 신호등 유지) · undo 먹색 · progress 는 info 칩 + 스피너.
 *   ⚠ §action-toast(2026-07-08)의 "아이콘 색만" 문법을 대체한다.
 */
const VARIANT_CHIP: Record<
  string,
  { Icon: typeof Check; chip: string; spin?: boolean }
> = {
  success: { Icon: Check, chip: "bg-[#f0fdf4] text-[#16a34a]" },
  warning: { Icon: AlertTriangle, chip: "bg-amber-50 text-[#b45821]" },
  error: { Icon: X, chip: "bg-[#fef2f2] text-[#dc2626]" },
  destructive: { Icon: X, chip: "bg-[#fef2f2] text-[#dc2626]" },
  info: { Icon: Info, chip: "bg-[#eff6ff] text-[#2563eb]" },
  undo: { Icon: RotateCcw, chip: "bg-slate-100 text-slate-900" },
}

const MANUAL_CLOSE_ONLY = new Set(["error", "destructive"])

export function Toaster() {
  const { toasts, dismiss } = useToast()

  // §global-toast — Esc 로 최신 토스트 닫기.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && toasts.length > 0) dismiss(toasts[0].id)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toasts, dismiss])

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, progress, duration, ...props }) {
        const v = (variant as string) || "default"
        const meta = VARIANT_CHIP[v]
        const isProgress = v === "info" && typeof progress === "number"
        // 지속: 성공/안내 3초 자동 소멸(호버 시 Radix 가 일시정지) · 오류는 수동 닫기만.
        const resolvedDuration = MANUAL_CLOSE_ONLY.has(v) ? 1000000 : duration ?? 3000
        return (
          <Toast
            key={id}
            variant={variant}
            duration={resolvedDuration}
            // 오류는 assertive(role=alert 상당), 그 외 polite(role=status 상당) — Radix type 매핑.
            type={MANUAL_CLOSE_ONLY.has(v) ? "foreground" : "background"}
            {...props}
          >
            <div className="flex w-full items-start gap-3">
              {meta && (
                <span
                  className={cn(
                    "mt-0.5 flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full",
                    meta.chip
                  )}
                >
                  {isProgress ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <meta.Icon className="h-4 w-4" aria-hidden />
                  )}
                </span>
              )}
              <div className="grid min-w-0 flex-1 gap-0.5">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
                {action && <div className="mt-2 flex flex-wrap items-center gap-2">{action}</div>}
              </div>
            </div>
            {typeof progress === "number" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
                <div
                  className="h-full bg-blue-600 transition-[width] duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            )}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
