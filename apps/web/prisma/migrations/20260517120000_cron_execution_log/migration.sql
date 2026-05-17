-- #cron-monitoring-admin-dashboard — Vercel cron 실행 history table.
--
-- 호영님 backlog audit P0 (b). §11.250b-fix (vercel.json registry completion)
-- 같은 dead cron 사건 사전 감지 = production critical 운영 가치.
--
-- 각 cron route handler 를 logCronExecution wrapper 으로 감싸면 본 table 에
-- INSERT. admin/cron page 가 본 table 을 시각화 (last execution / success rate
-- / p95 duration / recent failures).
--
-- FK 강제 0 — cron 자체는 anonymous 운영 telemetry. errorMessage TEXT
-- (truncate optional). metadata JSONB (handler 결과 또는 contextual data).
-- IF NOT EXISTS 패턴 (idempotent, RumMetric 패턴 reuse).

CREATE TABLE IF NOT EXISTS "CronExecutionLog" (
  "id"           TEXT NOT NULL,
  "cronPath"     TEXT NOT NULL,
  "startedAt"    TIMESTAMP(3) NOT NULL,
  "completedAt"  TIMESTAMP(3),
  "durationMs"   INTEGER NOT NULL,
  "success"      BOOLEAN NOT NULL,
  "errorMessage" TEXT,
  "metadata"     JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CronExecutionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CronExecutionLog_cronPath_idx"  ON "CronExecutionLog"("cronPath");
CREATE INDEX IF NOT EXISTS "CronExecutionLog_startedAt_idx" ON "CronExecutionLog"("startedAt");
CREATE INDEX IF NOT EXISTS "CronExecutionLog_success_idx"   ON "CronExecutionLog"("success");
