"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TYPOGRAPHY, SPACING, SURFACE } from "@/lib/work-queue/console-visual-grammar";
import {
  BOTTLENECK_CLASS_LABELS,
  REMEDIATION_STATUS_LABELS,
} from "@/lib/work-queue/console-bottleneck-remediation";
import type {
  DetectedBottleneck,
  RemediationItem,
  RemediationConsoleView as RemediationConsoleViewType,
  RemediationReportSignals,
} from "@/lib/work-queue/console-bottleneck-remediation";
import {
  useBottleneckRemediation,
  useRemediationAction,
} from "@/hooks/use-work-queue";

/** Severity → left border color */
const SEVERITY_BORDER: Record<string, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-400",
  medium: "border-l-yellow-400",
  low: "border-l-gray-200",
};

export function RemediationView() {
  const { data, isLoading } = useBottleneckRemediation();
  const remAction = useRemediationAction();

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>개선 데이터 로딩 중...</span>
      </div>
    );
  }

  const { bottlenecks, consoleView, reportSignals } = data;
  const activeBottlenecks = bottlenecks.filter(
    (b: DetectedBottleneck) => b.metricValue > 0 && b.severity !== "low",
  );

  return (
    <div className={SPACING.sectionGap}>
      {/* Summary Strip */}
      <div className={cn("flex gap-6 border rounded-md", SPACING.stripPadding)}>
        <StatCell label="열린 개선" value={consoleView.openCount} warn={consoleView.openCount > 0} />
        <StatCell label="고심각도" value={consoleView.highSeverityCount} warn={consoleView.highSeverityCount > 0} />
        <StatCell label="기한 초과" value={consoleView.overdueCount} warn={consoleView.overdueCount > 0} />
        <StatCell label="임박" value={consoleView.dueSoonCount} warn={false} />
      </div>

      {/* Active Bottlenecks Table */}
      {activeBottlenecks.length > 0 && (
        <section>
          <h3 className={cn(TYPOGRAPHY.sectionTitle, "mb-3")}>탐지된 병목</h3>
          <div className={SURFACE.primary}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={TYPOGRAPHY.metadata}>유형</TableHead>
                  <TableHead className={cn(TYPOGRAPHY.metadata, "text-center")}>심각도</TableHead>
                  <TableHead className={TYPOGRAPHY.metadata}>상세</TableHead>
                  <TableHead className={cn(TYPOGRAPHY.metadata, "text-center")}>개선 연결</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeBottlenecks.map((b: DetectedBottleneck, i: number) => (
                  <TableRow
                    key={`${b.bottleneckType}-${i}`}
                    className={cn("border-l-[3px]", SEVERITY_BORDER[b.severity] ?? "")}
                  >
                    <TableCell className={TYPOGRAPHY.rowTitle}>
                      {BOTTLENECK_CLASS_LABELS[b.bottleneckType]}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={b.remediationRequired ? "destructive" : "outline"} className={TYPOGRAPHY.badge}>
                        {b.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className={TYPOGRAPHY.metadata}>{b.detail}</TableCell>
                    <TableCell className={cn("text-center", TYPOGRAPHY.metadata)}>
                      {b.existingRemediationId ? (
                        <span className="text-blue-600">진행 중</span>
                      ) : b.remediationRequired ? (
                        <span className="text-red-600">필요</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Linked Remediations Table */}
      {consoleView.linkedToCurrentHotspots.length > 0 && (
        <section>
          <h3 className={cn(TYPOGRAPHY.sectionTitle, "mb-3")}>현재 핫스팟 연결 개선</h3>
          <div className={SURFACE.primary}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={TYPOGRAPHY.metadata}>요약</TableHead>
                  <TableHead className={TYPOGRAPHY.metadata}>병목 유형</TableHead>
                  <TableHead className={TYPOGRAPHY.metadata}>담당</TableHead>
                  <TableHead className={cn(TYPOGRAPHY.metadata, "text-center")}>상태</TableHead>
                  <TableHead className={cn(TYPOGRAPHY.metadata, "text-right")}>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consoleView.linkedToCurrentHotspots.map((r: RemediationItem) => (
                  <RemediationRow key={r.remediationId} item={r} onTransition={remAction.mutate} isPending={remAction.isPending} />
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Recently Resolved */}
      {consoleView.recentlyResolved.length > 0 && (
        <section>
          <h3 className={cn(TYPOGRAPHY.sectionTitle, "mb-3")}>최근 해결</h3>
          <div className={SURFACE.primary}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={TYPOGRAPHY.metadata}>요약</TableHead>
                  <TableHead className={TYPOGRAPHY.metadata}>병목 유형</TableHead>
                  <TableHead className={TYPOGRAPHY.metadata}>비고</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consoleView.recentlyResolved.map((r: RemediationItem) => (
                  <TableRow key={r.remediationId} className="border-l-[3px] border-l-green-300">
                    <TableCell className={TYPOGRAPHY.rowTitle}>{r.summary}</TableCell>
                    <TableCell className={TYPOGRAPHY.metadata}>{BOTTLENECK_CLASS_LABELS[r.bottleneckType]}</TableCell>
                    <TableCell className={TYPOGRAPHY.metadata}>{r.resolutionNote ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Report Signals Strip */}
      <section>
        <h3 className={cn(TYPOGRAPHY.sectionTitle, "mb-3")}>개선 루프 신호</h3>
        <div className={cn("flex gap-6 border rounded-md", SPACING.stripPadding)}>
          <StatCell label="반복 핫스팟" value={reportSignals.recurringHotspotCount} warn={reportSignals.recurringHotspotCount > 0} />
          <StatCell label="개선 없는 핫스팟" value={reportSignals.hotspotWithoutRemediationCount} warn={reportSignals.hotspotWithoutRemediationCount > 0} />
          <StatCell label="개선 후 재발" value={reportSignals.hotspotRecurrenceAfterRemediationCount} warn={reportSignals.hotspotRecurrenceAfterRemediationCount > 0} />
        </div>
      </section>
    </div>
  );
}

// ── Internal components ──

function StatCell({ label, value, warn }: { label: string; value: number; warn: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className={TYPOGRAPHY.metadata}>{label}</span>
      <span className={cn("text-lg font-bold tabular-nums", warn ? "text-red-600" : "text-foreground")}>{value}</span>
    </div>
  );
}

function RemediationRow({ item, onTransition, isPending }: {
  item: RemediationItem;
  onTransition: (params: { action: "transition"; remediationId: string; newStatus: string }) => void;
  isPending: boolean;
}) {
  const borderColor = SEVERITY_BORDER[item.severity] ?? "";
  return (
    <TableRow className={cn("border-l-[3px]", borderColor)}>
      <TableCell className={TYPOGRAPHY.rowTitle}>{item.summary}</TableCell>
      <TableCell className={TYPOGRAPHY.metadata}>{BOTTLENECK_CLASS_LABELS[item.bottleneckType]}</TableCell>
      <TableCell className={TYPOGRAPHY.metadata}>{item.owner}</TableCell>
      <TableCell className="text-center">
        <Badge variant="outline" className={TYPOGRAPHY.badge}>
          {REMEDIATION_STATUS_LABELS[item.status]}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className={cn("flex justify-end", SPACING.ctaCluster)}>
          {item.status === "open" && (
            <Button size="sm" variant="outline" className={cn(TYPOGRAPHY.cta, "h-6")} disabled={isPending}
              onClick={() => onTransition({ action: "transition", remediationId: item.remediationId, newStatus: "in_progress" })}>
              착수
            </Button>
          )}
          {(item.status === "open" || item.status === "in_progress") && (
            <Button size="sm" variant="outline" className={cn(TYPOGRAPHY.cta, "h-6")} disabled={isPending}
              onClick={() => onTransition({ action: "transition", remediationId: item.remediationId, newStatus: "resolved" })}>
              해결
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
