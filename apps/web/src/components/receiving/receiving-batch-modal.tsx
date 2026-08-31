"use client";

/**
 * §receiving-detail-redesign §4 — 일괄 처리 모달 (원버튼 해소)
 *
 * 남은 조치를 한 모달에서 순차 처리한다. 스텝 = 미해소 조치 1개씩.
 *   · 판정 스텝: 라인별 합격/불합격 + 실측 수량 (+ 불일치 시 처리·사유 필수) → PATCH /inspect
 *   · 문서 스텝: COA/거래명세서 업로드 → POST /api/receiving/documents/[orderId]
 *                "파일이 없습니다, 공급사에 요청" = 외부 대기(스텝 건너뜀 · 반영 보류)
 *   · 마지막 스텝 완료 → POST /approve (재고 반영) 자동. 외부 대기가 남으면 반영 보류.
 *
 * 배선 규칙(§6):
 *   · 각 스텝은 즉시 canonical 에 커밋한다 — "나중에" 로 이탈해도 처리분은 이미 저장(front-only 0).
 *   · `다음` disabled 사유는 버튼 라벨에 인라인(툴팁 금지).
 *   · COA 인식(§scan-recognition-upgrade P1) — 업로드 후 인식 API(저장 0) 호출 →
 *     RecognizedFieldsReview 확인 → 사람 확정 시에만 inspect PATCH 로 저장.
 *     "COA 인식" 배지 truth = canonical lotSource("coa_ocr") — 인식 응답만으로 달지 않는다.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { csrfFetch } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Upload, Send, X } from "lucide-react";
import type { CoaRecognitionResponse } from "@/lib/ocr/coa-recognize";
import {
  RecognizedFieldsReview,
  type RecognizedConfirmInput,
} from "@/components/ocr/recognized-fields-review";
import { fileToDataUrl } from "@/lib/utils/file-to-base64";

export type BatchItem = {
  id: string;
  name: string;
  productId: string | null;
  expectedQuantity: number | null;
  receivedQuantity: number | null;
  inspectedQuantity: number | null;
  unit: string | null;
  lotNumber: string | null;
  /** API(`/api/receiving-drafts/[id]`)가 반환하고 상세 페이지가 렌더한다 — 타입에만 누락돼 있었다 */
  expiryDate: string | null;
  /** §scan-recognition-upgrade P1 — lot 출처 canonical ("COA 인식" 배지 truth) */
  lotSource: string | null;
  decision: string | null;
  discrepancyAction: string | null;
  discrepancyReason: string | null;
  restockedAt: string | null;
};

export type BatchDoc = { id: string; docType: string; fileName: string };

type Step =
  | { kind: "decide"; item: BatchItem }
  | { kind: "document"; missing: "coa" | "invoice" }
  | { kind: "approve" };

const DISCREPANCY = [
  { key: "PARTIAL", label: "부분 입고" },
  { key: "RESHIP", label: "재배송 요청" },
  { key: "RETURN", label: "반품" },
] as const;

function stepTitle(s: Step): string {
  if (s.kind === "decide") return `검수 판정 · ${s.item.name}`;
  if (s.kind === "document") return s.missing === "coa" ? "COA 확보" : "거래명세서 확보";
  return "재고 반영";
}

