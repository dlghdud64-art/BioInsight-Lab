"use client";

/**
 * ProactiveFastTrackModal — Entry Intercept 선제 제안 모달.
 *
 * governance grammar:
 * - center/rail/dock workbench 를 침범하지 않는 overlay 전용 레이어.
 * - canonical truth 변경 X. 사용자의 클릭만 caller 콜백으로 전달한다.
 * - "아직 세션에서 못 본" eligible 만 전달받아 렌더링한다.
 *   필터링/정렬은 selectUnseenEligible 순수함수에서 이미 수행된 후 주입된다.
 *
 * 데드 버튼 금지:
 * - eligibleCount === 0 이면 caller 가 아예 open 하지 않는다.
 * - [일괄 승인] 버튼은 항상 enabled 로 두되 caller 가 보낸 items 가 곧 대상이다.
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

interface ProactiveFastTrackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** selectUnseenEligible 로 이미 필터/정렬된 결과 */
  items: readonly FastTrackRecommendationObject[];
  /** case id → 사람이 읽는 vendor 이름을 주입 (store 의 inputSnapshot.vendorName) */
  resolveVendorName: (caseId: string) => string;
  /** 일괄 승인 버튼 클릭. caller 가 markAccepted + finalizeApproval + dismissed 갱신을 수행 */
  onAcceptAll: (items: FastTrackRecommendationObject[]) => void;
  /** "내가 직접 검토" — proactive dismiss. caller 가 dismissedObjectIds 에 추가 */
  onDismissAll: (items: FastTrackRecommendationObject[]) => void;
}

export function ProactiveFastTrackModal({
  open,
  onOpenChange,
  items,
  resolveVendorName,
  onAcceptAll,
  onDismissAll,
}: ProactiveFastTrackModalProps) {
  const totalAmount = useMemo(
    () => items.reduce((sum, r) => sum + r.evaluationSnapshot.totalAmount, 0),
    [items],
  );

  if (items.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-emerald-200 bg-white p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-200 bg-emerald-50">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-600" />
            <DialogTitle className="text-sm font-semibold text-slate-800">
              즉시 승인 가능한 발주가 있습니다
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-600 mt-1">
            AI가 사전 검토한 결과, 아래 {items.length}건은 위험물·규제 플래그 없이
            반복 구매 이력 조건을 모두 충족합니다. 검토 없이 일괄 승인할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        {/* 요약 리스트 — 본문은 decision surface 가 아니라 confirm aid 역할만 수행 */}
        <div className="px-5 py-3 max-h-72 overflow-y-auto">
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-md">
            {items.map((rec) => {
              const vendor = resolveVendorName(rec.procurementCaseId);
              const topReason =
                rec.reasons[0]?.message ?? "Fast-Track 기본 조건 충족";
              return (
                <li
                  key={rec.objectId}
                  className="flex items-start gap-3 px-3 py-2 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 truncate">
                      {vendor}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {topReason} · 안전 점수 {(rec.safetyScore * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="shrink-0 tabular-nums font-mono text-slate-700">
                    ₩{rec.evaluationSnapshot.totalAmount.toLocaleString("ko-KR")}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>총 {items.length}건</span>
            <span className="tabular-nums font-mono">
              합계 ₩{totalAmount.toLocaleString("ko-KR")}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDismissAll([...items])}
            className="border-slate-300 text-slate-600"
          >
            내가 직접 검토하기
          </Button>
          <Button
            size="sm"
            onClick={() => onAcceptAll([...items])}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            ⚡ {items.length}건 일괄 승인
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
