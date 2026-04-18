/**
 * Outbound Payload Security
 *
 * Security Readiness Hardening Batch 0 — Security Batch C
 *
 * supplier-facing outbound payload와 internal truth를 강하게 분리하고,
 * 발송 전 필수 검증을 수행합니다.
 *
 * 설계 원칙:
 * - internal notes/risk score/rationale/hidden policy signal이 outbound에 포함되면 안 됨
 * - supplier mismatch / recipient domain mismatch / attachment missing → 발송 차단
 * - outbound payload와 internal truth를 같은 model로 재사용 금지
 */

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

/** Outbound payload — supplier에게 전달되는 정보만 포함 */
export interface SupplierFacingPayload {
  readonly poNumber: string;
  readonly supplierName: string;
  readonly supplierContactEmail: string;
  readonly shippingAddress: string;
  readonly billingAddress: string;
  readonly lineItems: readonly OutboundLineItem[];
  readonly totalAmount: number;
  readonly currency: string;
  readonly requiredDeliveryDate?: string;
  readonly commercialTerms: readonly string[];
  readonly attachmentIds: readonly string[];
  readonly payloadGeneratedAt: string; // ISO
  readonly payloadVersion: string;
}

export interface OutboundLineItem {
  readonly itemName: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly unit: string;
  readonly specifications?: string;
}

/** Internal truth — 운영팀만 보는 정보 */
export interface InternalTruthFields {
  readonly internalNotes: string;
  readonly internalRiskScore: number;
  readonly approvalRationale: string;
  readonly policyHoldReasons: readonly string[];
  readonly budgetAllocationDetails: string;
  readonly internalPricingExplanation: string;
  readonly auditTraceId: string;
  readonly governanceEventIds: readonly string[];
}

/** Internal-only field key 목록 — 이 필드들은 outbound payload에 절대 포함 불가 */
const INTERNAL_ONLY_FIELDS: ReadonlySet<string> = new Set([
  'internalNotes',
  'internalRiskScore',
  'approvalRationale',
  'policyHoldReasons',
  'budgetAllocationDetails',
  'internalPricingExplanation',
  'auditTraceId',
  'governanceEventIds',
  'actorUserId',
  'sessionId',
  'permissionLevel',
  'roleCheck',
  'snapshotHash',
  'complianceGateDetail',
  'blockerSnapshot',
  'decisionLogId',
]);

/** Outbound 검증 결과 */
export interface OutboundValidationResult {
  readonly valid: boolean;
  readonly blockers: readonly OutboundBlocker[];
  readonly warnings: readonly string[];
  readonly validatedAt: string;
}

export interface OutboundBlocker {
  readonly type: OutboundBlockerType;
  /** human-readable 메시지 (internal key 미포함) */
  readonly governanceMessage: string;
  readonly severity: 'hard' | 'soft';
}

export type OutboundBlockerType =
  | 'supplier_identity_unverified'
  | 'recipient_contact_missing'
  | 'recipient_domain_mismatch'
  | 'billing_address_incomplete'
  | 'shipping_address_incomplete'
  | 'commercial_terms_missing'
  | 'required_attachment_missing'
  | 'policy_hold_active'
  | 'stale_snapshot'
  | 'internal_field_leak'
  | 'supplier_mismatch'
  | 'amount_mismatch';

/** Blocker type → human-readable 메시지 */
const BLOCKER_MESSAGES: Record<OutboundBlockerType, string> = {
  supplier_identity_unverified: '공급사 신원이 확인되지 않았습니다',
  recipient_contact_missing: '수신자 연락처가 누락되었습니다',
  recipient_domain_mismatch: '수신자 이메일 도메인이 공급사 정보와 일치하지 않습니다',
  billing_address_incomplete: '청구 주소가 불완전합니다',
  shipping_address_incomplete: '배송 주소가 불완전합니다',
  commercial_terms_missing: '필수 거래 조건이 누락되었습니다',
  required_attachment_missing: '필수 첨부 문서가 누락되었습니다',
  policy_hold_active: '정책 보류가 활성 상태입니다',
  stale_snapshot: '승인 기준이 변경되었습니다. 검토가 필요합니다',
  internal_field_leak: '내부 전용 정보가 발송 내용에 포함되어 있습니다',
  supplier_mismatch: '공급사 정보가 승인된 내용과 일치하지 않습니다',
  amount_mismatch: '금액이 승인된 내용과 일치하지 않습니다',
};

