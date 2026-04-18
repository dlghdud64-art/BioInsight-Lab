/**
 * Attachment Security Engine
 *
 * Security Readiness Hardening Batch 0 — Security Batch C
 *
 * quote request / dispatch에서 사용하는 첨부 문서 보안 검증.
 *
 * 설계 원칙:
 * - MIME type, 확장자, 파일 크기, duplicate hash 검증
 * - unsupported / suspicious file은 업로드 및 발송 첨부 차단
 * - attachment removed/replaced 이벤트는 invalidation + audit 모두 기록
 * - document missing blocker는 실제 send/schedule 차단과 연결
 */

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

export interface AttachmentMetadata {
  readonly fileId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly extension: string;
  readonly fileSizeBytes: number;
  readonly contentHash: string;
  readonly uploadedAt: string;
  readonly uploadedBy: string;
}

export interface AttachmentValidationResult {
  readonly valid: boolean;
  readonly blockers: readonly AttachmentBlocker[];
  readonly warnings: readonly string[];
  readonly validatedAt: string;
}

export interface AttachmentBlocker {
  readonly type: AttachmentBlockerType;
  readonly governanceMessage: string;
  readonly severity: 'hard' | 'soft';
  readonly fileId?: string;
  readonly fileName?: string;
}

export type AttachmentBlockerType =
  | 'unsupported_mime_type'
  | 'suspicious_extension'
  | 'extension_mime_mismatch'
  | 'file_too_large'
  | 'file_empty'
  | 'duplicate_file'
  | 'preview_unsafe';

/** 허용된 MIME types */
const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
]);

/** 허용된 확장자 */
const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  'pdf', 'doc', 'docx', 'xlsx', 'xls', 'pptx',
  'png', 'jpg', 'jpeg', 'gif', 'webp',
  'txt', 'csv',
]);

/** 위험한 확장자 — 절대 차단 */
const DANGEROUS_EXTENSIONS: ReadonlySet<string> = new Set([
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif',
  'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'ps1',
  'sh', 'bash', 'csh', 'ksh',
  'dll', 'sys', 'drv',
  'reg', 'inf',
  'hta', 'cpl',
  'jar', 'class',
  'py', 'rb', 'pl',
]);

/** MIME type ↔ 확장자 매핑 */
const MIME_EXTENSION_MAP: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'text/plain': ['txt'],
  'text/csv': ['csv'],
};

/** 최대 파일 크기 (50MB) */
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Preview-safe MIME types */
const PREVIEW_SAFE_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
]);

// ═══════════════════════════════════════════════════════
// Blocker Messages
// ═══════════════════════════════════════════════════════

const ATTACHMENT_BLOCKER_MESSAGES: Record<AttachmentBlockerType, string> = {
  unsupported_mime_type: '지원되지 않는 파일 형식입니다',
  suspicious_extension: '보안 위험이 있는 파일 확장자입니다',
  extension_mime_mismatch: '파일 확장자와 내용 유형이 일치하지 않습니다',
  file_too_large: '파일 크기가 허용 한도를 초과합니다',
  file_empty: '빈 파일은 첨부할 수 없습니다',
  duplicate_file: '동일한 파일이 이미 첨부되어 있습니다',
  preview_unsafe: '미리보기가 지원되지 않는 파일 형식입니다',
};

// ═══════════════════════════════════════════════════════
// Core Validation
// ═══════════════════════════════════════════════════════

