"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  GitCompare,
  Loader2,
  Package,
  Search,
  Send,
  Shield,
  Users,
  Activity,
} from "lucide-react";
import type { OpsKPI, StepFunnelSummary, OpsAlert, WorkQueueSection, ActivityFeedItem, ApprovalInboxSummary } from "@/lib/review-queue/ops-hub";

// ═══════════════════════════════════════════════════
// KPI Card
// ═══════════════════════════════════════════════════

function getKpiStatus(key: string, count: number): { label: string; cls: string } {
  if (key === "reviewNeeded") {
    if (count === 0) return { label: "정상", cls: "text-emerald-400" };
    if (count <= 5) return { label: "확인 필요", cls: "text-amber-400" };
    return { label: "우선 처리", cls: "text-red-400" };
  }
  if (key === "compareWaiting") {
    if (count === 0) return { label: "정상", cls: "text-emerald-400" };
    if (count <= 3) return { label: "처리 가능", cls: "text-blue-400" };
    return { label: "대기 증가", cls: "text-amber-400" };
  }
  if (key === "quoteDraftReady") {
    if (count === 0) return { label: "없음", cls: "text-slate-500" };
    return { label: "즉시 처리 가능", cls: "text-emerald-400" };
  }
  if (key === "approvalPending") {
    if (count === 0) return { label: "정상", cls: "text-emerald-400" };
    if (count <= 2) return { label: "대기 중", cls: "text-amber-400" };
    return { label: "우선 확인", cls: "text-red-400" };
  }
  if (key === "budgetWarnings") {
    if (count === 0) return { label: "정상", cls: "text-emerald-400" };
    return { label: "검토 필요", cls: "text-amber-400" };
  }
  if (key === "inventoryWarnings") {
    if (count === 0) return { label: "정상", cls: "text-emerald-400" };
    return { label: "대조 필요", cls: "text-amber-400" };
  }
  return { label: "운영 중", cls: "text-slate-400" };
}

const KPI_META: { key: keyof OpsKPI; label: string; desc: string; icon: typeof Search }[] = [
  { key: "reviewNeeded", label: "검토 필요", desc: "Step 1에서 확인이 필요한 항목입니다", icon: Search },
  { key: "compareWaiting", label: "비교 확정 대기", desc: "후보 선택이 필요한 항목입니다", icon: GitCompare },
  { key: "quoteDraftReady", label: "견적 초안 제출 가능", desc: "Step 3에서 바로 제출할 수 있습니다", icon: FileText },
  { key: "approvalPending", label: "승인 대기", desc: "검토 또는 제출 승인이 필요한 요청입니다", icon: ClipboardCheck },
  { key: "budgetWarnings", label: "예산 확인 필요", desc: "제출 전 예산 검토가 필요한 항목입니다", icon: CreditCard },
  { key: "inventoryWarnings", label: "재고 중복 가능", desc: "기존 재고와 중복 구매 가능성이 있습니다", icon: Package },
  { key: "activeMembers", label: "활성 멤버", desc: "최근 작업이 있는 조직 멤버 수입니다", icon: Users },
  { key: "totalMembers", label: "최근 7일 활동", desc: "검토, 비교, 제출, 승인 이벤트 기준입니다", icon: Activity },
];

// ═══════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════

interface OrgOverviewHubProps {
  kpi: OpsKPI;
  funnel: StepFunnelSummary;
  alerts: OpsAlert[];
  workQueue: WorkQueueSection[];
  approvalInbox: ApprovalInboxSummary;
  activityFeed: ActivityFeedItem[];
  recentActivityCount?: number;
}

// ═══════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════

