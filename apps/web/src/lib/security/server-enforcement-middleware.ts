/**
 * Server Enforcement Middleware
 *
 * Security Batch 1: Server Enforcement Wiring
 *
 * Batch 0의 server-authorization-guard + mutation-replay-guard를
 * 실제 Next.js API route에서 사용할 수 있는 middleware로 연결합니다.
 *
 * 설계 원칙:
 * - 기존 auth.ts (NextAuth JWT)에서 세션/역할을 읽어 ServerActorContext 생성
 * - 모든 irreversible mutation API에 authorization + replay guard를 자동 적용
 * - 실패 시 human-readable governance message만 반환 (internal key 노출 금지)
 * - 기존 API route 구조를 변경하지 않고 wrapper로 감싸는 방식
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkServerAuthorization,
  type ServerActorContext,
  type IrreversibleActionType,
  type AuthorizationRequest,
} from './server-authorization-guard';
import {
  checkMutationReplayGuard,
  beginMutation,
  completeMutation,
  failMutation,
  type MutationRequest,
  type MutationActionType,
} from './mutation-replay-guard';
import {
  appendAuditEnvelope,
  computeStateHash,
} from './audit-integrity-engine';
import {
  generateCorrelationId,
  createEventProvenance,
  classifyEventSecurity,
  recordSecurityEvent,
} from './event-provenance-engine';
import { sanitizeErrorForSurface } from './frontend-leak-guard';
import {
  type CsrfProtectionLevel,
  type RouteCsrfConfig,
  isProtectedMethod as isCsrfProtectedMethod,
  getCsrfRolloutMode,
  shouldBlockOnViolation as csrfShouldBlock,
  getCsrfGovernanceMessage,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from './csrf-contract';
import { validateCsrfDoubleSubmitSync } from './csrf-token-engine';
import { performCsrfCheck } from './csrf-middleware';

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

/** NextAuth 세션에서 추출한 사용자 정보 */
interface SessionUser {
  id: string;
  email?: string;
  role?: string;
  name?: string;
}

/** Enforcement middleware 설정 */
export interface EnforcementConfig {
  readonly action: IrreversibleActionType;
  readonly mutationAction: MutationActionType;
  readonly targetEntityType: 'po' | 'quote' | 'dispatch' | 'approval' | 'order' | 'inventory' | 'receiving' | 'ai_action' | 'compare_session' | 'email_draft' | 'organization' | 'team' | 'workspace' | 'budget' | 'billing' | 'governance' | 'purchase_request' | 'purchase_record' | 'product' | 'cart' | 'invite';
  /** request body에서 entity ID를 추출하는 함수 */
  readonly extractEntityId: (body: Record<string, unknown>) => string;
  /** request body에서 organization ID를 추출하는 함수 */
  readonly extractOrgId?: (body: Record<string, unknown>) => string;
  /** request body에서 snapshot version을 추출하는 함수 */
  readonly extractSnapshotVersion?: (body: Record<string, unknown>) => string;
  /** 감사 로그용 source surface */
  readonly sourceSurface: string;
  /** CSRF 보호 수준 (default: 'required') */
  readonly csrfProtection?: CsrfProtectionLevel;
  /** 고위험 route (soft_enforce에서도 차단) */
  readonly csrfHighRisk?: boolean;
}

/** API route에 대한 rate limit 설정 */
export interface MutationRateLimitConfig {
  /** 시간 윈도우 (ms) */
  readonly interval: number;
  /** 윈도우 내 최대 요청 수 */
  readonly maxRequests: number;
}

/** Enforcement 결과 */
export interface EnforcementResult {
  readonly allowed: boolean;
  readonly correlationId: string;
  readonly actorContext?: ServerActorContext;
  readonly errorResponse?: NextResponse;
}

// ═══════════════════════════════════════════════════════
// Role Mapping
// ═══════════════════════════════════════════════════════

/** NextAuth UserRole → Security SystemRole 매핑 */
type SystemRole = 'requester' | 'buyer' | 'approver' | 'ops_admin';

const ROLE_MAP: Record<string, SystemRole> = {
  RESEARCHER: 'requester',
  BUYER: 'buyer',
  SUPPLIER: 'requester',
  ADMIN: 'ops_admin',
  VIEWER: 'requester',
  REQUESTER: 'requester',
  APPROVER: 'approver',
  OWNER: 'ops_admin',
};

function mapUserRole(role?: string): SystemRole[] {
  if (!role) return ['requester'];
  const mapped = ROLE_MAP[role.toUpperCase()];
  return mapped ? [mapped] : ['requester'];
}

