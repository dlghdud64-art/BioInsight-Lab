"use client";

/**
 * SuggestionPanel — 공통 AI suggestion 표시 컴포넌트
 *
 * 규칙:
 * - compact strip/block 형태만
 * - full-width banner 금지
 * - 한 화면에 최대 1개만 렌더
 * - reasons 최대 3개, preview 1줄
 */
import { Button } from "@/components/ui/button";
import { Sparkles, X, Check, AlertTriangle, MinusCircle, ArrowRight } from "lucide-react";
import type { AiSuggestion, AiSuggestionReason } from "@/lib/ai/suggestion-engine";

export type SuggestionPanelProps = {
  suggestion: AiSuggestion | null;
  variant: "sourcing" | "compare" | "request";
  onPrimaryAction: (actionId: string) => void;
  onDismiss: () => void;
  onEdit?: () => void;
  onOpenReview?: () => void;
};

const VARIANT_CONFIG = {
  sourcing: { label: "AI 제안", labelColor: "text-blue-400", borderColor: "border-blue-600/20", bgColor: "bg-blue-600/5" },
  compare: { label: "AI 판단", labelColor: "text-blue-300", borderColor: "border-blue-600/20", bgColor: "bg-blue-600/5" },
  request: { label: "AI 초안", labelColor: "text-blue-300", borderColor: "border-blue-600/20", bgColor: "bg-blue-600/5" },
} as const;

const CONFIDENCE_LABEL: Record<string, { label: string; color: string }> = {
  high: { label: "높음", color: "text-emerald-400 bg-emerald-600/10 border-emerald-600/20" },
  medium: { label: "보통", color: "text-blue-400 bg-blue-600/10 border-blue-600/20" },
  low: { label: "낮음", color: "text-slate-400 bg-slate-600/10 border-slate-600/20" },
};

function getConfidenceBucket(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

const REASON_ICON = {
  positive: Check,
  warning: AlertTriangle,
  missing: MinusCircle,
  difference: ArrowRight,
} as const;

function ReasonChip({ reason }: { reason: AiSuggestionReason }) {
  const Icon = REASON_ICON[reason.type];
  const colorMap = {
    positive: "text-emerald-400",
    warning: "text-amber-400",
    missing: "text-red-400",
    difference: "text-blue-400",
  };
  return (
    <span className="inline-flex items-center gap-1 text-[9px] text-slate-400">
      <Icon className={`h-2.5 w-2.5 ${colorMap[reason.type]}`} />
      {reason.label}
    </span>
  );
}

export function SuggestionPanel({ suggestion, variant, onPrimaryAction, onDismiss }: SuggestionPanelProps) {
  if (!suggestion || suggestion.status === "dismissed") return null;

  const config = VARIANT_CONFIG[variant];
  const primaryActions = suggestion.actions.filter(a => a.type !== "dismiss");
  const bucket = getConfidenceBucket(suggestion.confidence);
  const confConfig = CONFIDENCE_LABEL[bucket];
  const reasons = (suggestion.reasons || []).slice(0, 3);

  return (
    <div className={`rounded border ${config.borderColor} ${config.bgColor} overflow-hidden`}>
      {/* Header row */}
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <div className="flex items-center gap-1 shrink-0">
          <Sparkles className="h-3 w-3 text-blue-400" />
          <span className={`text-[10px] font-semibold ${config.labelColor}`}>{config.label}</span>
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-medium text-slate-700 truncate block">{suggestion.title}</span>
        </div>

        <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${confConfig.color}`}>
          {confConfig.label}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {primaryActions.map(action => (
            <Button
              key={action.id}
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] text-blue-300 hover:bg-blue-600/10 border border-blue-600/20"
              onClick={() => onPrimaryAction(action.id)}
            >
              {action.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[10px] text-slate-500 hover:text-slate-600"
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Detail row — reasons + preview (compare, request only) */}
      {(reasons.length > 0 || suggestion.preview) && variant !== "sourcing" && (
        <div className="px-2.5 pb-1.5 flex items-center gap-3 flex-wrap">
          {reasons.map(r => (
            <ReasonChip key={r.id} reason={r} />
          ))}
          {suggestion.preview?.summary && (
            <span className="text-[9px] text-slate-500 ml-auto">
              {suggestion.preview.beforeLabel && <>{suggestion.preview.beforeLabel} → </>}
              {suggestion.preview.afterLabel || suggestion.preview.summary}
            </span>
          )}
        </div>
      )}

      {/* Sourcing: show message as second line if reasons exist */}
      {variant === "sourcing" && suggestion.message && (
        <div className="px-2.5 pb-1.5">
          <span className="text-[10px] text-slate-400">{suggestion.message}</span>
        </div>
      )}
    </div>
  );
}
