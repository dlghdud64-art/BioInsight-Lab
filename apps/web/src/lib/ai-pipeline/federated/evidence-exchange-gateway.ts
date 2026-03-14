/**
 * @module evidence-exchange-gateway
 * @description 증거 교환 게이트웨이
 *
 * 연합 네트워크 파트너 간 증거 데이터를 안전하게 교환한다.
 * 아웃바운드 시 redaction을 적용하고, 인바운드 시 integrity hash를 검증한다.
 */

/** 교환 방향 */
export type ExchangeDirection = "INBOUND" | "OUTBOUND";

/** 교환 상태 */
export type ExchangeStatus =
  | "INITIATED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "ACKNOWLEDGED"
  | "FAILED"
  | "REJECTED";

/** 교환 기록 */
export interface ExchangeRecord {
  id: string;
  direction: ExchangeDirection;
  partnerId: string;
  evidenceType: string;
  payloadHash: string;
  sentAt: Date;
  acknowledgedAt: Date | null;
  status: ExchangeStatus;
}

/** 교환 시작 요청 */
export interface InitiateExchangeInput {
  direction: ExchangeDirection;
  partnerId: string;
  evidenceType: string;
  payload: Record<string, unknown>;
  redactionFields?: string[];
}

/** 인바운드 검증 결과 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  checkedAt: Date;
}

/** 인메모리 교환 기록 저장소 */
const exchangeStore: ExchangeRecord[] = [];

/** 고유 ID 생성 */
let exchangeSeq = 0;
function nextExchangeId(): string {
  exchangeSeq += 1;
  return `exchange-${exchangeSeq}`;
}

/**
 * 단순 해시 함수 (데모용, SHA-256 대체)
 * @param data 해시 대상 문자열
 * @returns 해시 문자열
 */
function simpleHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 32비트 정수 변환
  }
  return `sha256-${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

/**
 * 페이로드에서 redaction 필드를 제거한다.
 * @param payload 원본 페이로드
 * @param fields 제거할 필드명 배열
 * @returns redaction 적용된 페이로드
 */
function applyRedaction(
  payload: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  const redacted = { ...payload };
  for (const field of fields) {
    if (field in redacted) {
      redacted[field] = "[REDACTED]";
    }
  }
  return redacted;
}

/**
 * 증거 교환을 시작한다.
 * 아웃바운드의 경우 redaction 적용 후 해시를 생성한다.
 * @param input 교환 시작 정보
 * @returns 생성된 교환 기록
 */
export function initiateExchange(input: InitiateExchangeInput): ExchangeRecord {
  let processedPayload = input.payload;

  if (
    input.direction === "OUTBOUND" &&
    input.redactionFields &&
    input.redactionFields.length > 0
  ) {
    processedPayload = applyRedaction(input.payload, input.redactionFields);
  }

  const payloadHash = simpleHash(JSON.stringify(processedPayload));

  const record: ExchangeRecord = {
    id: nextExchangeId(),
    direction: input.direction,
    partnerId: input.partnerId,
    evidenceType: input.evidenceType,
    payloadHash,
    sentAt: new Date(),
    acknowledgedAt: null,
    status: input.direction === "OUTBOUND" ? "IN_TRANSIT" : "INITIATED",
  };

  exchangeStore.push(record);
  return record;
}

/**
 * 교환 수신을 확인(acknowledge)한다.
 * @param exchangeId 확인할 교환 ID
 * @returns 갱신된 교환 기록
 * @throws 교환 기록을 찾을 수 없는 경우
 */
export function acknowledgeReceipt(exchangeId: string): ExchangeRecord {
  const record = exchangeStore.find((r) => r.id === exchangeId);
  if (!record) {
    throw new Error(`교환 기록 '${exchangeId}'을(를) 찾을 수 없습니다.`);
  }

  record.status = "ACKNOWLEDGED";
  record.acknowledgedAt = new Date();
  return record;
}

/**
 * 특정 파트너와의 교환 이력을 조회한다.
 * @param partnerId 파트너 ID
 * @param direction 교환 방향 필터 (선택)
 * @returns 교환 기록 배열
 */
export function getExchangeHistory(
  partnerId: string,
  direction?: ExchangeDirection,
): ExchangeRecord[] {
  return exchangeStore.filter((r) => {
    if (r.partnerId !== partnerId) return false;
    if (direction && r.direction !== direction) return false;
    return true;
  });
}

/**
 * 인바운드 증거의 무결성을 검증한다.
 * @param exchangeId 검증할 교환 ID
 * @param expectedHash 예상 해시 값
 * @returns 검증 결과
 */
export function validateInboundEvidence(
  exchangeId: string,
  expectedHash: string,
): ValidationResult {
  const record = exchangeStore.find((r) => r.id === exchangeId);
  const errors: string[] = [];

  if (!record) {
    errors.push(`교환 기록 '${exchangeId}'을(를) 찾을 수 없습니다.`);
    return { valid: false, errors, checkedAt: new Date() };
  }

  if (record.direction !== "INBOUND") {
    errors.push("인바운드 교환만 검증할 수 있습니다.");
  }

  if (record.payloadHash !== expectedHash) {
    errors.push(
      `해시 불일치: 기대값='${expectedHash}', 실제값='${record.payloadHash}'`,
    );
  }

  if (record.status === "FAILED" || record.status === "REJECTED") {
    errors.push(`교환 상태가 '${record.status}'이므로 검증할 수 없습니다.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    checkedAt: new Date(),
  };
}
