// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Security Readiness Hardening Batch 0 — 통합 테스트
 *
 * SH1-SH50: 50 scenarios
 *
 * Batch A: Authorization + Mutation Replay Guard
 * Batch B: Audit Integrity + Event Provenance
 * Batch C: Outbound + Attachment + Storage Hygiene + Frontend Leak
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ── Batch A imports ──
import {
  checkServerAuthorization,
  checkBatchAuthorization,
  getDenialMessage,
  ACTION_ROLE_MINIMUM,
  SELF_APPROVAL_FORBIDDEN,
  type ServerActorContext,
  type AuthorizationRequest,
} from '../server-authorization-guard';

import {
  checkMutationReplayGuard,
  generateCsrfToken,
  beginMutation,
  completeMutation,
  failMutation,
  validateReadyToSendBoundary,
  __resetMutationGuardState,
  type MutationRequest,
} from '../mutation-replay-guard';

// ── Batch B imports ──
import {
  appendAuditEnvelope,
  verifyAuditChain,
  queryAuditEnvelopes,
  getAuditStoreStats,
  computeStateHash,
  __resetAuditStore,
  GENESIS_HASH,
} from '../audit-integrity-engine';

import {
  createEventProvenance,
  generateCorrelationId,
  detectImpossibleTransition,
  recordSecurityEvent,
  querySecurityEvents,
  classifyEventSecurity,
  __resetProvenanceState,
  IMPOSSIBLE_TRANSITIONS,
} from '../event-provenance-engine';

// ── Batch C imports ──
import {
  validateOutboundPayload,
  detectInternalFieldLeak,
  sanitizePayloadForSupplier,
  INTERNAL_ONLY_FIELDS,
  type SupplierFacingPayload,
} from '../outbound-payload-security';

import {
  validateAttachment,
  validateAttachmentBatch,
  shouldInvalidateOnAttachmentChange,
  ALLOWED_MIME_TYPES,
  DANGEROUS_EXTENSIONS,
  type AttachmentMetadata,
} from '../attachment-security-engine';

import {
  classifyField,
  sanitizeForBrowserStorage,
  auditBrowserStorageCompliance,
  createSecurePersistenceWrapper,
  BROWSER_UNSAFE_FIELDS,
} from '../storage-hygiene-classifier';

import {
  sanitizeErrorForSurface,
  sanitizeDisplayText,
  containsInternalPattern,
  getConfirmationText,
} from '../frontend-leak-guard';

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════

