"use client";

/**
 * §inventory-history-screen — /dashboard/inventory/history?itemId={id}
 *
 * 시약 이력 추적(재고 운영 기록 전수). §inventory-brief-delta(2026-07-29) §3 요구:
 *   품목 프리셀렉트 · 기간 전체 기본 · 전수·출력 담당.
 *
 * 역할 경계(PLAN_inventory-history-screen.md §0):
 *   - 여기 = 재고 운영 기록(입고·출고·입고 예정) 전수 + CSV 반출.
 *   - 수정 이력(누가 무엇을 바꿨나) = 브리핑 패널 "최근 수정 이력" 섹션 소관 — 본 화면 미포함.
 *   - /dashboard/audit(감사 surface)은 ADMIN/manager 전용이라 일반 연구원 재고 추적을 대체 불가.
 *
 * canonical: GET /api/inventory/[id]/movements (InventoryRestock + InventoryUsage 병합,
 *   재고 ownership 게이트). 화면은 read-only projection — mutation 0.
 */

export const dynamic = "force-dynamic";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, History, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell, AppPageHeader } from "@/components/layout/page-header";
import { useInventoryMovements } from "@/hooks/use-inventory-movements";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 50;

const TYPE_STYLE: Record<string, { label: string; cls: string }> = {
  in: { label: "입고", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  incoming: { label: "입고 예정", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  out: { label: "출고", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function InventoryHistoryContent() {
  const searchParams = useSearchParams();
  const itemId = searchParams.get("itemId");
  const { toast } = useToast();

  // 기간 전체 기본 — 값 미입력 시 필터 미전달(전체 기간).
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const { movements, total, truncated, isLoading, isError } = useInventoryMovements(itemId ?? undefined, {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    from: from || undefined,
    to: to || undefined,
    enabled: Boolean(itemId),
  });

  // 품목 표시명(프리셀렉트 헤더) — 재고 상세에서 파생. 실패해도 화면은 동작.
  const { data: inventory } = useQuery({
    queryKey: ["inventory-detail-for-history", itemId],
    enabled: Boolean(itemId),
    queryFn: async () => {
      const res = await fetch(`/api/inventory/${itemId}`);
      if (!res.ok) throw new Error("inventory fetch failed");
      return res.json();
    },
  });

  const itemName: string =
    inventory?.product?.name ?? inventory?.inventory?.product?.name ?? inventory?.name ?? "";

  // truncated = 서버 스캔 상한 초과 구간 → 정렬 보장 불가. 더 깊이 넘기지 않고 기간 좁히기를 안내.
  const hasNext = (page + 1) * PAGE_SIZE < total && !truncated;
  const rangeLabel = useMemo(
    () => (!from && !to ? "전체 기간" : `${from || "처음"} ~ ${to || "현재"}`),
    [from, to],
  );

  /** CSV 반출 — client-side Blob(/dashboard/audit 선례, 신규 endpoint 0). 현재 페이지 조회분 기준. */
  const handleCsvDownload = () => {
    if (movements.length === 0) {
      toast({ title: "내보낼 기록이 없습니다", variant: "destructive" });
      return;
    }
    const headers = ["일시", "유형", "수량", "단위", "상세", "담당"];
    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = movements.map((m) =>
      [
        formatDateTime(m.occurredAt),
        TYPE_STYLE[m.type]?.label ?? m.type,
        String(m.quantity),
        m.unit ?? "",
        m.detail ?? "",
        m.actor ?? "",
      ]
        .map(escape)
        .join(","),
    );
    const csv = "﻿" + [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-history-${itemId?.slice(0, 8) ?? "item"}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: "CSV 내보내기 완료" });
  };

  // itemId 미지정 — 빈 화면 금지, 재고 목록으로 유도.
  if (!itemId) {
    return (
      <PageShell>
        <AppPageHeader
          breadcrumbs={[{ label: "재고", href: "/dashboard/inventory" }, { label: "이력 추적" }]}
          title="시약 이력 추적"
          description="재고 목록에서 품목을 선택하면 해당 품목의 입·출고 기록을 전수로 확인할 수 있습니다."
        />
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <Package className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-600">조회할 품목이 지정되지 않았습니다.</p>
          <Link href="/dashboard/inventory">
            <Button size="sm" className="mt-4">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              재고 목록으로
            </Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AppPageHeader
        breadcrumbs={[{ label: "재고", href: "/dashboard/inventory" }, { label: "이력 추적" }]}
        title={itemName ? `${itemName} · 입·출고 기록` : "입·출고 기록"}
        description="해당 품목의 입고·출고 운영 기록 전수입니다. 기간을 지정해 조회하고 CSV로 내보낼 수 있습니다."
        statusChip={{ label: rangeLabel, tone: "neutral" }}
        actions={[
          {
            render: (
              <Button size="sm" variant="outline" onClick={handleCsvDownload} disabled={isLoading}>
                <Download className="mr-1 h-3.5 w-3.5" />
                CSV 내보내기
              </Button>
            ),
          },
        ]}
      />

      {/* 기간 필터 — 미입력 = 전체 기간(기본) */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="history-from" className="text-[11px] font-semibold text-slate-500">
            시작일
          </label>
          <Input
            id="history-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
            className="h-9 w-40 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="history-to" className="text-[11px] font-semibold text-slate-500">
            종료일
          </label>
          <Input
            id="history-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
            className="h-9 w-40 text-xs"
          />
        </div>
        {(from || to) && (
          <Button
            size="sm"
            variant="ghost"
            className="h-9 text-xs"
            onClick={() => {
              setFrom("");
              setTo("");
              setPage(0);
            }}
          >
            전체 기간
          </Button>
        )}
        <span className="ml-auto text-[11px] text-slate-500">
          {isLoading ? "조회 중…" : `총 ${total}건`}
        </span>
      </div>

      {truncated && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-[11px] text-yellow-800">
          기록이 많아 이 구간부터는 순서를 보장할 수 없습니다. 기간을 좁혀서 조회해주세요.
        </div>
      )}

      {/* 전수 표 */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-slate-100" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-11 animate-pulse bg-slate-50" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-600">기록을 불러오지 못했습니다.</p>
            <p className="mt-1 text-xs text-slate-500">
              접근 권한이 없거나 일시적인 오류일 수 있습니다. 잠시 후 다시 시도해주세요.
            </p>
          </div>
        ) : movements.length === 0 ? (
          <div className="p-8 text-center">
            <History className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm text-slate-600">
              {from || to ? "선택한 기간에 기록이 없습니다." : "입·출고 기록이 없습니다."}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">일시</th>
                <th className="px-3 py-2 font-semibold">유형</th>
                <th className="px-3 py-2 font-semibold text-right">수량</th>
                <th className="px-3 py-2 font-semibold">상세</th>
                <th className="px-3 py-2 font-semibold">담당</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((m) => {
                const style = TYPE_STYLE[m.type] ?? { label: m.type, cls: "bg-slate-50 text-slate-600 border-slate-200" };
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {formatDateTime(m.occurredAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${style.cls}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900 whitespace-nowrap">
                      {m.quantity}
                      {m.unit ? ` ${m.unit}` : ""}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{m.detail || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{m.actor || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 페이지네이션 */}
      {!isLoading && !isError && movements.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + movements.length} / {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              이전
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              다음
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export default function InventoryHistoryPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
          <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
        </PageShell>
      }
    >
      <InventoryHistoryContent />
    </Suspense>
  );
}
