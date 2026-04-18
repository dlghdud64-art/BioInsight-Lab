"use client";

/**
 * MultiVendorRequestWorkbench
 * ──────────────────────────────────────────────────────────────────────────────
 * smart-sourcing MultiVendor 비교 결과(QuoteComparisonHandoff)를 production 경로에서
 * 견적 요청 조립 → 요청 제출 → 견적 관리 handoff까지 이어주는 wrapper.
 *
 * 책임 분리:
 * - QuoteComparisonHandoff 는 canonical truth (mutate 금지).
 * - adaptComparisonHandoffToRequestSeed 로 derived 합성 데이터만 산출.
 * - work window 는 그대로 재사용 — 마운트 책임만 이 wrapper 가 진다.
 *
 * 상태 머신: "assembly" → "submission" → 외부 navigation
 * - assembly 단계: RequestAssemblyWorkWindow 마운트
 * - submission 단계: RequestSubmissionWorkWindow 마운트
 * - 제출 후: caller 의 onComplete 또는 router.push 기본 동작
 */

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RequestAssemblyWorkWindow } from "@/components/sourcing/request-assembly-work-window";
import { RequestSubmissionWorkWindow } from "@/components/sourcing/request-submission-work-window";
import {
  adaptComparisonHandoffToRequestSeed,
  type QuoteComparisonHandoff,
} from "@/lib/ai/smart-sourcing-handoff-engine";
import type {
  RequestDraftSnapshot,
  RequestSubmissionHandoff,
} from "@/lib/ai/request-assembly-engine";
import {
  emitRequestSubmissionExecuted,
  emitRequestSubmissionHandedOffToWorkqueue,
} from "@/lib/ai/smart-sourcing-invalidation";

interface MultiVendorRequestWorkbenchProps {
  open: boolean;
  onClose: () => void;
  comparisonHandoff: QuoteComparisonHandoff;
  /**
   * 제출 완료 후 호출. 미지정 시 /dashboard/quotes 로 router.push.
   * 자동 handoff 카운트다운(2.5s)이 끝나야 호출됨 — submission work window 의
   * autoHandoffDelayMs 정책을 그대로 따른다.
   */
  onComplete?: () => void;
}

type Mode = "assembly" | "submission";

export function MultiVendorRequestWorkbench({
  open,
  onClose,
  comparisonHandoff,
  onComplete,
}: MultiVendorRequestWorkbenchProps) {
  const router = useRouter();

  // Derived seed (canonical truth 의존, mutate 없음)
  const seed = useMemo(
    () => adaptComparisonHandoffToRequestSeed(comparisonHandoff),
    [comparisonHandoff],
  );

  const [mode, setMode] = useState<Mode>("assembly");
  const [draftSnapshot, setDraftSnapshot] = useState<RequestDraftSnapshot | null>(null);
  // submissionHandoff 는 현재 wrapper 에서 직접 소비하지 않지만 work window 계약상 필요
  const [, setSubmissionHandoff] = useState<RequestSubmissionHandoff | null>(null);
  // 마지막으로 실행된 submission event id — workqueue handoff 이벤트에 첨부
  const [lastSubmissionEventId, setLastSubmissionEventId] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setMode("assembly");
    setDraftSnapshot(null);
    setSubmissionHandoff(null);
    setLastSubmissionEventId(null);
    onClose();
  }, [onClose]);

  const handleSubmissionExecuted = useCallback(
    (event: import("@/lib/ai/request-submission-engine").RequestSubmissionEvent) => {
      // D-3: governance event — quote_chain domain 안의 sub-event로 발행
      emitRequestSubmissionExecuted(
        comparisonHandoff.id,
        event.submittedVendorTargetIds.length,
        event.submittedLineIds.length,
        event.id,
      );
      setLastSubmissionEventId(event.id);
    },
    [comparisonHandoff.id],
  );

  const handleQuoteWorkqueueOpen = useCallback(() => {
    // D-3: workqueue handoff 이벤트 발행 (자동/수동 동일)
    if (lastSubmissionEventId) {
      emitRequestSubmissionHandedOffToWorkqueue(
        comparisonHandoff.id,
        lastSubmissionEventId,
        new Date().toISOString(),
      );
    }
    if (onComplete) {
      onComplete();
    } else {
      router.push("/dashboard/quotes");
    }
  }, [comparisonHandoff.id, lastSubmissionEventId, onComplete, router]);

  return (
    <>
      <RequestAssemblyWorkWindow
        open={open && mode === "assembly"}
        onClose={handleClose}
        handoff={seed.requestHandoff}
        products={seed.syntheticProducts}
        quoteItems={seed.syntheticQuoteItems}
        onDraftRecorded={(snap) => setDraftSnapshot(snap)}
        onSubmissionReady={(h) => setSubmissionHandoff(h)}
        onGoToSubmission={() => setMode("submission")}
      />
      <RequestSubmissionWorkWindow
        open={open && mode === "submission"}
        onClose={handleClose}
        draftSnapshot={draftSnapshot}
        onSubmissionExecuted={handleSubmissionExecuted}
        onQuoteWorkqueueOpen={handleQuoteWorkqueueOpen}
        onBackToAssembly={() => setMode("assembly")}
      />
    </>
  );
}
