"use client";

/**
 * Policy Explainability Primitives — 충돌 진단 payload를 UI로 정확히 projection
 *
 * engine output (PolicyApprovalConflictPayload)만 렌더.
 * UI에서 approval reason을 재계산하지 않음.
 *
 * 6 components:
 * - PolicyExplanationCard: 전체 설명 카드
 * - WinningScopeBadge: 이긴 scope 표시
 * - ApprovalSourceTrace: approval source (risk_tier / org_policy / combined)
 * - EscalationSourceTrace: escalation source + domain
 * - OverriddenRuleList: override된 rule 목록
 * - WhyThisEffectPanel: 왜 이 effect인지 전체 설명
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
  PolicyApprovalConflictPayload,
  WinningPolicyRule,
  OverriddenPolicyRule,
  EffectiveApprovalSource,
  EffectiveEscalationSource,
} from "@/lib/ai/policy-approval-conflict-diagnostics-engine";

// ── PolicyExplanationCard ──
export interface PolicyExplanationCardProps {
  payload: PolicyApprovalConflictPayload;
  compact?: boolean;
  className?: string;
}

export function PolicyExplanationCard({ payload, compact = false, className }: PolicyExplanationCardProps) {
  return (
    <div className={cn("rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2.5", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">
          정책 판단 근거
        </h4>
        {payload.conflictDiagnostics.hasConflicts && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            충돌 {payload.conflictDiagnostics.conflictCount}건
          </span>
        )}
      </div>

      {/* Operator-safe summary */}
      <p className="text-sm font-medium text-slate-700">{payload.operatorSafeSummary}</p>

      {!compact && (
        <>
          {/* Approval source */}
          <ApprovalSourceTrace source={payload.effectiveApprovalSource} riskTier={payload.riskTier} />

          {/* Escalation source */}
          {payload.effectiveEscalationSource !== "none" && (
            <EscalationSourceTrace
              source={payload.effectiveEscalationSource}
              reasonCodes={payload.escalationReasonCodes}
            />
          )}

          {/* Dual approval reasons */}
          {payload.dualApprovalReasonCodes.length > 0 && (
            <div className="text-xs space-y-0.5">
              <span className="text-slate-500">이중 승인 이유:</span>
              {payload.dualApprovalReasonCodes.map((code, i) => (
                <span key={i} className="ml-1 text-amber-400">{formatReasonCode(code)}</span>
              ))}
            </div>
          )}

          {/* Block reasons */}
          {payload.blockReasonCodes.length > 0 && (
            <div className="space-y-1">
              {payload.blockReasonCodes.map((code, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-red-400">
                  <span className="shrink-0 mt-0.5">✕</span>
                  <span>{formatReasonCode(code)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Winning rules */}
          {payload.winningPolicyRules.length > 0 && (
            <div className="pt-1 border-t border-slate-800">
              <span className="text-[10px] text-slate-600">적용된 규칙:</span>
              <div className="mt-1 space-y-1">
                {payload.winningPolicyRules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px]">
                    <WinningScopeBadge scopeType={rule.scopeType} />
                    <span className="text-slate-400">{rule.domain}</span>
                    <span className="text-slate-600">{rule.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── WinningScopeBadge ──
export interface WinningScopeBadgeProps {
  scopeType: string;
  className?: string;
}

const SCOPE_LABELS: Record<string, string> = {
  system: "시스템",
  organization: "조직",
  department: "부서",
  team: "팀",
  site: "사이트",
  location: "위치",
};

const SCOPE_COLORS: Record<string, string> = {
  system: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  organization: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  department: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  team: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  site: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  location: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function WinningScopeBadge({ scopeType, className }: WinningScopeBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium border",
      SCOPE_COLORS[scopeType] || SCOPE_COLORS.system,
      className,
    )}>
      {SCOPE_LABELS[scopeType] || scopeType}
    </span>
  );
}

// ── ApprovalSourceTrace ──
export interface ApprovalSourceTraceProps {
  source: EffectiveApprovalSource;
  riskTier: string;
  className?: string;
}

const SOURCE_CONFIG: Record<EffectiveApprovalSource, { label: string; color: string }> = {
  risk_tier: { label: "위험 등급", color: "text-red-400" },
  org_policy: { label: "조직 정책", color: "text-blue-400" },
  combined: { label: "위험 등급 + 조직 정책", color: "text-amber-400" },
  none: { label: "승인 불필요", color: "text-emerald-400" },
};

export function ApprovalSourceTrace({ source, riskTier, className }: ApprovalSourceTraceProps) {
  const config = SOURCE_CONFIG[source];
  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      <span className="text-slate-500">승인 근거:</span>
      <span className={config.color}>{config.label}</span>
      {source !== "none" && (
        <span className="text-slate-600">({riskTier})</span>
      )}
    </div>
  );
}

// ── EscalationSourceTrace ──
export interface EscalationSourceTraceProps {
  source: EffectiveEscalationSource;
  reasonCodes: string[];
  className?: string;
}

export function EscalationSourceTrace({ source, reasonCodes, className }: EscalationSourceTraceProps) {
  return (
    <div className={cn("text-xs space-y-0.5", className)}>
      <div className="flex items-center gap-2">
        <span className="text-slate-500">에스컬레이션 원인:</span>
        <span className="text-amber-400">{formatEscalationSource(source)}</span>
      </div>
      {reasonCodes.length > 0 && (
        <div className="ml-4 space-y-0.5">
          {reasonCodes.map((code, i) => (
            <p key={i} className="text-slate-500 text-[10px]">· {formatReasonCode(code)}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── OverriddenRuleList ──
export interface OverriddenRuleListProps {
  rules: OverriddenPolicyRule[];
  className?: string;
}

export function OverriddenRuleList({ rules, className }: OverriddenRuleListProps) {
  if (rules.length === 0) return null;

  return (
    <div className={cn("rounded border border-slate-800 bg-slate-900/30 p-2.5 space-y-1.5", className)}>
      <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-600">
        Override된 규칙 ({rules.length})
      </h5>
      <div className="space-y-1">
        {rules.map((rule, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[10px]">
            <span className="text-slate-600 shrink-0">—</span>
            <div>
              <span className="text-slate-500">{rule.domain}</span>
              <span className="text-slate-600 mx-1">·</span>
              <WinningScopeBadge scopeType={rule.scopeType} />
              <span className="text-slate-600 mx-1">→</span>
              <span className="text-slate-500">{rule.reason}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── WhyThisEffectPanel ──
export interface WhyThisEffectPanelProps {
  payload: PolicyApprovalConflictPayload;
  className?: string;
}

export function WhyThisEffectPanel({ payload, className }: WhyThisEffectPanelProps) {
  return (
    <div className={cn("rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2", className)}>
      <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">
        판단 경로 설명
      </h4>

      <div className="space-y-1.5 text-xs">
        {/* Why this effect */}
        <div className="flex items-start gap-2">
          <span className="text-slate-500 shrink-0">Effect:</span>
          <span className="text-slate-700">{payload.whyThisEffect}</span>
        </div>

        {/* Why this approval path */}
        <div className="flex items-start gap-2">
          <span className="text-slate-500 shrink-0">경로:</span>
          <span className="text-slate-700">{payload.whyThisApprovalPath}</span>
        </div>

        {/* Conflict summary */}
        {payload.conflictDiagnostics.hasConflicts && (
          <div className="flex items-start gap-2">
            <span className="text-amber-500 shrink-0">충돌:</span>
            <span className="text-amber-300">{payload.conflictDiagnostics.conflictSummary}</span>
          </div>
        )}

        {/* Scope precedence traces */}
        {payload.conflictDiagnostics.scopePrecedence.length > 0 && (
          <div className="pt-1.5 border-t border-slate-800">
            <span className="text-[10px] text-slate-600">Scope 우선순위:</span>
            {payload.conflictDiagnostics.scopePrecedence.map((sp, i) => (
              <div key={i} className="flex items-center gap-1 mt-0.5 text-[10px]">
                <span className="text-slate-500">{sp.domain}:</span>
                {sp.matchedScopes.map((ms, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <span className="text-slate-700">→</span>}
                    <WinningScopeBadge scopeType={ms.scopeType} />
                    {ms.isWinner && <span className="text-emerald-400 text-[9px]">★</span>}
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──
function formatReasonCode(code: string): string {
  return code.replace(/_/g, " ").replace(/:/g, " → ");
}

function formatEscalationSource(source: EffectiveEscalationSource): string {
  const labels: Record<string, string> = {
    budget_policy: "예산 정책",
    vendor_policy: "공급사 정책",
    release_policy: "릴리스 정책",
    restricted_item: "제한 품목",
    reorder_policy: "재주문 정책",
    sod_exception: "SoD 예외",
    risk_tier: "위험 등급",
    combined: "복합 원인",
    none: "없음",
  };
  return labels[source] || source;
}
