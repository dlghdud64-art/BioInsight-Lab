"use client";

// §11.348-A-4b — 공급사 입고 회신 검토 패널 (same-canvas, receiving 랜딩 상단).
// PENDING_REVIEW 입고안을 연구소가 검토 → 승인(재고 확정) / 반려. A-4 라우트 호출.
// canonical mutation 은 서버(A-4)에서만 — 패널은 트리거.
//
// §receiving-inspection-decision (T2, 2026-08-01) — 검수 판정 입력 추가.
//   핸드오프 §0-3(검수 화면이 정적 표시물) 해소: 라인별 합격/불합격 · 실측 수량 입력 ·
//   불일치 처리(재배송/부분입고/반품)+사유 · 임시 저장 · 전 품목 판정 전 확정 disabled.
//   판정은 PATCH /inspect 로 서버 저장(front-only 판정 금지), 재고 반영은 approve 단일 경로.

import { useEffect, useState, useCallback } from "react";
import { csrfFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PackageCheck, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
// §11.348-A-5 — 확정 입고안 → 현장 QR 라벨(§11.355-B) 접합.
import { LabelPrintModal } from "@/components/inventory/LabelPrintModal";

interface DraftItem {
  id: string;
  name: string;
  productId: string | null;
  /** 발주 수량(PO) */
  expectedQuantity: number | null;
  /** 공급사 회신값 — 근거 보존(덮어쓰지 않음) */
  receivedQuantity: number | null;
  /** 검수 실측값 — 재고 반영 기준 */
  inspectedQuantity: number | null;
  unit: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  decision: string | null;
  decidedAt: string | null;
  discrepancyAction: string | null;
  discrepancyReason: string | null;
  restockedAt: string | null;
}
interface InspectionEdit {
  inspectedQuantity: number | null;
  decision: string | null;
  discrepancyAction: string | null;
  discrepancyReason: string | null;
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
  // §11.348-A-5 — 승인 직후 현장 라벨 출력(QR=inventoryId).
  const [labelOpen, setLabelOpen] = useState(false);
  const [labelItems, setLabelItems] = useState<Array<{ id: string; name: string; lotNumber?: string; expiryDate?: string }>>([]);

  // §T2 — 라인별 검수 입력 로컬 초안(itemId → 부분 편집). 저장 전까지는 UI 상태,
  //   저장(임시 저장 또는 확정)에서 서버에 기록된다. canonical 은 항상 서버 값.
  const [edits, setEdits] = useState<Record<string, Partial<InspectionEdit>>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const editOf = (it: DraftItem): InspectionEdit => ({
    inspectedQuantity:
      edits[it.id]?.inspectedQuantity !== undefined
        ? edits[it.id]!.inspectedQuantity!
        : it.inspectedQuantity ?? it.receivedQuantity ?? null,
    decision: edits[it.id]?.decision !== undefined ? edits[it.id]!.decision! : it.decision,
    discrepancyAction:
      edits[it.id]?.discrepancyAction !== undefined ? edits[it.id]!.discrepancyAction! : it.discrepancyAction,
    discrepancyReason:
      edits[it.id]?.discrepancyReason !== undefined ? edits[it.id]!.discrepancyReason! : it.discrepancyReason,
  });

  const setEdit = (itemId: string, patch: Partial<InspectionEdit>) =>
    setEdits((p) => ({ ...p, [itemId]: { ...p[itemId], ...patch } }));

  /** 발주 대비 차이 — 상태 열 파생(수량 미입력이면 판정 불가 상태). */
  const diffOf = (it: DraftItem): number | null => {
    const e = editOf(it);
    if (it.expectedQuantity == null || e.inspectedQuantity == null) return null;
    return e.inspectedQuantity - it.expectedQuantity;
  };

  /** 확정 차단 사유 — "남은 일" 텍스트 소스(사유 없는 disabled 금지). */
  const blockersOf = (d: Draft): string[] => {
    const out: string[] = [];
    const undecided = d.items.filter((it) => !editOf(it).decision && !it.restockedAt);
    if (undecided.length > 0) {
      out.push(`${undecided.map((it) => it.name).slice(0, 2).join(" · ")}${undecided.length > 2 ? ` 외 ${undecided.length - 2}건` : ""} 판정`);
    }
    const needReason = d.items.filter((it) => {
      const e = editOf(it);
      const diff = diffOf(it);
      return e.decision && diff !== null && diff !== 0 && (!e.discrepancyAction || !e.discrepancyReason?.trim());
    });
    if (needReason.length > 0) out.push("불일치 사유 입력");
    return out;
  };

  /** 판정 저장(임시 저장 겸용) — 서버 확인 후에만 목록 갱신. */
  const saveInspection = async (d: Draft, opts: { silent?: boolean } = {}) => {
    setSaving((p) => ({ ...p, [d.id]: true }));
    try {
      const payload = d.items
        .filter((it) => !it.restockedAt)
        .map((it) => {
          const e = editOf(it);
          return {
            itemId: it.id,
            inspectedQuantity: e.inspectedQuantity,
            decision: e.decision,
            discrepancyAction: e.discrepancyAction,
            discrepancyReason: e.discrepancyReason,
          };
        });
      const res = await csrfFetch(`/api/receiving-drafts/${d.id}/inspect`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      // 서버 저장 성공 후에만 로컬 초안을 비우고 서버 값으로 재조회(front-only 상태 금지).
      setEdits((p) => {
        const next = { ...p };
        d.items.forEach((it) => delete next[it.id]);
        return next;
      });
      await load();
      if (!opts.silent) {
        toast({ title: "임시 저장 완료", description: `판정 ${data.decidedCount ?? 0}/${data.totalCount ?? d.items.length}건이 저장되었습니다.` });
      }
      return true;
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
      return false;
    } finally {
      setSaving((p) => ({ ...p, [d.id]: false }));
    }
  };

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
    // §T2 — 확정 전 판정을 서버에 먼저 저장(로컬 초안이 반영 안 된 채 확정되는 것 방지).
    if (action === "approve") {
      const d = drafts.find((x) => x.id === id);
      if (d) {
        const ok = await saveInspection(d, { silent: true });
        if (!ok) return;
      }
    }
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
          ? `재고에 반영되었습니다. (${data.restockCount ?? 0}건) 현장 라벨을 출력하세요.`
          : "입고안이 반려되었습니다.",
      });
      // §11.348-A-5 — 승인 시 확정 품목(inventoryId)을 라벨 모달로 → 현장 QR 출력.
      if (action === "approve" && Array.isArray(data.restockedItems) && data.restockedItems.length > 0) {
        setLabelItems(data.restockedItems);
        setLabelOpen(true);
      }
      // §T2 — 부분 입고면 잔여 재확정을 위해 목록에 유지(서버가 PENDING_REVIEW 유지).
      if (action === "approve" && data.partial) {
        toast({
          title: "부분 입고 확정",
          description: `합격분 ${data.restockCount ?? 0}건이 반영됐습니다. 재배송 대기 ${data.pendingCount ?? 0}건은 도착 후 이어서 확정하세요.`,
        });
        await load();
      } else {
        setDrafts((prev) => prev.filter((d) => d.id !== id));
      }
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
          // §T2 — 확정 게이트: 전 품목 판정 + 불일치 사유 입력 전 disabled(사유는 아래 "남은 일"로 표기).
          const blockers = blockersOf(d);
          const decidedCount = d.items.filter((it) => !!editOf(it).decision || !!it.restockedAt).length;
          const canConfirm = blockers.length === 0;
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
                  {/* §T2 — 진행률 N/M 판정 */}
                  <Badge
                    variant="outline"
                    className={`flex-shrink-0 ${decidedCount === d.items.length ? "border-emerald-300 text-emerald-700" : "border-blue-300 text-blue-700"}`}
                  >
                    {decidedCount}/{d.items.length} 판정
                  </Badge>
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => act(d.id, "reject")}
                    className="h-9 text-red-600 border-red-200 hover:bg-red-50 gap-1">
                    <XCircle className="h-3.5 w-3.5" /> 반려
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy || !canConfirm}
                    title={canConfirm ? undefined : `남은 일: ${blockers.join(" · ")}`}
                    onClick={() => act(d.id, "approve")}
                    className="h-9 bg-emerald-600 hover:bg-emerald-700 gap-1"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} 검수 완료 — 재고 반영
                  </Button>
                </div>
              </div>
              {isOpen && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  {/* §T2 — 6열 검수 표: 품목 | Lot/유효기간 | 발주 | 수령(입력) | 상태(파생) | 판정 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="py-1.5 pr-2 font-semibold">품목</th>
                          <th className="py-1.5 px-2 font-semibold">Lot / 유효기간</th>
                          <th className="py-1.5 px-2 font-semibold text-right">발주</th>
                          <th className="py-1.5 px-2 font-semibold text-center">수령</th>
                          <th className="py-1.5 px-2 font-semibold text-center">상태</th>
                          <th className="py-1.5 pl-2 font-semibold text-right">판정</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {d.items.map((it) => {
                          const e = editOf(it);
                          const diff = diffOf(it);
                          const mismatched = diff !== null && diff !== 0;
                          const decided = !!e.decision;
                          const locked = !!it.restockedAt;
                          return (
                            <tr key={it.id} className={decided && e.decision === "PASS" ? "bg-emerald-50/60" : undefined}>
                              <td className="py-2 pr-2 align-top">
                                <span className="font-medium text-slate-800">{it.name}</span>
                                {locked && <span className="ml-1 text-[10px] text-slate-400">반영 완료</span>}
                              </td>
                              <td className="py-2 px-2 align-top text-slate-600">
                                {it.lotNumber ?? "—"}
                                <span className="block text-[10px] text-slate-400">
                                  {it.expiryDate ? String(it.expiryDate).split("T")[0] : "—"}
                                </span>
                              </td>
                              <td className="py-2 px-2 align-top text-right text-slate-700">
                                {it.expectedQuantity ?? "—"}
                                {it.unit ? ` ${it.unit}` : ""}
                              </td>
                              <td className="py-2 px-2 align-top text-center">
                                {locked ? (
                                  <span className="text-slate-600">{it.inspectedQuantity ?? "—"}</span>
                                ) : (
                                  <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={e.inspectedQuantity ?? ""}
                                    onChange={(ev) =>
                                      setEdit(it.id, {
                                        inspectedQuantity: ev.target.value === "" ? null : Number(ev.target.value),
                                      })
                                    }
                                    className="h-8 w-20 text-center text-xs"
                                    aria-label={`${it.name} 수령 수량`}
                                  />
                                )}
                                {it.receivedQuantity != null && (
                                  <span className="block text-[10px] text-slate-400">회신 {it.receivedQuantity}</span>
                                )}
                              </td>
                              <td className="py-2 px-2 align-top text-center">
                                {mismatched ? (
                                  <span className="inline-flex rounded-md bg-red-50 px-1.5 py-0.5 font-bold text-red-700">
                                    불일치 {diff! > 0 ? `+${diff}` : diff}
                                  </span>
                                ) : decided && e.decision === "PASS" ? (
                                  <span className="inline-flex rounded-md bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-700">합격</span>
                                ) : decided ? (
                                  <span className="inline-flex rounded-md bg-red-100 px-1.5 py-0.5 font-bold text-red-700">불합격</span>
                                ) : (
                                  <span className="text-slate-400">검수 대기</span>
                                )}
                              </td>
                              <td className="py-2 pl-2 align-top text-right">
                                {locked ? (
                                  <span className="text-[10px] text-slate-400">확정됨</span>
                                ) : decided ? (
                                  <button
                                    type="button"
                                    onClick={() => setEdit(it.id, { decision: null, discrepancyAction: null, discrepancyReason: null })}
                                    className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                                  >
                                    판정 취소
                                  </button>
                                ) : (
                                  <span className="inline-flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setEdit(it.id, { decision: "PASS" })}
                                      className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                                    >
                                      합격
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEdit(it.id, { decision: "FAIL" })}
                                      className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                                    >
                                      불합격
                                    </button>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* §T2 — 수량 불일치 처리(필수): 3택 + 사유. 불일치 라인에만 노출. */}
                  {d.items
                    .filter((it) => !it.restockedAt && diffOf(it) !== null && diffOf(it) !== 0)
                    .map((it) => {
                      const e = editOf(it);
                      const diff = diffOf(it)!;
                      return (
                        <div key={`disc-${it.id}`} className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3">
                          <p className="text-[12px] font-bold text-red-700">
                            {it.name} — 수량 불일치 (발주 {it.expectedQuantity} / 수령 {e.inspectedQuantity})
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {[
                              { key: "RESHIP", label: "부족분 재배송 요청" },
                              { key: "PARTIAL", label: "부분 입고로 확정" },
                              { key: "RETURN", label: "반품" },
                            ].map((opt) => (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => setEdit(it.id, { discrepancyAction: opt.key })}
                                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                  e.discrepancyAction === opt.key
                                    ? "border-red-500 bg-red-500 text-white"
                                    : "border-red-200 bg-white text-red-700 hover:bg-red-100"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          <Input
                            value={e.discrepancyReason ?? ""}
                            onChange={(ev) => setEdit(it.id, { discrepancyReason: ev.target.value })}
                            placeholder="사유를 입력하세요 (필수)"
                            className="mt-2 h-8 bg-white text-xs"
                            aria-label={`${it.name} 불일치 사유`}
                          />
                          <p className="mt-1 text-[10px] text-red-600">
                            {diff < 0 ? `${Math.abs(diff)}개 부족` : `${diff}개 초과`} · 처리 방식과 사유 모두 입력해야 확정할 수 있습니다.
                          </p>
                        </div>
                      );
                    })}

                  {d.vendorNote && <p className="pt-2 text-xs text-slate-500">메모: {d.vendorNote}</p>}

                  {/* §T2 — 푸터: 임시 저장 + 남은 일(사유 없는 disabled 금지) */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                    <span className="text-[11px] text-slate-500">
                      {blockers.length > 0 ? `남은 일: ${blockers.join(" · ")}` : "전 품목 판정 완료 — 확정할 수 있습니다."}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={!!saving[d.id]}
                      onClick={() => saveInspection(d)}
                    >
                      {saving[d.id] ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                      임시 저장
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* §11.348-A-5b — 라벨 재출력: 승인 직후 모달을 닫았어도 방금 확정분 다시 출력 */}
      {labelItems.length > 0 && !labelOpen && (
        <button
          onClick={() => setLabelOpen(true)}
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          <PackageCheck className="h-3.5 w-3.5" /> 방금 승인한 입고 라벨 재출력 ({labelItems.length}건)
        </button>
      )}

      {/* §11.348-A-5 — 확정 입고안 현장 QR 라벨 출력 */}
      <LabelPrintModal open={labelOpen} onOpenChange={setLabelOpen} selectedItems={labelItems} />
    </div>
  );
}