// ═══════════════════════════════════════════════════════
// Session → Actor Context
// ═══════════════════════════════════════════════════════

/**
 * NextAuth 세션에서 ServerActorContext를 생성
 *
 * JWT에서 추출한 id, role을 보안 컨텍스트로 변환.
 * 실제 production에서는 DB에서 entity capabilities도 조회.
 */
export function buildActorContextFromSession(
  user: SessionUser,
  sessionId: string,
): ServerActorContext {
  return {
    actorId: user.id,
    roles: mapUserRole(user.role),
    organizationId: 'default-org', // TODO: 실제 org 조회 (Batch 2에서 DB 연결)
    departmentId: undefined,
    entityCapabilities: [], // TODO: DB에서 조회
    sessionId,
    sessionIssuedAt: new Date().toISOString(),
    delegatedBy: undefined,
  };
}

// ═══════════════════════════════════════════════════════
// Core Middleware
// ═══════════════════════════════════════════════════════

/**
 * Irreversible mutation API route를 보안 middleware로 감싸는 higher-order function
 *
 * 사용법:
 * ```ts
 * export const POST = withEnforcement(
 *   { action: 'dispatch_send_now', mutationAction: 'send_now', ... },
 *   async (req, context) => {
 *     // 실제 비즈니스 로직
 *     return NextResponse.json({ success: true });
 *   }
 * );
 * ```
 */
export function withEnforcement(
  config: EnforcementConfig,
  handler: (
    req: NextRequest,
    context: {
      actorContext: ServerActorContext;
      correlationId: string;
      body: Record<string, unknown>;
    },
  ) => Promise<NextResponse>,
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const correlationId = generateCorrelationId();

    // 1. 세션 추출
    // NextAuth에서 세션을 가져오는 방법은 auth() 호출이지만,
    // route handler에서는 헤더에서 추출하거나 cookie 기반으로 처리
    // 여기서는 request에서 추출하는 패턴 사용
    const sessionToken = req.cookies.get('next-auth.session-token')?.value
      || req.cookies.get('__Secure-next-auth.session-token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: '인증이 필요합니다', correlationId },
        { status: 401 },
      );
    }

    // 2. CSRF validation (origin + double-submit token)
    const csrfResult = await performCsrfCheck({
      req,
      correlationId,
      protection: config.csrfProtection || 'required',
      highRisk: config.csrfHighRisk,
      sourceSurface: config.sourceSurface,
      actorUserId: undefined, // actor는 아직 resolve 전
    });
    if (!csrfResult.passed && csrfResult.blockResponse) {
      return csrfResult.blockResponse;
    }

    // 3. Request body 파싱
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: '요청 형식이 올바르지 않습니다', correlationId },
        { status: 400 },
      );
    }

    // 4. Actor context 생성
    // 실제 production에서는 JWT 디코딩 또는 auth() 호출
    const userId = (body._actorId as string) || 'unknown';
    const userRole = (body._actorRole as string) || 'RESEARCHER';
    const actorContext = buildActorContextFromSession(
      { id: userId, role: userRole },
      sessionToken.slice(0, 16),
    );

    // 5. Entity 정보 추출
    const entityId = config.extractEntityId(body);
    const orgId = config.extractOrgId?.(body) || actorContext.organizationId;
    const snapshotVersion = config.extractSnapshotVersion?.(body) || 'v0';

    // 6. Authorization check
    const authResult = checkServerAuthorization({
      action: config.action,
      actor: actorContext,
      targetEntityType: config.targetEntityType,
      targetEntityId: entityId,
      targetOrganizationId: orgId,
      snapshotVersion,
    });

    if (!authResult.permitted) {
      // Security event 기록
      const provenance = createEventProvenance({
        sourceDomain: 'security',
        sourceSurface: config.sourceSurface,
        sourceRoute: req.nextUrl.pathname,
        actorUserId: actorContext.actorId,
        targetEntityType: config.targetEntityType,
        targetEntityId: entityId,
        correlationId,
        securityClassification: 'security_event',
      });
      recordSecurityEvent('security_event', provenance,
        `Authorization denied: ${config.action} by role ${actorContext.roles.join(',')}`);

      return NextResponse.json(
        { error: authResult.governanceMessage, correlationId },
        { status: 403 },
      );
    }

    // 7. Mutation replay guard
    const idempotencyKey = (body._idempotencyKey as string)
      || `${config.mutationAction}_${entityId}_${Date.now()}`;
    const csrfToken = (body._csrfToken as string) || '';

    // CSRF 검증은 토큰이 제공된 경우에만 (점진적 도입)
    if (csrfToken) {
      const mutationCheck = checkMutationReplayGuard({
        idempotencyKey,
        action: config.mutationAction,
        targetEntityId: entityId,
        snapshotVersion,
        actorId: actorContext.actorId,
        csrfToken,
        requestedAt: new Date().toISOString(),
      });

      if (!mutationCheck.allowed) {
        return NextResponse.json(
          { error: mutationCheck.governanceMessage, correlationId },
          { status: 409 },
        );
      }
    }

    // 8. Concurrency lock 획득
    const lockAcquired = beginMutation(config.mutationAction, entityId);
    if (!lockAcquired) {
      return NextResponse.json(
        { error: '같은 항목에 대한 다른 작업이 진행 중입니다', correlationId },
        { status: 409 },
      );
    }

    // 9. 실제 핸들러 실행
    try {
      const response = await handler(req, { actorContext, correlationId, body });

      // 10. 성공 시 audit envelope 기록
      if (response.status >= 200 && response.status < 300) {
        appendAuditEnvelope({
          correlationId,
          actorUserId: actorContext.actorId,
          actorRole: actorContext.roles[0],
          actionType: config.action,
          targetEntityType: config.targetEntityType,
          targetEntityId: entityId,
          snapshotVersion,
          beforeState: { action: config.action, status: 'pending' },
          afterState: { action: config.action, status: 'completed' },
          rationale: (body.rationale as string) || '',
          reasonCode: (body.reasonCode as string) || config.action,
          sourceSurface: config.sourceSurface,
          securityClassification: classifyEventSecurity(config.action) as any,
        });

        // Mutation fingerprint 기록
        if (csrfToken) {
          completeMutation({
            idempotencyKey,
            action: config.mutationAction,
            targetEntityId: entityId,
            snapshotVersion,
            actorId: actorContext.actorId,
            csrfToken,
            requestedAt: new Date().toISOString(),
          });
        }
      }

      // Lock 해제
      failMutation(config.mutationAction, entityId);
      return response;

    } catch (error) {
      // Lock 해제
      failMutation(config.mutationAction, entityId);

      // Error sanitization
      const safeError = sanitizeErrorForSurface(
        'SYSTEM_ERROR',
        error instanceof Error ? error.message : undefined,
      );

      return NextResponse.json(
        { error: safeError.userMessage, correlationId },
        { status: 500 },
      );
    }
  };
}

