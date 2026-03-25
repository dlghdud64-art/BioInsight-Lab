"use client";

/**
 * SuggestionPanel — 공통 AI suggestion 표시 컴포넌트
 *
 * 규칙:
 * - compact strip/block 형태만
 * - full-width banner 금지
 * - 한 화면에 최대 1개만 렌더
 */
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import type { AiSuggestion } from "@/lib/ai/suggestion-engine";

type SuggestionPanelProps = {
  suggestion: AiSuggestion | null;
  variant: "sourcing" | "compare" | "request";
  onAcceptAction: (actionId: string) => void;
  onDismiss: () => void;
  onEdit?: () => void;
};

const VARIANT_CONFIG = {
  sourcing: { label: "AI 제안", labelColor: "text-blue-400", borderColor: "border-blue-600/20", bgColor: "bg-blue-600/5" },
  compare: { label: "AI 판단", labelColor: "text-blue-300", borderColor: "border-blue-600/20", bgColor: "bg-blue-600/5" },
  request: { label: "AI 초안", labelColor: "text-blue-300", borderColor: "border-blue-600/20", bgColor: "bg-blue-600/5" },
} as const;

export function SuggestionPanel({ suggestion, variant, onAcceptAction, onDismiss }: SuggestionPanelProps) {
  if (!suggestion || suggestion.status === "dismissed") return null;

  const config = VARIANT_CONFIG[variant];
  const primaryActions = suggestion.actions.filter(a => a.type !== "dismiss");
  const dismissAction = suggestion.actions.find(a => a.type === "dismiss");

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded border ${config.borderColor} ${config.bgColor}`}>
      {/* Label */}
      <div className="flex items-center gap-1 shrink-0">
        <Sparkles className="h-3 w-3 text-blue-400" />
        <span className={`text-[10px] font-semibold ${config.labelColor} shrink-0`}>{config.label}</span>
      </div>

      {/* Title + Message */}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-medium text-slate-200 truncate block">{suggestion.title}</span>
        {variant !== "sourcing" && (
          <span className="text-[10px] text-slate-400 truncate block">{suggestion.message}</span>
        )}
      </div>

      {/* Confidence */}
      {suggestion.confidence >= 0.8 && (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 shrink-0">
          높음
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {primaryActions.map(action => (
          <Button
            key={action.id}
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] text-blue-300 hover:bg-blue-600/10 border border-blue-600/20"
            onClick={() => onAcceptAction(action.id)}
          >
            {action.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px] text-slate-500 hover:text-slate-300"
          onClick={onDismiss}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
