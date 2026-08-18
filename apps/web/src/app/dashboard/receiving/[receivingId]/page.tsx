"use client";

/**
 * 입고 상세 — §receiving-detail-redesign (핸드오프 2026-08-04 · 구현 2026-08-17)
 *
 * P1  데모 시드(useOpsStore) 폐기 → canonical ReceivingDraft 를 GET /api/receiving-drafts/[id] 로 읽는다.
 * P2  라이트 전면 재구성(§1) + 다음 조치 단일 패널(§2). 다크 카드 0 · 3중 중복 0.
 * P3  일괄 처리 모달(§4) — 원버튼 `남은 N건 처리하고 반영`. 부분 반영·disabled 재고 반영 버튼 없음.
 * §5  모바일 = 같은 컴포넌트의 단일 컬럼. 다음 조치 최상단 · sticky 단일 CTA.
 *
 * 배선(§6): 판정 /inspect · 문서 /api/receiving/documents/[orderId] · 반영 /approve(이중 반영 가드는 서버).
 *   상태·KPI·조치는 전부 draft 에서 파생한다 — UI 상태로 canonical 을 대체하지 않는다.
 *
 * 구 데모 페이지 §11.290 4c-2/4c-3(견적 스캐너 트리거·PO 매칭 입력)은 시드 store 위 로컬 상태였다.
 * 실데이터 전환으로 은퇴 — 실제 수령 입력은 공급사 회신(ReceivingDraftItem.receivedQuantity)이 원천이다.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, ExternalLink, Loader2, ChevronRight, RefreshCw } from "lucide-react";
import { ReceivingBatchModal, type BatchItem, type BatchDoc } from "@/components/receiving/receiving-batch-modal";

/* ── 계약 ─────────────────────────────────────────────────────── */
type Draft = {
  id: string;
  status: "AWAITING_REPLY" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";
  submittedAt: string | null;
  reviewedAt: string | null;
  restockSyncedAt: string | null;
  vendorNote: string | null;
  rejectedReason: string | null;
  vendorName: string | null;
  order: { id: string; orderNumber: string; status: string; createdAt: string } | null;
  items: BatchItem[];
  documents: (BatchDoc & { uploadedAt: string; uploadedBy: string | null })[];
};

const STATUS_PILL: Record<Draft["status"], { label: string; cls: string }> = {
  AWAITING_REPLY: { label: "회신 대기", cls: "bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b]" },
  PENDING_REVIEW: { label: "검수·문서 진행 중", cls: "bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]" },
  APPROVED: { label: "재고 반영 완료", cls: "bg-[#f0fdf4] border-[#bbf7d0] text-[#15803d]" },
  REJECTED: { label: "반려", cls: "bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]" },
  EXPIRED: { label: "만료", cls: "bg-[#f1f5f9] border-[#e2e8f0] text-[#94a3b8]" },
};

const LINE_PILL = {
  pass: { label: "합격", cls: "bg-[#f0fdf4] border-[#bbf7d0] text-[#15803d]" },
  wait: { label: "검수 대기", cls: "bg-[#fefce8] border-[#fef08a] text-[#a16207]" },
  hold: { label: "보류", cls: "bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]" },
} as const;

