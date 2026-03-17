"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { TYPOGRAPHY, SPACING, SURFACE, SEVERITY_INDICATORS } from "@/lib/work-queue/console-visual-grammar";
import { OWNER_ROLE_LABELS } from "@/lib/work-queue/console-grouping";
import { ASSIGNMENT_STATE_LABELS } from "@/lib/work-queue/console-assignment";
import { PRIORITY_TIER_DEFS } from "@/lib/work-queue/console-priorities";
import { formatRelativeTime } from "@/lib/work-queue/console-v1-productization";
import { TASK_STATUS_BADGE, type TaskStatus } from "@/hooks/use-work-queue";
import type { GroupedItem } from "@/lib/work-queue/console-grouping";
import type { PriorityTier } from "@/lib/work-queue/console-priorities";

interface QueueDetailPanelProps {
  item: GroupedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCtaClick: (item: GroupedItem) => void;
  onAssignmentAction: (itemId: string, action: string) => void;
  isPending?: boolean;
}

export function QueueDetailPanel({
  item,
  open,
  onOpenChange,
  onCtaClick,
  onAssignmentAction,
  isPending,
}: QueueDetailPanelProps) {
  const router = useRouter();

  if (!item) return null;

  const severity = SEVERITY_INDICATORS[item.priorityTier as PriorityTier] ?? SEVERITY_INDICATORS.monitoring;
  const tierDef = PRIORITY_TIER_DEFS[item.priorityTier as PriorityTier];
  const statusBadge = TASK_STATUS_BADGE[item.taskStatus as TaskStatus];
  const age = formatRelativeTime(item.updatedAt);

  const navigateToEntity = () => {
    const { relatedEntityType, relatedEntityId } = item;
    if (!relatedEntityType || !relatedEntityId) return;
    const pathMap: Record<string, string> = {
      QUOTE: "/dashboard/quotes",
      ORDER: "/dashboard/orders",
      INVENTORY_RESTOCK: "/dashboard/inventory",
      PURCHASE_REQUEST: "/dashboard/purchases",
      COMPARE_SESSION: "/dashboard/compare",
    };
    const basePath = pathMap[relatedEntityType];
    if (basePath) {
      router.push(`${basePath}?entity_id=${relatedEntityId}&scroll_to=ops_context`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] overflow-y-auto">
        {/* Header */}
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-2">
            <div className={cn("w-1 h-8 rounded-full", severity.borderColor.replace("border-l-", "bg-"))} />
            <div className="flex-1 min-w-0">
              <SheetTitle className={cn(TYPOGRAPHY.rowTitle, "truncate")}>{item.title}</SheetTitle>
              <SheetDescription className={TYPOGRAPHY.metadata}>
                {item.relatedEntityType} · 점수 {item.totalScore}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className={cn("space-y-5 pt-4", SPACING.panelPadding)}>
          {/* §1: Current State + Owner */}
          <Section title="상태 · 배정">
            <MetaRow label="상태">
              {statusBadge && (
                <Badge variant="outline" className={TYPOGRAPHY.badge}>
                  {statusBadge.label}
                </Badge>
              )}
            </MetaRow>
            <MetaRow label="배정">
              <Badge variant="outline" className={TYPOGRAPHY.badge}>
                {ASSIGNMENT_STATE_LABELS[item.assignmentState] ?? item.assignmentState}
              </Badge>
            </MetaRow>
            <MetaRow label="담당 역할">
              <span className={TYPOGRAPHY.metadata}>
                {OWNER_ROLE_LABELS[item.ownerRole] ?? item.ownerRole}
              </span>
            </MetaRow>
            {item.shouldActorAct && (
              <MetaRow label="조치 필요">
                <Badge variant="destructive" className={TYPOGRAPHY.badge}>즉시 조치</Badge>
              </MetaRow>
            )}
          </Section>

          {/* §2: Why Here / Trust */}
          <Section title="이 항목이 여기 있는 이유">
            <div className={cn(SURFACE.alertStrip, severity.borderColor)}>
              <p className={cn(TYPOGRAPHY.metadata, severity.textColor)}>
                {item.urgencyReason || tierDef?.description || tierDef?.label || "일반 모니터링"}
              </p>
            </div>
            <MetaRow label="우선순위 티어">
              <span className={cn(TYPOGRAPHY.metadata, severity.textColor)}>
                {tierDef?.label ?? item.priorityTier}
              </span>
            </MetaRow>
          </Section>

          {/* §3: SLA / Age */}
          <Section title="시간 · SLA">
            <MetaRow label="최종 갱신">
              <span className={TYPOGRAPHY.timestamp}>{age}</span>
            </MetaRow>
            {item.nextQueueLabel && (
              <MetaRow label="다음 단계">
                <span className={TYPOGRAPHY.metadata}>{item.nextQueueLabel}</span>
              </MetaRow>
            )}
          </Section>

          {/* §4: Handoff / Evidence */}
          {item.handoffInfo && (
            <Section title="인수인계 정보">
              <div className={cn(SURFACE.alertStrip, "border-l-purple-400")}>
                <p className={cn(TYPOGRAPHY.metadata, "text-purple-700 font-medium")}>
                  사유: {item.handoffInfo.note}
                </p>
                {item.handoffInfo.nextAction && (
                  <p className={cn(TYPOGRAPHY.metadata, "text-purple-400 mt-1")}>
                    다음 조치: {item.handoffInfo.nextAction}
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* §5: Actions */}
          <Section title="작업">
            <div className={cn("flex flex-wrap", SPACING.ctaCluster)}>
              {/* Primary CTA */}
              <Button
                size="sm"
                variant="default"
                className={cn(TYPOGRAPHY.cta, "h-8")}
                disabled={isPending}
                onClick={() => onCtaClick(item)}
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                {item.primaryCtaLabel}
              </Button>

              {/* Secondary assignment actions */}
              {item.assignmentState === "unassigned" && (
                <Button size="sm" variant="outline" className={cn(TYPOGRAPHY.cta, "h-8")}
                  disabled={isPending}
                  onClick={() => onAssignmentAction(item.id, "claim")}>
                  담당
                </Button>
              )}
              {item.assignmentState === "assigned" && (
                <Button size="sm" variant="outline" className={cn(TYPOGRAPHY.cta, "h-8")}
                  disabled={isPending}
                  onClick={() => onAssignmentAction(item.id, "mark_in_progress")}>
                  진행 시작
                </Button>
              )}
              {item.assignmentState === "handed_off" && (
                <Button size="sm" variant="outline" className={cn(TYPOGRAPHY.cta, "h-8")}
                  disabled={isPending}
                  onClick={() => onAssignmentAction(item.id, "claim")}>
                  담당 인수
                </Button>
              )}
            </div>
          </Section>

          {/* §6: Navigation */}
          {item.relatedEntityType && item.relatedEntityId && (
            <Section title="연결">
              <Button
                size="sm"
                variant="ghost"
                className={cn(TYPOGRAPHY.cta, "h-8")}
                onClick={navigateToEntity}
              >
                상세 페이지로 이동 →
              </Button>
            </Section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Internal helpers ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className={TYPOGRAPHY.sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={TYPOGRAPHY.metadata}>{label}</span>
      {children}
    </div>
  );
}
