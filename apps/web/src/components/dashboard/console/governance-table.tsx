"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TYPOGRAPHY, SPACING, SURFACE } from "@/lib/work-queue/console-visual-grammar";
import {
  CADENCE_STEP_DEFS,
  SLA_CATEGORY_LABELS,
  LEAD_INTERVENTION_LABELS,
  GOVERNANCE_SIGNAL_LABELS,
} from "@/lib/work-queue/console-cadence-governance";
import type {
  GovernanceReport,
  CadenceStatus,
  SLAStatus,
  LeadInterventionTrigger,
  GovernanceSignalValue,
} from "@/lib/work-queue/console-cadence-governance";
import {
  useCadenceGovernance,
  useCadenceStepComplete,
} from "@/hooks/use-work-queue";
import { ConsoleEmptyState } from "./console-empty-state";

export function GovernanceView() {
  const { data: report, isLoading } = useCadenceGovernance();
  const cadenceComplete = useCadenceStepComplete();

  if (isLoading || !report) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>거버넌스 보고서 로딩 중...</span>
      </div>
    );
  }

  const hasInterventions = report.interventionTriggers.some((t: LeadInterventionTrigger) => t.triggered);

  return (
    <div className={SPACING.sectionGap}>
      {/* Cadence Table */}
      <section>
        <h3 className={cn(TYPOGRAPHY.sectionTitle, "mb-3")}>운영 케이던스</h3>
        <div className={SURFACE.primary}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={TYPOGRAPHY.metadata}>단계</TableHead>
                <TableHead className={TYPOGRAPHY.metadata}>설명</TableHead>
                <TableHead className={cn(TYPOGRAPHY.metadata, "text-center")}>대기</TableHead>
                <TableHead className={cn(TYPOGRAPHY.metadata, "text-right")}>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.cadenceStatuses.map((cs: CadenceStatus) => {
                const def = CADENCE_STEP_DEFS[cs.stepId];
                return (
                  <TableRow key={cs.stepId}>
                    <TableCell className={TYPOGRAPHY.rowTitle}>{def.label}</TableCell>
                    <TableCell className={TYPOGRAPHY.metadata}>{cs.description}</TableCell>
                    <TableCell className="text-center">
                      {cs.pendingItemCount > 0 && (
                        <Badge variant="outline" className={TYPOGRAPHY.badge}>
                          {cs.pendingItemCount}건
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {cs.isRelevant ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className={cn(TYPOGRAPHY.cta, "h-7")}
                          disabled={cadenceComplete.isPending}
                          onClick={() => cadenceComplete.mutate({ stepId: cs.stepId })}
                        >
                          {cadenceComplete.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "완료"}
                        </Button>
                      ) : (
                        <Badge variant="secondary" className={TYPOGRAPHY.badge}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />완료
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* SLA Table */}
      <section>
        <h3 className={cn(TYPOGRAPHY.sectionTitle, "mb-3")}>SLA 준수 현황</h3>
        <div className={SURFACE.primary}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={TYPOGRAPHY.metadata}>카테고리</TableHead>
                <TableHead className={cn(TYPOGRAPHY.metadata, "text-center")}>준수율</TableHead>
                <TableHead className={cn(TYPOGRAPHY.metadata, "text-center")}>목표</TableHead>
                <TableHead className={cn(TYPOGRAPHY.metadata, "text-center")}>경고</TableHead>
                <TableHead className={cn(TYPOGRAPHY.metadata, "text-center")}>위반</TableHead>
                <TableHead className={cn(TYPOGRAPHY.metadata, "text-center")}>전체</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.slaStatuses.map((sla: SLAStatus) => {
                const pct = Math.round(sla.complianceRate * 100);
                const isBad = sla.breached > 0;
                return (
                  <TableRow key={sla.categoryId} className={isBad ? "border-l-[3px] border-l-red-500" : ""}>
                    <TableCell className={TYPOGRAPHY.rowTitle}>
                      {SLA_CATEGORY_LABELS[sla.categoryId]}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={isBad ? "destructive" : "secondary"} className={TYPOGRAPHY.badge}>
                        {pct}%
                      </Badge>
                    </TableCell>
                    <TableCell className={cn("text-center", TYPOGRAPHY.timestamp)}>{sla.withinTarget}</TableCell>
                    <TableCell className={cn("text-center", TYPOGRAPHY.timestamp)}>{sla.withinBreach}</TableCell>
                    <TableCell className={cn("text-center", TYPOGRAPHY.timestamp, isBad && "text-red-700 font-medium")}>{sla.breached}</TableCell>
                    <TableCell className={cn("text-center", TYPOGRAPHY.timestamp)}>{sla.totalItems}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Lead Intervention */}
      {hasInterventions && (
        <section>
          <h3 className={cn(TYPOGRAPHY.sectionTitle, "mb-3 text-red-400")}>리드 개입 필요</h3>
          <div className={SURFACE.primary}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={TYPOGRAPHY.metadata}>케이스</TableHead>
                  <TableHead className={TYPOGRAPHY.metadata}>상세</TableHead>
                  <TableHead className={cn(TYPOGRAPHY.metadata, "text-center")}>영향</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.interventionTriggers
                  .filter((t: LeadInterventionTrigger) => t.triggered)
                  .map((t: LeadInterventionTrigger) => (
                    <TableRow key={t.caseId} className="border-l-[3px] border-l-red-500">
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                          <span className={cn(TYPOGRAPHY.rowTitle, "text-red-800")}>
                            {LEAD_INTERVENTION_LABELS[t.caseId]}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className={TYPOGRAPHY.metadata}>{t.detail}</TableCell>
                      <TableCell className={cn("text-center", TYPOGRAPHY.metadata)}>
                        {t.affectedItemIds.length}건
                        {t.affectedUserIds.length > 0 && ` · ${t.affectedUserIds.length}명`}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Governance Signals */}
      <section>
        <h3 className={cn(TYPOGRAPHY.sectionTitle, "mb-3")}>운영 신호</h3>
        <div className={cn("grid gap-3 sm:grid-cols-2")}>
          {report.signals.map((sig: GovernanceSignalValue) => (
            <div
              key={sig.signalId}
              className={cn(
                "flex items-center justify-between border rounded-md",
                SPACING.rowPadding,
                sig.thresholdExceeded ? "border-l-[3px] border-l-orange-400" : "",
              )}
            >
              <span className={TYPOGRAPHY.metadata}>
                {GOVERNANCE_SIGNAL_LABELS[sig.signalId]}
              </span>
              <span className={cn(
                "text-base font-bold tabular-nums",
                sig.thresholdExceeded ? "text-orange-400" : "text-foreground",
              )}>
                {typeof sig.value === "number" && sig.value % 1 !== 0 ? sig.value.toFixed(1) : sig.value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
