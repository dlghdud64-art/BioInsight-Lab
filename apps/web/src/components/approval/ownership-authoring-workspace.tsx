"use client";

/**
 * OwnershipAuthoringWorkspace — ownership CRUD + assign/reassign/transfer
 *
 * center = ownership record list + edit form
 * rail = current resolution preview + fallback chain + audit trail
 * dock = create/update/deactivate/assign/reassign/transfer actions
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { OwnerBadge } from "./dashboard-action-panels";
import type { OwnershipRecord, OwnershipType, FullOwnershipResolution } from "@/lib/ai/multi-team-ownership-engine";
import type { OwnershipChangeDiff } from "@/lib/ai/ownership-authoring-engine";

export interface OwnershipAuthoringWorkspaceProps {
  records: OwnershipRecord[];
  currentResolution: FullOwnershipResolution | null;
  lastChangeDiff: OwnershipChangeDiff | null;
  // State
  selectedRecordId: string | null;
  editMode: boolean;
  // Handlers
  onSelectRecord?: (recordId: string) => void;
  onCreate?: () => void;
  onUpdate?: (recordId: string) => void;
  onDeactivate?: (recordId: string) => void;
  onReassign?: (fromOwnerId: string) => void;
  onTransfer?: (fromScopeId: string) => void;
  className?: string;
}

const OWNERSHIP_TYPE_LABELS: Record<OwnershipType, string> = {
  approval_owner: "승인 담당",
  escalation_owner: "에스컬레이션 담당",
  policy_owner: "정책 관리",
  backlog_owner: "대기건 담당",
  sla_owner: "SLA 책임",
};

const SCOPE_TYPE_LABELS: Record<string, string> = {
  system: "시스템",
  organization: "조직",
  department: "부서",
  team: "팀",
  site: "사이트",
  location: "위치",
};

export function OwnershipAuthoringWorkspace({
  records,
  currentResolution,
  lastChangeDiff,
  selectedRecordId,
  editMode,
  onSelectRecord,
  onCreate,
  onUpdate,
  onDeactivate,
  onReassign,
  onTransfer,
  className,
}: OwnershipAuthoringWorkspaceProps) {
  const selectedRecord = records.find(r => r.recordId === selectedRecordId);
  const activeRecords = records.filter(r => r.active);
  const inactiveRecords = records.filter(r => !r.active);

  return (
    <div className={cn("flex gap-4 h-full", className)}>
      {/* ═══ CENTER ═══ */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Ownership 관리</h2>
          <span className="text-xs text-slate-500">
            활성 {activeRecords.length} · 비활성 {inactiveRecords.length}
          </span>
        </div>

        {/* Last change diff */}
        {lastChangeDiff && (
          <div className="rounded border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-400">
            최근 변경: {lastChangeDiff.summary}
          </div>
        )}

        {/* Active records table */}
        <div className="rounded border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-800">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">활성 Ownership</h3>
          </div>
          <div className="divide-y divide-slate-800/50">
            {activeRecords.length === 0 ? (
              <div className="px-3 py-4 text-xs text-slate-500 text-center">등록된 ownership이 없습니다</div>
            ) : (
              activeRecords.map(record => (
                <button
                  key={record.recordId}
                  onClick={() => onSelectRecord?.(record.recordId)}
                  className={cn(
                    "w-full text-left px-3 py-2 hover:bg-slate-800/30 transition-colors",
                    selectedRecordId === record.recordId && "bg-blue-600/10 border-l-2 border-l-blue-600",
                  )}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-700">{record.ownerName}</span>
                      <span className="text-[10px] text-slate-500">{record.ownerRole}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {OWNERSHIP_TYPE_LABELS[record.ownershipType]}
                    </span>
                  </div>
                  <div className="flex gap-2 text-[10px] text-slate-500">
                    <span>{SCOPE_TYPE_LABELS[record.scopeType] || record.scopeType}: {record.scopeLabel}</span>
                    {record.domain && record.domain !== "all" && <span>· {record.domain}</span>}
                    {record.fallbackOwnerId && <span>· fallback: {record.fallbackOwnerName || record.fallbackOwnerId}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Inactive records (collapsed) */}
        {inactiveRecords.length > 0 && (
          <details className="rounded border border-slate-800 bg-slate-900/50">
            <summary className="px-3 py-2 text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-400">
              비활성 ({inactiveRecords.length})
            </summary>
            <div className="divide-y divide-slate-800/50 border-t border-slate-800">
              {inactiveRecords.map(record => (
                <div key={record.recordId} className="px-3 py-1.5 text-xs text-slate-600">
                  <span>{record.ownerName}</span>
                  <span className="mx-1">·</span>
                  <span>{OWNERSHIP_TYPE_LABELS[record.ownershipType]}</span>
                  <span className="mx-1">·</span>
                  <span>{record.reason}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ═══ RAIL ═══ */}
      <div className="w-72 shrink-0 space-y-3">
        {/* Current resolution preview */}
        {currentResolution && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">현재 Resolution</h4>
            <div className="space-y-1.5 text-xs">
              {[
                { label: "승인", owner: currentResolution.approvalOwner },
                { label: "에스컬", owner: currentResolution.escalationOwner },
                { label: "정책", owner: currentResolution.policyOwner },
                { label: "대기건", owner: currentResolution.backlogOwner },
                { label: "SLA", owner: currentResolution.slaOwner },
              ].map(({ label, owner }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-slate-500">{label}</span>
                  <span className={owner.resolvedBy === "unresolved" ? "text-red-400" : "text-slate-700"}>
                    {owner.resolvedBy === "unresolved" ? "미지정" : owner.ownerName}
                  </span>
                </div>
              ))}
            </div>
            {currentResolution.unresolvedCount > 0 && (
              <p className="text-[10px] text-red-400">{currentResolution.unresolvedCount}개 ownership 미지정</p>
            )}
          </div>
        )}

        {/* Selected record detail */}
        {selectedRecord && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">상세</h4>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">ID</span>
                <span className="text-slate-400 font-mono text-[10px]">{selectedRecord.recordId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">유형</span>
                <span className="text-slate-700">{OWNERSHIP_TYPE_LABELS[selectedRecord.ownershipType]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Scope</span>
                <span className="text-slate-700">{selectedRecord.scopeType}: {selectedRecord.scopeLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">시작일</span>
                <span className="text-slate-400">{new Date(selectedRecord.effectiveFrom).toLocaleDateString("ko-KR")}</span>
              </div>
              {selectedRecord.effectiveUntil && (
                <div className="flex justify-between">
                  <span className="text-slate-500">종료일</span>
                  <span className="text-slate-400">{new Date(selectedRecord.effectiveUntil).toLocaleDateString("ko-KR")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">배정자</span>
                <span className="text-slate-400">{selectedRecord.assignedBy}</span>
              </div>
              <div className="pt-1 border-t border-slate-800">
                <span className="text-slate-500">사유</span>
                <p className="text-slate-600 mt-0.5">{selectedRecord.reason}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ DOCK ═══ */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {selectedRecord ? `${selectedRecord.ownerName} — ${OWNERSHIP_TYPE_LABELS[selectedRecord.ownershipType]}` : "레코드를 선택하세요"}
          </div>
          <div className="flex items-center gap-2">
            {selectedRecord && onReassign && (
              <button onClick={() => onReassign(selectedRecord.ownerId)} className="rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors">
                재배정
              </button>
            )}
            {selectedRecord && onDeactivate && (
              <button onClick={() => onDeactivate(selectedRecord.recordId)} className="rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors">
                비활성화
              </button>
            )}
            {selectedRecord && onUpdate && (
              <button onClick={() => onUpdate(selectedRecord.recordId)} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors">
                수정
              </button>
            )}
            {onCreate && (
              <button onClick={onCreate} className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors">
                새 Ownership
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
