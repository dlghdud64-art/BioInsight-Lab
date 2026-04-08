/**
 * ActionLedger — 운영 액션 타임라인 피드
 *
 * Zustand store(useOrderQueueStore, useBudgetStore)에서 최근 발생한
 * 주요 이벤트(승인, 견적, 예산 위험 등)를 시간 순으로 보여준다.
 *
 * source of truth: store 그대로. 자체 fetch 없음.
 * preview/derived 표시이며 canonical mutation은 하지 않는다.
 */
"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  FileText,
  AlertTriangle,
  Package,
  DollarSign,
  Truck,
  Clock,
  ShieldAlert,
  Zap,
} from "lucide-react";
import type { OrderQueueItem } from "@/lib/store/order-queue-store";
import type { Budget } from "@/lib/store/budget-store";
import { deriveBudgetControl } from "@/lib/store/budget-store";
import type { FastTrackAcceptanceLogEntry } from "@/lib/store/fast-track-store";

// ── Types ────────────────────────────────────────────────────────────

export type LedgerEventKind =
  | "order_approved"
  | "order_received"
  | "order_dispatch_ready"
  | "order_pending_approval"
  | "budget_critical"
  | "budget_warning"
  | "budget_over"
  | "fast_track_accepted";

export interface LedgerEvent {
  id: string;
  kind: LedgerEventKind;
  title: string;
  detail: string;
  timestamp: string; // ISO
  href?: string;
}

interface ActionLedgerProps {
  orders: OrderQueueItem[];
  budgets: Budget[];
  /** Fast-Track 수락 이력 (useFastTrackStore.acceptanceLog) — optional, 미전달 시 해당 이벤트 미노출 */
  fastTrackAcceptances?: FastTrackAcceptanceLogEntry[];
  /** 최대 표시 건수. 기본 8건 */
  limit?: number;
  /** 로딩 상태 (skeleton 표시용) */
  loading?: boolean;
}

// ── Event derivation ─────────────────────────────────────────────────

function buildOrderEvents(orders: OrderQueueItem[]): LedgerEvent[] {
  const events: LedgerEvent[] = [];

  for (const o of orders) {
    // 승인 완료
    if (o.approvedAt) {
      events.push({
        id: `${o.id}-approved`,
        kind: "order_approved",
        title: `${o.poNumber} 승인 완료`,
        detail: `${o.productName} · ${o.totalAmount.toLocaleString()}원`,
        timestamp: o.approvedAt,
        href: `/dashboard/purchase-orders`,
      });
    }
    // 수령 완료
    if (o.receivedAt) {
      events.push({
        id: `${o.id}-received`,
        kind: "order_received",
        title: `${o.poNumber} 입고 완료`,
        detail: `${o.productName} · ${o.receivedQuantity ?? o.quantity}${o.unit}`,
        timestamp: o.receivedAt,
        href: `/dashboard/purchase-orders`,
      });
    }
    // 승인 대기
    if (o.status === "pending_approval") {
      events.push({
        id: `${o.id}-pending`,
        kind: "order_pending_approval",
        title: `${o.poNumber} 승인 대기`,
        detail: `${o.productName} · ${o.totalAmount.toLocaleString()}원`,
        timestamp: o.updatedAt,
        href: `/dashboard/purchase-orders`,
      });
    }
    // Dispatch 준비
    if (o.status === "po_created" || o.status === "dispatch_prep") {
      events.push({
        id: `${o.id}-dispatch`,
        kind: "order_dispatch_ready",
        title: `${o.poNumber} 발송 준비`,
        detail: o.computed.nextAction,
        timestamp: o.updatedAt,
        href: `/dashboard/purchase-orders`,
      });
    }
  }

  return events;
}

function buildFastTrackEvents(
  entries: FastTrackAcceptanceLogEntry[],
): LedgerEvent[] {
  return entries.map((e) => ({
    id: `ft-${e.id}`,
    kind: "fast_track_accepted" as const,
    title: `⚡ ${e.vendorName} Fast-Track 수락`,
    detail: `사용자가 AI의 Fast-Track 권장을 수락하여 승인함 · ${e.totalAmount.toLocaleString()}원`,
    timestamp: e.acceptedAt,
    href: `/dashboard/orders`,
  }));
}

