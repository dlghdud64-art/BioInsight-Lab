/**
 * Storage Hygiene Classifier
 *
 * Security Readiness Hardening Batch 0 — Security Batch C
 *
 * browser persistence에 저장되는 데이터의 민감도를 분류하고,
 * browser-unsafe 데이터가 직접 저장되지 않도록 합니다.
 *
 * 설계 원칙:
 * - browser-safe / browser-unsafe / server-required 3단계 분류
 * - approval rationale 원문, supplier-facing finalized payload 등은 browser-unsafe
 * - sessionStorage adapter가 남아 있어도 payload 전체 저장 금지
 * - sensitive content는 short-lived in-memory, re-entry 시 서버에서 hydrate
 */

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

export type StorageSensitivity =
  | 'browser_safe'      // sessionStorage/localStorage에 저장 가능
  | 'browser_unsafe'    // 브라우저 저장소에 남기면 안 됨 (in-memory only)
  | 'server_required';  // 반드시 서버에 저장해야 함

/** 데이터 필드의 민감도 분류 */
export interface FieldClassification {
  readonly fieldKey: string;
  readonly sensitivity: StorageSensitivity;
  readonly reason: string;
}

/** Storage 정제 결과 */
export interface SanitizedStoragePayload {
  /** browser-safe 필드만 포함된 payload */
  readonly safePayload: Record<string, unknown>;
  /** 제거된 필드 목록 */
  readonly removedFields: readonly string[];
  /** 경고 메시지 */
  readonly warnings: readonly string[];
}

// ═══════════════════════════════════════════════════════
// Classification Rules
// ═══════════════════════════════════════════════════════

/** Browser-unsafe 필드 — 절대 browser storage에 남기면 안 됨 */
const BROWSER_UNSAFE_FIELDS: ReadonlySet<string> = new Set([
  // Approval/Governance
  'approvalRationale',
  'approvalRationaleText',
  'decisionReason',
  'escalationReason',
  'policyHoldDetail',
  'policyHoldReasons',
  'complianceGateDetail',

  // Supplier-facing
  'supplierFacingPayload',
  'finalizedPayload',
  'outboundPayloadBody',
  'recipientContactEmail',
  'supplierContactDetails',

  // Contact/Billing/Shipping sensitive
  'billingAddress',
  'shippingAddress',
  'contactPhone',
  'contactPersonal',

  // Internal pricing
  'internalPricingExplanation',
  'budgetAllocationDetails',
  'costBreakdown',
  'marginAnalysis',

  // Internal notes
  'internalNotes',
  'internalRiskScore',
  'auditTraceId',
  'governanceEventIds',

  // Security
  'sessionToken',
  'accessToken',
  'refreshToken',
  'csrfToken',
]);

/** Server-required 필드 — 서버에 반드시 저장해야 하며 browser fallback 불가 */
const SERVER_REQUIRED_FIELDS: ReadonlySet<string> = new Set([
  'auditEnvelope',
  'auditChainHash',
  'complianceSnapshot',
  'decisionLogEntry',
  'permissionCheckResult',
  'outboundExecutionResult',
  'sentConfirmation',
  'supplierAcknowledgement',
]);

/** Browser-safe 필드 패턴 — 이 패턴의 필드만 browser storage 허용 */
const BROWSER_SAFE_PATTERNS: readonly string[] = [
  'Id',      // entity ID 참조
  'Number',  // PO number 등 참조
  'Status',  // 상태 코드 (민감하지 않은)
  'Version', // 버전 번호
  'At',      // timestamp
  'Count',   // 카운트
  'Hash',    // hash 참조값 (원문 아님)
  'Key',     // idempotency key 등 참조
];

// ═══════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════

/**
 * 개별 필드의 민감도 분류
 */
export function classifyField(fieldKey: string): StorageSensitivity {
  if (SERVER_REQUIRED_FIELDS.has(fieldKey)) return 'server_required';
  if (BROWSER_UNSAFE_FIELDS.has(fieldKey)) return 'browser_unsafe';
  return 'browser_safe';
}

