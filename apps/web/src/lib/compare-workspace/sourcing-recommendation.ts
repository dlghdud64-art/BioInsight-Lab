/**
 * §11.318 대체품/벤더 추천 코어 — 내부 PurchaseRecord(실거래) 기반.
 *
 * 결정(호영님 2026-05-29):
 *   - 1차 데이터 = PurchaseRecord only → 환각 0(근거 없으면 추천 없음).
 *   - 납기 = 상류에서 QuoteListItem.leadTime 파싱한 LeadTimeIndex(quoteId→days|null).
 *     없으면 leadTimeDays=null + leadTimeSource="unknown"("미확인", 지어내기 0).
 *   - 대체품 = 같은 catalogNumber 다른 벤더(정확) + 같은 category 다른 catalog(best-effort).
 *     규격 정밀 파싱은 후속(Phase 2). 다른 category 는 제외(§1 엉뚱 비교 차단).
 *
 * 순수 함수 — DB 미접근. API 라우트가 PurchaseRecord/QuoteListItem fetch 후 호출.
 * ⚠️ 자유 텍스트 "전략"/"추천 문구" 를 생성하지 않는다(환각 표면 원천 차단).
 */

export interface PurchaseRecordLike {
  vendorName: string;
  itemName: string;
  catalogNumber: string | null;
  category: string | null;
  unitPrice: number | null;
  amount: number;
  qty: number;
  unit: string | null;
  currency: string;
  purchasedAt: string; // ISO
  quoteId: string | null;
}

export interface RecommendTarget {
  catalogNumber: string | null;
  itemName: string;
  category: string | null;
}

/** quoteId → 파싱된 납기 일수(없거나 파싱 실패 시 null). 상류(QuoteListItem.leadTime)에서 구성. */
export type LeadTimeIndex = Record<string, number | null>;

export interface VendorOption {
  vendorName: string;
  unitPrice: number | null; // 최근 구매 단가
  currency: string;
  lastPurchasedAt: string; // ISO
  purchaseCount: number;
  leadTimeDays: number | null;
  leadTimeSource: "quote" | "unknown";
  isLowestPrice: boolean;
  isFastest: boolean;
}

export interface SubstituteOption {
  itemName: string;
  catalogNumber: string | null;
  category: string | null;
  vendorName: string;
  unitPrice: number | null;
  currency: string;
  reason: string;
}

export interface SourcingRecommendation {
  hasData: boolean;
  dataSource: "purchase_history" | "none";
  sameProductOtherVendors: VendorOption[];
  substitutes: SubstituteOption[];
}

/* ── 유틸 ── */

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/** 같은 제품 판정: catalogNumber 일치(둘 다 non-null) 우선, 없으면 itemName 일치. */
function isSameProduct(r: PurchaseRecordLike, target: RecommendTarget): boolean {
  if (target.catalogNumber && r.catalogNumber) {
    return norm(r.catalogNumber) === norm(target.catalogNumber);
  }
  return norm(r.itemName) === norm(target.itemName);
}

function leadTimeFor(
  quoteId: string | null,
  index: LeadTimeIndex | undefined,
): { days: number | null; source: "quote" | "unknown" } {
  if (quoteId && index && typeof index[quoteId] === "number") {
    return { days: index[quoteId] as number, source: "quote" };
  }
  return { days: null, source: "unknown" };
}

/* ── 메인 ── */

export function buildSourcingRecommendation(
  records: PurchaseRecordLike[],
  target: RecommendTarget,
  leadTimeIndex?: LeadTimeIndex,
): SourcingRecommendation {
  const sameProduct = records.filter((r) => isSameProduct(r, target));

  // ── 같은 제품: 벤더별 그룹 ──
  const byVendor = new Map<string, PurchaseRecordLike[]>();
  for (const r of sameProduct) {
    const key = r.vendorName;
    const arr = byVendor.get(key);
    if (arr) arr.push(r);
    else byVendor.set(key, [r]);
  }

  let sameProductOtherVendors: VendorOption[] = [];
  for (const [vendorName, recs] of byVendor) {
    // 최근 구매 기준 대표값
    const sorted = [...recs].sort(
      (a, b) => Date.parse(b.purchasedAt) - Date.parse(a.purchasedAt),
    );
    const latest = sorted[0];
    const lt = leadTimeFor(latest.quoteId, leadTimeIndex);
    sameProductOtherVendors.push({
      vendorName,
      unitPrice: latest.unitPrice ?? null,
      currency: latest.currency,
      lastPurchasedAt: latest.purchasedAt,
      purchaseCount: recs.length,
      leadTimeDays: lt.days,
      leadTimeSource: lt.source,
      isLowestPrice: false,
      isFastest: false,
    });
  }

  // 최저가(비null 중) / 최단납기(비null 중) 플래그 — 근거 없으면 부여 안 함
  const priced = sameProductOtherVendors.filter((v) => typeof v.unitPrice === "number");
  if (priced.length > 0) {
    const min = Math.min(...priced.map((v) => v.unitPrice as number));
    for (const v of sameProductOtherVendors) {
      if (v.unitPrice === min) {
        v.isLowestPrice = true;
        break; // 동가면 첫 1개만
      }
    }
  }
  const led = sameProductOtherVendors.filter((v) => typeof v.leadTimeDays === "number");
  if (led.length > 0) {
    const minLt = Math.min(...led.map((v) => v.leadTimeDays as number));
    for (const v of sameProductOtherVendors) {
      if (v.leadTimeDays === minLt) {
        v.isFastest = true;
        break;
      }
    }
  }

  // 단가 오름차순(null 은 뒤로)
  sameProductOtherVendors = sameProductOtherVendors.sort((a, b) => {
    if (a.unitPrice == null && b.unitPrice == null) return 0;
    if (a.unitPrice == null) return 1;
    if (b.unitPrice == null) return -1;
    return a.unitPrice - b.unitPrice;
  });

  // ── 대체품: 같은 category, 다른 제품(best-effort) ──
  const substitutes: SubstituteOption[] = [];
  const seen = new Set<string>();
  for (const r of records) {
    if (isSameProduct(r, target)) continue; // 같은 제품 제외
    if (!target.category || !r.category) continue; // 카테고리 미상이면 대체 추천 안 함
    if (norm(r.category) !== norm(target.category)) continue; // 다른 카테고리 제외(§1)
    const dedupeKey = `${norm(r.catalogNumber)}|${norm(r.itemName)}|${norm(r.vendorName)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    substitutes.push({
      itemName: r.itemName,
      catalogNumber: r.catalogNumber,
      category: r.category,
      vendorName: r.vendorName,
      unitPrice: r.unitPrice ?? null,
      currency: r.currency,
      reason: "같은 카테고리 내 유사 품목 (과거 구매 기록 기반)",
    });
  }

  const hasData = sameProductOtherVendors.length > 0 || substitutes.length > 0;
  return {
    hasData,
    dataSource: hasData ? "purchase_history" : "none",
    sameProductOtherVendors,
    substitutes,
  };
}