function buildBudgetEvents(budgets: Budget[]): LedgerEvent[] {
  const events: LedgerEvent[] = [];

  for (const b of budgets) {
    const ctrl = deriveBudgetControl(b);
    if (ctrl.risk === "over") {
      events.push({
        id: `${b.id}-over`,
        kind: "budget_over",
        title: `${b.name} 예산 초과`,
        detail: `소진율 ${ctrl.burnRate.toFixed(0)}% — 즉시 확인 필요`,
        timestamp: b.periodEnd,
        href: `/dashboard/budget`,
      });
    } else if (ctrl.risk === "critical") {
      events.push({
        id: `${b.id}-critical`,
        kind: "budget_critical",
        title: `${b.name} 예산 위험`,
        detail: `소진율 ${ctrl.burnRate.toFixed(0)}% — 잔여 ${ctrl.available.toLocaleString()}원`,
        timestamp: b.periodEnd,
        href: `/dashboard/budget`,
      });
    } else if (ctrl.risk === "warning") {
      events.push({
        id: `${b.id}-warning`,
        kind: "budget_warning",
        title: `${b.name} 소진 주의`,
        detail: `소진율 ${ctrl.burnRate.toFixed(0)}%`,
        timestamp: b.periodEnd,
        href: `/dashboard/budget`,
      });
    }
  }

  return events;
}

// ── Visual mapping ───────────────────────────────────────────────────

function eventIcon(kind: LedgerEventKind) {
  switch (kind) {
    case "order_approved":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
    case "order_received":
      return <Package className="h-3.5 w-3.5 text-emerald-600" />;
    case "order_dispatch_ready":
      return <Truck className="h-3.5 w-3.5 text-violet-600" />;
    case "order_pending_approval":
      return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    case "budget_over":
      return <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />;
    case "budget_critical":
      return <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />;
    case "budget_warning":
      return <DollarSign className="h-3.5 w-3.5 text-amber-500" />;
    case "fast_track_accepted":
      return <Zap className="h-3.5 w-3.5 text-emerald-600" />;
    default:
      return <FileText className="h-3.5 w-3.5 text-slate-500" />;
  }
}

function eventDotColor(kind: LedgerEventKind): string {
  switch (kind) {
    case "order_approved":
    case "order_received":
    case "fast_track_accepted":
      return "bg-emerald-500";
    case "order_dispatch_ready":
      return "bg-violet-500";
    case "order_pending_approval":
    case "budget_warning":
      return "bg-amber-500";
    case "budget_critical":
    case "budget_over":
      return "bg-rose-500";
    default:
      return "bg-slate-300";
  }
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffMs = now - t;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}일 전`;
  const months = Math.round(days / 30);
  return `${months}개월 전`;
}

// ── Component ────────────────────────────────────────────────────────

export function ActionLedger({
  orders,
  budgets,
  fastTrackAcceptances,
  limit = 8,
  loading = false,
}: ActionLedgerProps) {
  const events = useMemo(() => {
    const merged = [
      ...buildOrderEvents(orders),
      ...buildBudgetEvents(budgets),
      ...buildFastTrackEvents(fastTrackAcceptances ?? []),
    ];
    return merged
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }, [orders, budgets, fastTrackAcceptances, limit]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-md bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center">
        <p className="text-xs text-slate-500">최근 발생한 운영 이벤트가 없습니다.</p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-3 pl-4">
      {/* 좌측 타임라인 라인 */}
      <span
        aria-hidden
        className="absolute left-1 top-1 bottom-1 w-px bg-slate-200"
      />
      {events.map((ev) => {
        const content = (
          <div className="flex items-start gap-2.5">
            <span
              className={`relative -ml-[11px] mt-1.5 inline-flex h-2 w-2 flex-shrink-0 rounded-full ring-2 ring-white ${eventDotColor(ev.kind)}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {eventIcon(ev.kind)}
                <p className="text-[12px] font-medium text-slate-800 truncate">
                  {ev.title}
                </p>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                {ev.detail}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {formatRelativeTime(ev.timestamp)}
              </p>
            </div>
          </div>
        );

        return (
          <li key={ev.id}>
            {ev.href ? (
              <Link
                href={ev.href}
                className="block rounded-md px-1.5 py-1 -mx-1.5 hover:bg-slate-50 transition-colors"
              >
                {content}
              </Link>
            ) : (
              <div className="px-1.5 py-1">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
