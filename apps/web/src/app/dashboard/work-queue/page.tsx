"use client";

import { WorkQueueConsole } from "@/components/dashboard/work-queue-console";
import { Clock } from "lucide-react";

export default function WorkQueuePage() {
  const now = new Date();
  const timeStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div>
      {/* Operational Context Strip */}
      <div className="flex items-center gap-3 border rounded-md px-3 py-1.5 bg-muted/30 mx-6 mt-6 mb-0">
        <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-[11px] text-muted-foreground">
          마지막 동기화: {timeStr}
        </span>
      </div>
      <WorkQueueConsole />
    </div>
  );
}