/**
 * 읽기 전용 API route에 대한 가벼운 authorization wrapper
 *
 * mutation이 아닌 조회 API에서도 역할 기반 접근 제어가 필요한 경우 사용.
 */
export function withReadAuthorization(
  requiredRoles: readonly SystemRole[],
  handler: (req: NextRequest, actorContext: ServerActorContext) => Promise<NextResponse>,
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const sessionToken = req.cookies.get('next-auth.session-token')?.value
      || req.cookies.get('__Secure-next-auth.session-token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 },
      );
    }

    // 간이 actor context (실제 production에서는 JWT 디코딩)
    const actorContext = buildActorContextFromSession(
      { id: 'unknown', role: 'RESEARCHER' },
      sessionToken.slice(0, 16),
    );

    // Role check
    const hasRole = actorContext.roles.some(r => requiredRoles.includes(r));
    if (!hasRole) {
      return NextResponse.json(
        { error: '현재 역할로는 이 정보에 접근할 수 없습니다' },
        { status: 403 },
      );
    }

    return handler(req, actorContext);
  };
}

// ═══════════════════════════════════════════════════════
// Inline Enforcement (기존 auth() route에 점진적 적용)
// ═══════════════════════════════════════════════════════

/**
 * 기존 route handler에서 auth() 세션과 함께 사용하는 inline enforcement
 *
 * withEnforcement()는 route handler를 통째로 감싸는 방식이지만,
 * enforceAction()은 기존 route 내부에서 호출하는 방식.
 * 기존 auth() / DB 조회 패턴을 유지하면서 enforcement를 추가.
 *
 * 사용법:
 * ```ts
 * export async function POST(req: NextRequest, { params }) {
 *   const session = await auth();
 *   if (!session) return NextResponse.json({error: '...'}, {status: 401});
 *
 *   const enforcement = enforceAction({
 *     userId: session.user.id,
 *     userRole: session.user.role,
 *     action: 'purchase_request_approve',
 *     targetEntityType: 'approval',
 *     targetEntityId: params.id,
 *     sourceSurface: 'request-approval-api',
 *     routePath: '/api/request/[id]/approve',
 *   });
 *
 *   if (!enforcement.allowed) {
 *     return enforcement.deny();
 *   }
 *
 *   // ... existing business logic ...
 *
 *   enforcement.complete({ ... });
 *   return NextResponse.json({ ... });
 * }
 * ```
 */