export function OrgOverviewHub({
  kpi,
  funnel,
  alerts,
  workQueue,
  approvalInbox,
  activityFeed,
  recentActivityCount = 0,
}: OrgOverviewHubProps) {
  const hasAnyData = funnel.step1Total + funnel.step2Total + funnel.step3Total > 0;

  // ── 전체 빈 상태 ──
  if (!hasAnyData && alerts.length === 0 && activityFeed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 bg-el border border-bd border-dashed rounded-xl text-center max-w-lg mx-auto">
        <Shield className="h-10 w-10 text-slate-500 mb-4" />
        <h3 className="text-base font-bold text-slate-700 mb-2">아직 운영 작업이 시작되지 않았습니다</h3>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          직접 검색 또는 업로드 해석으로 검토 큐를 만들면<br />비교와 견적 작업이 이어집니다
        </p>
        <Button asChild className="bg-blue-600 hover:bg-blue-500">
          <Link href="/app/search">Step 1 시작하기</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 1. 상단 KPI ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {KPI_META.map(({ key, label, desc, icon: Icon }) => {
          const count = kpi[key];
          const status = getKpiStatus(key, count);
          return (
            <div key={key} className="bg-pn border border-bd rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-slate-500" />
                <span className="text-[11px] font-medium text-slate-400">{label}</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 mb-1">{count}</div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 truncate">{desc}</span>
                <span className={`text-[10px] font-medium ${status.cls}`}>{status.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 2. Step Funnel ── */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-3">작업 흐름 요약</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { title: "검토 큐", count: funnel.step1Total, desc: "입력 해석과 항목 검토가 진행 중입니다", sub: `검토 필요 ${funnel.step1NeedsReview} · 실패 ${funnel.step1MatchFailed}`, href: "/app/search", cta: "검토 큐 열기" },
            { title: "비교 큐", count: funnel.step2Total, desc: "후보 선택과 비교 확정이 필요한 항목입니다", sub: `선택 필요 ${funnel.step2Pending} · 확정 ${funnel.step2Confirmed}`, href: "/app/compare", cta: "비교 큐 열기" },
            { title: "견적 초안", count: funnel.step3Total, desc: "제출 전 수량·단위·예산을 확인할 수 있습니다", sub: `제출 가능 ${funnel.step3Ready} · 보류 ${funnel.step3Missing + funnel.step3Review}`, href: "/app/quote", cta: "견적 초안 열기" },
          ].map((step) => (
            <div key={step.title} className="bg-pn border border-bd rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">{step.title}</span>
                <span className="text-xl font-bold text-slate-900">{step.count}</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">{step.desc}</p>
              <p className="text-[10px] text-slate-500 mb-3">{step.sub}</p>
              <Button asChild variant="outline" size="sm" className="h-7 text-[11px] w-full border-bd">
                <Link href={step.href}>{step.cta} <ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Alerts ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">운영 경고</h3>
          <span className="text-[10px] text-slate-500">우선 확인이 필요한 항목만 표시합니다</span>
        </div>
        {alerts.length === 0 ? (
          <p className="text-xs text-slate-500 bg-pn border border-bd rounded-lg p-4">현재 우선 확인이 필요한 운영 경고가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className={`bg-pn border rounded-lg p-3 flex items-center justify-between ${
                alert.priority === "high" ? "border-red-500/30" : alert.priority === "medium" ? "border-amber-500/30" : "border-bd"
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    alert.priority === "high" ? "bg-red-500/10 text-red-400" : alert.priority === "medium" ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400"
                  }`}>
                    {alert.priority === "high" ? "긴급" : alert.priority === "medium" ? "주의" : "안내"}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-700">{alert.title}</p>
                    <p className="text-[10px] text-slate-500">{alert.description}</p>
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm" className="h-7 text-[11px] text-slate-400 hover:text-slate-700">
                  <Link href={alert.linkHref}>{alert.linkLabel} <ArrowRight className="h-3 w-3 ml-1" /></Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 4. Work Queue ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">지금 처리할 작업</h3>
          <span className="text-[10px] text-slate-500">바로 처리 가능한 항목부터 보여줍니다</span>
        </div>
        {workQueue.length === 0 ? (
          <p className="text-xs text-slate-500 bg-pn border border-bd rounded-lg p-4">지금 바로 처리할 작업이 없습니다</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {workQueue.map((section) => (
              <div key={section.id} className="bg-pn border border-bd rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-700">{section.title}</span>
                  <Badge variant="secondary" className="bg-el text-slate-600 text-[10px]">{section.count}</Badge>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">{section.description}</p>
                {section.items.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {section.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">{item.label}</span>
                        <span className="text-slate-600 font-medium">{item.count}건</span>
                      </div>
                    ))}
                  </div>
                )}
                <Button asChild variant="outline" size="sm" className="h-7 text-[11px] w-full border-bd">
                  <Link href={section.linkHref}>{section.linkLabel} <ArrowRight className="h-3 w-3 ml-1" /></Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 5. Approval Inbox ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">승인 대기함</h3>
          <span className="text-[10px] text-slate-500">조직 차원의 승인과 검토가 필요한 요청입니다</span>
        </div>
        {approvalInbox.pendingCount === 0 && approvalInbox.myRequestsCount === 0 ? (
          <p className="text-xs text-slate-500 bg-pn border border-bd rounded-lg p-4">현재 승인 대기 요청이 없습니다</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            <div className="bg-pn border border-bd rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-700">내가 처리할 승인</span>
                <span className="text-lg font-bold text-slate-900">{approvalInbox.pendingCount}</span>
              </div>
              <p className="text-[10px] text-slate-500 mb-3">구매 또는 운영 승인 후 진행할 수 있습니다</p>
              <Button variant="outline" size="sm" className="h-7 text-[11px] w-full border-bd">전체 승인 요청 보기</Button>
            </div>
            <div className="bg-pn border border-bd rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-700">내가 올린 요청</span>
                <span className="text-lg font-bold text-slate-900">{approvalInbox.myRequestsCount}</span>
              </div>
              <p className="text-[10px] text-slate-500 mb-3">현재 승인 대기 중입니다</p>
              <Button variant="outline" size="sm" className="h-7 text-[11px] w-full border-bd">내 요청 보기</Button>
            </div>
            <div className="bg-pn border border-bd rounded-xl p-4">
              <span className="text-xs font-medium text-slate-700 block mb-2">최근 승인 결과</span>
              {approvalInbox.recentDecisions.length === 0 ? (
                <p className="text-[10px] text-slate-500">최근 승인/반려 기록 없음</p>
              ) : (
                <div className="space-y-1.5">
                  {approvalInbox.recentDecisions.slice(0, 3).map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 truncate">{d.action}</span>
                      <span className={d.state === "approved" ? "text-emerald-400" : "text-red-400"}>
                        {d.state === "approved" ? "승인" : "반려"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 6. Activity Feed ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">최근 운영 활동</h3>
          <span className="text-[10px] text-slate-500">검토, 비교, 제출, 승인 이력을 시간순으로 보여줍니다</span>
        </div>
        {activityFeed.length === 0 ? (
          <p className="text-xs text-slate-500 bg-pn border border-bd rounded-lg p-4">아직 기록된 운영 활동이 없습니다</p>
        ) : (
          <div className="bg-pn border border-bd rounded-xl divide-y divide-bd">
            {activityFeed.slice(0, 8).map((item) => (
              <div key={item.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-700">{item.action}</p>
                  <p className="text-[10px] text-slate-500">{item.actor} · {new Date(item.time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 7. 빠른 이동 ── */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-3">빠른 이동</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { href: "/app/search", label: "Step 1 검토 큐 열기" },
            { href: "/app/compare", label: "Step 2 비교 큐 열기" },
            { href: "/app/quote", label: "Step 3 견적 초안 열기" },
            { href: "#approvals", label: "승인 요청 보기" },
            { href: "#members", label: "멤버 및 접근 관리 보기" },
            { href: "#settings", label: "정책 및 설정 보기" },
          ].map((link) => (
            <Button key={link.href} asChild variant="outline" size="sm" className="h-8 text-[11px] border-bd justify-start">
              <Link href={link.href}>{link.label} <ArrowRight className="h-3 w-3 ml-auto" /></Link>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
