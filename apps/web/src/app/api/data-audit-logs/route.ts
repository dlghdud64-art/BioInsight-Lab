/**
 * GET /api/data-audit-logs
 *
 * DataAuditLog(CRUD 추적) 조회 엔드포인트
 *
 * Query Parameters:
 *   entityType     - (선택) AuditEntityType enum 값 필터
 *   entityId       - (선택) 특정 레코드 ID 필터 (타임라인 조회)
 *   action         - (선택) CREATE | UPDATE | DELETE
 *   organizationId - (선택) 직접 지정 — 미지정 시 세션의 첫 번째 org 자동 사용
 *   limit          - (선택, 기본 50, 최대 200)
 *   cursor         - (선택) 커서 페이지네이션 (DataAuditLog.id)
 *
 * Authorization (RLS):
 *   - 로그인 필수
 *   - organizationId 지정 시 해당 조직 멤버십 검증 (IDOR 방어)
 *   - 개인 기록(organizationId=null)은 본인 userId 기록만 조회
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { AuditAction, AuditEntityType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const entityType = searchParams.get("entityType") as AuditEntityType | null;
    const entityId   = searchParams.get("entityId")   ?? undefined;
    const action     = searchParams.get("action")     as AuditAction | null;
    const orgIdParam = searchParams.get("organizationId") ?? undefined;
    const limit      = Math.min(Number(searchParams.get("limit") || "50"), 200);
    const cursor     = searchParams.get("cursor") ?? undefined;

    // ─── RLS: organizationId 권한 검증 ───────────────────────────────────────
    let resolvedOrgId: string | undefined = orgIdParam;

    if (resolvedOrgId) {
      // 요청자가 해당 조직 멤버인지 확인 (IDOR 방어)
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: resolvedOrgId },
        select: { id: true },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "Forbidden: 해당 조직의 멤버가 아닙니다." },
          { status: 403 }
        );
      }
    } else {
      // 미지정 시 세션 유저의 첫 번째 조직으로 자동 해석
      const firstMembership = await db.organizationMember.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true },
        orderBy: { createdAt: "asc" },
      });
      resolvedOrgId = firstMembership?.organizationId ?? undefined;
    }

    // ─── WHERE 조건 ──────────────────────────────────────────────────────────
    const where: any = {
      // 조직 로그 OR 본인 개인 로그 (데이터 격리)
      OR: [
        ...(resolvedOrgId ? [{ organizationId: resolvedOrgId }] : []),
        { organizationId: null, userId: session.user.id },
      ],
    };

    if (entityType) where.entityType = entityType;
    if (entityId)   where.entityId   = entityId;
    if (action)     where.action     = action;

    // ─── 커서 페이지네이션 ────────────────────────────────────────────────────
    const rows = await db.dataAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    const hasNextPage = rows.length > limit;
    const logs        = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor  = hasNextPage ? logs[logs.length - 1].id : null;

    return NextResponse.json({
      logs,
      pagination: { limit, hasNextPage, nextCursor },
    });
  } catch (error: any) {
    console.error("[DataAuditLogs/GET]", error);
    return NextResponse.json(
      { error: "감사 로그 조회에 실패했습니다.", details: error.message },
      { status: 500 }
    );
  }
}
