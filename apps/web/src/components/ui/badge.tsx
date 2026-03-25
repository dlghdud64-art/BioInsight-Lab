import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 h-6 font-semibold text-[11px] tracking-wide gap-1.5 w-fit transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const dotColorMap = {
  red: {
    dot: "bg-red-600",
    ping: "bg-red-400",
  },
  blue: {
    dot: "bg-blue-600",
    ping: "bg-blue-400",
  },
  amber: {
    dot: "bg-amber-500",
    ping: "bg-amber-400",
  },
  emerald: {
    dot: "bg-emerald-500",
    ping: "bg-emerald-400",
  },
  slate: {
    dot: "bg-slate-400",
    ping: "bg-slate-300",
  },
  purple: {
    dot: "bg-purple-500",
    ping: "bg-purple-400",
  },
} as const;

export type StatusDotColor = keyof typeof dotColorMap;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** 상태 도트 색상 (지정 시 좌측에 도트 표시) */
  dot?: StatusDotColor;
  /** 도트에 pulse(깜빡임) 효과 적용 (긴급/액션 필요 시 true) */
  dotPulse?: boolean;
}

function Badge({
  className,
  variant,
  dot,
  dotPulse,
  children,
  ...props
}: BadgeProps) {
  const dotStyles = dot ? dotColorMap[dot] : null;

  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {dotStyles && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {dotPulse && (
            <span
              className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                dotStyles.ping
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex rounded-full h-1.5 w-1.5",
              dotStyles.dot
            )}
          />
        </span>
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
