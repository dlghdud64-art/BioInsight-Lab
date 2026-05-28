"use client";

import { CheckCircle2, AlertTriangle, XCircle, Loader2, Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { EDGE_STATE_MESSAGES, type EdgeStateId } from "@/lib/work-queue/console-v1-productization";

const ICON_MAP = {
  empty: Inbox,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  loading: Loader2,
} as const;

interface ConsoleEmptyStateProps {
  stateId: EdgeStateId;
  className?: string;
}

export function ConsoleEmptyState({ stateId, className }: ConsoleEmptyStateProps) {
  const message = EDGE_STATE_MESSAGES[stateId];
  const Icon = ICON_MAP[message.icon];

  return (
    <EmptyState
      icon={Icon}
      title={message.title}
      description={message.description}
      className={className}
    />
  );
}
