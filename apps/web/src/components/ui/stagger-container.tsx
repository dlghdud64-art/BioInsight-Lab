"use client";

import { Children, type ReactNode } from "react";

type Direction = "up" | "left" | "right" | "scale";

interface StaggerContainerProps {
  children: ReactNode;
  /** 등장 방향 (default: "up") */
  direction?: Direction;
  /** 아이템 간 딜레이 (ms, default: 60) */
  staggerMs?: number;
  /** 첫 아이템 시작 딜레이 (ms, default: 0) */
  baseDelayMs?: number;
  /** 컨테이너 className */
  className?: string;
  /** 컨테이너 태그 (default: "div") */
  as?: "div" | "ul" | "ol" | "section";
}

const ANIM_CLASS: Record<Direction, string> = {
  up: "animate-stagger-up",
  left: "animate-stagger-left",
  right: "animate-stagger-right",
  scale: "animate-stagger-scale",
};

/**
 * 자식 요소들에 순차 등장 애니메이션을 자동 적용하는 래퍼.
 *
 * ```tsx
 * <StaggerContainer direction="up" staggerMs={80}>
 *   <Card>...</Card>
 *   <Card>...</Card>
 * </StaggerContainer>
 * ```
 */
export function StaggerContainer({
  children,
  direction = "up",
  staggerMs = 60,
  baseDelayMs = 0,
  className = "",
  as: Tag = "div",
}: StaggerContainerProps) {
  const animClass = ANIM_CLASS[direction];

  return (
    <Tag className={className}>
      {Children.map(children, (child, i) => {
        if (!child) return null;
        return (
          <div
            className={animClass}
            style={{ animationDelay: `${baseDelayMs + i * staggerMs}ms` }}
          >
            {child}
          </div>
        );
      })}
    </Tag>
  );
}

/**
 * 단일 요소에 stagger 딜레이를 적용하는 헬퍼.
 * grid/flex 컨테이너에서 직접 자식에 적용할 때 사용.
 */
export function StaggerItem({
  children,
  index,
  direction = "up",
  staggerMs = 60,
  baseDelayMs = 0,
  className = "",
}: {
  children: ReactNode;
  index: number;
  direction?: Direction;
  staggerMs?: number;
  baseDelayMs?: number;
  className?: string;
}) {
  return (
    <div
      className={`${ANIM_CLASS[direction]} ${className}`}
      style={{ animationDelay: `${baseDelayMs + index * staggerMs}ms` }}
    >
      {children}
    </div>
  );
}
