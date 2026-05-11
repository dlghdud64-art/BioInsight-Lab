"use client";

/**
 * #quote-card-batch3-price-delivery — 호영님 Batch III #4: 납기 상대 일수
 *
 * 호영님 spec: "납기 3~5일" 형태 (절대 날짜 → 상대 표현).
 * SSR/CSR Date.now() drift 차단 (§11.212 mirror) — useEffect mount 후 set.
 * 서버 render 시 빈 placeholder ("—"), client mount 후 정확한 일수 노출.
 *
 * Behavior:
 *   - days < 0: "{N}일 지연" (red)
 *   - days === 0: "오늘 마감" (red)
 *   - days > 0: "{N}일 남음" (slate / amber tone caller 책임)
 */

import { useEffect, useState } from "react";

export interface RelativeDeliveryTextProps {
  /** ISO 8601 timestamp — quote.deliveryDate */
  iso: string | null | undefined;
  /** 추가 className — caller 의 색상 tone 결정 (delayed 시 red 등). */
  className?: string;
}

export function RelativeDeliveryText({ iso, className }: RelativeDeliveryTextProps) {
  const [label, setLabel] = useState<string>("—");

  useEffect(() => {
    if (!iso) {
      setLabel("—");
      return;
    }
    const target = new Date(iso).getTime();
    if (Number.isNaN(target)) {
      setLabel("—");
      return;
    }
    const days = Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) setLabel(`${Math.abs(days)}일 지연`);
    else if (days === 0) setLabel("오늘 마감");
    else setLabel(`${days}일 남음`);
  }, [iso]);

  return <span className={className}>납기 {label}</span>;
}