/**
 * 객체의 모든 필드를 분류
 */
export function classifyAllFields(
  payload: Record<string, unknown>,
): readonly FieldClassification[] {
  const classifications: FieldClassification[] = [];

  for (const key of Object.keys(payload)) {
    const sensitivity = classifyField(key);
    let reason = '';

    switch (sensitivity) {
      case 'server_required':
        reason = '서버 저장 필수 — 감사/증거 데이터';
        break;
      case 'browser_unsafe':
        reason = '브라우저 저장 금지 — 민감 정보';
        break;
      case 'browser_safe':
        reason = '브라우저 저장 가능 — 참조/메타데이터';
        break;
    }

    classifications.push({ fieldKey: key, sensitivity, reason });
  }

  return classifications;
}

/**
 * Browser storage에 저장하기 전 payload 정제
 *
 * browser-unsafe / server-required 필드를 제거하고
 * browser-safe 필드만 포함된 payload를 반환합니다.
 *
 * 제거된 필드 목록과 경고도 함께 반환합니다.
 */
export function sanitizeForBrowserStorage(
  payload: Record<string, unknown>,
): SanitizedStoragePayload {
  const safePayload: Record<string, unknown> = {};
  const removedFields: string[] = [];
  const warnings: string[] = [];

  for (const [key, value] of Object.entries(payload)) {
    const sensitivity = classifyField(key);

    if (sensitivity === 'browser_safe') {
      // 중첩 객체도 재귀적으로 정제
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = sanitizeForBrowserStorage(value as Record<string, unknown>);
        safePayload[key] = nested.safePayload;
        removedFields.push(...nested.removedFields.map(f => `${key}.${f}`));
        warnings.push(...nested.warnings);
      } else {
        safePayload[key] = value;
      }
    } else {
      removedFields.push(key);
      if (sensitivity === 'server_required') {
        warnings.push(`${key}: 서버 저장 필수 데이터가 browser storage 요청에 포함됨`);
      }
    }
  }

  return { safePayload, removedFields, warnings };
}

/**
 * 기존 PersistenceAdapter를 감싸는 security wrapper
 *
 * persist() 호출 시 자동으로 browser-unsafe 필드를 제거합니다.
 * load() 시에는 원본 그대로 반환 (이미 정제된 상태).
 */
export function createSecurePersistenceWrapper<T extends Record<string, unknown>>(
  adapter: {
    load: () => T | null;
    persist: (data: T) => void;
    clear: () => void;
    hydrateIfEmpty: (factory: () => T) => T;
  },
): typeof adapter {
  return {
    load: () => adapter.load(),
    persist: (data: T) => {
      const { safePayload } = sanitizeForBrowserStorage(data);
      adapter.persist(safePayload as T);
    },
    clear: () => adapter.clear(),
    hydrateIfEmpty: (factory: () => T) => {
      return adapter.hydrateIfEmpty(() => {
        const data = factory();
        const { safePayload } = sanitizeForBrowserStorage(data);
        return safePayload as T;
      });
    },
  };
}

// ═══════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════

/**
 * Browser storage에 browser-unsafe 데이터가 없는지 검증
 *
 * 테스트 및 런타임 검증용
 */
export function auditBrowserStorageCompliance(
  storedPayload: Record<string, unknown>,
): {
  compliant: boolean;
  violations: readonly string[];
} {
  const violations: string[] = [];

  function checkRecursive(obj: Record<string, unknown>, path: string): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      const sensitivity = classifyField(key);

      if (sensitivity !== 'browser_safe') {
        violations.push(`${fullPath} (${sensitivity})`);
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        checkRecursive(value as Record<string, unknown>, fullPath);
      }
    }
  }

  checkRecursive(storedPayload, '');

  return {
    compliant: violations.length === 0,
    violations,
  };
}

// ═══════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════

export { BROWSER_UNSAFE_FIELDS, SERVER_REQUIRED_FIELDS, BROWSER_SAFE_PATTERNS };
