"use client";

/**
 * GovernanceDevPanel — Governance Event Bus 디버깅 패널
 *
 * 실시간으로:
 * - 이벤트 히스토리 (domain, type, severity, timestamp)
 * - 구독자 수
 * - 이벤트 필터링 (domain / severity)
 * - 이벤트 상세 (payload, affected objects, actor)
 *
 * 개발 환경에서만 표시. 프로덕션에서는 렌더링 안 함.
 * 토글: Ctrl+Shift+G (또는 ⌘+Shift+G)
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getGlobalGovernanceEventBus,
  type GovernanceEvent,
  type GovernanceDomain,
  type GovernanceEventSeverity,
} from "@/lib/ai/governance-event-bus";
import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════

const DOMAIN_LABELS: Record<GovernanceDomain, string> = {
  quote_chain: "견적",
  dispatch_prep: "발송준비",
  dispatch_execution: "발송실행",
  supplier_confirmation: "공급사확인",
  receiving_prep: "입고준비",
  receiving_execution: "입고실행",
  stock_release: "재고출고",
  reorder_decision: "재주문",
};

const SEVERITY_COLORS: Record<GovernanceEventSeverity, { bg: string; text: string; dot: string }> = {
  info: { bg: "bg-slate-800", text: "text-slate-400", dot: "bg-slate-500" },
  warning: { bg: "bg-amber-950/30", text: "text-amber-400", dot: "bg-amber-500" },
  critical: { bg: "bg-red-950/30", text: "text-red-400", dot: "bg-red-500" },
};

const MAX_DISPLAY = 100;

// ══════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════

export function GovernanceDevPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<GovernanceEvent[]>([]);
  const [subCount, setSubCount] = useState(0);
  const [domainFilter, setDomainFilter] = useState<GovernanceDomain | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<GovernanceEventSeverity | "all">("all");
  const [selectedEvent, setSelectedEvent] = useState<GovernanceEvent | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Skip in production
  if (process.env.NODE_ENV === "production") return null;

  // Toggle with Ctrl+Shift+G
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "G") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Subscribe to all events
  useEffect(() => {
    if (!isOpen) return;

    let bus: ReturnType<typeof getGlobalGovernanceEventBus>;
    try {
      bus = getGlobalGovernanceEventBus();
    } catch {
      return;
    }

    // Load existing history
    const history = bus.getHistory({ limit: MAX_DISPLAY });
    setEvents(history);
    setSubCount(bus.getSubscriptionCount());

    const subId = bus.subscribe({
      domains: [],
      chainStages: [],
      caseId: null,
      poNumber: null,
      severities: [],
      handler: (event) => {
        if (isPaused) return;
        setEvents((prev) => {
          const next = [...prev, event];
          return next.length > MAX_DISPLAY ? next.slice(-MAX_DISPLAY) : next;
        });
        setSubCount(bus.getSubscriptionCount());
      },
    });

    // Periodic sub count refresh
    const interval = setInterval(() => {
      setSubCount(bus.getSubscriptionCount());
    }, 3000);

    return () => {
      bus.unsubscribe(subId);
      clearInterval(interval);
    };
  }, [isOpen, isPaused]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && !selectedEvent) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, selectedEvent]);

  const filteredEvents = events.filter((e) => {
    if (domainFilter !== "all" && e.domain !== domainFilter) return false;
    if (severityFilter !== "all" && e.severity !== severityFilter) return false;
    return true;
  });

  const handleClear = useCallback(() => {
    try {
      getGlobalGovernanceEventBus().clearHistory();
    } catch {
      // ignore
    }
    setEvents([]);
    setSelectedEvent(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 right-0 z-[9999] w-[420px] max-w-[100vw] h-[50vh] flex flex-col bg-[#1a1b1e] border-l border-t border-slate-700 shadow-2xl rounded-tl-lg font-mono text-xs">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-[#222326]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Governance Bus</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
            {filteredEvents.length} events
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400">
            {subCount} subs
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsPaused((p) => !p)}
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px]",
              isPaused ? "bg-amber-900/40 text-amber-400" : "bg-slate-700 text-slate-400",
            )}
          >
            {isPaused ? "▶ 재개" : "⏸ 일시정지"}
          </button>
          <button
            onClick={handleClear}
            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-400 hover:text-red-400"
          >
            삭제
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-slate-800 bg-[#1e1f22]">
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value as GovernanceDomain | "all")}
          className="bg-slate-800 text-slate-300 text-[10px] rounded px-1.5 py-0.5 border-none outline-none"
        >
          <option value="all">전체 domain</option>
          {Object.entries(DOMAIN_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as GovernanceEventSeverity | "all")}
          className="bg-slate-800 text-slate-300 text-[10px] rounded px-1.5 py-0.5 border-none outline-none"
        >
          <option value="all">전체 severity</option>
          <option value="info">info</option>
          <option value="warning">warning</option>
          <option value="critical">critical</option>
        </select>
      </div>

      {/* Event list + Detail split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Event list */}
        <div
          ref={scrollRef}
          className={cn("flex-1 overflow-y-auto", selectedEvent && "w-1/2")}
          style={{ scrollbarWidth: "thin", scrollbarColor: "#4b5563 transparent" }}
        >
          {filteredEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500 text-[10px]">
              이벤트 없음 — bus에 이벤트가 발행되면 여기에 표시됩니다
            </div>
          ) : (
            filteredEvents.map((evt, i) => {
              const sev = SEVERITY_COLORS[evt.severity];
              const isSelected = selectedEvent?.eventId === evt.eventId;
              const time = evt.timestamp.split("T")[1]?.slice(0, 8) || evt.timestamp;
              return (
                <button
                  key={`${evt.eventId}-${i}`}
                  onClick={() => setSelectedEvent(isSelected ? null : evt)}
                  className={cn(
                    "w-full text-left flex items-start gap-1.5 px-2 py-1 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors",
                    isSelected && "bg-blue-950/30 border-blue-800/30",
                    sev.bg,
                  )}
                >
                  <span className={cn("shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full", sev.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] px-1 rounded bg-slate-700/60 text-slate-400">
                        {DOMAIN_LABELS[evt.domain] || evt.domain}
                      </span>
                      <span className={cn("truncate", sev.text)}>{evt.eventType}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-0.5">
                      <span>{time}</span>
                      <span>·</span>
                      <span className="truncate">{evt.detail.slice(0, 40)}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Detail pane */}
        {selectedEvent && (
          <div className="w-1/2 border-l border-slate-700 overflow-y-auto p-2 bg-[#1e1f22]" style={{ scrollbarWidth: "thin" }}>
            <div className="space-y-2">
              <DetailRow label="Event ID" value={selectedEvent.eventId} />
              <DetailRow label="Domain" value={`${selectedEvent.domain} (${DOMAIN_LABELS[selectedEvent.domain]})`} />
              <DetailRow label="Type" value={selectedEvent.eventType} />
              <DetailRow label="Severity" value={selectedEvent.severity} />
              <DetailRow label="Case ID" value={selectedEvent.caseId || "—"} />
              <DetailRow label="PO" value={selectedEvent.poNumber || "—"} />
              <DetailRow label="Chain Stage" value={selectedEvent.chainStage || "—"} />
              <DetailRow label="Actor" value={selectedEvent.actor} />
              <DetailRow label="Timestamp" value={selectedEvent.timestamp} />
              <DetailRow label="From → To" value={`${selectedEvent.fromStatus} → ${selectedEvent.toStatus}`} />
              <DetailRow label="Detail" value={selectedEvent.detail} />
              <DetailRow label="Affected" value={selectedEvent.affectedObjectIds.join(", ") || "—"} />
              <div>
                <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-0.5">Payload</span>
                <pre className="text-[9px] text-slate-300 bg-slate-900 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</span>
      <p className="text-[10px] text-slate-300 break-all">{value}</p>
    </div>
  );
}
