/**
 * Frontend Leak Guard
 *
 * Security Readiness Hardening Batch 0 — Security Batch C
 *
 * surface에 internal key / enum / raw status / policy code /
 * supplier secret / debug label이 노출되지 않도록 합니다.
 *
 * 설계 원칙:
 * - human-readable 라벨만 노출
 * - stack trace, raw SQL-like message, internal condition string 노출 금지
 * - security denial message는 운영 언어로 변환
 */

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

/** 에러 메시지 분류 */
export type ErrorCategory =
  | 'permission_denied'
  | 'validation_failed'
  | 'system_error'
  | 'network_error'
  | 'session_error'
  | 'governance_blocked';

/** Sanitized 에러 — UI surface용 */
export interface SafeErrorMessage {
  readonly category: ErrorCategory;
  readonly userMessage: string;
  readonly actionHint?: string;
  readonly retryable: boolean;
}

// ═══════════════════════════════════════════════════════
// Internal Key Detection
// ═══════════════════════════════════════════════════════

/** 내부 키/코드 패턴 — 이 패턴이 포함되면 사용자에게 노출하면 안 됨 */
const INTERNAL_PATTERNS: readonly RegExp[] = [
  // Stack traces
  /at\s+\w+\s+\(.*:\d+:\d+\)/,
  /Error:\s*\w+Error/,
  /TypeError:|ReferenceError:|SyntaxError:/,

  // SQL-like patterns
  /SELECT\s+.*FROM/i,
  /INSERT\s+INTO/i,
  /UPDATE\s+.*SET/i,
  /DELETE\s+FROM/i,

  // Internal keys
  /^[A-Z_]{3,}_[A-Z_]{3,}$/,   // POLICY_HOLD_ACTIVE 같은 상수
  /permission_check_\w+/,
  /policy_constraint_\w+/,
  /governance_gate_\w+/,

  // File paths
  /\/src\/|\/lib\/|\/components\//,
  /\.tsx?:\d+/,

  // Debug labels
  /\[DEBUG\]|\[TRACE\]|\[INTERNAL\]/,

  // Raw IDs that look like UUIDs or internal format
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,

  // JSON-like raw payloads
  /^\{.*"[a-zA-Z]+":.*\}$/,
];

/**
 * 텍스트에 internal 패턴이 포함되어 있는지 검사
 */
export function containsInternalPattern(text: string): boolean {
  return INTERNAL_PATTERNS.some(pattern => pattern.test(text));
}

// ═══════════════════════════════════════════════════════
// Error Sanitization
// ═══════════════════════════════════════════════════════

/** 내부 에러 코드 → human-readable 운영 메시지 */
const ERROR_MESSAGE_MAP: Record<string, SafeErrorMessage> = {
  // Permission
  PERMISSION_DENIED: {
    category: 'permission_denied',
    userMessage: '현재 권한으로는 이 작업을 실행할 수 없습니다',
    actionHint: '관리자에게 권한을 요청하세요',
    retryable: false,
  },
  ROLE_INSUFFICIENT: {
    category: 'permission_denied',
    userMessage: '현재 역할로는 이 작업을 실행할 수 없습니다',
    actionHint: '필요한 권한이 있는 담당자에게 요청하세요',
    retryable: false,
  },
  ORG_MISMATCH: {
    category: 'permission_denied',
    userMessage: '다른 조직의 항목에 대한 작업 권한이 없습니다',
    retryable: false,
  },
  SELF_APPROVAL_FORBIDDEN: {
    category: 'permission_denied',
    userMessage: '동일인이 요청하고 승인할 수 없습니다',
    actionHint: '별도 승인자에게 요청해주세요',
    retryable: false,
  },

  // Validation
  SNAPSHOT_INVALIDATED: {
    category: 'governance_blocked',
    userMessage: '승인 기준이 변경되어 다시 검토가 필요합니다',
    actionHint: '변경 사항을 확인한 후 다시 진행해주세요',
    retryable: true,
  },
  POLICY_HOLD_ACTIVE: {
    category: 'governance_blocked',
    userMessage: '정책 보류가 활성 상태입니다',
    actionHint: '정책 보류가 해제된 후 진행 가능합니다',
    retryable: true,
  },
  STALE_SNAPSHOT: {
    category: 'governance_blocked',
    userMessage: '데이터가 변경되었습니다',
    actionHint: '최신 상태를 확인한 후 다시 시도해주세요',
    retryable: true,
  },
  DUPLICATE_MUTATION: {
    category: 'validation_failed',
    userMessage: '이 작업은 이미 처리되었습니다',
    retryable: false,
  },
  CSRF_INVALID: {
    category: 'session_error',
    userMessage: '요청 검증에 실패했습니다',
    actionHint: '페이지를 새로고침한 후 다시 시도해주세요',
    retryable: true,
  },
  REQUEST_EXPIRED: {
    category: 'session_error',
    userMessage: '요청이 만료되었습니다',
    actionHint: '다시 시도해주세요',
    retryable: true,
  },

  // System
  CONCURRENT_MUTATION: {
    category: 'system_error',
    userMessage: '같은 항목에 대한 다른 작업이 진행 중입니다',
    actionHint: '잠시 후 다시 시도해주세요',
    retryable: true,
  },
  NETWORK_ERROR: {
    category: 'network_error',
    userMessage: '네트워크 연결을 확인해주세요',
    actionHint: '연결 확인 후 다시 시도해주세요',
    retryable: true,
  },

  // Outbound
  SUPPLIER_MISMATCH: {
    category: 'governance_blocked',
    userMessage: '공급사 정보가 승인된 내용과 일치하지 않습니다',
    actionHint: '공급사 정보를 확인해주세요',
    retryable: true,
  },
  RECIPIENT_MISSING: {
    category: 'validation_failed',
    userMessage: '수신자 연락처가 누락되었습니다',
    actionHint: '수신자 정보를 입력해주세요',
    retryable: true,
  },
  ATTACHMENT_BLOCKED: {
    category: 'validation_failed',
    userMessage: '첨부 파일에 문제가 있습니다',
    actionHint: '파일 형식과 크기를 확인해주세요',
    retryable: true,
  },
};

