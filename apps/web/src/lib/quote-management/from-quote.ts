/**
 * §quote-management P4-core-A — 클라이언트 Quote → computePriority QuoteCase 매퍼
 *
 * 우선 추천 카드/우선순위 단일화(P4-core-B)가 쓰는 순수 매핑. DB 무접촉.
 *   canonical 파생(저장 금지): stage·priority·마감은 항상 계산.
 *
 * ★ 정직성(호영님):
 *   - amount 미상(totalAmount null) → null 유지(money=unknown). 다른 값 근사 대입 금지.
 *   - 응답 기한(vendorRequest expiresAt) 미상 → sentDate=null → computeDue(s2)=null → 마감 "—".
 *     (validUntil 등 의미 다른 필드를 마감으로 근사 금지 = 가짜 마감 방지.)
 *   - 재고 신호 클라 미연계 → stock="ok" 기본값(가짜 위급 금지). inventory 연계는 후속.
 *   - sendByDate(s1)/decisionDueDate(s3/s4) 현행 미보유(B채택) → null → "—".
 *   - 퍼널 외 상태(CANCELLED 등) → null 반환(우선 추천 대상 아님).
 */

import { deriveStage, type QuoteCase } from "./derive";
import { toSuppliers } from "@/components/quotes/supplier-avatars";

const DAY_MS = 86_400_000;

/** 매퍼 입력 — page Quote 의 필요한 부분만 구조적으로 수용(결합도 ↓). */
export interface QuoteLike {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  totalAmount?: number | null;
  vendorRequests?: Array<{
    vendorName?: string | null;
    vendorEmail?: string | null;
    respondedAt?: string | Date | null;
    status?: string | null;
    createdAt?: string | Date | null;
    expiresAt?: string | Date | null;
  }>;
}

/** Quote → QuoteCase. 퍼널 외 상태면 null(우선 추천 비대상). */
export function toQuoteCase(q: QuoteLike): QuoteCase | null {
  const stage = deriveStage(q.status);
  if (!stage) return null;

  const suppliers = toSuppliers(q.vendorRequests);

  // 응답 기한 실값 — 가장 빨리 만료되는(가장 급한) vendorRequest 기준. 없으면 미상.
  let soonest: { created: number; expires: number } | null = null;
  for (const v of q.vendorRequests ?? []) {
    if (!v.expiresAt || !v.createdAt) continue;
    const created = new Date(v.createdAt).getTime();
    const expires = new Date(v.expiresAt).getTime();
    if (!Number.isFinite(created) || !Number.isFinite(expires) || expires <= created) continue;
    if (!soonest || expires < soonest.expires) soonest = { created, expires };
  }
  const hasWindow = soonest != null;
  // ★ 기한 미상이면 sentDate=null → computeDue(s2)=null → 마감 "—"(근사 금지).
  const sentDate = hasWindow ? new Date(soonest!.created).toISOString().slice(0, 10) : null;
  const responseWindowDays = hasWindow
    ? Math.max(1, Math.round((soonest!.expires - soonest!.created) / DAY_MS))
    : 0;

  return {
    id: q.id,
    name: q.title,
    stage,
    suppliers,
    amount: q.totalAmount ?? null,
    stock: "ok",
    sentDate,
    responseWindowDays,
    sendByDate: null,
    decisionDueDate: null,
  };
}
