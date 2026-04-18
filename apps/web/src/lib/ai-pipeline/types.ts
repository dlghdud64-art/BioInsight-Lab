/**
 * ══════════════════════════════════════════════════════════
 * Package A — 통합 AI 운영 레이어 공통 타입 정의
 * ══════════════════════════════════════════════════════════
 *
 * 이 파일은 Ingestion → Classification → Extraction → Entity Linking
 * → Verification → Work Queue → Audit Trail 파이프라인 전체에서
 * 사용하는 공통 TypeScript Interface를 정의합니다.
 *
 * ⚠️ 도메인(Quote/Order/Inventory)에 종속되지 않는 공통 스키마입니다.
 * ⚠️ Prisma Enum과 1:1 매핑되며, Prisma 타입은 런타임에서 import합니다.
 */

// ──────────────────────────────────────────────────────────
// A-3. Extraction Result — AI가 문서에서 추출한 구조화된 필드
// ──────────────────────────────────────────────────────────

/** 개별 추출 필드와 해당 Confidence Score */
export interface ExtractedField<T = string | number | null> {
  value: T;
  confidence: number; // 0.0 ~ 1.0
  /** AI가 원본에서 해당 필드를 추출한 위치/근거 (디버깅용) */
  source?: string;
}

/** 추출 결과 라인 아이템 (견적서/인보이스 품목 행) */
export interface ExtractedLineItem {
  itemName: ExtractedField<string>;
  itemCode: ExtractedField<string | null>;  // Catalog Number
  quantity: ExtractedField<number | null>;
  unitPrice: ExtractedField<number | null>;
  totalAmount: ExtractedField<number | null>;
  unit: ExtractedField<string | null>;       // ea, box, pack 등
  leadTime: ExtractedField<string | null>;   // "2-3 weeks", "5 business days"
  moq: ExtractedField<number | null>;        // Minimum Order Quantity
}

/**
 * A-3. ExtractionResult — AI Extraction 단계의 최종 출력 JSON 구조
 *
 * IngestionEntry.extractionResult (Json 컬럼)에 저장됩니다.
 * 모든 필드는 ExtractedField<T> 래퍼를 통해 개별 Confidence를 보유합니다.
 */
export interface ExtractionResult {
  // ── 문서 메타 ──
  documentDate: ExtractedField<string | null>;      // ISO date string
  documentNumber: ExtractedField<string | null>;     // 견적번호/주문번호/송장번호 통합

  // ── 벤더 정보 ──
  vendorName: ExtractedField<string | null>;
  vendorEmail: ExtractedField<string | null>;
  vendorPhone: ExtractedField<string | null>;
  vendorAddress: ExtractedField<string | null>;

  // ── 참조 번호 (문서 유형에 따라 해당되는 필드만 채움) ──
  quoteNumber: ExtractedField<string | null>;
  orderNumber: ExtractedField<string | null>;
  invoiceNumber: ExtractedField<string | null>;
  poNumber: ExtractedField<string | null>;           // Purchase Order Number

  // ── 금액 ──
  currency: ExtractedField<string | null>;            // "KRW", "USD" 등
  subtotalAmount: ExtractedField<number | null>;
  taxAmount: ExtractedField<number | null>;
  totalAmount: ExtractedField<number | null>;

  // ── 납기/배송 ──
  deliveryDate: ExtractedField<string | null>;        // ISO date string
  leadTime: ExtractedField<string | null>;            // 전체 문서 레벨

  // ── 품목 리스트 ──
  lineItems: ExtractedLineItem[];

  // ── AI 메타데이터 ──
  overallConfidence: number;                           // 전체 추출 신뢰도 (0.0 ~ 1.0)
  aiModel: string;                                     // 사용된 모델 (e.g., "gpt-4o")
  processingDurationMs: number;                        // 추출 소요 시간
  rawResponseTokens?: number;                          // 토큰 사용량
}


// ──────────────────────────────────────────────────────────
// A-4. Entity Linking — 추출 결과를 DB Entity와 매칭
// ──────────────────────────────────────────────────────────

/** Entity Linking 대상 도메인 타입 */
export type LinkedEntityType =
  | "QUOTE"
  | "ORDER"
  | "PURCHASE"
  | "INVENTORY"
  | "VENDOR"
  | "PRODUCT";

/** Entity Linking 후보 결과 (복수 후보 중 최고 신뢰도 선택) */
export interface EntityLinkCandidate {
  entityType: LinkedEntityType;
  entityId: string;
  confidence: number;        // 0.0 ~ 1.0
  matchedOn: string[];       // 매칭 근거 필드 (e.g., ["invoiceNumber", "vendorName"])
  /**
   * ⚠️ org_id 교차 검증 — 이 Entity가 현재 IngestionEntry의 org_id와 동일 조직인지 확인
   * false일 경우 Hard Block (Entity Linking 거부)
   */
  orgScopeValid: boolean;
}

