import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { enforceAction, type InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import {
  recordMutationAudit,
  buildAuditEventKey,
} from "@/lib/audit/durable-mutation-audit";
import crypto from "crypto";

const logger = createLogger("api/invites/accept");

// ── Token 서명 검증 ──

const INVITE_HMAC_SECRET = process.env.INVITE_HMAC_SECRET || "";

/**
 * HMAC-SHA256으로 invite token의 서명을 검증한다.
 *
 * 토큰 형식: `{payload}.{signature}`
 * - payload: 원본 cuid (DB에 저장된 token)
 * - signature: HMAC-SHA256(payload, secret)
 *
 * INVITE_HMAC_SECRET이 설정되지 않은 환경(dev/staging)에서는
 * 서명 검증을 skip하고 payload만 추출한다.
 * Production에서는 반드시 설정해야 한다.
 */
function verifyInviteToken(signedToken: string): {
  valid: boolean;
  payload: string;
  reason?: string;
} {
  // Signed token format: {payload}.{signature}
  const lastDotIndex = signedToken.lastIndexOf(".");

  // 서명이 없는 legacy token → payload = 전체 문자열
  if (lastDotIndex === -1) {
    if (INVITE_HMAC_SECRET) {
      // Production에서 서명 없는 토큰은 거부
      return { valid: false, payload: signedToken, reason: "unsigned_token" };
    }
    // Dev 환경: legacy token 허용 (backward compat)
    return { valid: true, payload: signedToken };
  }

  const payload = signedToken.slice(0, lastDotIndex);
  const signature = signedToken.slice(lastDotIndex + 1);

  if (!INVITE_HMAC_SECRET) {
    // Secret 미설정 환경: 서명 검증 skip
    return { valid: true, payload };
  }

  // HMAC 검증 (timing-safe comparison)
  const expectedSignature = crypto
    .createHmac("sha256", INVITE_HMAC_SECRET)
    .update(payload)
    .digest("hex");

  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return { valid: false, payload, reason: "invalid_signature" };
  }

  return { valid: true, payload };
}

/**
 * Invite token에 HMAC 서명을 추가한다.
 * 초대 생성 시 사용.
 *
 * ⚠️ Next.js App Router는 route 파일에서 HTTP method 외 named export를 금지.
 * 이 함수는 lib/security/invite-token.ts 등 별도 모듈로 추출해야 한다.
 * 현재는 route 내부에서만 사용.
 */
