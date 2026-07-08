"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { Check, AlertTriangle, X, Loader2, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

// §action-toast(호영님 2026-07-08) — 5타입 아이콘·색(상태 구분은 아이콘 색만).
//   success 초록 · partial(warning) muted amber #b45821(§11.302 신호등) · error 빨강 · progress(info) 파랑 · undo 먹색.
const VARIANT_ICON: Record<
  string,
  { Icon: typeof Check; color: string; spin?: boolean }
> = {
  success: { Icon: Check, color: "text-emerald-600" },
  warning: { Icon: AlertTriangle, color: "text-[#b45821]" },
  error: { Icon: X, color: "text-rose-600" },
  info: { Icon: Loader2, color: "text-blue-600", spin: true },
  undo: { Icon: RotateCcw, color: "text-slate-900" },
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, progress, ...props }) {
        const meta = variant ? VARIANT_ICON[variant as string] : undefined
        const showClose = variant !== "info" // progress(info) 는 닫기 없음(지시문)
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex w-full items-start gap-3">
              {meta && (
                <span className={cn("mt-0.5 flex-none", meta.color)}>
                  <meta.Icon className={cn("h-5 w-5", meta.spin && "animate-spin")} aria-hidden />
                </span>
              )}
              <div className="grid gap-1 flex-1 min-w-0">
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
            {showClose && <ToastClose />}
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