/** Entity Linking 단계의 최종 출력 */
export interface EntityLinkingResult {
  /** 최고 신뢰도 매칭 결과 (없으면 null → UNLINKED) */
  bestMatch: EntityLinkCandidate | null;
  /** 검토용 대안 후보 (bestMatch 외 상위 N개) */
  alternatives: EntityLinkCandidate[];
  /** 매칭 시도한 전략 목록 (디버깅용) */
  strategiesUsed: string[];   // e.g., ["exact_number", "fuzzy_vendor+amount", "catalog_code"]
}


// ──────────────────────────────────────────────────────────
// A-5. Verification — 교차 검증 판정
// ──────────────────────────────────────────────────────────

/** 검증 시 비교 대상이 된 개별 필드 결과 */
export interface FieldVerificationDetail {
  fieldName: string;           // e.g., "totalAmount", "quantity"
  extractedValue: unknown;
  expectedValue: unknown;      // DB에서 가져온 기대값
  matched: boolean;
  /** 허용 오차 적용 여부 (금액 반올림 등) */
  toleranceApplied?: boolean;
}

/** Verification 단계의 최종 출력 */
export interface VerificationResult {
  status: "AUTO_VERIFIED" | "REVIEW_NEEDED" | "MISMATCH" | "MISSING";
  reason: string;                           // 사람이 읽을 수 있는 판정 사유
  fieldDetails: FieldVerificationDetail[];  // 개별 필드 비교 결과
  mismatchedFields: string[];               // 불일치 필드명 배열
  missingFields: string[];                  // 누락 필드명 배열
  /** Policy Hook 신호 */
  policyFlags: {
    budgetExceeded?: boolean;
    amountThreshold?: number;              // 초과 임계치 (원)
    mandatoryDocumentMissing?: boolean;    // 필수 문서 누락
    approvalRequired: boolean;
  };
}


// ──────────────────────────────────────────────────────────
// A-6. Work Queue Task Generation — 매핑 규칙
// ──────────────────────────────────────────────────────────

/** Verification 상태 → Work Queue Task 매핑 규칙 */
export interface WorkQueueTaskMapping {
  /** 트리거 조건 */
  trigger: {
    verificationStatus: VerificationResult["status"];
    documentType?: string;     // 특정 DocumentType에서만 발동 (없으면 전체)
    policyFlag?: string;       // 특정 Policy Flag에서만 발동
  };
  /** 생성할 Task 정보 */
  task: {
    type: string;              // AiActionType enum 값
    taskType: string;          // IngestionTaskType enum 값
    taskStatus: string;        // TaskStatus 초기값
    approvalStatus: string;    // ApprovalStatus 초기값
    priority: string;          // AiActionPriority 초기값
    titleTemplate: string;     // 제목 템플릿 (변수 치환: {{vendorName}}, {{amount}} 등)
    summaryTemplate: string;   // 요약 템플릿
  };
  /** 중복 방지 키 생성 규칙 */
  dedupKey: {
    fields: string[];          // 조합할 필드 (e.g., ["linkedEntityId", "taskType"])
    windowHours: number;       // 중복 체크 윈도우 (시간)
  };
}

/** Work Queue Task 생성 요청 (서비스 레이어 입력) */
export interface CreateWorkQueueTaskRequest {
  ingestionEntryId: string;
  organizationId: string;
  userId: string;
  taskType: string;            // IngestionTaskType enum 값
  title: string;
  summary: string;
  linkedEntityType: string;
  linkedEntityId: string;
  priority: string;
  payload: Record<string, unknown>;
  policyFlags?: Record<string, unknown>;
}


// ──────────────────────────────────────────────────────────
// A-7. Audit Trail — 파이프라인 이벤트 계약
// ──────────────────────────────────────────────────────────

/** Audit Trail 로그 생성 요청 */
export interface CreateIngestionAuditRequest {
  ingestionEntryId: string;
  action: string;              // IngestionAuditAction enum 값
  actorType: "SYSTEM" | "USER";
  actorId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  confidence?: number;
  durationMs?: number;
  errorMessage?: string;
}


// ──────────────────────────────────────────────────────────
// 파이프라인 단계별 입출력 Interface
// ──────────────────────────────────────────────────────────

/** 파이프라인 단계 식별자 */
export type PipelineStage =
  | "INGESTION"
  | "CLASSIFICATION"
  | "EXTRACTION"
  | "ENTITY_LINKING"
  | "VERIFICATION"
  | "WORK_QUEUE_DISPATCH"
  | "AUDIT_TRAIL";