export interface InlineEnforcementConfig {
  readonly userId: string;
  readonly userRole?: string;
  readonly action: IrreversibleActionType;
  readonly targetEntityType: 'po' | 'quote' | 'dispatch' | 'approval' | 'order' | 'inventory' | 'receiving' | 'ai_action' | 'compare_session' | 'email_draft' | 'organization' | 'team' | 'workspace' | 'budget' | 'billing' | 'governance' | 'purchase_request' | 'purchase_record' | 'product' | 'cart' | 'invite';
  readonly targetEntityId: string;
  readonly organizationId?: string;
  readonly sourceSurface: string;
  readonly routePath: string;
  readonly idempotencyKey?: string;
  readonly rationale?: string;
  /** CSRF defense-in-depth: request 객체 전달 시 inline CSRF 검증 수행 */
  readonly request?: NextRequest;
  /** CSRF 보호 수준 (default: 'required') */
  readonly csrfProtection?: CsrfProtectionLevel;
  /** 고위험 route — soft_enforce에서도 차단 */
  readonly csrfHighRisk?: boolean;
}

export interface InlineEnforcementHandle {
  readonly allowed: boolean;
  readonly correlationId: string;
  readonly actorContext: ServerActorContext;
  readonly authResult: ReturnType<typeof checkServerAuthorization>;
  /** 차단 시 pre-built JSON response를 반환 */
  deny(): NextResponse;
  /** 성공 시 audit envelope 기록 + mutation lock 해제 */
  complete(detail?: { beforeState?: Record<string, unknown>; afterState?: Record<string, unknown> }): void;
  /** 실패 시 mutation lock 해제 (audit 미기록) */
  fail(): void;
}

export function enforceAction(config: InlineEnforcementConfig): InlineEnforcementHandle {
  const correlationId = generateCorrelationId();

  // 1. Actor context 생성 (auth()에서 가져온 정보 기반)
  const actorContext = buildActorContextFromSession(
    { id: config.userId, role: config.userRole },
    `inline_${Date.now()}`,
  );

  // 2. Authorization check
  const authResult = checkServerAuthorization({
    action: config.action,
    actor: actorContext,
    targetEntityType: config.targetEntityType,
    targetEntityId: config.targetEntityId,
    targetOrganizationId: config.organizationId || actorContext.organizationId,
  });

  // 2.5. CSRF defense-in-depth (request 객체 전달 시에만 수행)
  // middleware.ts CSRF gate 이후 추가 검증 — double-check 레이어
  let csrfPassed = true;
  let csrfDenyMessage: string | undefined;

  if (config.request && authResult.permitted) {
    const csrfProtection = config.csrfProtection ?? 'required';
    const csrfHighRisk = config.csrfHighRisk ?? false;

    if (csrfProtection !== 'exempt' && isCsrfProtectedMethod(config.request.method)) {
      const mode = getCsrfRolloutMode();
      const cookieToken =
        config.request.cookies.get(CSRF_COOKIE_NAME.replace('__Host-', ''))?.value ||
        config.request.cookies.get(CSRF_COOKIE_NAME)?.value;
      const headerToken = config.request.headers.get(CSRF_HEADER_NAME);

      const tokenResult = validateCsrfDoubleSubmitSync(cookieToken, headerToken);

      if (!tokenResult.valid && tokenResult.violation) {
        // Telemetry 기록
        const csrfProvenance = createEventProvenance({
          sourceDomain: 'security',
          sourceSurface: config.sourceSurface,
          sourceRoute: config.routePath,
          actorUserId: config.userId,
          targetEntityType: 'csrf',
          targetEntityId: config.targetEntityId,
          correlationId,
          securityClassification: 'security_event',
        });
        recordSecurityEvent(
          'security_event',
          csrfProvenance,
          `CSRF inline check failed: ${tokenResult.violation} action=${config.action} path=${config.routePath}`,
        );

        if (csrfShouldBlock(mode, csrfProtection, csrfHighRisk)) {
          csrfPassed = false;
          csrfDenyMessage = getCsrfGovernanceMessage(tokenResult.violation);
        }
      }
    }
  }

  // 3. Concurrency lock
  const mutationAction = config.action as unknown as MutationActionType;
  let lockAcquired = false;

  if (authResult.permitted && csrfPassed) {
    lockAcquired = beginMutation(mutationAction, config.targetEntityId);
  }

  const allowed = authResult.permitted && csrfPassed && lockAcquired;

  // 4. Security event 기록 (차단 시)
  if (!authResult.permitted) {
    const provenance = createEventProvenance({
      sourceDomain: 'security',
      sourceSurface: config.sourceSurface,
      sourceRoute: config.routePath,
      actorUserId: config.userId,
      targetEntityType: config.targetEntityType,
      targetEntityId: config.targetEntityId,
      correlationId,
      securityClassification: 'security_event',
    });
    recordSecurityEvent(
      'security_event',
      provenance,
      `Authorization denied: ${config.action} by role ${actorContext.roles.join(',')}`,
    );
  }

  return {
    allowed,
    correlationId,
    actorContext,
    authResult,

    deny() {
      const message = !authResult.permitted
        ? authResult.governanceMessage
        : !csrfPassed
        ? (csrfDenyMessage || '보안 검증이 완료되지 않아 작업을 진행할 수 없습니다.')
        : '같은 항목에 대한 다른 작업이 진행 중입니다';
      const status = !authResult.permitted ? 403 : !csrfPassed ? 403 : 409;

      return NextResponse.json(
        { error: message, correlationId },
        { status },
      );
    },

    complete(detail) {
      // Audit envelope 기록
      appendAuditEnvelope({
        correlationId,
        actorUserId: config.userId,
        actorRole: actorContext.roles[0],
        actionType: config.action,
        targetEntityType: config.targetEntityType,
        targetEntityId: config.targetEntityId,
        snapshotVersion: 'v0',
        beforeState: detail?.beforeState || { action: config.action, status: 'pending' },
        afterState: detail?.afterState || { action: config.action, status: 'completed' },
        rationale: config.rationale || '',
        reasonCode: config.action,
        sourceSurface: config.sourceSurface,
        securityClassification: classifyEventSecurity(config.action) as any,
      });

      // Lock 해제
      failMutation(mutationAction, config.targetEntityId);
    },

    fail() {
      // Lock 해제만 (audit 미기록)
      if (lockAcquired) {
        failMutation(mutationAction, config.targetEntityId);
      }
    },
  };
}

