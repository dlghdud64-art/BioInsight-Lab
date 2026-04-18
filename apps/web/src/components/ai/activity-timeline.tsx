"use client";

import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Mail,
  AlertTriangle,
  Sparkles,
  Eye,
} from "lucide-react";
import {
  useEntityActivityLogs,
  ACTIVITY_TYPE_LABELS,
  STATUS_LABELS,
  type ActivityLogEntry,
} from "@/hooks/use-activity-logs";

// ── 아이콘 매핑 ──

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  AI_TASK_CREATED: <Sparkles className="h-3.5 w-3.5 text-blue-500" />,
  AI_TASK_OPENED: <Eye className="h-3.5 w-3.5 text-gray-500" />,
  QUOTE_DRAFT_GENERATED: <FileText className="h-3.5 w-3.5 text-blue-500" />,
  QUOTE_DRAFT_REVIEWED: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  EMAIL_DRAFT_GENERATED: <Mail className="h-3.5 w-3.5 text-purple-500" />,
  EMAIL_SENT: <Mail className="h-3.5 w-3.5 text-green-500" />,
  AI_TASK_COMPLETED: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  AI_TASK_FAILED: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  INVENTORY_RESTOCK_SUGGESTED: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
  INVENTORY_RESTOCK_REVIEWED: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
};

function getIcon(activityType: string) {
  return ACTIVITY_ICONS[activityType] || <Clock className="h-3.5 w-3.5 text-gray-400" />;
}

function formatStatusTransition(entry: ActivityLogEntry): string {
  if (entry.beforeStatus && entry.afterStatus) {
    const before = STATUS_LABELS[entry.beforeStatus] || entry.beforeStatus;
    const after = STATUS_LABELS[entry.afterStatus] || entry.afterStatus;
    return `${before} → ${after}`;
  }
  if (entry.afterStatus) {
    return STATUS_LABELS[entry.afterStatus] || entry.afterStatus;
  }
  return "";
}

// ── ActivityTimeline: 상세 화면용 최근 활동 (3건) ──

interface ActivityTimelineProps {
  entityType: string;
  entityId: string | null | undefined;
  limit?: number;
  className?: string;
}

export function ActivityTimeline({
  entityType,
  entityId,
  limit = 3,
  className = "",
}: ActivityTimelineProps) {
  const { data, isLoading } = useEntityActivityLogs(entityType, entityId, {
    limit,
  });

  if (isLoading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 animate-pulse">
            <div className="h-3.5 w-3.5 rounded-full bg-gray-200" />
            <div className="h-3 w-32 rounded bg-gray-200" />
            <div className="h-3 w-16 rounded bg-el ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  const logs = data?.logs || [];

  if (logs.length === 0) {
    return (
      <div className={`text-xs text-muted-foreground ${className}`}>
        활동 기록이 없습니다.
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {logs.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-2 text-xs"
        >
          {getIcon(entry.activityType)}
          <span className="text-foreground truncate">
            {ACTIVITY_TYPE_LABELS[entry.activityType] || entry.activityType}
          </span>
          {entry.beforeStatus && entry.afterStatus && (
            <span className="text-muted-foreground flex-shrink-0">
              ({formatStatusTransition(entry)})
            </span>
          )}
          <span className="text-muted-foreground ml-auto flex-shrink-0">
            {formatDistanceToNow(new Date(entry.createdAt), {
              addSuffix: true,
              locale: ko,
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── ActivityStatusLine: 대시보드 카드용 1줄 요약 ──

interface ActivityStatusLineProps {
  entityType: string;
  entityId: string | null | undefined;
  className?: string;
}

export function ActivityStatusLine({
  entityType,
  entityId,
  className = "",
}: ActivityStatusLineProps) {
  const { data } = useEntityActivityLogs(entityType, entityId, {
    limit: 1,
  });

  const latest = data?.logs?.[0];
  if (!latest) return null;

  const label = ACTIVITY_TYPE_LABELS[latest.activityType] || latest.activityType;
  const time = formatDistanceToNow(new Date(latest.createdAt), {
    addSuffix: true,
    locale: ko,
  });
  const statusStr = formatStatusTransition(latest);

  return (
    <div className={`flex items-center gap-1.5 text-[11px] text-muted-foreground ${className}`}>
      {getIcon(latest.activityType)}
      <span className="truncate">
        {label}
        {statusStr && ` (${statusStr})`}
      </span>
      <span className="flex-shrink-0">{time}</span>
    </div>
  );
}