function signInviteToken(payload: string): string {
  if (!INVITE_HMAC_SECRET) return payload; // dev fallback
  const signature = crypto
    .createHmac("sha256", INVITE_HMAC_SECRET)
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

// ── 입력 스키마 ──

const acceptInviteSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

// ── Rate limit (in-memory, per-process) ──

const RATE_LIMIT_WINDOW_MS = 60_000; // 1분
const RATE_LIMIT_MAX = 10; // IP당 1분 10회
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// ── Replay 방지: acceptedAt + 트랜잭션 내 재확인 ──
// WorkspaceInvite.acceptedAt는 single-use consume marker.
// 트랜잭션 안에서 다시 확인하여 TOCTOU race를 방지한다.

/**
 * POST /api/invites/accept
 *
 * Security chain:
 * 1. enforceAction (authorization + audit envelope)
 * 2. Rate limiting (IP-based, brute-force 방지)
 * 3. HMAC token signature verification
 * 4. Auth check (session required)
 * 5. Token lookup + expiry check
 * 6. Email binding verification (invitee = session user)
 * 7. Single-use consume (acceptedAt check, TOCTOU-safe in tx)
 * 8. Duplicate membership check
 * 9. Atomic membership creation + invite consume
 * 10. Audit log (enforcement.complete)
 */
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;

  try {
    // ── 0. Rate limiting ──
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    // ── 1. Auth check ──
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in to accept this invite." },
        { status: 401 },
      );
    }

    // ── 2. Input validation ──
    const body = await request.json();
    const { token: rawToken } = acceptInviteSchema.parse(body);

    // ── 3. Token signature verification ──
    const tokenResult = verifyInviteToken(rawToken);
    if (!tokenResult.valid) {
      logger.warn("Invite token signature verification failed", {
        userId: session.user.id,
        reason: tokenResult.reason,
        ip: clientIp,
      });
      return NextResponse.json(
        { error: "Invalid invite token" },
        { status: 403 },
      );
    }
    const token = tokenResult.payload;

    // ── 4. Enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "workspace_invite_accept",
      targetEntityType: "invite",
      targetEntityId: token,
      sourceSurface: "invites-accept-api",
      routePath: "/api/invites/accept",
    });

    if (!enforcement.allowed) {
      return enforcement.deny();
    }

    // ── 5. Token lookup (pre-tx, fast-fail) ──
    const invite = await db.workspaceInvite.findUnique({
      where: { token },
      include: { workspace: true },
    });

    if (!invite) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Invalid invite token" },
        { status: 404 },
      );
    }

    // ── 6. Expiry check ──
    if (invite.expiresAt < new Date()) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Invite has expired" },
        { status: 410 },
      );
    }

    // ── 7. Already consumed check (pre-tx fast path) ──
    if (invite.acceptedAt) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Invite has already been accepted" },
        { status: 409 },
      );
    }

    // ── 8. Email binding ──
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      enforcement.fail();
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    if (user.email !== invite.email) {
      enforcement.fail();
      logger.warn("Invite email binding mismatch", {
        userId: session.user.id,
        inviteEmail: invite.email,
        userEmail: user.email,
        ip: clientIp,
      });
      return NextResponse.json(
        { error: "Invite email does not match your account email" },
        { status: 403 },
      );
    }

    // ── 9. Duplicate membership check ──
    const existingMember = await db.workspaceMember.findFirst({
      where: {
        workspaceId: invite.workspaceId,
        userId: session.user.id,
      },
    });

    if (existingMember) {
      // 이미 멤버 → invite만 소비하고 종료
      await db.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      enforcement.complete({
        beforeState: { inviteId: invite.id, status: "pending", alreadyMember: true },
        afterState: { inviteId: invite.id, status: "consumed_duplicate" },
      });

      return NextResponse.json(
        { error: "You are already a member of this workspace" },
        { status: 409 },
      );
    }

    // ── 10. Atomic consume + membership creation (TOCTOU-safe) ──
    const acceptedAt = new Date();

    const [member] = await db.$transaction(async (tx: any) => {
      // TOCTOU: 트랜잭션 안에서 acceptedAt 재확인 (replay 방지)
      const freshInvite = await tx.workspaceInvite.findUnique({
        where: { token },
        select: { id: true, acceptedAt: true },
      });

      if (!freshInvite || freshInvite.acceptedAt) {
        throw {
          __replayDetected: true,
          message: "Invite was already consumed (concurrent accept detected)",
        };
      }

      // Membership 생성
      const newMember = await tx.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId: session.user.id,
          role: invite.role,
        },
        include: {
          workspace: true,
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      });

      // Single-use consume: acceptedAt 설정
      await tx.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt },
      });

      // Durable audit event — 같은 tx 안에서 기록
      await recordMutationAudit(tx, {
        auditEventKey: buildAuditEventKey(
          invite.workspaceId, invite.id, 'workspace_invite_accept',
        ),
        orgId: invite.workspaceId,
        actorId: session.user.id,
        route: '/api/invites/accept',
        action: 'workspace_invite_accept',
        entityType: 'invite',
        entityId: invite.id,
        result: 'success',
        correlationId: enforcement!.correlationId,
      });

      return [newMember];
    });

    // ── 11. Audit (enforcement.complete) ──
    enforcement.complete({
      beforeState: {
        inviteId: invite.id,
        inviteToken: token,
        workspaceId: invite.workspaceId,
        inviteEmail: invite.email,
        status: "pending",
      },
      afterState: {
        inviteId: invite.id,
        workspaceId: invite.workspaceId,
        memberId: member.id ?? null,
        userId: session.user.id,
        role: invite.role,
        status: "accepted",
        acceptedAt: acceptedAt.toISOString(),
      },
    });

    logger.info("Workspace invite accepted", {
      workspaceId: invite.workspaceId,
      userId: session.user.id,
      role: invite.role,
      inviteId: invite.id,
    });

    return NextResponse.json({
      success: true,
      workspace: member.workspace,
      member,
    });
  } catch (error: any) {
    // Replay detection
    if (error?.__replayDetected) {
      enforcement?.fail();
      return NextResponse.json(
        { error: "Invite has already been accepted" },
        { status: 409 },
      );
    }

    if (error instanceof z.ZodError) {
      enforcement?.fail();
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 },
      );
    }

    enforcement?.fail();
    return handleApiError(error, "invites/accept");
  }
}