export function ReceivingBatchModal({
  open,
  onClose,
  draftId,
  orderId,
  items,
  documents,
  onCommitted,
}: {
  open: boolean;
  onClose: () => void;
  draftId: string;
  orderId: string;
  items: BatchItem[];
  documents: BatchDoc[];
  /** 스텝 하나가 canonical 에 커밋될 때마다 — 부모는 refetch */
  onCommitted: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [externalWait, setExternalWait] = useState<Set<string>>(new Set());
  const [idx, setIdx] = useState(0);

  // 판정 스텝 로컬 입력
  const [decision, setDecision] = useState<"PASS" | "FAIL" | null>(null);
  const [qty, setQty] = useState<string>("");
  const [dAction, setDAction] = useState<string | null>(null);
  const [dReason, setDReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // §scan-recognition-upgrade P1 — COA 인식 결과(표시용 파생 · 저장 0). 확정 전 canonical 무접촉.
  const [coaRecog, setCoaRecog] = useState<CoaRecognitionResponse | null>(null);

  const steps = useMemo<Step[]>(() => {
    const s: Step[] = [];
    for (const it of items) if (it.decision == null) s.push({ kind: "decide", item: it });
    const hasCoa = documents.some((d) => d.docType === "coa");
    const hasInvoice = documents.some((d) => d.docType === "invoice");
    if (!hasCoa && !externalWait.has("coa")) s.push({ kind: "document", missing: "coa" });
    if (!hasInvoice && !externalWait.has("invoice")) s.push({ kind: "document", missing: "invoice" });
    s.push({ kind: "approve" });
    return s;
  }, [items, documents, externalWait]);

  const total = steps.length;
  const cur = steps[Math.min(idx, total - 1)];

  // 스텝 진입 시 입력 초기화
  useEffect(() => {
    if (!cur) return;
    if (cur.kind === "decide") {
      const it = cur.item;
      setDecision(null);
      setQty(String(it.inspectedQuantity ?? it.receivedQuantity ?? it.expectedQuantity ?? ""));
      setDAction(null);
      setDReason("");
    }
    setFile(null);
  }, [idx, cur?.kind, cur?.kind === "decide" ? cur.item.id : ""]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) setIdx(0);
  }, [open]);

  const mismatched = useMemo(() => {
    if (cur?.kind !== "decide") return false;
    const n = Number(qty);
    const exp = cur.item.expectedQuantity;
    return Number.isFinite(n) && exp != null && n !== exp;
  }, [cur, qty]);

  // `다음` 차단 사유 — 라벨 인라인 (툴팁 금지)
  const blockReason = useMemo<string | null>(() => {
    if (!cur) return null;
    if (cur.kind === "decide") {
      if (!decision) return "합격/불합격 선택 필요";
      if (qty === "" || Number(qty) < 0) return "실측 수량 입력 필요";
      if (mismatched && !dAction) return "수량 불일치 · 처리 방식 선택 필요";
      if (mismatched && !dReason.trim()) return "수량 불일치 · 사유 입력 필요";
      return null;
    }
    if (cur.kind === "document") return file ? null : "파일 선택 필요";
    return null;
  }, [cur, decision, qty, mismatched, dAction, dReason, file]);

  const externalPending = externalWait.size > 0;

  const commitDecide = useCallback(async () => {
    if (cur?.kind !== "decide") return;
    const res = await csrfFetch(`/api/receiving-drafts/${draftId}/inspect`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            // inspect 계약은 itemId — `id:` 로 보내면 422 ITEM_MISMATCH (계약 불일치 결함 수정)
            itemId: cur.item.id,
            inspectedQuantity: Number(qty),
            decision,
            discrepancyAction: mismatched ? dAction : null,
            discrepancyReason: mismatched ? dReason.trim() : null,
          },
        ],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "판정 저장 실패");
  }, [cur, draftId, qty, decision, mismatched, dAction, dReason]);

  const commitDocument = useCallback(async () => {
    if (cur?.kind !== "document" || !file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("docType", cur.missing);
    const res = await csrfFetch(`/api/receiving/documents/${orderId}`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "문서 업로드 실패");
  }, [cur, file, orderId]);

  // COA 인식 — 추출·대조 응답만(저장 0). jobId 없으면 null(lineage 없는 확정 금지).
  const runCoaRecognition = useCallback(async (coaFile: File): Promise<CoaRecognitionResponse | null> => {
    try {
      const imageBase64 = await fileToDataUrl(coaFile);
      const res = await csrfFetch(`/api/receiving-drafts/${draftId}/coa-recognize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.jobId) return null;
      return data as CoaRecognitionResponse;
    } catch {
      return null; // 인식 실패 = 업로드만 완료된 기존 흐름(수동 폴백) — 가짜 성공 0
    }
  }, [draftId]);

  // COA 확정 — 사람 클릭 후에만 canonical 저장(inspect PATCH 단일 경로).
  const confirmCoa = useCallback(async (input: RecognizedConfirmInput) => {
    if (!coaRecog?.jobId) return;
    setBusy(true);
    try {
      const res = await csrfFetch(`/api/receiving-drafts/${draftId}/inspect`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              itemId: input.itemId,
              lotNumber: input.lot,
              expiryDate: input.expiry,
              lotSource: "coa_ocr",
              coaOcrJobId: coaRecog.jobId,
            },
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "COA 확정 실패");
      onCommitted();
      toast({ title: "COA 인식 확정", description: "선택 라인의 Lot·유효기간이 저장되었습니다." });
      setCoaRecog(null);
      setIdx((i) => i + 1);
    } catch (e: unknown) {
      toast({ title: "COA 확정 실패", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [coaRecog, draftId, onCommitted, toast]);

  const commitApprove = useCallback(async () => {
    const res = await csrfFetch(`/api/receiving-drafts/${draftId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "재고 반영 실패");
    return data;
  }, [draftId]);

  const next = useCallback(async () => {
    if (!cur || blockReason) return;
    if (coaRecog) return; // 인식 확인 화면이 열려 있으면 확정/나중에 버튼만 유효

    setBusy(true);
    try {
      if (cur.kind === "decide") {
        await commitDecide();
        onCommitted();
        setIdx((i) => i + 1);
      } else if (cur.kind === "document") {
        await commitDocument();
        onCommitted();
        // COA 스텝은 업로드 후 인식 시도 — 결과가 있으면 확인 화면을 띄우고 대기(자동 진행 0).
        if (cur.missing === "coa" && file) {
          const recognition = await runCoaRecognition(file);
          if (recognition) {
            setCoaRecog(recognition);
            return;
          }
        }
        setIdx((i) => i + 1);
      } else {
        if (externalPending) {
          toast({
            title: "반영 보류",
            description: "공급사 회신 대기 문서가 있어 재고 반영을 보류합니다. 처리분은 저장되었습니다.",
          });
          onClose();
          return;
        }
        const data = await commitApprove();
        onCommitted();
        toast({
          title: "재고 반영 완료",
          description: `${data?.restockedCount ?? data?.restockedItems?.length ?? ""} 품목이 재고에 반영되었습니다.`.trim(),
        });
        onClose();
      }
    } catch (e: unknown) {
      toast({ title: "처리 실패", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [cur, blockReason, coaRecog, commitDecide, commitDocument, commitApprove, externalPending, onCommitted, onClose, toast, file, runCoaRecognition]);

  const requestFromVendor = useCallback(() => {
    if (cur?.kind !== "document") return;
    // 외부 대기로 넘긴다 — 스텝 목록에서 빠지고 approve 스텝이 "반영 보류" 로 동작한다.
    setExternalWait((prev) => new Set(prev).add(cur.missing));
    toast({ title: "공급사 요청으로 표시", description: "이 문서는 외부 대기로 넘깁니다. 도착 후 첨부하면 반영할 수 있습니다." });
  }, [cur, toast]);

  if (!open || !cur) return null;

  const done = Math.min(idx, total - 1);
  const pct = Math.round((done / Math.max(total - 1, 1)) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="남은 조치 처리">
      <div className="w-full sm:max-w-lg bg-white rounded-t-[18px] sm:rounded-[18px] border border-[#e2e8f0] shadow-xl max-h-[92vh] flex flex-col">
        {/* 헤더 */}
        <div className="px-5 pt-4 pb-3 border-b border-[#e2e8f0]">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-extrabold text-[#0f172a]">
              남은 조치 처리 {Math.min(idx + 1, total)}/{total}
            </h3>
            <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-[#f1f5f9] text-[#64748b]" aria-label="닫기">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-[#eef2f7] overflow-hidden">
            <div className="h-full bg-[#2563eb] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* 스텝 목록 — 활성만 펼침, 나머지 dim 요약행 */}
        <div className="px-5 py-4 space-y-2 overflow-y-auto">
          {steps.map((s, i) => {
            const active = i === idx;
            const finished = i < idx;
            return (
              <div key={`${s.kind}-${i}`} className={`rounded-[13px] border ${active ? "border-[#2563eb] ring-4 ring-[rgba(37,99,235,.15)]" : "border-[#e2e8f0]"} ${active ? "bg-white" : "bg-[#f8fafc]"}`}>
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${finished ? "bg-[#16a34a] text-white" : active ? "bg-[#2563eb] text-white" : "bg-[#e2e8f0] text-[#64748b]"}`}>
                    {finished ? "✓" : i + 1}
                  </span>
                  <span className={`text-[13px] font-semibold ${active ? "text-[#0f172a]" : "text-[#64748b]"}`}>{stepTitle(s)}</span>
                </div>

                {active && s.kind === "decide" && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="text-[12px] text-[#64748b] tabular-nums">
                      발주 {s.item.expectedQuantity ?? "-"} · 공급사 회신 {s.item.receivedQuantity ?? "-"} {s.item.unit ?? ""}
                      {s.item.lotNumber ? <> · Lot <span className="font-mono">{s.item.lotNumber}</span></> : null}
                      {/* 배지 truth = canonical lotSource — 확정된 라인만 */}
                      {s.item.lotSource === "coa_ocr" && (
                        <span className="ml-1.5 inline-flex items-center text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">
                          COA 인식
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setDecision("PASS")} className={`h-[42px] rounded-lg border text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 ${decision === "PASS" ? "bg-[#f0fdf4] border-[#bbf7d0] text-[#15803d]" : "bg-white border-[#e2e8f0] text-[#475569]"}`}>
                        <CheckCircle2 className="h-4 w-4" /> 합격
                      </button>
                      <button onClick={() => setDecision("FAIL")} className={`h-[42px] rounded-lg border text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 ${decision === "FAIL" ? "bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]" : "bg-white border-[#e2e8f0] text-[#475569]"}`}>
                        <XCircle className="h-4 w-4" /> 불합격
                      </button>
                    </div>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-[#64748b]">실측 수량</span>
                      <input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-[#e2e8f0] px-3 text-[13px] tabular-nums" />
                    </label>
                    {mismatched && (
                      <div className="rounded-lg bg-[#fefce8] border border-[#fef08a] p-3 space-y-2">
                        <p className="text-[12px] font-semibold text-[#a16207]">발주 수량과 다릅니다 · 처리 방식과 사유가 필요합니다</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {DISCREPANCY.map((o) => (
                            <button key={o.key} onClick={() => setDAction(o.key)} className={`h-8 px-3 rounded-full border text-[12px] font-semibold ${dAction === o.key ? "bg-[#2563eb] border-[#2563eb] text-white" : "bg-white border-[#e2e8f0] text-[#475569]"}`}>{o.label}</button>
                          ))}
                        </div>
                        <input value={dReason} onChange={(e) => setDReason(e.target.value)} placeholder="사유 메모 (필수)" className="w-full h-9 rounded-lg border border-[#e2e8f0] px-3 text-[12px]" />
                      </div>
                    )}
                  </div>
                )}

                {active && s.kind === "document" && (
                  <div className="px-4 pb-4 space-y-3">
                    {coaRecog ? (
                      <RecognizedFieldsReview
                        fields={coaRecog.fields}
                        confidence={coaRecog.confidence}
                        lines={coaRecog.perLine.map((p) => ({
                          itemId: p.itemId,
                          name: items.find((it) => it.id === p.itemId)?.name ?? p.itemId,
                          match: p.match,
                        }))}
                        busy={busy}
                        onConfirm={(input) => { void confirmCoa(input); }}
                        onDismiss={() => { setCoaRecog(null); setIdx((i) => i + 1); }}
                      />
                    ) : (
                      <>
                        <label className="flex flex-col items-center justify-center gap-1.5 rounded-[13px] border-2 border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-6 cursor-pointer hover:border-[#2563eb]">
                          <Upload className="h-5 w-5 text-[#64748b]" />
                          <span className="text-[13px] font-semibold text-[#0f172a]">{file ? file.name : "파일을 끌어다 놓거나 클릭해 선택"}</span>
                          <span className="text-[11px] text-[#94a3b8]">PDF · 이미지 · 첨부 후 담당자가 Lot·유효기간을 확인하고 확정합니다</span>
                          <input type="file" className="hidden" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                        </label>
                        <button onClick={requestFromVendor} className="w-full h-10 rounded-lg border border-[#e2e8f0] bg-white text-[13px] font-semibold text-[#475569] inline-flex items-center justify-center gap-1.5 hover:bg-[#f1f5f9]">
                          <Send className="h-4 w-4" /> 파일이 없습니다, 공급사에 요청
                        </button>
                      </>
                    )}
                  </div>
                )}

                {active && s.kind === "approve" && (
                  <div className="px-4 pb-4 text-[12.5px] text-[#475569] leading-relaxed">
                    {externalPending
                      ? "공급사 회신 대기 문서가 있습니다. 처리분은 저장되고 재고 반영은 보류됩니다."
                      : "판정 완료된 합격 품목이 재고에 반영되고 반영 이력이 기록됩니다. 이미 반영된 라인은 건너뜁니다."}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 하단 */}
        <div className="px-5 py-3 border-t border-[#e2e8f0] grid grid-cols-2 gap-2">
          <button onClick={onClose} disabled={busy} className="h-[42px] rounded-lg border border-[#e2e8f0] bg-white text-[13px] font-semibold text-[#475569]">
            나중에
          </button>
          <button
            onClick={next}
            disabled={busy || !!blockReason}
            aria-disabled={busy || !!blockReason}
            className="h-[42px] rounded-lg bg-[#2563eb] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:bg-[#e2e8f0] disabled:text-[#94a3b8]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {blockReason
              ? `다음 · ${blockReason}`
              : cur.kind === "approve"
                ? externalPending ? "저장하고 닫기" : "재고 반영"
                : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
