"use client";

import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
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

/**
 * §11.143 #operational-brief-rail-work-queue
 *
 * §11.142 lock 패턴 적용:
 * - "운영 브리핑" 헤더 + "선택한 작업" object label
 * - 4 preset chips (상태 요약 / 긴급 사유 / 인수인계 / 다음 단계)
 * - 4 section: 상황 요약 / 핵심 근거 / 리스크 / 다음 조치
 * - Primary CTA = item.primaryCtaLabel (canonical, no AI 재해석)
 * - Sheet drawer 유지 (same-canvas)
 * - chatbot input 0 (자유 채팅창 금지)
 */

interface QueueDetailPanelProps {
  item: GroupedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCtaClick: (item: GroupedItem) => void;
  onAssignmentAction: (itemId: string, action: string) => void;
  isPending?: boolean;
}

type BriefSectionId = "summary" | "facts" | "risks" | "next";

const PRESET_CHIPS: { id: BriefSectionId; label: string }[] = [
  { id: "summary", label: "상태 요약" },
  { id: "facts",   label: "긴급 사유" },
  { id: "risks",   label: "인수인계" },
  { id: "next",    label: "다음 단계" },
];

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
  const ownerLabel = OWNER_ROLE_LABELS[item.ownerRole] ?? item.ownerRole;
  const assignmentLabel = ASSIGNMENT_STATE_LABELS[item.assignmentState] ?? item.assignmentState;

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

  const scrollToBrief = (id: BriefSectionId) => {
    const el = document.getElementById(`brief-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 1-line resolver-derived 상황 요약
  const situationOneLiner = `${ownerLabel} · ${statusBadge?.label ?? item.taskStatus} · ${assignmentLabel}${
    item.shouldActorAct ? " · 즉시 조치" : ""
  }`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] overflow-y-auto">
        {/* ── Brief Header (§11.142 lock) ── */}
        <SheetHeader className="pb-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className={cn(TYPOGRAPHY.sectionTitle, "text-base font-semibold")}>
              운영 브리핑
            </SheetTitle>
            <span className={cn(TYPOGRAPHY.metadata, "text-[10px] uppercase tracking-wide text-muted-foreground")}>
              선택한 작업
            </span>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className={cn("w-1 h-7 rounded-full", severity.borderColor.replace("border-l-", "bg-"))} />
            <SheetDescription className={cn(TYPOGRAPHY.rowTitle, "truncate text-foreground font-medium")}>
              {item.title}
            </SheetDescription>
          </div>
        </SheetHeader>

        {/* ── Preset chips (jump to section) ── */}
        <div className="flex flex-wrap gap-1.5 pt-3">
          {PRESET_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => scrollToBrief(chip.id)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium",
                "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className={cn("space-y-5 pt-4", SPACING.panelPadding)}>
          {/* ── § 1. 상황 요약 ── */}
          <BriefSection id="summary" title="상황 요약">
            <p className={cn(TYPOGRAPHY.metadata, "text-foreground leading-relaxed")}>
              {situationOneLiner}
            </p>
          </BriefSection>

          {/* ── § 2. 핵심 근거 ── */}
          <BriefSection id="facts" title="핵심 근거">
            <div className="space-y-1">
              <MetaRow label="상태">
                {statusBadge && (
                  <Badge variant="outline" className={TYPOGRAPHY.badge}>
                    {statusBadge.label}
                  </Badge>
                )}
              </MetaRow>
              <MetaRow label="배정">
                <Badge variant="outline" className={TYPOGRAPHY.badge}>{assignmentLabel}</Badge>
              </MetaRow>
              <MetaRow label="담당 역할">
                <span className={TYPOGRAPHY.metadata}>{ownerLabel}</span>
              </MetaRow>
              <MetaRow label="우선순위">
                <span className={cn(TYPOGRAPHY.metadata, severity.textColor)}>
                  {tierDef?.label ?? item.priorityTier}
                </span>
              </MetaRow>
              <MetaRow label="최종 갱신">
                <span className={TYPOGRAPHY.timestamp}>{age}</span>
              </MetaRow>
            </div>
          </BriefSection>

          {/* ── § 3. 리스크 ── */}
          <BriefSection id="risks" title="리스크">
            <div className={cn(SURFACE.alertStrip, severity.borderColor)}>
              <p className={cn(TYPOGRAPHY.metadata, severity.textColor)}>
                {item.urgencyReason || tierDef?.description || tierDef?.label || "일반 모니터링"}
              </p>
            </div>
            {item.handoffInfo && (
              <div className={cn(SURFACE.alertStrip, "border-l-purple-400 mt-2")}>
                <p className={cn(TYPOGRAPHY.metadata, "text-purple-700 font-medium")}>
                  인수인계 사유: {item.handoffInfo.note}
                </p>
                {item.handoffInfo.nextAction && (
                  <p className={cn(TYPOGRAPHY.metadata, "text-purple-600 mt-1")}>
                    다음 조치: {item.handoffInfo.nextAction}
                  </p>
                )}
              </div>
            )}
            {item.shouldActorAct && (
              <div className="mt-2">
                <Badge variant="destructive" className={TYPOGRAPHY.badge}>즉시 조치 필요</Badge>
              </div>
            )}
          </BriefSection>

          {/* ── § 4. 다음 조치 ── */}
          <BriefSection id="next" title="다음 조치">
            {item.nextQueueLabel && (
              <MetaRow label="다음 단계">
                <span className={TYPOGRAPHY.metadata}>{item.nextQueueLabel}</span>
              </MetaRow>
            )}

            {/* Primary CTA — canonical truth (no AI 재해석) */}
            <Button
              size="sm"
              variant="default"
              className={cn("w-full justify-center gap-1.5", TYPOGRAPHY.cta, "h-9 mt-2")}
              disabled={isPending}
              onClick={() => onCtaClick(item)}
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {item.primaryCtaLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>

            {/* Secondary assignment actions */}
            <div className={cn("flex flex-wrap pt-2", SPACING.ctaCluster)}>
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
              {item.relatedEntityType && item.relatedEntityId && (
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(TYPOGRAPHY.cta, "h-8")}
                  onClick={navigateToEntity}
                >
                  상세 페이지로 이동 →
                </Button>
              )}
            </div>
          </BriefSection>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Internal helpers ──

function BriefSection({ id, title, children }: { id: BriefSectionId; title: string; children: React.ReactNode }) {
  return (
    <section id={`brief-${id}`} className="space-y-2 scroll-mt-4">
      <h3 className={TYPOGRAPHY.sectionTitle}>{title}</h3>
      {children}
    </section>
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
