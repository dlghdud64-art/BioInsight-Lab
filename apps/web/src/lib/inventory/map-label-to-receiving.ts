/**
 * §11.326 — 라벨 용량(packSize) vs 입고 수량(받은 통 개수) 분리 매핑 (순수 모듈)
 *
 * root cause 차단: OCR 라벨 "100 CAPSULES"(통 1개 함량=규격)를 입고 수량으로 쓰지 않는다.
 * 결정(호영님 2026-05-30):
 *   - OCR quantity → packSize(품목 마스터), OCR unit → packUnit.
 *   - 입고 수량(receivedQuantity) = 사용자 입력, 기본값 1, **절대 라벨값 아님**.
 *   - receivedUnit 기본 "통". 총함량(received × packSize)은 표시만(영속화 X).
 *   - received 0/음수 → 1 보정.
 *
 * surface-agnostic 순수 함수 — 데스크톱/모바일 공유.
 * ⚠️ DUPLICATED 대상: 모바일(apps/mobile/lib/inventory/map-label-to-receiving.ts)은
 *    Phase B 에서 이 파일을 복제(+동기화 주석). 변경 시 양쪽 동기화.
 * DOM/서버 의존 import 금지(순수).
 */

export interface LabelOcrFields {
  /** 라벨에서 추출한 함량 숫자 문자열(예: "100"). = packSize 원천. */
  quantity: string | null;
  /** 라벨 함량 단위(예: "CAPSULES", "mL"). = packUnit. */
  unit: string | null;
}

export interface ReceivingUserInput {
  /** 받은 통/박스 개수(사용자 입력). 미입력/비정상 → 1. */
  receivedQuantity?: number | null;
  /** 받은 단위(통/박스). 미입력 → "통". */
  receivedUnit?: string | null;
}

export interface ReceivingMapping {
  /** 통 1개의 함량(규격). 라벨 quantity 파싱. 없으면 null. */
  packSize: number | null;
  /** 함량 단위(CAPSULES 등). */
  packUnit: string | null;
  /** 받은 통 개수(영속화: InventoryRestock.quantity). 기본 1. */
  receivedQuantity: number;
  /** 받은 단위(영속화: InventoryRestock.unit). 기본 "통". */
  receivedUnit: string;
  /** 총 함량 = receivedQuantity × packSize. 표시 전용(영속화 X). packSize 없으면 null. */
  totalContent: number | null;
}

const DEFAULT_RECEIVED_QUANTITY = 1;
const DEFAULT_RECEIVED_UNIT = "통";

/** 라벨 함량 문자열 → 숫자. 첫 숫자(소수 포함) 추출. 없으면 null. */
function parsePackSize(quantity: string | null): number | null {
  if (!quantity) return null;
  const m = String(quantity).match(/\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * 라벨 OCR + 사용자 입력 → 품목/입고 분리 매핑.
 * 입고 수량은 절대 라벨값을 기본으로 쓰지 않는다(기본 1).
 */
export function mapLabelToReceiving(
  ocr: LabelOcrFields,
  userInput: ReceivingUserInput = {},
): ReceivingMapping {
  const packSize = parsePackSize(ocr.quantity);
  const packUnit = ocr.unit && ocr.unit.trim() ? ocr.unit.trim() : null;

  const rawReceived = userInput.receivedQuantity;
  const receivedQuantity =
    typeof rawReceived === "number" && Number.isFinite(rawReceived) && rawReceived > 0
      ? rawReceived
      : DEFAULT_RECEIVED_QUANTITY;

  const receivedUnit =
    userInput.receivedUnit && userInput.receivedUnit.trim()
      ? userInput.receivedUnit.trim()
      : DEFAULT_RECEIVED_UNIT;

  const totalContent = packSize != null ? receivedQuantity * packSize : null;

  return { packSize, packUnit, receivedQuantity, receivedUnit, totalContent };
}
