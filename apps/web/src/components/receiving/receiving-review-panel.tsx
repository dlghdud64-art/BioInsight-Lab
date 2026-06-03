"use client";

// §11.348-A-4b — 공급사 입고 회신 검토 패널 (same-canvas, receiving 랜딩 상단).
// PENDING_REVIEW 입고안을 연구소가 검토 → 승인(재고 확정) / 반려. A-4 라우트 호출.
// canonical mutation 은 서버(A-4)에서만 — 패널은 트리거.

import { useEffect, useState, useCallback } from "react";
import { csrfFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PackageCheck, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight } from "lucide-react";

interface DraftItem {
  id: string;
  name: string;
  productId: string | null;
  receivedQuantity: number | null;
  lotNumber: string | null;
  expiryDate: string | null;
}
interface Draft {
  id: string;
  status: string;
  submittedAt: string | null;
  vendorNote: string | null;
  vendorName: string | null;
  order: { id: string; orderNumber: string; status: string } | null;
  items: DraftItem[];
}

export function ReceivingReviewPanel() {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [acting, setActing] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/receiving-drafts?status=PENDING_REVIEW");
      if (!res.ok) throw new Error("목록 조회 실패");
      const data = await res.json();
      setDrafts(data.drafts ?? []);
    } catch {
      // 조용히 — 패널은 보조. 빈 상태로.
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: "approve" | "reject") => {
    setActing((p) => ({ ...p, [id]: true }));
    try {
      const res = await csrfFetch(`/api/receiving-drafts/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reject" ? { reason: "연구소 검토 반려" } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "처리 실패");
      toast({
        title: action === "approve" ? "입고 확정" : "반려 완료",
        description: action === "approve"
          ? `재고에 반영되었습니다. (${data.restockCount ?? 0}건)`
          : "입고안이 반려되었습니다.",
      });
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } catch (e: any) {
      toast({ title: "처리 실패", description: e.message, variant: "destructive" });
    } finally {
      setActing((p) => ({ ...p, [id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> 입고 회신 확인 중…
      </div>
    );
  }
  if (drafts.length === 0) return null; // 검토 대기 0건 — 패널 숨김(공간 절약)

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3" data-testid="receiving-review-panel">
      <div className="flex items-center gap-2">
        <PackageCheck className="h-5 w-5 text-indigo-600" />
        <h2 className="text-base font-bold text-slate-900">
          공급사 입고 회신 검토 <span className="text-indigo-600">· {drafts.length}건</span>
        </h2>
      </div>
      <p className="text-xs text-slate-500">공급사가 회신한 LOT·실수량을 확인하고 승인하면 재고에 반영됩니다.</p>

      <div className="space-y-2">
        {drafts.map((d) => {
          const isOpen = expanded[d.id];
          const busy = acting[d.id];
          return (
            <div key={d.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setExpanded((p) => ({ ...p, [d.id]: !p[d.id] }))}
                  className="flex items-center gap-2 min-w-0 text-left"
                >
                  {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                  <span className="text-sm font-semibold text-slate-900 truncate">
                    {d.order?.orderNumber ?? "발주"} {d.vendorName ? `· ${d.vendorName}` : ""}
                  </span>
                  <Badge variant="outline" className="border-slate-300 text-slate-600 flex-shrink-0">{d.items.length}품목</Badge>
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => act(d.id, "reject")}
                    className="h-9 text-red-600 border-red-200 hover:bg-red-50 gap-1">
                    <XCircle className="h-3.5 w-3.5" /> 반려
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => act(d.id, "approve")}
                    className="h-9 bg-emerald-600 hover:bg-emerald-700 gap-1">
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} 승인·입고
                  </Button>
                </div>
              </div>
              {isOpen && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                  {d.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-medium text-slate-800 truncate">{it.name}</span>
                      <span className="flex items-center gap-3 flex-shrink-0">
                        <span>실수량 {it.receivedQuantity ?? "-"}</span>
                        <span>LOT {it.lotNumber ?? "-"}</span>
                        <span>유효 {it.expiryDate ? String(it.expiryDate).split("T")[0] : "-"}</span>
                      </span>
                    </div>
                  ))}
                  {d.vendorNote && <p className="text-xs text-slate-500 pt-1">메모: {d.vendorNote}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