function makeActor(overrides: Partial<ServerActorContext> = {}): ServerActorContext {
  return {
    actorId: 'user-001',
    roles: ['buyer'],
    organizationId: 'org-001',
    departmentId: 'dept-001',
    entityCapabilities: [],
    sessionId: 'sess-001',
    sessionIssuedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeAuthRequest(overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest {
  return {
    action: 'dispatch_send_now',
    actor: makeActor(),
    targetEntityType: 'dispatch',
    targetEntityId: 'disp-001',
    targetOrganizationId: 'org-001',
    ...overrides,
  };
}

function makeMutationRequest(overrides: Partial<MutationRequest> = {}): MutationRequest {
  return {
    idempotencyKey: `idem_${Date.now()}_${Math.random()}`,
    action: 'send_now',
    targetEntityId: 'po-001',
    snapshotVersion: 'v1',
    actorId: 'user-001',
    csrfToken: generateCsrfToken(),
    requestedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePayload(overrides: Partial<SupplierFacingPayload> = {}): SupplierFacingPayload {
  return {
    poNumber: 'PO-2026-001',
    supplierName: '한국과학기기',
    supplierContactEmail: 'contact@ksci.co.kr',
    shippingAddress: '서울특별시 강남구 테헤란로 152 강남파이낸스센터',
    billingAddress: '서울특별시 강남구 테헤란로 152 강남파이낸스센터 청구팀',
    lineItems: [{ itemName: '시약 A', quantity: 10, unitPrice: 50000, unit: 'EA' }],
    totalAmount: 500000,
    currency: 'KRW',
    commercialTerms: ['NET30'],
    attachmentIds: ['att-001'],
    payloadGeneratedAt: new Date().toISOString(),
    payloadVersion: 'v1',
    ...overrides,
  };
}

function makeAttachment(overrides: Partial<AttachmentMetadata> = {}): AttachmentMetadata {
  return {
    fileId: 'file-001',
    fileName: 'spec-document.pdf',
    mimeType: 'application/pdf',
    extension: 'pdf',
    fileSizeBytes: 1024 * 100,
    contentHash: 'abc123def456',
    uploadedAt: new Date().toISOString(),
    uploadedBy: 'user-001',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════
// Batch A: Authorization + Mutation Replay Guard
// ═══════════════════════════════════════════════════════

describe('Security Batch A: Irreversible Action Protection', () => {
  beforeEach(() => {
    __resetMutationGuardState();
  });

  // ── SH1: 권한 없는 사용자가 approval action 실행 시 서버 차단 ──
  it('SH1: requester 역할이 approval_decision 실행하면 차단', () => {
    const result = checkServerAuthorization(
      makeAuthRequest({
        action: 'approval_decision',
        actor: makeActor({ roles: ['requester'] }),
      }),
    );
    expect(result.permitted).toBe(false);
    expect(result.denialReason).toBe('role_insufficient');
    expect(result.governanceMessage).not.toContain('role_insufficient');
  });

  // ── SH2: 권한 있는 사용자는 통과 ──
  it('SH2: approver 역할이 approval_decision 실행하면 허가 (단, 별도 승인 필요)', () => {
    const result = checkServerAuthorization(
      makeAuthRequest({
        action: 'approval_decision',
        actor: makeActor({ roles: ['approver'] }),
      }),
    );
    expect(result.permitted).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  // ── SH3: 다른 조직의 항목에 접근 차단 ──
  it('SH3: 다른 조직의 dispatch send 차단', () => {
    const result = checkServerAuthorization(
      makeAuthRequest({
        targetOrganizationId: 'other-org',
      }),
    );
    expect(result.permitted).toBe(false);
    expect(result.denialReason).toBe('org_mismatch');
  });

  // ── SH4: 만료된 세션 차단 ──
  it('SH4: 만료된 세션으로 action 실행 차단', () => {
    const result = checkServerAuthorization(
      makeAuthRequest({
        actor: makeActor({
          sessionIssuedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        }),
      }),
    );
    expect(result.permitted).toBe(false);
    expect(result.denialReason).toBe('session_expired');
  });

  // ── SH5: self-approval 금지 (Tier 3) ──
  it('SH5: po_conversion_finalize는 self-approval 금지', () => {
    expect(SELF_APPROVAL_FORBIDDEN.has('po_conversion_finalize')).toBe(true);
    expect(SELF_APPROVAL_FORBIDDEN.has('approval_decision')).toBe(true);
  });

  // ── SH6: batch authorization ──
  it('SH6: batch authorization에서 일부만 허가', () => {
    const results = checkBatchAuthorization([
      makeAuthRequest({ action: 'dispatch_send_now' }),
      makeAuthRequest({
        action: 'approval_decision',
        actor: makeActor({ roles: ['requester'] }),
      }),
    ]);
    expect(results[0].permitted).toBe(true);
    expect(results[1].permitted).toBe(false);
  });

  // ── SH7: denial 메시지에 internal key 미포함 ──
  it('SH7: denial message에 raw key 미포함', () => {
    const result = checkServerAuthorization(
      makeAuthRequest({
        action: 'dispatch_send_now',
        actor: makeActor({ roles: ['requester'] }),
      }),
    );
    expect(getDenialMessage(result)).not.toContain('role_insufficient');
    expect(getDenialMessage(result)).not.toContain('PERMISSION');
  });

  // ── SH8: CSRF 토큰 1회 소비 후 재사용 불가 ──
  it('SH8: CSRF 토큰 1회 소비 후 재사용 불가', () => {
    const token = generateCsrfToken();
    const req1 = makeMutationRequest({ csrfToken: token });
    const result1 = checkMutationReplayGuard(req1);
    expect(result1.allowed).toBe(true);

    // 같은 토큰으로 두 번째 시도
    const req2 = makeMutationRequest({ csrfToken: token, idempotencyKey: 'diff-key' });
    const result2 = checkMutationReplayGuard(req2);
    expect(result2.allowed).toBe(false);
    expect(result2.reason).toBe('csrf_invalid');
  });

  // ── SH9: duplicate mutation 차단 ──
  it('SH9: 동일 idempotencyKey로 두 번 실행하면 차단', () => {
    const req = makeMutationRequest();
    const result1 = checkMutationReplayGuard(req);
    expect(result1.allowed).toBe(true);

    completeMutation(req);

    // 새 CSRF 토큰으로 같은 idempotencyKey 재시도
    const req2 = { ...req, csrfToken: generateCsrfToken() };
    const result2 = checkMutationReplayGuard(req2);
    expect(result2.allowed).toBe(false);
    expect(result2.reason).toBe('duplicate_mutation');
  });

  // ── SH10: 만료된 요청 차단 ──
  it('SH10: 5분 초과 요청 차단', () => {
    const req = makeMutationRequest({
      requestedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    });
    const result = checkMutationReplayGuard(req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('request_expired');
  });

  // ── SH11: concurrent mutation 차단 ──
  it('SH11: 같은 entity에 대한 동시 mutation 차단', () => {
    const acquired = beginMutation('send_now', 'po-001');
    expect(acquired).toBe(true);

    const req = makeMutationRequest({ action: 'send_now', targetEntityId: 'po-001' });
    const result = checkMutationReplayGuard(req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('concurrent_mutation');

    failMutation('send_now', 'po-001');
  });

  // ── SH12: ready_to_send ≠ sent 경계 ──
  it('SH12: sent 상태에서 send_now 차단', () => {
    const result = validateReadyToSendBoundary('sent', 'send_now');
    expect(result.valid).toBe(false);
  });

  // ── SH13: ready_to_send에서 send_now 허용 ──
  it('SH13: ready_to_send 상태에서 send_now 허용', () => {
    const result = validateReadyToSendBoundary('ready_to_send', 'send_now');
    expect(result.valid).toBe(true);
  });

  // ── SH14: 준비 미완료 상태에서 발송 차단 ──
  it('SH14: needs_review 상태에서 send_now 차단', () => {
    const result = validateReadyToSendBoundary('needs_review', 'send_now');
    expect(result.valid).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════
// Batch B: Audit Integrity + Event Provenance
// ═══════════════════════════════════════════════════════

describe('Security Batch B: Audit & Event Provenance', () => {
  beforeEach(() => {
    __resetAuditStore();
    __resetProvenanceState();
  });

  // ── SH15: audit envelope append-only ──
  it('SH15: audit envelope가 append-only로 기록됨', () => {
    const env1 = appendAuditEnvelope({
      correlationId: 'corr-001',
      actorUserId: 'user-001',
      actorRole: 'buyer',
      actionType: 'dispatch_send_now',
      targetEntityType: 'po',
      targetEntityId: 'po-001',
      snapshotVersion: 'v1',
      beforeState: { status: 'ready_to_send' },
      afterState: { status: 'sent' },
      rationale: '발송 승인 완료',
      reasonCode: 'approved_for_send',
      sourceSurface: 'dispatch-prep-workbench',
    });

    expect(env1.eventId).toBeTruthy();
    expect(env1.envelopeHash).toBeTruthy();
    expect(env1.previousEnvelopeHash).toBe(GENESIS_HASH);

    const stats = getAuditStoreStats();
    expect(stats.chainLength).toBe(1);
    expect(stats.currentStoreSize).toBe(1);
  });

  // ── SH16: hash chain 무결성 ──
  it('SH16: 여러 envelope의 hash chain이 연결됨', () => {
    const env1 = appendAuditEnvelope({
      correlationId: 'corr-001',
      actorUserId: 'user-001',
      actorRole: 'buyer',
      actionType: 'dispatch_send_now',
      targetEntityType: 'po',
      targetEntityId: 'po-001',
      snapshotVersion: 'v1',
      beforeState: { status: 'ready' },
      afterState: { status: 'sent' },
      rationale: '발송',
      reasonCode: 'send',
      sourceSurface: 'workbench',
    });

    const env2 = appendAuditEnvelope({
      correlationId: 'corr-002',
      actorUserId: 'user-002',
      actorRole: 'approver',
      actionType: 'approval_decision',
      targetEntityType: 'po',
      targetEntityId: 'po-002',
      snapshotVersion: 'v2',
      beforeState: { status: 'pending' },
      afterState: { status: 'approved' },
      rationale: '승인',
      reasonCode: 'approve',
      sourceSurface: 'approval-workbench',
    });

    expect(env2.previousEnvelopeHash).toBe(env1.envelopeHash);

    const verification = verifyAuditChain();
    expect(verification.valid).toBe(true);
    expect(verification.chainLength).toBe(2);
  });

  // ── SH17: beforeHash / afterHash 비어 있지 않음 ──
  it('SH17: beforeHash / afterHash / correlationId가 비어 있지 않음', () => {
    const env = appendAuditEnvelope({
      correlationId: 'corr-001',
      actorUserId: 'user-001',
      actorRole: 'buyer',
      actionType: 'send_now',
      targetEntityType: 'po',
      targetEntityId: 'po-001',
      snapshotVersion: 'v1',
      beforeState: { status: 'ready' },
      afterState: { status: 'sent' },
      rationale: '테스트',
      reasonCode: 'test',
      sourceSurface: 'test',
    });

    expect(env.beforeHash).toBeTruthy();
    expect(env.afterHash).toBeTruthy();
    expect(env.correlationId).toBeTruthy();
    expect(env.beforeHash).not.toBe(env.afterHash);
  });

  // ── SH18: audit query 필터링 ──
  it('SH18: audit query가 actionType으로 필터링됨', () => {
    appendAuditEnvelope({
      correlationId: 'c1', actorUserId: 'u1', actorRole: 'buyer',
      actionType: 'send_now', targetEntityType: 'po', targetEntityId: 'po-001',
      snapshotVersion: 'v1', beforeState: {}, afterState: {},
      rationale: '', reasonCode: '', sourceSurface: '',
    });
    appendAuditEnvelope({
      correlationId: 'c2', actorUserId: 'u2', actorRole: 'approver',
      actionType: 'approval_decision', targetEntityType: 'po', targetEntityId: 'po-002',
      snapshotVersion: 'v1', beforeState: {}, afterState: {},
      rationale: '', reasonCode: '', sourceSurface: '',
    });

    const sendOnly = queryAuditEnvelopes({ actionType: 'send_now' });
    expect(sendOnly.length).toBe(1);
    expect(sendOnly[0].actorUserId).toBe('u1');
  });

  // ── SH19: state hash 결정론적 ──
  it('SH19: 같은 상태에 대해 같은 hash 생성', () => {
    const h1 = computeStateHash({ a: 1, b: 'hello' });
    const h2 = computeStateHash({ b: 'hello', a: 1 });
    expect(h1).toBe(h2);
  });

  // ── SH20: impossible transition — sent 이전에 supplier confirmed ──
  it('SH20: sent 없이 supplier_confirmed 전환 시 impossible transition 탐지', () => {
    const result = detectImpossibleTransition(
      'ready_to_send', 'supplier_confirmed',
      [], // sent 미충족
    );
    expect(result.detected).toBe(true);
    expect(result.violations[0].missingPrecondition).toBe('sent');
  });

  // ── SH21: approval 없이 conversion finalize 불가 ──
  it('SH21: approved 없이 conversion_finalized 전환 탐지', () => {
    const result = detectImpossibleTransition(
      'pending_approval', 'conversion_finalized',
      [], // approved 미충족
    );
    expect(result.detected).toBe(true);
    expect(result.violations[0].missingPrecondition).toBe('approved');
  });

  // ── SH22: 정상 전환은 통과 ──
  it('SH22: 선행 조건 충족 시 impossible transition 미탐지', () => {
    const result = detectImpossibleTransition(
      'ready_to_send', 'supplier_confirmed',
      ['sent'],
    );
    expect(result.detected).toBe(false);
  });

  // ── SH23: invalidated snapshot에서 send 불가 ──
  it('SH23: 무효화된 스냅샷 상태에서 sent 전환 탐지', () => {
    const result = detectImpossibleTransition(
      'snapshot_invalidated', 'sent',
      [],
    );
    expect(result.detected).toBe(true);
  });

  // ── SH24: security event 기록 ──
  it('SH24: security event가 기록되고 조회됨', () => {
    const provenance = createEventProvenance({
      sourceDomain: 'dispatch_prep',
      sourceSurface: 'workbench',
      sourceRoute: '/dispatch/123',
      actorUserId: 'user-001',
      targetEntityType: 'po',
      targetEntityId: 'po-001',
      correlationId: generateCorrelationId(),
    });

    recordSecurityEvent('security_event', provenance, 'Replay attack blocked');

    const events = querySecurityEvents({ classification: 'security_event' });
    expect(events.length).toBe(1);
    expect(events[0].detail).toContain('Replay');
  });

  // ── SH25: event security classification ──
  it('SH25: action type에 따라 security classification이 결정됨', () => {
    expect(classifyEventSecurity('send_now')).toBe('irreversible_action');
    expect(classifyEventSecurity('approval_decision')).toBe('governance_action');
    expect(classifyEventSecurity('auth_failure')).toBe('security_event');
    expect(classifyEventSecurity('status_change')).toBe('routine');
  });

  // ── SH26: correlation ID 유일성 ──
  it('SH26: correlation ID가 매번 다르게 생성됨', () => {
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();
    expect(id1).not.toBe(id2);
  });
});

// ═══════════════════════════════════════════════════════
// Batch C: Outbound / Attachment / Storage / Frontend Leak
// ═══════════════════════════════════════════════════════

describe('Security Batch C: Outbound / Attachment / Storage Hygiene', () => {
  // ── SH27: 정상 outbound payload 검증 통과 ──
  it('SH27: 완전한 payload가 검증 통과', () => {
    const result = validateOutboundPayload(makePayload());
    expect(result.valid).toBe(true);
    expect(result.blockers.length).toBe(0);
  });

  // ── SH28: supplier mismatch 차단 ──
  it('SH28: supplier 이름 불일치 시 차단', () => {
    const result = validateOutboundPayload(makePayload(), {
      expectedSupplierName: '다른공급사',
    });
    expect(result.valid).toBe(false);
    expect(result.blockers.some(b => b.type === 'supplier_mismatch')).toBe(true);
  });

  // ── SH29: recipient domain mismatch 차단 ──
  it('SH29: recipient 도메인 allowlist 불일치 시 차단', () => {
    const result = validateOutboundPayload(makePayload(), {
      allowedRecipientDomains: ['other-domain.com'],
    });
    expect(result.valid).toBe(false);
    expect(result.blockers.some(b => b.type === 'recipient_domain_mismatch')).toBe(true);
  });

  // ── SH30: missing attachment 차단 ──
  it('SH30: 필수 첨부 누락 시 차단', () => {
    const result = validateOutboundPayload(
      makePayload({ attachmentIds: [] }),
      { requiredAttachmentCount: 1 },
    );
    expect(result.valid).toBe(false);
    expect(result.blockers.some(b => b.type === 'required_attachment_missing')).toBe(true);
  });

  // ── SH31: policy hold active 차단 ──
  it('SH31: policy hold active 시 차단', () => {
    const result = validateOutboundPayload(makePayload(), { policyHoldActive: true });
    expect(result.valid).toBe(false);
    expect(result.blockers.some(b => b.type === 'policy_hold_active')).toBe(true);
  });

  // ── SH32: stale snapshot 차단 ──
  it('SH32: stale snapshot 시 발송 차단', () => {
    const result = validateOutboundPayload(makePayload(), { snapshotValid: false });
    expect(result.valid).toBe(false);
    expect(result.blockers.some(b => b.type === 'stale_snapshot')).toBe(true);
  });

  // ── SH33: internal field leak 탐지 ──
  it('SH33: outbound payload에 internal field 포함 시 탐지', () => {
    const leaks = detectInternalFieldLeak({
      poNumber: 'PO-001',
      internalNotes: '비밀 메모',
      internalRiskScore: 85,
    });
    expect(leaks).toContain('internalNotes');
    expect(leaks).toContain('internalRiskScore');
  });

  // ── SH34: payload sanitization ──
  it('SH34: sanitizePayloadForSupplier가 internal 필드 제거', () => {
    const raw = {
      poNumber: 'PO-001',
      supplierName: '공급사',
      internalNotes: '비밀',
      internalRiskScore: 90,
      approvalRationale: '승인 사유',
    };
    const sanitized = sanitizePayloadForSupplier(raw);
    expect(sanitized.poNumber).toBe('PO-001');
    expect(sanitized.supplierName).toBe('공급사');
    expect(sanitized).not.toHaveProperty('internalNotes');
    expect(sanitized).not.toHaveProperty('internalRiskScore');
    expect(sanitized).not.toHaveProperty('approvalRationale');
  });

  // ── SH35: 정상 첨부파일 검증 통과 ──
  it('SH35: PDF 첨부파일 검증 통과', () => {
    const result = validateAttachment(makeAttachment());
    expect(result.valid).toBe(true);
  });

  // ── SH36: 위험한 확장자 차단 ──
  it('SH36: exe 파일 차단', () => {
    const result = validateAttachment(makeAttachment({
      fileName: 'malware.exe',
      mimeType: 'application/x-msdownload',
      extension: 'exe',
    }));
    expect(result.valid).toBe(false);
    expect(result.blockers.some(b => b.type === 'suspicious_extension')).toBe(true);
  });

  // ── SH37: MIME type 불일치 차단 ──
  it('SH37: 확장자-MIME 불일치 차단', () => {
    const result = validateAttachment(makeAttachment({
      fileName: 'document.pdf',
      mimeType: 'image/png',
      extension: 'pdf',
    }));
    expect(result.valid).toBe(false);
    expect(result.blockers.some(b => b.type === 'extension_mime_mismatch')).toBe(true);
  });

  // ── SH38: 파일 크기 초과 차단 ──
  it('SH38: 50MB 초과 파일 차단', () => {
    const result = validateAttachment(makeAttachment({
      fileSizeBytes: 51 * 1024 * 1024,
    }));
    expect(result.valid).toBe(false);
    expect(result.blockers.some(b => b.type === 'file_too_large')).toBe(true);
  });

  // ── SH39: duplicate file 탐지 ──
  it('SH39: 동일 hash 파일 중복 탐지', () => {
    const existing = new Set(['abc123def456']);
    const result = validateAttachment(makeAttachment(), existing);
    expect(result.blockers.some(b => b.type === 'duplicate_file')).toBe(true);
  });

  // ── SH40: attachment batch 검증 ──
  it('SH40: batch 첨부파일 검증', () => {
    const result = validateAttachmentBatch([
      makeAttachment({ fileId: 'f1', contentHash: 'hash1' }),
      makeAttachment({ fileId: 'f2', contentHash: 'hash2' }),
    ]);
    expect(result.valid).toBe(true);
  });

  // ── SH41: attachment 변경 시 invalidation 필요 ──
  it('SH41: attachment removed 시 invalidation 필요', () => {
    expect(shouldInvalidateOnAttachmentChange({
      type: 'removed',
      fileId: 'f1',
      fileName: 'doc.pdf',
      targetEntityType: 'dispatch',
      targetEntityId: 'd1',
      actorUserId: 'u1',
      occurredAt: new Date().toISOString(),
    })).toBe(true);
  });

  // ── SH42: browser-unsafe 필드 분류 ──
  it('SH42: approvalRationale은 browser_unsafe', () => {
    expect(classifyField('approvalRationale')).toBe('browser_unsafe');
    expect(classifyField('poNumber')).toBe('browser_safe');
    expect(classifyField('auditEnvelope')).toBe('server_required');
  });

  // ── SH43: browser storage에 browser-unsafe payload 직접 저장되지 않음 ──
  it('SH43: sanitizeForBrowserStorage가 unsafe 필드 제거', () => {
    const { safePayload, removedFields } = sanitizeForBrowserStorage({
      poId: 'po-001',
      status: 'ready',
      approvalRationale: '승인 사유 원문',
      internalNotes: '내부 메모',
      supplierFacingPayload: { data: 'sensitive' },
    });
    expect(safePayload).toHaveProperty('poId');
    expect(safePayload).toHaveProperty('status');
    expect(safePayload).not.toHaveProperty('approvalRationale');
    expect(safePayload).not.toHaveProperty('internalNotes');
    expect(removedFields).toContain('approvalRationale');
    expect(removedFields).toContain('internalNotes');
  });

  // ── SH44: browser storage compliance audit ──
  it('SH44: auditBrowserStorageCompliance가 위반 탐지', () => {
    const { compliant, violations } = auditBrowserStorageCompliance({
      poId: 'po-001',
      approvalRationale: '비밀 사유',
    });
    expect(compliant).toBe(false);
    expect(violations.some(v => v.includes('approvalRationale'))).toBe(true);
  });

  // ── SH45: error sanitization — internal pattern 차단 ──
  it('SH45: internal error pattern이 sanitize됨', () => {
    expect(containsInternalPattern('at Function.execute (/src/lib/engine.ts:42:12)')).toBe(true);
    expect(containsInternalPattern('발송이 완료되었습니다')).toBe(false);
  });

  // ── SH46: error code → human-readable 변환 ──
  it('SH46: PERMISSION_DENIED → human-readable 메시지', () => {
    const result = sanitizeErrorForSurface('PERMISSION_DENIED');
    expect(result.category).toBe('permission_denied');
    expect(result.userMessage).not.toContain('PERMISSION');
    expect(result.retryable).toBe(false);
  });

  // ── SH47: 알 수 없는 에러 → fallback 메시지 ──
  it('SH47: 알 수 없는 에러 코드는 fallback', () => {
    const result = sanitizeErrorForSurface('UNKNOWN_INTERNAL_ERROR_XYZ');
    expect(result.category).toBe('system_error');
    expect(result.userMessage).not.toContain('UNKNOWN');
  });

  // ── SH48: display text에서 stack trace 제거 ──
  it('SH48: sanitizeDisplayText가 stack trace 제거', () => {
    const raw = 'Error occurred at Function.execute (/src/lib/engine.ts:42:12)\nSome text';
    const sanitized = sanitizeDisplayText(raw);
    expect(sanitized).not.toContain('/src/lib/');
    expect(sanitized).not.toContain(':42:12');
  });

  // ── SH49: confirmation text 제공 ──
  it('SH49: send_now confirmation text가 destructive 표시', () => {
    const conf = getConfirmationText('send_now');
    expect(conf.isDestructive).toBe(true);
    expect(conf.title).toContain('발송');
  });

  // ── SH50: secure persistence wrapper가 unsafe 필드 필터링 ──
  it('SH50: createSecurePersistenceWrapper가 persist 시 unsafe 필드 제거', () => {
    let stored: Record<string, unknown> | null = null;
    const mockAdapter = {
      load: () => stored,
      persist: (data: Record<string, unknown>) => { stored = data; },
      clear: () => { stored = null; },
      hydrateIfEmpty: (factory: () => Record<string, unknown>) => {
        if (!stored) stored = factory();
        return stored;
      },
    };

    const secure = createSecurePersistenceWrapper(mockAdapter);
    secure.persist({
      poId: 'po-001',
      approvalRationale: '비밀',
      internalNotes: '내부',
    });

    expect(stored).toHaveProperty('poId');
    expect(stored).not.toHaveProperty('approvalRationale');
    expect(stored).not.toHaveProperty('internalNotes');
  });
});