/** Fallback 메시지 — 매핑되지 않은 에러 */
const FALLBACK_ERROR: SafeErrorMessage = {
  category: 'system_error',
  userMessage: '일시적인 오류가 발생했습니다',
  actionHint: '잠시 후 다시 시도해주세요',
  retryable: true,
};

/**
 * 에러 메시지 sanitization — internal 코드를 human-readable로 변환
 *
 * raw error message를 직접 UI에 표시하면 안 됩니다.
 * 이 함수를 통해 변환된 SafeErrorMessage만 surface에 반영하세요.
 */
export function sanitizeErrorForSurface(
  errorCode: string,
  rawMessage?: string,
): SafeErrorMessage {
  // 1. 알려진 에러 코드 매핑
  const mapped = ERROR_MESSAGE_MAP[errorCode.toUpperCase()];
  if (mapped) return mapped;

  // 2. 에러 코드 자체에 internal 패턴이 있으면 fallback
  if (containsInternalPattern(errorCode)) return FALLBACK_ERROR;

  // 3. raw message에 internal 패턴이 있으면 fallback
  if (rawMessage && containsInternalPattern(rawMessage)) return FALLBACK_ERROR;

  // 4. 에러 코드를 snake_case → 기본 카테고리 추론
  if (errorCode.includes('permission') || errorCode.includes('denied') || errorCode.includes('forbidden')) {
    return {
      category: 'permission_denied',
      userMessage: '현재 권한으로는 실행이 제한됩니다',
      retryable: false,
    };
  }

  if (errorCode.includes('timeout') || errorCode.includes('network')) {
    return {
      category: 'network_error',
      userMessage: '네트워크 연결을 확인해주세요',
      retryable: true,
    };
  }

  return FALLBACK_ERROR;
}

/**
 * 텍스트에서 민감한 정보 제거
 *
 * toast / error panel / rail에 표시되는 텍스트를 정제합니다.
 * internal key, stack trace, raw SQL, file path 등을 제거합니다.
 */
export function sanitizeDisplayText(text: string): string {
  if (!text) return '';

  // Stack trace 제거
  let sanitized = text.replace(/at\s+\w+\s+\(.*:\d+:\d+\)/g, '');

  // File path 제거
  sanitized = sanitized.replace(/\/[a-zA-Z]+\/[a-zA-Z\/\-_.]+\.(ts|tsx|js|jsx)/g, '');

  // 내부 에러 클래스명 제거
  sanitized = sanitized.replace(/(TypeError|ReferenceError|SyntaxError|RangeError):\s*/g, '');

  // 남은 줄바꿈/공백 정리
  sanitized = sanitized.replace(/\n{2,}/g, '\n').trim();

  // 결과가 비었거나 여전히 internal 패턴이면 fallback
  if (!sanitized || containsInternalPattern(sanitized)) {
    return '일시적인 오류가 발생했습니다';
  }

  return sanitized;
}

/**
 * Confirmation dialog에서 사용할 action 설명 텍스트 생성
 *
 * destructive/irreversible action에 대한 explicit confirmation 요구.
 * confirmation 자체가 fake unlock이 되지 않도록 경고 메시지를 포함.
 */
export function getConfirmationText(actionType: string): {
  title: string;
  description: string;
  confirmLabel: string;
  isDestructive: boolean;
} {
  const CONFIRMATION_MAP: Record<string, { title: string; description: string; confirmLabel: string; isDestructive: boolean }> = {
    send_now: {
      title: '지금 발송하시겠습니까?',
      description: '발송 후에는 취소할 수 없습니다. 모든 내용이 정확한지 확인해주세요.',
      confirmLabel: '발송 실행',
      isDestructive: true,
    },
    schedule_send: {
      title: '발송을 예약하시겠습니까?',
      description: '예약된 시간에 자동으로 발송됩니다. 예약 후 취소는 가능합니다.',
      confirmLabel: '예약 확정',
      isDestructive: false,
    },
    po_conversion_finalize: {
      title: 'PO 전환을 확정하시겠습니까?',
      description: '확정 후에는 승인 내용을 기반으로 발송 준비가 시작됩니다.',
      confirmLabel: '전환 확정',
      isDestructive: true,
    },
    approval_decision: {
      title: '승인 결정을 확정하시겠습니까?',
      description: '승인 결정은 기록되며, 이후 절차에 영향을 미칩니다.',
      confirmLabel: '결정 확정',
      isDestructive: true,
    },
    quote_request_submit: {
      title: '견적 요청을 제출하시겠습니까?',
      description: '제출 후 공급사에게 요청이 전달됩니다.',
      confirmLabel: '제출',
      isDestructive: false,
    },
  };

  return CONFIRMATION_MAP[actionType] ?? {
    title: '이 작업을 실행하시겠습니까?',
    description: '실행 후 되돌릴 수 없을 수 있습니다.',
    confirmLabel: '실행',
    isDestructive: false,
  };
}

// ═══════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════

export { ERROR_MESSAGE_MAP, FALLBACK_ERROR, INTERNAL_PATTERNS };