// ═══════════════════════════════════════════════════════
// Preset Configurations
// ═══════════════════════════════════════════════════════

/** 자주 사용되는 enforcement 설정 preset */
export const ENFORCEMENT_PRESETS = {
  dispatchSendNow: {
    action: 'dispatch_send_now' as IrreversibleActionType,
    mutationAction: 'send_now' as MutationActionType,
    targetEntityType: 'dispatch' as const,
    extractEntityId: (body: Record<string, unknown>) => (body.poId || body.entityId || '') as string,
    extractSnapshotVersion: (body: Record<string, unknown>) => (body.snapshotVersion || 'v0') as string,
    sourceSurface: 'dispatch-prep-workbench',
    csrfProtection: 'required' as CsrfProtectionLevel,
    csrfHighRisk: true,
  },

  dispatchScheduleSend: {
    action: 'dispatch_schedule_send' as IrreversibleActionType,
    mutationAction: 'schedule_send' as MutationActionType,
    targetEntityType: 'dispatch' as const,
    extractEntityId: (body: Record<string, unknown>) => (body.poId || body.entityId || '') as string,
    sourceSurface: 'dispatch-prep-workbench',
    csrfProtection: 'required' as CsrfProtectionLevel,
    csrfHighRisk: true,
  },

  approvalDecision: {
    action: 'approval_decision' as IrreversibleActionType,
    mutationAction: 'approval_decision' as MutationActionType,
    targetEntityType: 'approval' as const,
    extractEntityId: (body: Record<string, unknown>) => (body.caseId || body.entityId || '') as string,
    sourceSurface: 'fire-approval-workbench',
    csrfProtection: 'required' as CsrfProtectionLevel,
    csrfHighRisk: true,
  },

  poConversionFinalize: {
    action: 'po_conversion_finalize' as IrreversibleActionType,
    mutationAction: 'po_conversion_finalize' as MutationActionType,
    targetEntityType: 'po' as const,
    extractEntityId: (body: Record<string, unknown>) => (body.poId || body.entityId || '') as string,
    sourceSurface: 'po-conversion-workbench',
    csrfProtection: 'required' as CsrfProtectionLevel,
    csrfHighRisk: true,
  },

  quoteRequestSubmit: {
    action: 'quote_request_submit' as IrreversibleActionType,
    mutationAction: 'quote_request_submit' as MutationActionType,
    targetEntityType: 'quote' as const,
    extractEntityId: (body: Record<string, unknown>) => (body.quoteId || body.entityId || '') as string,
    sourceSurface: 'quote-request-workbench',
    csrfProtection: 'required' as CsrfProtectionLevel,
    csrfHighRisk: true,
  },
} as const;
