/**
 * Security Module — LabAxis Security Readiness Hardening
 *
 * Batch 0-A: Irreversible Action Protection
 * - server-authorization-guard — 서버 authoritative permission check
 * - mutation-replay-guard — CSRF, idempotency, replay 방어
 *
 * Batch 0-B: Audit & Event Provenance
 * - audit-integrity-engine — append-only, tamper-evident hash chain audit
 * - event-provenance-engine — impossible transition detection, security event classification
 *
 * Batch 0-C: Outbound / Attachment / Storage Hygiene
 * - outbound-payload-security — supplier-facing payload 검증, internal field leak 방지
 * - attachment-security-engine — MIME/확장자/크기/hash 검증
 * - storage-hygiene-classifier — browser-safe/unsafe/server-required 분류
 * - frontend-leak-guard — error sanitization, confirmation text, internal key 차단
 *
 * Batch 1: Server Enforcement Wiring
 * - server-enforcement-middleware — Next.js API route에 authorization + replay guard 자동 적용
 *
 * Batch 2: Audit Persistence (adapter boundary)
 * - audit-persistence-adapter — in-memory → Supabase 교체 가능한 adapter
 *
 * Batch 3: Crypto Hash Upgrade
 * - crypto-hash-engine — Web Crypto SHA-256 + HMAC + secure random
 *
 * Batch 4: Mutation Rate Limiting
 * - mutation-rate-limiter — actor + action + entity 기반 3단계 rate limit
 *
 * Batch 5: Payload Encryption at Rest (adapter boundary)
 * - payload-encryption-adapter — plaintext fallback → AES-GCM 교체 가능한 adapter
 */

export {
  checkServerAuthorization,
  checkBatchAuthorization,
  getDenialMessage,
  type ServerActorContext,
  type AuthorizationRequest,
  type AuthorizationResult,
  type IrreversibleActionType,
  type SystemRole,
  type EntityCapability,
} from './server-authorization-guard';

export {
  checkMutationReplayGuard,
  generateCsrfToken as generateMutationCsrfToken,
  beginMutation,
  completeMutation,
  failMutation,
  validateReadyToSendBoundary,
  type MutationRequest,
  type MutationGuardResult,
  type MutationActionType,
} from './mutation-replay-guard';

export {
  appendAuditEnvelope,
  verifyAuditChain,
  queryAuditEnvelopes,
  getAuditStoreStats,
  computeStateHash,
  type AuditEnvelope,
  type AppendAuditInput,
  type ChainVerificationResult,
  type SecurityClassification,
} from './audit-integrity-engine';

export {
  createEventProvenance,
  generateCorrelationId,
  detectImpossibleTransition,
  recordSecurityEvent,
  querySecurityEvents,
  classifyEventSecurity,
  type EventProvenance,
  type EventSecurityClassification,
  type ImpossibleTransitionResult,
  type TransitionViolation,
} from './event-provenance-engine';

export {
  validateOutboundPayload,
  detectInternalFieldLeak,
  sanitizePayloadForSupplier,
  type SupplierFacingPayload,
  type OutboundValidationResult,
  type OutboundBlocker,
  type OutboundBlockerType,
} from './outbound-payload-security';

export {
  validateAttachment,
  validateAttachmentBatch,
  shouldInvalidateOnAttachmentChange,
  type AttachmentMetadata,
  type AttachmentValidationResult,
  type AttachmentBlocker,
  type AttachmentChangeEvent,
} from './attachment-security-engine';

export {
  classifyField,
  classifyAllFields,
  sanitizeForBrowserStorage,
  createSecurePersistenceWrapper,
  auditBrowserStorageCompliance,
  type StorageSensitivity,
  type FieldClassification,
  type SanitizedStoragePayload,
} from './storage-hygiene-classifier';

export {
  sanitizeErrorForSurface,
  sanitizeDisplayText,
  containsInternalPattern,
  getConfirmationText,
  type SafeErrorMessage,
  type ErrorCategory,
} from './frontend-leak-guard';

// ── Batch 1: Server Enforcement Wiring ──
export {
  withEnforcement,
  withReadAuthorization,
  buildActorContextFromSession,
  enforceAction,
  ENFORCEMENT_PRESETS,
  type EnforcementConfig,
  type EnforcementResult,
  type InlineEnforcementConfig,
  type InlineEnforcementHandle,
} from './server-enforcement-middleware';

// ── Batch 2 + 6: Audit Persistence Adapter (durable) ──
export {
  getAuditPersistenceAdapter,
  setAuditPersistenceAdapter,
  getAuditAdapterType,
  InMemoryAuditAdapter,
  PrismaAuditAdapter,
  SupabaseAuditAdapterStub,
  type AuditPersistenceAdapter,
  type AuditQueryFilter,
  type AuditStoreStats,
} from './audit-persistence-adapter';

// ── Batch 3: Crypto Hash Engine ──
export {
  sha256Hash,
  computeSecureStateHash,
  djb2Hash,
  computeStateHashSync,
  hmacSha256,
  secureRandomHex,
  generateSecureCsrfToken,
  generateSecureIdempotencyKey,
  verifyChainWithSha256,
  deterministicStringify,
  isCryptoAvailable,
  type HashResult,
} from './crypto-hash-engine';

// ── Batch 4 + 9: Mutation Rate Limiter (Redis-ready) ──
export {
  checkMutationRateLimit,
  getRateLimitStatus,
  pruneExpiredBuckets,
  setRateLimitAdapter,
  getRateLimitAdapterType,
  InMemoryRateLimitAdapter,
  RedisRateLimitAdapter,
  type MutationRateLimitResult,
  type RateLimitedAction,
  type RateLimitPersistenceAdapter,
} from './mutation-rate-limiter';

// ── Batch 5 + 7: Payload Encryption Adapter (AES-256-GCM) ──
export {
  getEncryptionAdapter,
  setEncryptionAdapter,
  getEncryptionAdapterType,
  createPurposeAdapter,
  deriveKey,
  PlaintextFallbackAdapter,
  AesGcmEncryptionAdapter,
  AesGcmAdapterStub,
  EnvKeyProvider,
  type PayloadEncryptionAdapter,
  type EncryptedPayload,
  type EncryptionKeyProvider,
  type KeyPurpose,
} from './payload-encryption-adapter';

// ── Batch 10: CSRF Full Enforcement ──
export {
  CSRF_HEADER_NAME,
  CSRF_COOKIE_NAME,
  CSRF_PROTECTED_METHODS,
  CSRF_TOKEN_TTL_MS,
  CSRF_TOKEN_MAX_AGE_MS,
  getCsrfRolloutMode,
  getCsrfGovernanceMessage,
  isProtectedMethod,
  isTrustedOrigin,
  shouldBlockOnViolation,
  type CsrfRolloutMode,
  type CsrfProtectionLevel,
  type CsrfValidationResult,
  type CsrfViolationType,
  type CsrfTelemetryEvent,
  type RouteCsrfConfig,
} from './csrf-contract';

export {
  generateCsrfToken,
  generateCsrfTokenSync,
  validateCsrfDoubleSubmit,
  validateCsrfDoubleSubmitSync,
  isCsrfTokenExpired,
  shouldRefreshCsrfToken,
  buildCsrfCookieHeader,
} from './csrf-token-engine';

export {
  performCsrfCheck,
  type CsrfCheckContext,
  type CsrfCheckResult,
} from './csrf-middleware';
