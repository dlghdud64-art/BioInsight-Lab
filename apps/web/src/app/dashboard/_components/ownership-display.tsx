'use client';

import type { OwnershipSummary, AssignmentState, SlaState } from '@/lib/ops-console/ownership-adapter';
import {
  ASSIGNMENT_STATE_LABELS,
  ASSIGNMENT_STATE_TONES,
  SLA_STATE_LABELS,
  SLA_STATE_TONES,
} from '@/lib/ops-console/ownership-adapter';

// ---------------------------------------------------------------------------
// OwnershipStrip — header 영역에 표시하는 compact owner 요약
// ---------------------------------------------------------------------------

export interface OwnershipStripProps {
  ownership: OwnershipSummary;
}

export function OwnershipStrip({ ownership }: OwnershipStripProps) {
  const {
    currentOwnerName,
    currentOwnerRole,
    assignmentState,
    reviewerNames,
    approverNames,
    waitingExternalLabel,
    nextOwnerName,
    nextOwnerRole,
    escalationOwnerName,
    slaState,
    ownerBlockedReason,
  } = ownership;

  const assignLabel = ASSIGNMENT_STATE_LABELS[assignmentState];
  const assignTone = ASSIGNMENT_STATE_TONES[assignmentState];
  const slaLabel = SLA_STATE_LABELS[slaState];
  const slaTone = SLA_STATE_TONES[slaState];

  const isEscalation = slaState === 'escalation_required' || slaState === 'overdue_internal';

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      {/* Current owner */}
      {(currentOwnerName || currentOwnerRole) && (
        <span className="text-slate-500">
          담당:{' '}
          <span className="text-slate-200 font-medium">
            {currentOwnerName ?? currentOwnerRole}
          </span>
          {currentOwnerName && currentOwnerRole && (
            <span className="text-slate-500 ml-1">({currentOwnerRole})</span>
          )}
        </span>
      )}

      {/* Assignment state */}
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-800 ${assignTone}`}>
        {assignLabel}
      </span>

      {/* SLA state */}
      {slaState !== 'on_track' && (
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-800 ${slaTone}`}>
          {slaLabel}
        </span>
      )}

      {/* Waiting external */}
      {waitingExternalLabel && (
        <span className="text-purple-400 text-[10px]">
          ⏳ {waitingExternalLabel}
        </span>
      )}

      {/* Approver/reviewer */}
      {approverNames && approverNames.length > 0 && (
        <span className="text-slate-500">
          승인: <span className="text-amber-400">{approverNames.join(', ')}</span>
        </span>
      )}
      {reviewerNames && reviewerNames.length > 0 && (
        <span className="text-slate-500">
          검토: <span className="text-blue-400">{reviewerNames.join(', ')}</span>
        </span>
      )}

      {/* Next owner */}
      {nextOwnerName && (
        <span className="text-slate-500">
          다음: <span className="text-teal-400">{nextOwnerName}</span>
          {nextOwnerRole && <span className="text-slate-600 ml-0.5">({nextOwnerRole})</span>}
        </span>
      )}

      {/* Escalation */}
      {isEscalation && escalationOwnerName && (
        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-400">
          에스컬레이션 → {escalationOwnerName}
        </span>
      )}

      {/* Owner blocked reason */}
      {ownerBlockedReason && (
        <span className="text-red-400/70 text-[10px]">⚠ {ownerBlockedReason}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OwnershipBadge — inbox row에서 compact하게 표시
// ---------------------------------------------------------------------------

export interface OwnershipBadgeProps {
  ownership: OwnershipSummary;
  compact?: boolean;
}

export function OwnershipBadge({ ownership, compact = false }: OwnershipBadgeProps) {
  const { currentOwnerName, currentOwnerRole, assignmentState, waitingExternalLabel, slaState } = ownership;
  const assignTone = ASSIGNMENT_STATE_TONES[assignmentState];

  if (compact) {
    return (
      <span className={`text-[10px] font-medium ${assignTone}`}>
        {currentOwnerName ?? ASSIGNMENT_STATE_LABELS[assignmentState]}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-slate-400">{currentOwnerName ?? currentOwnerRole ?? '미할당'}</span>
      <span className={`rounded px-1 py-0.5 text-[9px] font-medium bg-slate-800 ${assignTone}`}>
        {ASSIGNMENT_STATE_LABELS[assignmentState]}
      </span>
      {waitingExternalLabel && (
        <span className="text-[9px] text-purple-400">⏳</span>
      )}
      {slaState === 'escalation_required' && (
        <span className="text-[9px] text-red-400">🔺</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DecisionOwnerContext — decision panel 내부에 owner 문맥 표시
// ---------------------------------------------------------------------------

export interface DecisionOwnerContextProps {
  ownership: OwnershipSummary;
}

export function DecisionOwnerContext({ ownership }: DecisionOwnerContextProps) {
  const {
    currentOwnerName,
    currentOwnerRole,
    assignmentState,
    approverNames,
    nextOwnerName,
    nextOwnerRole,
    waitingExternalLabel,
    slaState,
    ownerBlockedReason,
  } = ownership;

  const isBlocked = assignmentState === 'blocked_by_role' || assignmentState === 'awaiting_approval';

  return (
    <div className="space-y-1.5 text-xs">
      {/* Who should act */}
      <div className="text-slate-400">
        실행 주체:{' '}
        <span className="text-slate-200 font-medium">
          {currentOwnerName ?? currentOwnerRole ?? '미할당'}
        </span>
      </div>

      {/* Approval blocking */}
      {isBlocked && approverNames && approverNames.length > 0 && (
        <div className="text-amber-400/80">
          승인 필요: {approverNames.join(', ')}
        </div>
      )}

      {/* Waiting external */}
      {waitingExternalLabel && (
        <div className="text-purple-400/80">
          외부 대기: {waitingExternalLabel}
        </div>
      )}

      {/* Next handoff */}
      {nextOwnerName && (
        <div className="text-slate-400">
          실행 후 →{' '}
          <span className="text-teal-400">{nextOwnerName}</span>
          {nextOwnerRole && <span className="text-slate-600 ml-0.5">({nextOwnerRole})</span>}
        </div>
      )}

      {/* Owner blocked */}
      {ownerBlockedReason && (
        <div className="flex items-center gap-1 text-red-400/80">
          <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
          {ownerBlockedReason}
        </div>
      )}
    </div>
  );
}