/** 파이프라인 단계 실행 결과 (공통 래퍼) */
export interface StageResult<T> {
  success: boolean;
  stage: PipelineStage;
  data: T | null;
  error?: string;
  durationMs: number;
  /** 다음 단계 진행 여부 (false면 파이프라인 중단) */
  continueToNext: boolean;
}

/** Stage 1: Ingestion — 외부 입력 수신 */
export interface IngestionInput {
  organizationId: string;
  sourceType: "EMAIL" | "ATTACHMENT" | "UPLOAD" | "SYSTEM";
  sourceRef?: string;
  filename?: string;
  mimeType?: string;
  rawText: string;
  uploaderId?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestionOutput {
  ingestionEntryId: string;
  rawTextStored: boolean;
}

/** Stage 2: Classification — 문서 분류 */
export interface ClassificationInput {
  ingestionEntryId: string;
  rawText: string;
  filename?: string;
  mimeType?: string;
}

export interface ClassificationOutput {
  documentType: string;      // DocumentType enum 값
  confidence: number;
}

/** Stage 3: Extraction — 필드 추출 */
export interface ExtractionInput {
  ingestionEntryId: string;
  rawText: string;
  documentType: string;
}

export interface ExtractionOutput {
  extractionResult: ExtractionResult;
}

/** Stage 4: Entity Linking */
export interface EntityLinkingInput {
  ingestionEntryId: string;
  organizationId: string;
  extractionResult: ExtractionResult;
  documentType: string;
}

export interface EntityLinkingOutput {
  linkingResult: EntityLinkingResult;
}

/** Stage 5: Verification */
export interface VerificationInput {
  ingestionEntryId: string;
  organizationId: string;
  extractionResult: ExtractionResult;
  linkedEntityType: string;
  linkedEntityId: string;
  documentType: string;
}

export interface VerificationOutput {
  verificationResult: VerificationResult;
}

/** Stage 6: Work Queue Dispatch */
export interface WorkQueueDispatchInput {
  ingestionEntryId: string;
  organizationId: string;
  userId: string;
  verificationResult: VerificationResult;
  linkedEntityType: string;
  linkedEntityId: string;
  documentType: string;
  extractionResult: ExtractionResult;
}

export interface WorkQueueDispatchOutput {
  taskCreated: boolean;
  taskId?: string;
  taskType?: string;
  skippedReason?: string;       // 중복 등으로 생성 건너뜀
}


// ──────────────────────────────────────────────────────────
// 파이프라인 오케스트레이터 Interface
// ──────────────────────────────────────────────────────────

/**
 * IPipelineOrchestrator — 전체 파이프라인 실행을 조율하는 최상위 인터페이스
 *
 * 구현체는 각 Stage를 순차 실행하며, 실패 시 IngestionEntry.errorMessage에 기록하고
 * IngestionAuditLog에 실패 이벤트를 남깁니다.
 */
export interface IPipelineOrchestrator {
  /**
   * 전체 파이프라인 실행 (Ingestion → Audit Trail)
   * @returns 최종 IngestionEntry ID 및 각 단계 결과 요약
   */
  execute(input: IngestionInput): Promise<PipelineExecutionResult>;
}

/** 파이프라인 전체 실행 결과 */
export interface PipelineExecutionResult {
  ingestionEntryId: string;
  completedStages: PipelineStage[];
  failedStage?: PipelineStage;
  error?: string;
  /** 최종 결과 요약 */
  summary: {
    documentType: string | null;
    linkedEntityType: string | null;
    linkedEntityId: string | null;
    verificationStatus: string | null;
    workQueueTaskId: string | null;
  };
  totalDurationMs: number;
}


// ──────────────────────────────────────────────────────────
// 개별 Stage Processor Interface
// ──────────────────────────────────────────────────────────

/**
 * 각 파이프라인 단계의 공통 처리기 인터페이스
 * 구현체는 단일 책임 원칙을 따르며, 자신의 단계만 처리합니다.
 */
export interface IStageProcessor<TInput, TOutput> {
  readonly stage: PipelineStage;
  process(input: TInput): Promise<StageResult<TOutput>>;
}

/** 타입화된 개별 Stage Processor */
export type IClassificationProcessor = IStageProcessor<ClassificationInput, ClassificationOutput>;
export type IExtractionProcessor = IStageProcessor<ExtractionInput, ExtractionOutput>;
export type IEntityLinkingProcessor = IStageProcessor<EntityLinkingInput, EntityLinkingOutput>;
export type IVerificationProcessor = IStageProcessor<VerificationInput, VerificationOutput>;
export type IWorkQueueDispatcher = IStageProcessor<WorkQueueDispatchInput, WorkQueueDispatchOutput>;
