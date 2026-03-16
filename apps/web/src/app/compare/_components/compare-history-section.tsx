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
              <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
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
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group"
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
                    <DecisionStateBadge state={session.decisionState} />
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
                  </div>

                  {/* 시간 */}
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {relativeTime(session.latestActionAt)}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
