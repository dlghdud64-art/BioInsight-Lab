import { cn } from "@/lib/utils"

/**
 * §11.244 #2 — 호영님 P0 분석 페이지 로딩 UX:
 *   정적 `animate-pulse bg-el` → linear-gradient shimmer (좌→우 그라데이션 반복).
 *   "로딩 중" 시각이 빈 상태 (정적 회색 박스) 와 확연히 구분되도록.
 *   keyframes shimmer + .animate-shimmer 는 globals.css 에 정의.
 *
 * caller drift 0 — Skeleton 단일 export 보존, className override 동일 동작.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-[linear-gradient(90deg,#f0f0f0_25%,#e0e0e0_50%,#f0f0f0_75%)] bg-[length:200%_100%] animate-shimmer",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
