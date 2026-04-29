import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit/audit-logger";
import { AuditEventType } from "@prisma/client";

/**
 * §11.138 #admin-user-soft-delete-purge-cron
 *
 * GET /api/cron/user-soft-delete-purge
 *
 * Vercel Cron 으로 daily run. soft-deleted user (deletedAt < 30일 전) 를
 * hard delete (cascade FK). GDPR right-to-be-forgotten 정합 + audit 보존.
 *
 * 흐름:
 *   1. deletedAt IS NOT NULL AND deletedAt < (now - 30 days) user query
 *   2. 각 user 별로 audit log USER_DELETED (action="auto_purge_30d") 기록
 *      후 hard delete (cascade)
 *   3. 실패 시 errors 배열 수집, 다음 user 계속
 *
 * Vercel cron 설정 (vercel.json):
 *   { "path": "/api/cron/user-soft-delete-purge", "schedule": "0 2 * * *" }
 *   매일 새벽 02:00 UTC (한국 시간 11:00 AM 기준 — 운영자 깨어 있는 시간).
 *
 * Auth: CRON_SECRET env 또는 x-vercel-cron-signature header.
 *
 * §11.133 (soft delete) → §11.134 (restore) → §11.138 (auto purge 30일)
 * lifecycle 정형화. GDPR compliance: 30일 cooldown + audit 보존.
 */

const PURGE_AFTER_DAYS = 30;

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const cronHeader = request.headers.get("x-vercel-cron-signature");
      const isAuthorized =
        authHeader === `Bearer ${cronSecret}` || cronHeader != null;
      if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PURGE_AFTER_DAYS);

    // soft-deleted user 중 30일 경과
    const candidates = await db.user.findMany({
      where: {
        deletedAt: {
          not: null,
          lt: cutoff,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        deletedAt: true,
      },
    });

    // §11.141 — fail alert: errors 가 발생하면 critical AuditLog
    // (action=auto_purge_failed) 추가 + console.error. admin/audit 페이지에서
    // 발견 가능. email/Slack 알림은 별도 트랙.
    let purgedCount = 0;
    const errors: { userId: string; error: string }[] = [];

    for (const user of candidates) {
      try {
        // 1) audit log 먼저 (hard delete 후에는 user.id 만 보존)
        await createAuditLog({
          eventType: AuditEventType.USER_DELETED,
          entityType: "User",
          entityId: user.id,
          action: "auto_purge_30d",
          metadata: {
            purgedUserEmail: user.email,
            purgedUserName: user.name,
            purgedUserRole: user.role,
            originalDeletedAt: user.deletedAt?.toISOString() ?? null,
            purgedAt: new Date().toISOString(),
            purgeReasonDays: PURGE_AFTER_DAYS,
          },
          success: true,
        });

        // 2) hard delete (cascade FK)
        await db.user.delete({ where: { id: user.id } });
        purgedCount++;
      } catch (err) {
        errors.push({
          userId: user.id,
          error: err instanceof Error ? err.message : "delete failed",
        });
      }
    }

    // §11.141 — purge 실패 발생 시 critical alert audit log + console.error
    if (errors.length > 0) {
      console.error(
        "[cron/user-soft-delete-purge] FAIL ALERT — purge errors detected",
        { failedCount: errors.length, errors },
      );
      try {
        await createAuditLog({
          eventType: AuditEventType.USER_DELETED,
          entityType: "User",
          action: "auto_purge_failed",
          metadata: {
            cutoff: cutoff.toISOString(),
            candidatesFound: candidates.length,
            purgedCount,
            failedCount: errors.length,
            failedSample: errors.slice(0, 5),
            cronRunAt: new Date().toISOString(),
          },
          success: false,
          errorMessage: `purge cron 부분 실패 — ${errors.length} 명 미처리`,
        });
      } catch (auditErr) {
        console.error("[cron/user-soft-delete-purge] alert audit log 실패", auditErr);
      }
    }

    return NextResponse.json({
      cutoff: cutoff.toISOString(),
      candidatesFound: candidates.length,
      purgedCount,
      failedCount: errors.length,
      errors,
    });
  } catch (error) {
    console.error("[cron/user-soft-delete-purge] error:", error);
    return NextResponse.json(
      { error: "GDPR purge cron 처리에 실패했습니다." },
      { status: 500 },
    );
  }
}
