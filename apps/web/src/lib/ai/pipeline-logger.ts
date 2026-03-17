/**
 * PDF BOM Extraction Pipeline — Structured Diagnostic Logger
 *
 * 모든 PDF 파이프라인 단계에서 공유하는 로깅 유틸리티.
 * requestId 기반으로 요청 전체 흐름을 추적할 수 있도록 설계됨.
 */

export type PipelineStage =
  | "upload_received"
  | "file_validated"
  | "pdf_parse_started"
  | "pdf_parse_completed"
  | "pdf_parse_failed"
  | "extracted_text_verified"
  | "ocr_fallback_needed"
  | "llm_request_started"
  | "llm_response_received"
  | "llm_request_failed"
  | "schema_validation"
  | "db_save_started"
  | "db_save_completed"
  | "final_success"
  | "final_failure";

export type PipelineErrorCode =
  | "UPLOAD_FAILED"
  | "UNSUPPORTED_FORMAT"
  | "PDF_ENCRYPTED"
  | "PDF_CORRUPT"
  | "PDF_INVALID"
  | "PDF_NO_TEXT"
  | "PDF_MODULE_ERROR"
  | "PDF_RUNTIME_ERROR"
  | "OCR_REQUIRED"
  | "LLM_AUTH_MISSING"
  | "LLM_AUTH_FAILED"
  | "LLM_MODEL_ERROR"
  | "LLM_TIMEOUT"
  | "LLM_PARSE_ERROR"
  | "SCHEMA_VALIDATION_FAILED"
  | "DB_SAVE_FAILED"
  | "TIMEOUT"
  | "UNKNOWN";

export interface PipelineLogEntry {
  stage: PipelineStage;
  requestId: string;
  timestamp: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  pageCount?: number;
  hasTextLayer?: boolean;
  extractedTextLength?: number;
  extractionMethod?: string;
  textPreview?: string;
  durationMs?: number;
  errorCode?: PipelineErrorCode;
  errorMessage?: string;
  model?: string;
  vendor?: string;
  itemCount?: number;
  confidence?: string;
  quoteId?: string;
  textLength?: number;
  [key: string]: unknown;
}

/**
 * 파이프라인 단계별 구조화 로그 출력
 *
 * 에러 단계(failed / final_failure)는 console.error,
 * 그 외는 console.log 로 출력.
 */
export function logPipelineStage(entry: PipelineLogEntry): void {
  const shortId = entry.requestId.slice(0, 12);
  const prefix = `[PDF Pipeline] [${shortId}] ${entry.stage}`;

  if (
    entry.errorCode ||
    entry.stage.includes("failed") ||
    entry.stage === "final_failure"
  ) {
    console.error(prefix, JSON.stringify(entry));
  } else {
    console.log(prefix, JSON.stringify(entry));
  }
}

/**
 * 고유 요청 ID 생성 (crypto 의존 없이 서버/클라이언트 모두 동작)
 */
export function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
