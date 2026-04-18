"use client";

/**
 * SimilarApprovalInterceptModal — Action Intercept 패턴.
 *
 * 사용자가 리스트에서 특정 건 [승인] 버튼을 눌렀을 때, 같은 공급사의 다른
 * eligible 건이 1개 이상 존재하면 승인 직전에 이 모달이 끼어들어
 * "함께 승인할지" 를 묻는다.
 *
 * governance:
 * - center/rail/dock 를 침범하지 않는 overlay 레이어.
 * - 실제 승인 실행은 caller 가 shared helper (runFastTrackBulkApproval) 로 처리.
 *   본 컴포넌트는 선택만 받아 callback 으로 전달한다.
 * - [이 건만] 과 [같이 승인] 은 서로 다른 승인 대상 리스트를 전달한다.
 */
import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import type { FastTrackRecommendationObject } from "@/lib/ontology/types";

interface SimilarApprovalInterceptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 사용자가 방금 [승인] 버튼을 누른 원본 항목 */
  targetRec: FastTrackRecommendationObject | null;
  /** findSimilarEligible 이 반환한 유사 항목 목록 (이미 필터/정렬/cap 적용) */
  similarRecs: readonly FastTrackRecommendationObject[];
  /** case id → 사람이 읽는 vendor 이름 */
  resolveVendorName: (caseId: string) => string;
  /**
   * "이 건만 승인" — 원본 1건만 실행. caller 가 target 을 runFastTrackBulkApproval
   * 에 단일 원소로 넘겨 기존 승인 경로를 그대로 사용한다.
   */
  onApproveTargetOnly: (target: FastTrackRecommendationObject) => void;
  /**
   * "같이 승인" — target + similar 를 합쳐 한 번에 실행.
   */
  onApproveTogether: (
    merged: FastTrackRecommendationObject[],
  ) => void;
}

export function SimilarApprovalInterceptModal({
  open,
  onOpenChange,
  targetRec,
  similarRecs,
  resolveVendorName,
  onApproveTargetOnly,
  onApproveTogether,
}: SimilarApprovalInterceptModalProps) {
  const mergedList = useMemo(
    () => (targetRec ? [targetRec, ...similarRecs] : []),
    [targetRec, similarRecs],
  );
  const mergedTotal = useMemo(
    () =>
      mergedList.reduce(
        (sum, r) => sum + r.evaluationSnapshot.totalAmount,
        0,
      ),
    [mergedList],
  );

  if (!targetRec || similarRecs.length === 0) return null;

  const vendorName = resolveVendorName(targetRec.procurementCaseId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-amber-200 bg-white p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-200 bg-amber-50">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600" />
            <DialogTitle className="text-sm font-semibold text-slate-800">
              같은 공급사에 {similarRecs.length}건이 더 있습니다
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-600 mt-1">
            <span className="font-medium">{vendorName}</span> 공급사의 다른 즉시
            승인 가능한 대기 건을 함께 처리할 수 있습니다. 한 번의 확인으로
            반복 작업을 줄일 수 있어요.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-3 max-h-72 overflow-y-auto">
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-md">
            {mergedList.map((rec, idx) => (
              <li
                key={rec.objectId}
                className="flex items-start gap-3 px-3 py-2 text-xs"
              >
                <span
                  className={`shrink-0 mt-0.5 inline-block w-1.5 h-1.5 rounded-full ${
                    idx === 0 ? "bg-slate-800" : "bg-amber-400"
                  }`}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 truncate">
                    {resolveVendorName(rec.procurementCaseId)}
                    {idx === 0 && (
                      <span className="ml-1 text-[10px] text-slate-500">
                        · 방금 선택
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    안전 점수 {(rec.safetyScore * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="shrink-0 tabular-nums font-mono text-slate-700">
                  ₩{rec.evaluationSnapshot.totalAmount.toLocaleString("ko-KR")}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>함께 승인 시 {mergedList.length}건</span>
            <span className="tabular-nums font-mono">
              합계 ₩{mergedTotal.toLocaleString("ko-KR")}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onApproveTargetOnly(targetRec)}
            className="border-slate-300 text-slate-600"
          >
            이 건만 승인
          </Button>
          <Button
            size="sm"
            onClick={() => onApproveTogether([...mergedList])}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            ⚡ {mergedList.length}건 함께 승인
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
