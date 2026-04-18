"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TYPOGRAPHY, SPACING, SURFACE } from "@/lib/work-queue/console-visual-grammar";
import {
  DAILY_REVIEW_CATEGORY_LABELS,
  ESCALATION_ACTION_LABELS,
  REVIEW_OUTCOME_LABELS,
} from "@/lib/work-queue/console-daily-review";
import type { DailyReviewItem } from "@/lib/work-queue/console-daily-review";

interface DailyReviewRowProps {
  reviewItem: DailyReviewItem;
  onEscalation: (actionId: string) => void;
  onReviewOutcome: (outcomeId: string) => void;
  isPending: boolean;
}

/** Daily review category → severity border color */
const CATEGORY_BORDER: Record<string, string> = {
  urgent_now: "border-l-red-500",
  overdue_owned: "border-l-orange-400",
  blocked_too_long: "border-l-amber-400",
  handoff_not_accepted: "border-l-purple-400",
  urgent_unassigned: "border-l-yellow-400",
  recently_resolved: "border-l-green-300",
  needs_lead_intervention: "border-l-rose-400",
};

export function DailyReviewRow({ reviewItem, onEscalation, onReviewOutcome, isPending }: DailyReviewRowProps) {
  const borderColor = CATEGORY_BORDER[reviewItem.category] ?? "border-l-gray-200";
  const primaryAction = reviewItem.availableEscalationActions[0] ?? reviewItem.availableReviewOutcomes[0];
  const isPrimaryEscalation = reviewItem.availableEscalationActions.length > 0;

  return (
    <div className={cn("flex items-center border-l-[3px]", borderColor, SURFACE.row, SPACING.rowPadding)}>
      {/* Title */}
      <div className="flex-1 min-w-0 mr-3">
        <div className={cn(TYPOGRAPHY.rowTitle, "truncate")}>{reviewItem.item.title}</div>
      </div>

      {/* Category label */}
      <div className={cn("w-24 text-center flex-shrink-0", TYPOGRAPHY.metadata)}>
        {DAILY_REVIEW_CATEGORY_LABELS[reviewItem.category]}
      </div>

      {/* Carry-over */}
      <div className="w-16 text-center flex-shrink-0">
        {reviewItem.carryOver ? (
          <Badge
            variant={reviewItem.carryOver.severityPromoted ? "destructive" : "outline"}
            className={TYPOGRAPHY.badge}
          >
            이월 {reviewItem.carryOver.dayCount}일
          </Badge>
        ) : null}
      </div>

      {/* Escalation count */}
      <div className="w-12 text-center flex-shrink-0">
        {reviewItem.escalations.length > 0 && (
          <Badge variant="destructive" className={TYPOGRAPHY.badge}>
            {reviewItem.escalations.length}
          </Badge>
        )}
      </div>

      {/* Primary CTA */}
      <div className="w-28 text-right flex-shrink-0 ml-2">
        {primaryAction && (
          <Button
            size="sm"
            variant={isPrimaryEscalation ? "destructive" : "outline"}
            className={cn(TYPOGRAPHY.cta, "h-7")}
            disabled={isPending}
            onClick={(e) => {
              e.stopPropagation();
              if (isPrimaryEscalation) {
                onEscalation(primaryAction);
              } else {
                onReviewOutcome(primaryAction);
              }
            }}
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isPrimaryEscalation ? (
              (ESCALATION_ACTION_LABELS as Record<string, string>)[primaryAction]
            ) : (
              (REVIEW_OUTCOME_LABELS as Record<string, string>)[primaryAction]
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Daily review column header */
export function DailyReviewColumnHeader() {
  return (
    <div className={cn("flex items-center border-l-[3px] border-l-transparent", SPACING.rowPadding, "border-b pb-1")}>
      <div className={cn("flex-1 min-w-0 mr-3", TYPOGRAPHY.metadata)}>항목</div>
      <div className={cn("w-24 text-center flex-shrink-0", TYPOGRAPHY.metadata)}>분류</div>
      <div className={cn("w-16 text-center flex-shrink-0", TYPOGRAPHY.metadata)}>이월</div>
      <div className={cn("w-12 text-center flex-shrink-0", TYPOGRAPHY.metadata)}>에스컬</div>
      <div className="w-28 flex-shrink-0 ml-2" />
    </div>
  );
}