// ═══════════════════════════════════════════════════════
// Core Validation
// ═══════════════════════════════════════════════════════

/**
 * Internal field leak 검사
 *
 * outbound payload 객체에 internal-only field가 포함되어 있지 않은지 검증.
 * 재귀적으로 모든 중첩 객체도 검사합니다.
 */
export function detectInternalFieldLeak(
  payload: Record<string, unknown>,
  path = '',
): string[] {
  const leaks: string[] = [];

  for (const key of Object.keys(payload)) {
    const fullPath = path ? `${path}.${key}` : key;

    if (INTERNAL_ONLY_FIELDS.has(key)) {
      leaks.push(fullPath);
    }

    // 중첩 객체 재귀 검사
    const value = payload[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      leaks.push(...detectInternalFieldLeak(value as Record<string, unknown>, fullPath));
    }
  }

  return leaks;
}

/**
 * Supplier identity 검증
 */
function validateSupplierIdentity(
  payload: SupplierFacingPayload,
  expectedSupplierId?: string,
): OutboundBlocker | null {
  if (!payload.supplierName || payload.supplierName.trim().length === 0) {
    return {
      type: 'supplier_identity_unverified',
      governanceMessage: BLOCKER_MESSAGES.supplier_identity_unverified,
      severity: 'hard',
    };
  }
  return null;
}

/**
 * Recipient contact 검증
 */
function validateRecipientContact(
  payload: SupplierFacingPayload,
  allowedDomains?: readonly string[],
): OutboundBlocker[] {
  const blockers: OutboundBlocker[] = [];

  if (!payload.supplierContactEmail || payload.supplierContactEmail.trim().length === 0) {
    blockers.push({
      type: 'recipient_contact_missing',
      governanceMessage: BLOCKER_MESSAGES.recipient_contact_missing,
      severity: 'hard',
    });
    return blockers;
  }

  // Domain allowlist 검증
  if (allowedDomains && allowedDomains.length > 0) {
    const emailDomain = payload.supplierContactEmail.split('@')[1]?.toLowerCase();
    if (emailDomain && !allowedDomains.some(d => d.toLowerCase() === emailDomain)) {
      blockers.push({
        type: 'recipient_domain_mismatch',
        governanceMessage: BLOCKER_MESSAGES.recipient_domain_mismatch,
        severity: 'hard',
      });
    }
  }

  return blockers;
}

/**
 * Address completeness 검증
 */
function validateAddresses(payload: SupplierFacingPayload): OutboundBlocker[] {
  const blockers: OutboundBlocker[] = [];

  if (!payload.billingAddress || payload.billingAddress.trim().length < 10) {
    blockers.push({
      type: 'billing_address_incomplete',
      governanceMessage: BLOCKER_MESSAGES.billing_address_incomplete,
      severity: 'hard',
    });
  }

  if (!payload.shippingAddress || payload.shippingAddress.trim().length < 10) {
    blockers.push({
      type: 'shipping_address_incomplete',
      governanceMessage: BLOCKER_MESSAGES.shipping_address_incomplete,
      severity: 'hard',
    });
  }

  return blockers;
}

/**
 * Commercial terms 검증
 */
function validateCommercialTerms(
  payload: SupplierFacingPayload,
  requiredTerms?: readonly string[],
): OutboundBlocker | null {
  if (requiredTerms && requiredTerms.length > 0) {
    const missing = requiredTerms.filter(t => !payload.commercialTerms.includes(t));
    if (missing.length > 0) {
      return {
        type: 'commercial_terms_missing',
        governanceMessage: BLOCKER_MESSAGES.commercial_terms_missing,
        severity: 'hard',
      };
    }
  }
  return null;
}

