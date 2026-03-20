'use client';

import { useState } from 'react';
import type { CommandSurface, OperationalCommand } from '@/lib/ops-console/action-model';
import { COMMAND_PRIORITY_STYLES, COMMAND_TYPE_HINTS } from '@/lib/ops-console/action-model';
import type { OwnershipSummary } from '@/lib/ops-console/ownership-adapter';
import type { AggregatedBlockerView } from '@/lib/ops-console/blocker-adapter';
import { DecisionOwnerContext } from './ownership-display';
import { BlockerCommandHints } from './blocker-display';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OperationalCommandBarProps {
  surface: CommandSurface;
  ownership?: OwnershipSummary;
  blockerView?: AggregatedBlockerView;
}

// ---------------------------------------------------------------------------
// Confirmation Dialog (inline)
// ---------------------------------------------------------------------------

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
      <p className="text-xs text-amber-300">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
        >
          확인
        </button>
        <button
          onClick={onCancel}
          className="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-600 transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Command Button
// ---------------------------------------------------------------------------

function CommandButton({
  command,
  showIcon = false,
}: {
  command: OperationalCommand;
  showIcon?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  const handleClick = () => {
    if (!command.canExecute) return;
    if (command.confirmRequired) {
      setConfirming(true);
      return;
    }
    command.onExecute();
  };

  const handleConfirm = () => {
    setConfirming(false);
    command.onExecute();
  };

  if (confirming) {
    return (
      <ConfirmDialog
        message={command.confirmMessage ?? '이 작업을 실행하시겠습니까?'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(false)}
      />
    );
  }

  const hint = COMMAND_TYPE_HINTS[command.commandType];
  const priorityStyle = COMMAND_PRIORITY_STYLES[command.priority];

  // Context/navigation commands render as links
  if (command.priority === 'context') {
    return (
      <div>
        {command.nextRoute ? (
          <a
            href={command.nextRoute}
            className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
          >
            {command.label} →
          </a>
        ) : (
          <button
            onClick={handleClick}
            disabled={!command.canExecute}
            className="text-xs text-slate-400 hover:text-slate-200 underline-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {command.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleClick}
        disabled={!command.canExecute}
        className={`w-full rounded px-3 py-2 text-sm font-medium transition-colors ${
          !command.canExecute
            ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500'
            : command.destructive
              ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20'
              : priorityStyle
        }`}
        title={
          !command.canExecute && command.blockedReasons.length > 0
            ? command.blockedReasons.join(' / ')
            : undefined
        }
      >
        <span className="flex items-center justify-center gap-1.5">
          {showIcon && <span className={`text-xs ${hint.tone}`}>●</span>}
          {command.label}
        </span>
      </button>

      {/* Post-action summary hint */}
      {command.canExecute && command.postActionSummary && (
        <p className="text-[10px] text-slate-500 px-1">→ {command.postActionSummary}</p>
      )}

      {/* Blocked reasons inline */}
      {!command.canExecute && command.blockedReasons.length > 0 && (
        <div className="px-1">
          {command.blockedReasons.map((reason, i) => (
            <p key={i} className="text-[10px] text-red-400/70">{reason}</p>
          ))}
        </div>
      )}

      {/* Review reasons */}
      {command.reviewReasons.length > 0 && (
        <div className="px-1">
          {command.reviewReasons.map((reason, i) => (
            <p key={i} className="text-[10px] text-amber-400/70">⚠ {reason}</p>
          ))}
        </div>
      )}

      {/* Next owner hint */}
      {command.canExecute && command.nextOwner && (
        <p className="text-[10px] text-slate-500 px-1">다음 담당: {command.nextOwner}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OperationalCommandBar
// ---------------------------------------------------------------------------

export function OperationalCommandBar({ surface, ownership, blockerView }: OperationalCommandBarProps) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900 p-4 space-y-3">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
        판단 & 조치
      </div>

      {/* Readiness indicator */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`w-2 h-2 rounded-full ${surface.isReady ? 'bg-emerald-400' : 'bg-amber-400'}`}
        />
        <span className="text-slate-300">{surface.readinessSummary}</span>
      </div>

      {/* Owner context in decision panel */}
      {ownership && (
        <div className="border-t border-slate-800 pt-2">
          <DecisionOwnerContext ownership={ownership} />
        </div>
      )}

      {/* Aggregated blockers */}
      {surface.aggregatedBlockers.length > 0 && (
        <div className="space-y-1">
          {surface.aggregatedBlockers.map((reason, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span className="text-red-300">{reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* Blocker resolution hints */}
      {blockerView && blockerView.totalCount > 0 && (
        <div className="border-t border-slate-800 pt-2">
          <BlockerCommandHints blockerView={blockerView} />
        </div>
      )}

      {/* Handoff target */}
      {surface.handoffTarget && (
        <div className="text-xs">
          <span className="text-slate-500">다음 단계: </span>
          <a
            href={surface.handoffTarget.href}
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            {surface.handoffTarget.label} →
          </a>
        </div>
      )}

      {/* Primary command */}
      {surface.primaryCommand && (
        <div className="pt-1">
          <CommandButton command={surface.primaryCommand} showIcon />
        </div>
      )}

      {/* Secondary commands */}
      {surface.secondaryCommands.length > 0 && (
        <div className="space-y-2">
          {surface.secondaryCommands.map((cmd) => (
            <CommandButton key={cmd.id} command={cmd} />
          ))}
        </div>
      )}

      {/* Triage commands */}
      {surface.triageCommands.length > 0 && (
        <div className="border-t border-slate-800 pt-2 space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-600">
            검토 & 해소
          </div>
          {surface.triageCommands.map((cmd) => (
            <CommandButton key={cmd.id} command={cmd} />
          ))}
        </div>
      )}

      {/* Context commands */}
      {surface.contextCommands.length > 0 && (
        <div className="border-t border-slate-800 pt-2 space-y-1.5">
          {surface.contextCommands.map((cmd) => (
            <CommandButton key={cmd.id} command={cmd} />
          ))}
        </div>
      )}
    </div>
  );
}
