"use client";

/**
 * Compare History Section — 최근 비교 세션 목록
 */

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GitCompareArrows, FileText, Mail, Clock, ChevronRight, Loader2,
} from "lucide-react";
import {
  getDecisionConfig,
  getDraftStatusConfig,
  getQuoteStatusConfig,
  VERDICT_CONFIG,
} from "@/lib/compare-workspace/decision-constants";
import { determineCompareSubstatus, COMPARE_SUBSTATUS_DEFS, determineResolutionPath, RESOLUTION_PATH_LABELS } from "@/lib/work-queue/compare-queue-semantics";

// ── Types ──

export interface CompareSessionSummary {
  id: string;
  productIds: string[];
  productNames: string[];
  decisionState: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  linkedQuoteCount: number;
  inquiryDraftCount: number;
  inquiryDraftStatuses: string[];
  latestActionAt: string | null;
  createdAt: string | null;
  diffSummaryVerdict: string | null;
  linkedQuoteStatuses: string[];
  latestQuoteStatus: string | null;
  downstreamProgress?: {
    hasOrder: boolean;
    orderStatus?: string;
    hasReceiving: boolean;
    receivingComplete: boolean;
  };
}

interface CompareHistorySectionProps {
  onOpenSession: (session: CompareSessionSummary) => void;
}

// ── Badge Components ──

function DecisionStateBadge({ state }: { state: string | null }) {
  const c = getDecisionConfig(state);
  return (
    <Badge variant="outline" dot={c.dotColor as any} dotPulse={c.pulse} className="text-xs">
      {c.label}
    </Badge>
  );
}

function VerdictBadgeMini({ verdict }: { verdict: string | null }) {
  if (!verdict) return null;
  const c = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.MINOR_DIFFERENCES;
  return <Badge variant="outline" className={`text-xs ${c.className}`}>{c.label}</Badge>;
}

function DraftStatusBadgeMini({ status }: { status: string }) {
  const c = getDraftStatusConfig(status);
  return <Badge variant="outline" className={`text-xs ${c.className}`}>{c.label}</Badge>;
}

function QuoteStatusBadgeMini({ status }: { status: string }) {
  const c = getQuoteStatusConfig(status);
  return <Badge variant="outline" className={`text-xs ${c.className}`}>견적 {c.label}</Badge>;
}

function CompareSubstatusBadge({ session }: { session: CompareSessionSummary }) {
  if (session.decisionState && session.decisionState !== "UNDECIDED") return null;

  const substatus = determineCompareSubstatus({
    inquiryDrafts: session.inquiryDraftStatuses.map((s) => ({ status: s })),
    linkedQuoteStatuses: session.linkedQuoteStatuses,
    isReopened: false,
  });

  const def = COMPARE_SUBSTATUS_DEFS[substatus];
  if (!def || def.isTerminal) return null;

  return (
    <Badge variant="outline" className="text-xs bg-purple-600/10 text-purple-400">
      {def.label}
    </Badge>
  );
}

function DownstreamProgressBadge({ progress }: { progress?: CompareSessionSummary["downstreamProgress"] }) {
  if (!progress || !progress.hasOrder) return null;
  if (progress.receivingComplete) {
    return <Badge variant="outline" className="text-xs bg-green-600/10 text-green-400">입고 완료</Badge>;
  }
  if (progress.hasReceiving) {
    return <Badge variant="outline" className="text-xs bg-blue-600/10 text-blue-400">입고 진행</Badge>;
  }
  const label = progress.orderStatus === "DELIVERED" ? "배송 완료"
    : progress.orderStatus === "SHIPPING" ? "배송 중"
    : progress.orderStatus === "CONFIRMED" ? "발주 확인"
    : "발주 진행";
  return <Badge variant="outline" className="text-xs bg-indigo-600/10 text-indigo-400">{label}</Badge>;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

// ── Main Component ──

export function CompareHistorySection({ onOpenSession }: CompareHistorySectionProps) {
  const { data, isLoading } = useQuery<{ sessions: CompareSessionSummary[]; total: number }>({
    queryKey: ["compare-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/compare-sessions?limit=10");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const sessions = data?.sessions ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4" />
          최근 비교 이력
          {data && data.total > 0 && (
            <Badge variant="secondary" className="text-xs ml-1">{data.total}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 bg-slate-800 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && sessions.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <GitCompareArrows className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            비교 이력이 없습니다. 제품을 추가하여 비교를 시작하세요.
          </div>
        )}

        {!isLoading && sessions.length > 0 && (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-800 transition-colors cursor-pointer group"
                onClick={() => onOpenSession(session)}
              >
                <div className="flex-1 min-w-0">
                  {/* 제품명 */}
                  <p className="text-sm font-medium truncate">
                    {session.productNames.join(" vs ")}
                  </p>

                  {/* 배지 행 */}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <VerdictBadgeMini verdict={session.diffSummaryVerdict} />
                    <CompareSubstatusBadge session={session} />
                    <DecisionStateBadge state={session.decisionState} />
                    {session.decisionState && session.decisionState !== "UNDECIDED" && (() => {
                      const path = determineResolutionPath({
                        hasLinkedQuote: session.linkedQuoteCount > 0,
                        hasInquiryDraft: session.inquiryDraftCount > 0,
                        isReopened: false,
                      });
                      return (
                        <Badge variant="outline" className="text-xs text-slate-400">
                          {RESOLUTION_PATH_LABELS[path]}
                        </Badge>
                      );
                    })()}
                    {session.latestQuoteStatus && (
                      <QuoteStatusBadgeMini status={session.latestQuoteStatus} />
                    )}
                    {!session.latestQuoteStatus && session.linkedQuoteCount > 0 && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <FileText className="h-3 w-3" />
                        견적 {session.linkedQuoteCount}
                      </Badge>
                    )}
                    {session.inquiryDraftCount > 0 && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Mail className="h-3 w-3" />
                        문의 {session.inquiryDraftCount}
                      </Badge>
                    )}
                    {session.inquiryDraftStatuses.length > 0 && session.inquiryDraftStatuses.map((s, i) => (
                      <DraftStatusBadgeMini key={i} status={s} />
                    ))}
                    <DownstreamProgressBadge progress={session.downstreamProgress} />
                  </div>

                  {/* 시간 */}
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {relativeTime(session.latestActionAt)}
                    {(!session.decisionState || session.decisionState === "UNDECIDED") && (() => {
                      const ageDays = session.createdAt
                        ? Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 86400000)
                        : 0;
                      if (ageDays >= 7) {
                        return <span className="text-[10px] text-orange-400 font-medium ml-1">{ageDays}일 대기</span>;
                      }
                      return null;
                    })()}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-400 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