/**
 * Attachment 검증
 */
function validateAttachments(
  payload: SupplierFacingPayload,
  requiredAttachmentCount?: number,
): OutboundBlocker | null {
  const minRequired = requiredAttachmentCount ?? 0;
  if (payload.attachmentIds.length < minRequired) {
    return {
      type: 'required_attachment_missing',
      governanceMessage: BLOCKER_MESSAGES.required_attachment_missing,
      severity: 'hard',
    };
  }
  return null;
}

/**
 * 전체 outbound payload 검증
 *
 * hard blocker가 1건이라도 있으면 발송 차단.
 * supplier mismatch / recipient mismatch / missing attachment 시 차단.
 */
export function validateOutboundPayload(
  payload: SupplierFacingPayload,
  context: {
    allowedRecipientDomains?: readonly string[];
    requiredCommercialTerms?: readonly string[];
    requiredAttachmentCount?: number;
    policyHoldActive?: boolean;
    snapshotValid?: boolean;
    expectedSupplierName?: string;
    expectedTotalAmount?: number;
  } = {},
): OutboundValidationResult {
  const blockers: OutboundBlocker[] = [];
  const warnings: string[] = [];

  // 1. Internal field leak 검사
  const leaks = detectInternalFieldLeak(payload as unknown as Record<string, unknown>);
  if (leaks.length > 0) {
    blockers.push({
      type: 'internal_field_leak',
      governanceMessage: BLOCKER_MESSAGES.internal_field_leak,
      severity: 'hard',
    });
  }

  // 2. Supplier identity
  const supplierBlocker = validateSupplierIdentity(payload);
  if (supplierBlocker) blockers.push(supplierBlocker);

  // 3. Supplier mismatch
  if (context.expectedSupplierName &&
      payload.supplierName !== context.expectedSupplierName) {
    blockers.push({
      type: 'supplier_mismatch',
      governanceMessage: BLOCKER_MESSAGES.supplier_mismatch,
      severity: 'hard',
    });
  }

  // 4. Amount mismatch
  if (context.expectedTotalAmount !== undefined &&
      payload.totalAmount !== context.expectedTotalAmount) {
    blockers.push({
      type: 'amount_mismatch',
      governanceMessage: BLOCKER_MESSAGES.amount_mismatch,
      severity: 'hard',
    });
  }

  // 5. Recipient contact
  blockers.push(...validateRecipientContact(payload, context.allowedRecipientDomains));

  // 6. Addresses
  blockers.push(...validateAddresses(payload));

  // 7. Commercial terms
  const termsBlocker = validateCommercialTerms(payload, context.requiredCommercialTerms);
  if (termsBlocker) blockers.push(termsBlocker);

  // 8. Attachments
  const attachBlocker = validateAttachments(payload, context.requiredAttachmentCount);
  if (attachBlocker) blockers.push(attachBlocker);

  // 9. Policy hold
  if (context.policyHoldActive) {
    blockers.push({
      type: 'policy_hold_active',
      governanceMessage: BLOCKER_MESSAGES.policy_hold_active,
      severity: 'hard',
    });
  }

  // 10. Snapshot validity
  if (context.snapshotValid === false) {
    blockers.push({
      type: 'stale_snapshot',
      governanceMessage: BLOCKER_MESSAGES.stale_snapshot,
      severity: 'hard',
    });
  }

  return {
    valid: blockers.filter(b => b.severity === 'hard').length === 0,
    blockers,
    warnings,
    validatedAt: new Date().toISOString(),
  };
}

/**
 * Payload를 supplier-facing 안전 형태로 정제
 *
 * internal-only field를 제거하고 supplier-safe 필드만 남깁니다.
 */
export function sanitizePayloadForSupplier(
  rawPayload: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rawPayload)) {
    if (INTERNAL_ONLY_FIELDS.has(key)) continue;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizePayloadForSupplier(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ═══════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════

export { INTERNAL_ONLY_FIELDS, BLOCKER_MESSAGES };
