/**
 * §11.348-B-1 B1-3 — /api/safety/products 응답(Product 안전필드)을 안전 페이지의
 * SafetyItemInput 으로 변환하는 순수 어댑터.
 *
 * 기존 안전 페이지는 하드코딩 mock(§11.357 진단). B1-3 가 실데이터로 교체한다.
 * SafetyItemInput.id 는 number(엔진·페이지 state 정합) → 실 Product.id(cuid)와
 * 충돌하므로 **로컬 index id(1..N)** 를 부여하고, 별도 맵으로 실 productId 보존
 * (SDS/액션 deep-link 용). 엔진/페이지 number-id 무변경 = 저위험.
 *
 * 파생 규칙(heuristic, mock 대체):
 *  - hasMsds  = msdsUrl 있음 또는 sdsDocuments 1개 이상
 *  - isHighRisk/level = 위험 픽토그램(corrosive/toxic) 또는 hazardCode 존재 기반
 *  - actionStatus = MSDS 없으면 action_required, 있으면 normal
 *  - icons = pictograms(안전 페이지 키: corrosive/toxic/flammable/oxidizer)
 *  - ppe   = product.ppe → [{type, required:true}]
 *  - cas   = Product 에 필드 없음 → "" (페이지는 빈 표시)
 *  - loc/lastInspection = Product 에 없음 → "" / null (입고·점검 연계는 후속)
 */
import type { SafetyItemInput, SafetyLevel, ActionStatus } from "@/lib/ai/safety-decision-engine";

export interface SafetyApiProduct {
  id: string;
  name: string;
  category?: string | null;
  msdsUrl?: string | null;
  storageCondition?: string | null;
  hazardCodes?: unknown;
  pictograms?: unknown;
  ppe?: unknown;
  createdAt?: string | null;
  sdsDocuments?: Array<{ id: string; createdAt?: string | null }>;
}

const PICTO_KEYS = ["corrosive", "toxic", "flammable", "oxidizer"] as const;
const HIGH_RISK_PICTOS = new Set(["corrosive", "toxic"]);

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

export interface SafetyAdapterResult {
  items: SafetyItemInput[];
  /** 로컬 number id → 실 Product.id (SDS/액션 deep-link). */
  productIdByLocalId: Record<number, string>;
}

export function adaptSafetyProducts(products: SafetyApiProduct[]): SafetyAdapterResult {
  const items: SafetyItemInput[] = [];
  const productIdByLocalId: Record<number, string> = {};

  products.forEach((p, idx) => {
    const localId = idx + 1;
    productIdByLocalId[localId] = p.id;

    const hazardCodes = toStringArray(p.hazardCodes);
    const pictograms = toStringArray(p.pictograms);
    const ppeArr = toStringArray(p.ppe);
    const icons = pictograms.filter((pic) => (PICTO_KEYS as readonly string[]).includes(pic));

    const hasMsds = Boolean(p.msdsUrl) || (p.sdsDocuments?.length ?? 0) > 0;
    const isHighRisk =
      pictograms.some((pic) => HIGH_RISK_PICTOS.has(pic)) || hazardCodes.length > 0;
    const level: SafetyLevel = isHighRisk ? "HIGH" : pictograms.length > 0 ? "MEDIUM" : "LOW";
    const actionStatus: ActionStatus = hasMsds ? "normal" : "action_required";
    const latestSds = p.sdsDocuments && p.sdsDocuments.length > 0 ? p.sdsDocuments[0] : null;

    items.push({
      id: localId,
      name: p.name,
      cas: "", // Product 에 CAS 필드 없음
      isHighRisk,
      level,
      actionStatus,
      hasMsds,
      msdsUpdatedAt: latestSds?.createdAt ?? null,
      registeredAt: p.createdAt ?? new Date().toISOString(),
      lastInspection: null,
      storageCondition: p.storageCondition ?? "",
      loc: "",
      icons,
      ppe: ppeArr.map((type) => ({ type, required: true })),
    });
  });

  return { items, productIdByLocalId };
}
