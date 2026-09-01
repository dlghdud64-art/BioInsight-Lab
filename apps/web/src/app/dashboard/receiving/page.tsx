"use client";

/**
 * 입고 관리 리스트 — §receiving-list-redesign (핸드오프 2026-08-30 · 시각 truth 1a)
 *
 * P4  데스크탑 리스트를 데모 그래프(unifiedInboxItems 이슈 단위)에서 canonical
 *     ReceivingDraft(GET /api/receiving-drafts)로 전환 — 상세 페이지(§receiving-detail-redesign
 *     P1)와 동일 truth. 표면 간 상태 모순·반영 front-only(§0.1) 원천 제거.
 * P2  플레인 헤더(AppPageHeader) + 파이프라인 4카드 + 필터 칩 + 케이스 1건 = 1행.
 * P3  행 클릭 = 인라인 펼침. 우측 슬라이드 패널(quickview-drawer)·재고 반영 모달
 *     (receiving-post-modal, 데모 경로) 폐기. COA 인라인 드롭존 = 문서 API 실배선.
 * CTA = 일괄 처리 모달(ReceivingBatchModal) 직행 — 반영은 모달의 POST /approve
 *     (서버 이중 반영 가드)로만 일어난다. front-only 반영 경로 0.
 *
 * 모바일(md 미만)은 §mobile-receiving-rcv-card 유지(무접촉) — 데모 store 파생.
 *   canonical 전환은 별도 배치(모바일 핸드오프)에서.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import { MODULE_ORIENTATION } from "@/lib/ops-console/module-landing-adapter";
import { MobileReceivingView } from "@/components/receiving/mobile-receiving-view";
import {
  buildMobileReceivingSummary,
  type MobileReceivingCard,
} from "@/lib/ops-console/mobile-receiving-view-model";
import { MobileDocAttachSheet } from "@/components/receiving/mobile-doc-attach-sheet";
import { ReceivingCaseListView } from "@/components/receiving/receiving-case-list";
import { ReceivingBatchModal } from "@/components/receiving/receiving-batch-modal";
import { ReceivingReviewPanel } from "@/components/receiving/receiving-review-panel";
import { PageShell, AppPageHeader } from "@/components/layout/page-header";
import { useOpenModal } from "@/lib/store/modal-store";
import { labToast } from "@/lib/toast/lab-toast";
import { csrfFetch } from "@/lib/api-client";
import {
  buildReceivingCaseList,
  type ReceivingCaseRow,
  type ReceivingDraftDto,
} from "@/lib/ops-console/receiving-desktop-view-model";
import type { CoaRecognitionResponse } from "@/lib/ocr/coa-recognize";
import type { RecognizedConfirmInput } from "@/components/ocr/recognized-fields-review";
import { fileToDataUrl } from "@/lib/utils/file-to-base64";

export default function ReceivingLandingPage() {
  const router = useRouter();
  const openModal = useOpenModal();
  const orientation = MODULE_ORIENTATION.receiving;

  // ── 데스크탑 canonical — ReceivingDraft 목록 ──────────────────────
  const [drafts, setDrafts] = useState<ReceivingDraftDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(
        "/api/receiving-drafts?status=AWAITING_REPLY,PENDING_REVIEW,APPROVED",
        { cache: "no-store" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `불러오기 실패 (${res.status})`);
      setDrafts(data.drafts ?? []);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const caseList = useMemo(() => buildReceivingCaseList(drafts), [drafts]);

  // ── CTA = 일괄 처리 모달 직행 (시안 수정 ④ · 반영은 모달 /approve 단일 경로) ──
  //   id 로만 보관 → 매 렌더 live 행 조회(refetch 후 자동 최신, 로컬 복제 truth 없음).
  const [processingId, setProcessingId] = useState<string | null>(null);
  const processingRow = processingId
    ? caseList.rows.find((r) => r.id === processingId) ?? null
    : null;

  const handleCta = (row: ReceivingCaseRow) => {
    if (!row.orderId) {
      // 발주 연결 없는 입고안은 일괄 처리 모달 계약(orderId 필수)을 못 태움 — 상세로.
      router.push(`/dashboard/receiving/${row.id}`);
      return;
    }
    setProcessingId(row.id);
  };

  // ── COA 인라인 드롭존 — 문서 API 실배선 (첨부 즉시 canonical 커밋) ──
  const handleAttachDocument = async (
    row: ReceivingCaseRow,
    docType: "coa" | "invoice",
    file: File,
  ) => {
    if (!row.orderId) {
      labToast.error("문서 첨부 불가", "연결된 발주가 없어 문서를 첨부할 수 없습니다.");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("docType", docType);
    const res = await csrfFetch(`/api/receiving/documents/${row.orderId}`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      labToast.error("문서 첨부 실패", data.error ?? "잠시 후 다시 시도해 주세요.");
      return;
    }
    labToast.success("COA 첨부 완료", `<b>${row.displayNumber}</b> 입고 건 문서로 저장되었습니다.`);
    await load();
  };

  // ── COA 인식 (§scan-recognition-upgrade P1) — 추출·대조만, 저장 0 ──
  //   jobId(감사 로그) 없으면 null 반환 → 리스트는 기존 업로드 흐름 유지(lineage 없는 확정 금지).
  const recognizeCoa = async (
    row: ReceivingCaseRow,
    file: File,
  ): Promise<CoaRecognitionResponse | null> => {
    try {
      const imageBase64 = await fileToDataUrl(file);
      const res = await csrfFetch(`/api/receiving-drafts/${row.id}/coa-recognize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.jobId) return null;
      return data as CoaRecognitionResponse;
    } catch {
      return null; // 인식 실패 = 기존 업로드 흐름(빈값 수동 폴백) — 가짜 성공 0
    }
  };

  // ── COA 확정 — 사람 클릭 후에만 canonical 저장 (inspect PATCH 단일 경로) ──
  const confirmCoa = async (
    row: ReceivingCaseRow,
    input: RecognizedConfirmInput & { jobId: string },
  ): Promise<boolean> => {
    try {
      const res = await csrfFetch(`/api/receiving-drafts/${row.id}/inspect`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              itemId: input.itemId,
              lotNumber: input.lot,
              expiryDate: input.expiry,
              lotSource: "coa_ocr",
              coaOcrJobId: input.jobId,
            },
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        labToast.error("COA 확정 실패", data.error ?? "잠시 후 다시 시도해 주세요.");
        return false;
      }
      labToast.success("COA 인식 확정", "선택 라인의 Lot·유효기간이 저장되었습니다.");
      await load();
      return true;
    } catch (e: unknown) {
      labToast.error("COA 확정 실패", e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  // ── 모바일 (§mobile-receiving-rcv-card 무접촉) ────────────────────
  const { receivingBatches, postToInventory } = useOpsStore();
  const [nowIso] = useState(() => new Date().toISOString());
  const mobileSummary = useMemo(
    () => buildMobileReceivingSummary(receivingBatches, nowIso),
    [receivingBatches, nowIso],
  );
  const [attachCardId, setAttachCardId] = useState<string | null>(null);
  const attachBatch = attachCardId
    ? receivingBatches.find((b) => b.id === attachCardId) ?? null
    : null;

  return (
    <div className="min-h-screen bg-white p-4 md:p-6">
      <PageShell>
        {/* §11.348-A-4b — 공급사 입고 회신(PENDING_REVIEW) 검토. 0건 시 자동 숨김. */}
        <ReceivingReviewPanel />

        {/* ── 플레인 헤더 통일 (핸드오프 §0.3 — 박스형 헤더 제거) ── */}
        <AppPageHeader
          title="입고 관리"
          description={orientation.role}
          actions={[
            {
              label: "입고 등록",
              icon: <Plus className="h-3.5 w-3.5" />,
              tone: "primary",
              // 글로벌 스캔 허브(§11.371-3) 입고 스캔 경로 — 실 wiring(dead button 0).
              onClick: () => openModal("scan_hub"),
            },
          ]}
          className="mb-4"
        />

        {/* ── Mobile (below md) — 무접촉 ── */}
        <div className="md:hidden">
          <MobileReceivingView
            summary={mobileSummary}
            onAttach={(card: MobileReceivingCard) => setAttachCardId(card.id)}
            onInspect={(card: MobileReceivingCard) => router.push(`/dashboard/receiving/${card.id}`)}
            onPost={(card: MobileReceivingCard) => {
              postToInventory(card.id);
              labToast.success(
                "재고 반영 완료",
                `<b>${card.receivingNumber}</b> 재고에 반영되었습니다.`,
              );
            }}
          />
          <MobileDocAttachSheet
            open={attachBatch != null}
            rb={attachBatch}
            onClose={() => setAttachCardId(null)}
          />
        </div>

        {/* ── Desktop (md+) — canonical 케이스 리스트 ── */}
        <div className="hidden md:block">
          {loading ? (
            <div className="flex items-center gap-2 text-[13px] text-slate-500 py-6">
              <Loader2 className="h-4 w-4 animate-spin" /> 입고 목록 불러오는 중
            </div>
          ) : loadError ? (
            <div className="rounded-[13px] border border-red-200 bg-red-50 p-4">
              <p className="text-[13px] font-semibold text-red-700">{loadError}</p>
              <button
                onClick={() => { setLoading(true); void load(); }}
                className="mt-3 h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-600 inline-flex items-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" /> 다시 시도
              </button>
            </div>
          ) : caseList.rows.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
              {/* 2026-09-02(호영님) — 발주 유도 제거. 실사용 범위가 견적·입고뿐이라
                  발주 관리는 §purchasing-hide 로 메뉴에서도 숨긴 표면이고, 거기로 보내는 것은
                  dead path 안내였다. 실제 진입 경로(스캔)로 교체 — 헤더 `입고 등록`과 동일 CTA. */}
              <p className="text-sm text-slate-600">
                처리 중인 입고가 없습니다. 거래명세서를 스캔해 입고를 등록하세요
              </p>
              <button
                onClick={() => openModal("scan_hub")}
                className="inline-flex items-center gap-1.5 mt-3 h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5" /> 입고 등록
              </button>
            </div>
          ) : (
            <ReceivingCaseListView
              list={caseList}
              onCta={handleCta}
              onAttachDocument={handleAttachDocument}
              onRecognizeCoa={recognizeCoa}
              onConfirmCoa={confirmCoa}
            />
          )}
        </div>

        {/* ── 일괄 처리 모달 (same-canvas) — 판정·문서·반영 전부 canonical 커밋 ── */}
        {processingRow && processingRow.orderId && (
          <ReceivingBatchModal
            open
            onClose={() => setProcessingId(null)}
            draftId={processingRow.id}
            orderId={processingRow.orderId}
            items={processingRow.rawItems}
            documents={processingRow.documents}
            onCommitted={() => void load()}
          />
        )}
      </PageShell>
    </div>
  );
}