/** 단일 첨부파일 검증 */
export function validateAttachment(
  metadata: AttachmentMetadata,
  existingHashes?: ReadonlySet<string>,
): AttachmentValidationResult {
  const blockers: AttachmentBlocker[] = [];
  const warnings: string[] = [];
  const validatedAt = new Date().toISOString();

  const ext = metadata.extension.toLowerCase().replace(/^\./, '');

  // 1. 위험한 확장자 차단
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    blockers.push({
      type: 'suspicious_extension',
      governanceMessage: ATTACHMENT_BLOCKER_MESSAGES.suspicious_extension,
      severity: 'hard',
      fileId: metadata.fileId,
      fileName: metadata.fileName,
    });
  }

  // 2. 허용된 MIME type 확인
  if (!ALLOWED_MIME_TYPES.has(metadata.mimeType)) {
    blockers.push({
      type: 'unsupported_mime_type',
      governanceMessage: ATTACHMENT_BLOCKER_MESSAGES.unsupported_mime_type,
      severity: 'hard',
      fileId: metadata.fileId,
      fileName: metadata.fileName,
    });
  }

  // 3. 확장자 허용 확인
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    blockers.push({
      type: 'suspicious_extension',
      governanceMessage: ATTACHMENT_BLOCKER_MESSAGES.suspicious_extension,
      severity: 'hard',
      fileId: metadata.fileId,
      fileName: metadata.fileName,
    });
  }

  // 4. MIME ↔ 확장자 일치 검사
  const expectedExtensions = MIME_EXTENSION_MAP[metadata.mimeType];
  if (expectedExtensions && !expectedExtensions.includes(ext)) {
    blockers.push({
      type: 'extension_mime_mismatch',
      governanceMessage: ATTACHMENT_BLOCKER_MESSAGES.extension_mime_mismatch,
      severity: 'hard',
      fileId: metadata.fileId,
      fileName: metadata.fileName,
    });
  }

  // 5. 파일 크기 검증
  if (metadata.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    blockers.push({
      type: 'file_too_large',
      governanceMessage: ATTACHMENT_BLOCKER_MESSAGES.file_too_large,
      severity: 'hard',
      fileId: metadata.fileId,
      fileName: metadata.fileName,
    });
  }

  if (metadata.fileSizeBytes === 0) {
    blockers.push({
      type: 'file_empty',
      governanceMessage: ATTACHMENT_BLOCKER_MESSAGES.file_empty,
      severity: 'hard',
      fileId: metadata.fileId,
      fileName: metadata.fileName,
    });
  }

  // 6. Duplicate hash 검사
  if (existingHashes && existingHashes.has(metadata.contentHash)) {
    blockers.push({
      type: 'duplicate_file',
      governanceMessage: ATTACHMENT_BLOCKER_MESSAGES.duplicate_file,
      severity: 'soft',
      fileId: metadata.fileId,
      fileName: metadata.fileName,
    });
  }

  // 7. Preview safety
  if (!PREVIEW_SAFE_MIME_TYPES.has(metadata.mimeType)) {
    warnings.push(`${metadata.fileName}: 미리보기가 지원되지 않습니다`);
  }

  return {
    valid: blockers.filter(b => b.severity === 'hard').length === 0,
    blockers,
    warnings,
    validatedAt,
  };
}

/** Batch 첨부파일 검증 */
export function validateAttachmentBatch(
  attachments: readonly AttachmentMetadata[],
): AttachmentValidationResult {
  const allBlockers: AttachmentBlocker[] = [];
  const allWarnings: string[] = [];
  const existingHashes = new Set<string>();
  const validatedAt = new Date().toISOString();

  for (const attachment of attachments) {
    const result = validateAttachment(attachment, existingHashes);
    allBlockers.push(...result.blockers);
    allWarnings.push(...result.warnings);
    existingHashes.add(attachment.contentHash);
  }

  return {
    valid: allBlockers.filter(b => b.severity === 'hard').length === 0,
    blockers: allBlockers,
    warnings: allWarnings,
    validatedAt,
  };
}

/** Attachment 변경 이벤트 — invalidation + audit 기록용 */
export interface AttachmentChangeEvent {
  readonly type: 'added' | 'removed' | 'replaced';
  readonly fileId: string;
  readonly fileName: string;
  readonly targetEntityType: string;
  readonly targetEntityId: string;
  readonly actorUserId: string;
  readonly occurredAt: string;
  readonly previousFileId?: string;
}

/**
 * Attachment 변경 시 invalidation이 필요한지 판정
 *
 * attachment added/removed/replaced → dispatch payload validity 재계산 필요
 */
export function shouldInvalidateOnAttachmentChange(
  event: AttachmentChangeEvent,
): boolean {
  // 모든 attachment 변경은 payload validity에 영향
  return true;
}

// ═══════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════

export {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  DANGEROUS_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  PREVIEW_SAFE_MIME_TYPES,
  ATTACHMENT_BLOCKER_MESSAGES,
};
