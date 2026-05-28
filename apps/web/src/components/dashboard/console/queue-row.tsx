"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TYPOGRAPHY, SPACING, SURFACE, SEVERITY_INDICATORS } from "@/lib/work-queue/console-visual-grammar";
import { OWNER_ROLE_LABELS } from "@/lib/work-queue/console-grouping";
import { ASSIGNMENT_STATE_LABELS } from "@/lib/work-queue/console-assignment";
import { formatRelativeTime } from "@/lib/work-queue/console-v1-productization";
import { PRIORITY_TIER_DEFS } from "@/lib/work-queue/console-priorities";
import type { GroupedItem } from "@/lib/work-queue/console-grouping";
import type { PriorityTier } from "@/lib/work-queue/console-priorities";

interface QueueRowProps {
  item: GroupedItem;
  onSelect: (item: GroupedItem) => void;
  onCtaClick: (item: GroupedItem) => void;
  isSelected?: boolean;
  isPending?: boolean;
}

export function QueueRow({ item, onSelect, onCtaClick, isSelected, isPending }: QueueRowProps) {
  const severity = SEVERITY_INDICATORS[item.priorityTier as PriorityTier] ?? SEVERITY_INDICATORS.monitoring;
  const tierDef = PRIORITY_TIER_DEFS[item.priorityTier as PriorityTier];
  const whyHere = item.urgencyReason || tierDef?.label || "";
  const age = formatRelativeTime(item.updatedAt);

  return (
    <div
      role="row"
      onClick={() => onSelect(item)}
      className={cn(
        "flex items-center border-l-[3px]",
        severity.borderColor,
        isSelected ? SURFACE.rowSelected : SURFACE.row,
        SPACING.rowPadding,
      )}
    >
      {/* Title + entity type */}
      <div className="flex-1 min-w-0 mr-3">
        <div className={cn(TYPOGRAPHY.rowTitle, "truncate")}>{item.title}</div>
        {item.relatedEntityType && (
          <span className={cn(TYPOGRAPHY.metadata, "block truncate")}>
            {item.relatedEntityType}
          </span>
        )}
      </div>

      {/* Assignment state */}
      <div className="w-20 text-center flex-shrink-0">
        <Badge variant="outline" className={cn(TYPOGRAPHY.badge, "whitespace-nowrap")}>
          {ASSIGNMENT_STATE_LABELS[item.assignmentState] ?? item.assignmentState}
        </Badge>
      </div>

      {/* Owner */}
      <div className={cn("w-16 text-center flex-shrink-0", TYPOGRAPHY.metadata)}>
        {OWNER_ROLE_LABELS[item.ownerRole] ?? item.ownerRole}
      </div>

      {/* Why here */}
      <div className={cn("w-32 flex-shrink-0 truncate", TYPOGRAPHY.metadata, severity.textColor)}>
        {whyHere}
      </div>

      {/* Age */}
      <div className={cn("w-16 text-right flex-shrink-0", TYPOGRAPHY.timestamp)}>
        {age}
      </div>

      {/* Primary CTA */}
      <div className="w-24 text-right flex-shrink-0 ml-2">
        <Button
          size="sm"
          variant="default"
          className={cn(TYPOGRAPHY.cta, "h-7")}
          disabled={isPending}
          onClick={(e) => {
            e.stopPropagation();
            onCtaClick(item);
          }}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            item.primaryCtaLabel
          )}
        </Button>
      </div>
    </div>
  );
}

/** Queue column header */
export function QueueColumnHeader() {
  return (
    <div className={cn("flex items-center border-l-[3px] border-l-transparent", SPACING.rowPadding, "border-b pb-1")}>
      <div className={cn("flex-1 min-w-0 mr-3", TYPOGRAPHY.metadata)}>항목</div>
      <div className={cn("w-20 text-center flex-shrink-0", TYPOGRAPHY.metadata)}>상태</div>
      <div className={cn("w-16 text-center flex-shrink-0", TYPOGRAPHY.metadata)}>담당</div>
      <div className={cn("w-32 flex-shrink-0", TYPOGRAPHY.metadata)}>사유</div>
      <div className={cn("w-16 text-right flex-shrink-0", TYPOGRAPHY.metadata)}>경과</div>
      <div className="w-24 flex-shrink-0 ml-2" />
    </div>
  );
}
