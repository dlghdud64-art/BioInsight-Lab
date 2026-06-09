/**
 * §11.37x(b) — QR 재고 확인 게이트(중복구매 방지) 순수 로직
 *
 * 소싱 surface QR = read-only 조회. 스캔 텍스트 → 재고 조회 토큰 resolve →
 * GET /api/inventory?search=<token> 결과로 보유 재고 합산 → advisory 게이트 판정.
 *
 * 승인(2026-06-10): advisory — 보유 시 경고 + 진행 허용(차단 아님). 차감/mutation 0.
 * 순수 함수만(DOM/네트워크 무의존) → vitest 단위 검증 가능.
 */
import { parseGs1, type Gs1Parsed } from "./gs1-parser";

export type StockQuerySource = "gs1-lot" | "gs1-gtin" | "raw" | "empty";

export interface StockLookupResolve {
  /** GET /api/inventory?search= 에 넣을 토큰. */
  query: string;
  /** 토큰 출처(디버그·UX 표시용). */
  source: StockQuerySource;
  /** GS1 해석 결과(있으면). 표시용 GTIN/Lot/EXP. */
  gs1: Gs1Parsed | null;
}

/**
 * 스캔 디코드 텍스트 → 재고 조회 토큰.
 * - GS1 datamatrix 이고 Lot(AI 10) 있으면 → lot 토큰(이미 입고한 그 Lot 매칭, 가장 구체적).
 * - GS1 이고 GTIN 만 → gtin 토큰(재고엔 GTIN 필드 부재라 매칭 실패 가능 = advisory false-neg 허용).
 * - 그 외(일반 카탈로그/QR) → raw 토큰(카탈로그 번호·제품명 contains 매칭).
 * - 공백/빈값 → empty(조회 안 함).
 */
export function resolveScanToStockQuery(
  decodedText: string | null | undefined,
): StockLookupResolve {
  const trimmed = (decodedText ?? "").trim();
  if (!trimmed) {
    return { query: "", source: "empty", gs1: null };
  }

  const gs1 = parseGs1(trimmed);
  if (gs1.isGs1) {
    if (gs1.lotNo) {
      return { query: gs1.lotNo, source: "gs1-lot", gs1 };
    }
    if (gs1.gtin) {
      return { query: gs1.gtin, source: "gs1-gtin", gs1 };
    }
  }

  return { query: trimmed, source: "raw", gs1: gs1.isGs1 ? gs1 : null };
}

/** GET /api/inventory 응답 row 의 최소 형태(게이트 판정에 필요한 필드만). */
export interface InventoryRowLike {
  currentQuantity: number;
  product?: {
    name?: string | null;
    catalogNumber?: string | null;
  } | null;
}

export interface DuplicatePurchaseGate {
  /** warn = 보유 재고 존재(중복 가능) / clear = 보유 0(중복 아님). */
  status: "warn" | "clear";
  /** 보유(currentQuantity>0) row 합산 수량. */
  totalOnHand: number;
  /** 보유(currentQuantity>0) row 수. */
  matchCount: number;
  /** 보유 수량 최대 row(경고 배너 대표 표기용). */
  topMatch: { name: string; catalogNumber: string | null; currentQuantity: number } | null;
}

/**
 * 재고 조회 결과 → advisory 중복구매 게이트 상태.
 * canonical: 보유 판정은 서버 currentQuantity 기준. 0 재고 row 는 보유로 치지 않음(만료/소진).
 * advisory: warn 이어도 진행(견적 담기)은 호출부에서 그대로 허용 — 차단하지 않는다.
 */
export function computeDuplicatePurchaseGate(
  rows: InventoryRowLike[] | null | undefined,
): DuplicatePurchaseGate {
  const list = Array.isArray(rows) ? rows : [];
  const held = list.filter((r) => Number(r?.currentQuantity) > 0);

  const totalOnHand = held.reduce((sum, r) => sum + Number(r.currentQuantity), 0);
  const matchCount = held.length;

  let topMatch: DuplicatePurchaseGate["topMatch"] = null;
  if (held.length > 0) {
    const top = held.reduce((a, b) =>
      Number(b.currentQuantity) > Number(a.currentQuantity) ? b : a,
    );
    topMatch = {
      name: top.product?.name ?? "이름 미상 재고",
      catalogNumber: top.product?.catalogNumber ?? null,
      currentQuantity: Number(top.currentQuantity),
    };
  }

  return {
    status: totalOnHand > 0 ? "warn" : "clear",
    totalOnHand,
    matchCount,
    topMatch,
  };
}
