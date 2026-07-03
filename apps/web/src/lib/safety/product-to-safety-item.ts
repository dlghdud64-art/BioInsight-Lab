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
// §msds-version-validation — 버전상태 휴리스틱 분류(단일 카운트 소스).
import { classifyMsdsVersion, type MsdsVersionStatus, type MsdsVersionSummary } from "@/lib/safety/msds-version";
// §cas-hazard-classification P3 — canonical CAS→GHS 분류(정적표) + 등급 파생.
import { classifyByCas, deriveHazardLevel, normalizeCas } from "@/lib/safety/cas-ghs-table";

export interface SafetyApiProduct {
  id: string;
  name: string;
  category?: string | null;
  msdsUrl?: string | null;
  storageCondition?: string | null;
  casNo?: string | null;
  hazardCodes?: unknown;
  pictograms?: unknown;
  ppe?: unknown;
  createdAt?: string | null;
  sdsDocuments?: Array<{
    id: string;
    createdAt?: string | null;
    // §msds-version-validation — 버전상태 분류 입력.
    docVersion?: string | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
    supersededAt?: string | null;
  }>;
}

const PICTO_KEYS = ["corrosive", "toxic", "flammable", "oxidizer"] as const;

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

export interface SafetyAdapterResult {
  items: SafetyItemInput[];
  /** 로컬 number id → 실 Product.id (SDS/액션 deep-link). */
  productIdByLocalId: Record<number, string>;
  /** §msds-version-validation — 버전상태 집계(단일 카운트 소스). 출처 없음=문서/메타 없음. */
  msdsVersionSummary: MsdsVersionSummary;
}

export function adaptSafetyProducts(products: SafetyApiProduct[]): SafetyAdapterResult {
  const items: SafetyItemInput[] = [];
  const productIdByLocalId: Record<number, string> = {};
  const msdsVersionSummary: MsdsVersionSummary = { current: 0, stale: 0, unknown: 0, total: products.length };

  products.forEach((p, idx) => {
    const localId = idx + 1;
    productIdByLocalId[localId] = p.id;

    const hazardCodes = toStringArray(p.hazardCodes);
    const pictograms = toStringArray(p.pictograms);
    const ppeArr = toStringArray(p.ppe);
    const icons = pictograms.filter((pic) => (PICTO_KEYS as readonly string[]).includes(pic));

    const hasMsds = Boolean(p.msdsUrl) || (p.sdsDocuments?.length ?? 0) > 0;

    // §cas-hazard-classification P3 — canonical 분류. 저장 hazardCodes 우선, 없으면 casNo 정적분류.
    //   classified = 저장코드/픽토 있음 OR casNo 표 매칭(비위험 포함). 미분류(false)는 "일반" 오도 금지.
    const casResult = classifyByCas(p.casNo);
    const effectiveHazardCodes = hazardCodes.length > 0 ? hazardCodes : casResult.hazardCodes;
    const classified = hazardCodes.length > 0 || pictograms.length > 0 || casResult.matched;
    const hazardLevel = deriveHazardLevel({ classified, hazardCodes: effectiveHazardCodes });
    // engine SafetyLevel 매핑: critical|high|고위험 픽토그램→HIGH, medium|픽토그램 존재→MEDIUM, 그 외→LOW.
    //   (미분류는 classified=false 로 구분). 저장 pictograms 의 위험 신호 보존(회귀 방지).
    const pictoHighRisk = pictograms.some((pic) =>
      ["corrosive", "toxic", "skull", "flame", "health_hazard", "health-hazard", "explosive"].includes(pic),
    );
    const level: SafetyLevel =
      hazardLevel === "critical" || hazardLevel === "high" || pictoHighRisk
        ? "HIGH"
        : hazardLevel === "medium" || pictograms.length > 0
          ? "MEDIUM"
          : "LOW";
    const isHighRisk = level === "HIGH";
    const actionStatus: ActionStatus = hasMsds ? "normal" : "action_required";
    const latestSds = p.sdsDocuments && p.sdsDocuments.length > 0 ? p.sdsDocuments[0] : null;
    // §msds-version-validation — 최신 SDS 문서 메타로 버전상태 분류. 문서 없으면 출처 없음(unknown).
    const versionStatus: MsdsVersionStatus = latestSds ? classifyMsdsVersion(latestSds) : "unknown";
    msdsVersionSummary[versionStatus] += 1;

    items.push({
      id: localId,
      name: p.name,
      cas: normalizeCas(p.casNo) ?? (p.casNo ?? ""),
      isHighRisk,
      level,
      classified,
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

  return { items, productIdByLocalId, msdsVersionSummary };
}