function fmtDate(v: string | null | undefined) {
  if (!v) return "-";
  const d = new Date(v);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

/* ── 페이지 ───────────────────────────────────────────────────── */
export default function ReceivingDetailPage() {
  const params = useParams();
  const receivingId = params.receivingId as string;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/receiving-drafts/${receivingId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `불러오기 실패 (${res.status})`);
      setDraft(data.draft);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [receivingId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ── 파생 — 전부 draft 에서 ── */
  const derived = useMemo(() => {
    if (!draft) return null;
    const items = draft.items;
    const expected = items.reduce((s, it) => s + (it.expectedQuantity ?? 0), 0);
    const received = items.reduce((s, it) => s + (it.inspectedQuantity ?? it.receivedQuantity ?? 0), 0);
    const decided = items.filter((it) => it.decision != null);
    const passed = items.filter((it) => it.decision === "PASS");
    const undecided = items.filter((it) => it.decision == null);
    const hasCoa = draft.documents.some((d) => d.docType === "coa");
    const hasInvoice = draft.documents.some((d) => d.docType === "invoice");
    const restocked = items.filter((it) => it.restockedAt != null);

    // 다음 조치 — 번호 리스트(색 = 심각도). 이 화면에서 검수·문서 상태는 여기 1곳에만 나온다.
    const actions: { tone: "red" | "yellow" | "blue"; title: string; sub: string }[] = [];
    if (undecided.length > 0)
      actions.push({ tone: "yellow", title: `검수 판정 ${undecided.length}건`, sub: undecided.map((i) => i.name).slice(0, 3).join(" · ") + (undecided.length > 3 ? " 외" : "") });
    if (!hasCoa) actions.push({ tone: "yellow", title: "COA 확보", sub: "직접 첨부 또는 공급사 요청 · 대부분 배송 동봉" });
    if (!hasInvoice) actions.push({ tone: "blue", title: "거래명세서 확보", sub: "첨부 시 반영 이력에 함께 남습니다" });

    const stepIdx =
      draft.status === "APPROVED" ? 4
      : draft.status === "REJECTED" || draft.status === "EXPIRED" ? 1
      : draft.status === "AWAITING_REPLY" ? 0
      : undecided.length > 0 || !hasCoa ? 1
      : passed.some((p) => !p.lotNumber) ? 2
      : 3;

    return { expected, received, decided, passed, undecided, hasCoa, hasInvoice, restocked, actions, stepIdx, remaining: actions.length };
  }, [draft]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 flex items-center gap-2 text-[13px] text-[#64748b]">
        <Loader2 className="h-4 w-4 animate-spin" /> 입고안 불러오는 중
      </div>
    );
  }
  if (error || !draft || !derived) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="rounded-[13px] border border-[#fecaca] bg-[#fef2f2] p-4">
          <p className="text-[13px] font-semibold text-[#b91c1c]">{error ?? "입고안을 찾을 수 없습니다."}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => void load()} className="h-9 px-3 rounded-lg border border-[#e2e8f0] bg-white text-[12.5px] font-semibold text-[#475569] inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> 다시 시도</button>
            <Link href="/dashboard/receiving" className="h-9 px-3 rounded-lg border border-[#e2e8f0] bg-white text-[12.5px] font-semibold text-[#475569] inline-flex items-center gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> 목록으로</Link>
          </div>
        </div>
      </div>
    );
  }

  const pill = STATUS_PILL[draft.status];
  const canProcess = draft.status === "PENDING_REVIEW";
  const ctaLabel =
    !canProcess ? null
    : derived.remaining > 0 ? `남은 ${derived.remaining}건 처리하고 반영`
    : "재고 반영";

  const NextActionPanel = (
    <section className="rounded-[14px] border border-[#e2e8f0] bg-white p-4" aria-label="다음 조치">
      <h2 className="text-[13px] font-extrabold text-[#0f172a]">다음 조치</h2>
      {draft.status === "APPROVED" ? (
        <p className="mt-2 text-[12.5px] text-[#15803d]">재고 반영이 완료되었습니다. 남은 조치가 없습니다.</p>
      ) : derived.actions.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-[#475569]">전 라인 판정 완료 · 문서 확보 완료. 재고 반영만 남았습니다.</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {derived.actions.map((a, i) => (
            <li key={i} className="flex gap-2.5">
              <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${a.tone === "red" ? "bg-[#b91c1c] text-white" : a.tone === "yellow" ? "bg-[#fef08a] text-[#854d0e]" : "bg-[#2563eb] text-white"}`}>{i + 1}</span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#0f172a]">{a.title}</p>
                <p className="text-[11.5px] text-[#64748b] truncate">{a.sub}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {ctaLabel && (
        <button
          onClick={() => setModalOpen(true)}
          className="mt-3 w-full h-[42px] rounded-lg bg-[#2563eb] text-white text-[13px] font-semibold hover:bg-[#1d4ed8] inline-flex items-center justify-center gap-1.5"
        >
          {ctaLabel} <ChevronRight className="h-4 w-4" />
        </button>
      )}
      {!canProcess && draft.status === "AWAITING_REPLY" && (
        <p className="mt-3 text-[11.5px] text-[#94a3b8]">공급사 회신이 도착하면 검수를 시작할 수 있습니다.</p>
      )}
    </section>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 pb-24 lg:pb-6">
      {/* 헤더 — 플레인 타이틀 문법 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <nav className="text-[11.5px] text-[#64748b] flex items-center gap-1.5">
            <Link href="/dashboard/receiving" className="hover:text-[#0f172a]">입고 관리</Link>
            <span>›</span>
            <span className="font-mono text-[#475569]">RCV-{draft.id.slice(-6).toUpperCase()}</span>
          </nav>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-extrabold text-[#0f172a] tracking-tight">입고 상세</h1>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold ${pill.cls}`}>{pill.label}</span>
          </div>
          <p className="mt-1 text-[12.5px] text-[#64748b] flex items-center gap-1.5 flex-wrap">
            <span>{draft.vendorName ?? "공급사 미상"}</span>
            {draft.order && (
              <>
                <span>·</span>
                <Link href={`/dashboard/purchase-orders/${draft.order.id}`} className="inline-flex items-center gap-1 text-[#2563eb] hover:underline">
                  <span className="font-mono">{draft.order.orderNumber}</span><ExternalLink className="h-3 w-3" />
                </Link>
              </>
            )}
            <span>·</span>
            <span>회신 {fmtDate(draft.submittedAt)}</span>
          </p>
        </div>
        <Link href="/dashboard/receiving" className="shrink-0 h-9 px-3 rounded-lg border border-[#e2e8f0] bg-white text-[12.5px] font-semibold text-[#475569] inline-flex items-center gap-1.5 hover:bg-[#f1f5f9]">
          <ArrowLeft className="h-3.5 w-3.5" /> 목록으로
        </Link>
      </div>

      {/* 4단계 스텝퍼 */}
      <ol className="mt-4 flex items-center gap-2 text-[12px]" aria-label="진행 단계">
        {["입고", "검수·문서", "Lot 등록", "재고 반영"].map((label, i) => {
          const done = i < derived.stepIdx;
          const active = i === derived.stepIdx && draft.status !== "APPROVED";
          return (
            <li key={label} className="flex items-center gap-2">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${done ? "bg-[#16a34a] text-white" : active ? "bg-[#2563eb] text-white ring-4 ring-[rgba(37,99,235,.15)]" : "bg-[#e2e8f0] text-[#64748b]"}`}>{done ? "✓" : i + 1}</span>
              <span className={`font-semibold ${done || active ? "text-[#0f172a]" : "text-[#94a3b8]"}`}>{label}</span>
              {active && <span className="rounded-full bg-[#eff6ff] border border-[#bfdbfe] px-2 py-0.5 text-[10.5px] font-bold text-[#1d4ed8]">진행 중</span>}
              {i < 3 && <span className={`h-px w-6 ${done ? "bg-[#16a34a]" : "bg-[#e2e8f0]"}`} />}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* 모바일: 다음 조치 최상단 */}
        <div className="lg:hidden">{NextActionPanel}</div>

        {/* 좌: KPI + 라인 */}
        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "수령", val: `${derived.received}/${derived.expected}`, sub: "실측 기준", pct: derived.expected ? derived.received / derived.expected : 0 },
              { label: "검수", val: `${derived.passed.length}/${draft.items.length} 합격`, sub: `${derived.undecided.length}건 대기`, pct: draft.items.length ? derived.decided.length / draft.items.length : 0 },
              { label: "문서", val: `${(derived.hasCoa ? 1 : 0) + (derived.hasInvoice ? 1 : 0)}/2 첨부`, sub: derived.hasCoa ? "COA 확보" : "COA 미첨부", pct: ((derived.hasCoa ? 1 : 0) + (derived.hasInvoice ? 1 : 0)) / 2 },
            ].map((k) => (
              <div key={k.label} className="rounded-[13px] border border-[#e2e8f0] bg-white p-3">
                <p className="text-[11px] font-semibold text-[#64748b]">{k.label}</p>
                <p className="mt-0.5 text-[15px] sm:text-[17px] font-extrabold text-[#0f172a] tabular-nums">{k.val}</p>
                <div className="mt-2 h-1.5 rounded-full bg-[#eef2f7] overflow-hidden">
                  <div className={`h-full ${k.pct >= 1 ? "bg-[#2563eb]" : "bg-[#ca8a04]"}`} style={{ width: `${Math.round(k.pct * 100)}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-[#94a3b8]">{k.sub}</p>
              </div>
            ))}
          </div>

          <section className="rounded-[14px] border border-[#e2e8f0] bg-white overflow-hidden" aria-label="수령 라인">
            <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
              <h2 className="text-[13px] font-extrabold text-[#0f172a]">수령 라인 {draft.items.length}</h2>
              {draft.vendorNote && <span className="text-[11.5px] text-[#64748b] truncate max-w-[60%]">공급사 메모 · {draft.vendorNote}</span>}
            </div>
            <ul className="divide-y divide-[#f1f5f9]">
              {draft.items.map((it) => {
                const p = it.decision === "PASS" ? LINE_PILL.pass : it.decision === "FAIL" ? LINE_PILL.hold : LINE_PILL.wait;
                const reason =
                  it.decision === "FAIL" ? (it.discrepancyReason || "불합격 · 재고 미반영")
                  : it.decision == null ? "검수 판정 필요"
                  : it.restockedAt ? `재고 반영됨 · ${fmtDate(it.restockedAt)}`
                  : "반영 대기";
                return (
                  <li key={it.id} className="px-4 py-3 flex items-start gap-3">
                    <span className={`mt-0.5 shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${p.cls}`}>{p.label}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[#0f172a] truncate">{it.name}</p>
                      <p className="text-[11.5px] text-[#64748b]">{reason}</p>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px] tabular-nums">
                        <span className="text-[#475569]">발주 {it.expectedQuantity ?? "-"} · 실측 {it.inspectedQuantity ?? it.receivedQuantity ?? "-"} {it.unit ?? ""}</span>
                        {it.lotNumber && <span className="font-mono font-semibold rounded bg-[#eff6ff] text-[#1d4ed8] px-1.5 py-0.5">Lot {it.lotNumber}</span>}
                        {it.expiryDate && <span className="text-[#64748b]">유효 {fmtDate(it.expiryDate)}</span>}
                      </div>
                    </div>
                    {canProcess && it.decision == null && (
                      <button onClick={() => setModalOpen(true)} className="shrink-0 h-8 px-2.5 rounded-lg border border-[#e2e8f0] bg-white text-[11.5px] font-semibold text-[#2563eb] hover:bg-[#eff6ff]">판정</button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* 우: 다음 조치(데스크톱) · 문서 · 이력 */}
        <aside className="space-y-4">
          <div className="hidden lg:block">{NextActionPanel}</div>

          <section className="rounded-[14px] border border-[#e2e8f0] bg-white p-4" aria-label="문서">
            <h2 className="text-[13px] font-extrabold text-[#0f172a]">문서</h2>
            <ul className="mt-2 space-y-1.5">
              {[{ key: "invoice", label: "거래명세서" }, { key: "coa", label: "COA" }].map((d) => {
                const doc = draft.documents.find((x) => x.docType === d.key);
                return (
                  <li key={d.key} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="inline-flex items-center gap-1.5 text-[#0f172a]"><FileText className="h-3.5 w-3.5 text-[#64748b]" /> {d.label}</span>
                    {doc ? (
                      <span className="text-[#15803d] font-semibold truncate max-w-[55%]">{doc.fileName}</span>
                    ) : canProcess ? (
                      <button onClick={() => setModalOpen(true)} className="text-[#2563eb] font-semibold hover:underline">직접 첨부</button>
                    ) : (
                      <span className="text-[#94a3b8]">미첨부</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] text-[#94a3b8] leading-relaxed">첨부 후 담당자가 Lot·유효기간을 확인하고 확정합니다. 자동 확정하지 않습니다.</p>
          </section>

          <section className="rounded-[14px] border border-[#e2e8f0] bg-white p-4" aria-label="반영 이력">
            <h2 className="text-[13px] font-extrabold text-[#0f172a]">반영 이력</h2>
            {derived.restocked.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-[#94a3b8]">아직 반영된 라인이 없습니다.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-[12.5px]">
                {derived.restocked.map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-2">
                    <span className="text-[#0f172a] truncate">{it.name}</span>
                    <Link href="/dashboard/inventory" className="shrink-0 text-[#2563eb] hover:underline tabular-nums">{fmtDate(it.restockedAt)} · 재고 →</Link>
                  </li>
                ))}
                {derived.restocked.length < draft.items.length && (
                  <li className="text-[11.5px] text-[#64748b]">잔여 {draft.items.length - derived.restocked.length}라인 미반영</li>
                )}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {/* 모바일 sticky 단일 CTA */}
      {ctaLabel && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 p-3 bg-white/95 backdrop-blur border-t border-[#e2e8f0]">
          <button onClick={() => setModalOpen(true)} className="w-full h-[42px] rounded-lg bg-[#2563eb] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5">
            {ctaLabel} <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {draft.order && (
        <ReceivingBatchModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          draftId={draft.id}
          orderId={draft.order.id}
          items={draft.items}
          documents={draft.documents}
          onCommitted={() => void load()}
        />
      )}
    </div>
  );
}
