"use client";

/**
 * Timeline Rail — 공통 판단/근거/상태 전이 기록 rail 컴포넌트
 *
 * 각 workbench의 right rail에 삽입하여 사용합니다.
 * - 최근 이벤트 타임라인
 * - 연결 문서/근거
 * - override/예외 하이라이트
 * - header summary signal
 */

import {
  type ActivityEvent,
  type Evidence,
  type TimelineSummary,
  computeTimelineSummary,
  getRecentEvents,
  EVENT_TYPE_CONFIG,
} from "@/lib/activity-spine";
import { Badge } from "@/components/ui/badge";
import {
  FileText, AlertCircle, AlertTriangle, CheckCircle2, Clock,
  ShieldAlert, ChevronRight,
} from "lucide-react";

// ── Header Summary Signal ───────────────────────────────────────

export function TimelineHeaderSignal({
  events,
  evidence,
}: {
  events: ActivityEvent[];
  evidence: Evidence[];
}) {
  const summary = computeTimelineSummary(events, evidence);

  if (events.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {summary.recentChanges > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-600/10 text-blue-400 border border-blue-600/20">
          <Clock className="h-2.5 w-2.5" />변경 {summary.recentChanges}
        </span>
      )}
      {summary.unresolvedBlockers > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-600/10 text-red-400 border border-red-600/20">
          <AlertCircle className="h-2.5 w-2.5" />차단 {summary.unresolvedBlockers}
        </span>
      )}
      {summary.linkedDocs > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-el text-slate-400 border border-bd">
          <FileText className="h-2.5 w-2.5" />문서 {summary.linkedDocs}
        </span>
      )}
      {summary.hasOverride && (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-600/10 text-red-400 border border-red-600/20">
          <ShieldAlert className="h-2.5 w-2.5" />예외
        </span>
      )}
    </div>
  );
}

// ── Timeline Rail (for right panel insertion) ───────────────────

export function TimelineRail({
  events,
  evidence,
  maxEvents = 8,
  onEventClick,
}: {
  events: ActivityEvent[];
  evidence: Evidence[];
  maxEvents?: number;
  onEventClick?: (event: ActivityEvent) => void;
}) {
  const recentEvents = getRecentEvents(events, maxEvents);
  const activeEvidence = evidence.filter(e => e.status === "active");

  return (
    <div className="space-y-0">
      {/* Timeline header */}
      <div className="px-5 py-3 border-b border-bd/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">활동 타임라인</span>
          <span className="text-[10px] text-slate-500">{events.length}건</span>
        </div>
        <TimelineHeaderSignal events={events} evidence={evidence} />
      </div>

      {/* Event list */}
      <div className="px-5 py-2">
        {recentEvents.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">기록된 활동이 없습니다</p>
        ) : (
          <div className="space-y-0">
            {recentEvents.map((event, idx) => {
              const config = EVENT_TYPE_CONFIG[event.eventType];
              const isOverride = event.eventType === "policy_override_recorded";
              const isBlocker = event.eventType === "blocker_flagged";
              const isResolved = event.eventType === "blocker_resolved";

              return (
                <button
                  key={event.eventId}
                  onClick={() => onEventClick?.(event)}
                  className="w-full text-left flex items-start gap-2.5 py-2 border-b border-bd/30 last:border-0 hover:bg-el/30 transition-colors rounded -mx-1 px-1"
                >
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center shrink-0 pt-0.5">
                    <span className={`h-2 w-2 rounded-full ${
                      isOverride ? "bg-red-500" : isBlocker ? "bg-red-500" : isResolved ? "bg-emerald-500" : "bg-slate-600"
                    }`} />
                    {idx < recentEvents.length - 1 && <div className="w-px h-full bg-bd/50 mt-1" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-medium ${config.color}`}>{config.label}</span>
                      {event.severity === "critical" && <AlertCircle className="h-2.5 w-2.5 text-red-400" />}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">{event.summary}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-slate-500">{event.actor}</span>
                      <span className="text-[9px] text-slate-600">·</span>
                      <span className="text-[9px] text-slate-500">{formatRelativeTime(event.occurredAt)}</span>
                      {event.linkedEvidenceIds.length > 0 && (
                        <span className="text-[9px] text-slate-500">· 근거 {event.linkedEvidenceIds.length}</span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="h-3 w-3 text-slate-700 shrink-0 mt-1" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Evidence section */}
      {activeEvidence.length > 0 && (
        <div className="px-5 py-3 border-t border-bd/50">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">
            연결 근거 ({activeEvidence.length}건)
          </div>
          <div className="space-y-1">
            {activeEvidence.slice(0, 5).map(ev => (
              <div key={ev.evidenceId} className="flex items-center justify-between text-xs py-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText className="h-3 w-3 text-slate-500 shrink-0" />
                  <span className="text-slate-600 truncate">{ev.title}</span>
                </div>
                <Badge variant="secondary" className="text-[9px] bg-pn text-slate-500 border-bd shrink-0">
                  {EVIDENCE_TYPE_LABEL[ev.evidenceType] ?? ev.evidenceType}
                </Badge>
              </div>
            ))}
            {activeEvidence.length > 5 && (
              <p className="text-[10px] text-slate-500">+{activeEvidence.length - 5}건 더</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Evidence type labels ────────────────────────────────────────

const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  quote_pdf: "견적서",
  vendor_message: "공급사 메시지",
  coa: "CoA",
  sds: "SDS",
  approval_package: "승인 패키지",
  receiving_photo: "입고 사진",
  discrepancy_note: "이슈 메모",
  inventory_lot_note: "Lot 메모",
  policy_exception_note: "예외 메모",
  selection_reason: "선택 사유",
  blocker_resolution: "차단 해소",
  approval_handoff: "승인 인계",
  vendor_followup: "공급사 후속",
  receiving_issue: "입고 이슈",
  inventory_warning: "재고 경고",
  reorder_context: "재주문 사유",
};

// ── Utility ─────────────────────────────────────────────────────

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(isoDate).toLocaleDateString("ko-KR");
}
