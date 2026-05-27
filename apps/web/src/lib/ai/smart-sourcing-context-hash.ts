/**
 * Smart Sourcing AI Context Hash
 *
 * 다중 견적 비교 / BOM 파싱의 입력 상태를 해시하여
 * 중복 API 호출 방지 + 입력 변경 시 결과 staleness 경고를 제공합니다.
 *
 * sourcing-operating-layer.ts의 buildSourcingAiContextHash 패턴을 재사용.
 *
 * 규칙:
 * 1. 동일 입력에 대한 중복 API 호출 방지 (memoization)
 * 2. 입력이 변경되면 기존 결과를 stale로 표시
 * 3. 해시는 결정적(deterministic) — 같은 입력은 항상 같은 해시
 */

// ══════════════════════════════════════════════════════════════════════════════
// Simple Hash
// ══════════════════════════════════════════════════════════════════════════════

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

// ══════════════════════════════════════════════════════════════════════════════
// Multi-Vendor Context Hash
// ══════════════════════════════════════════════════════════════════════════════

export interface MultiVendorAiContext {
  productName: string;
  quantity: string;
  vendors: Array<{ vendorName: string; rawText: string }>;
}

export function buildMultiVendorContextHash(ctx: MultiVendorAiContext): string {
  const vendorParts = ctx.vendors
    .filter((v) => v.vendorName.trim() && v.rawText.trim())
    .map((v) => `${v.vendorName}::${v.rawText.slice(0, 200)}`)
    .sort()
    .join("|");

  const str = `mv:${ctx.productName}:${ctx.quantity}:${vendorParts}`;
  return `mv_${simpleHash(str)}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// BOM Parse Context Hash
// ══════════════════════════════════════════════════════════════════════════════

export interface BomParseAiContext {
  bomText: string;
}

export function buildBomParseContextHash(ctx: BomParseAiContext): string {
  const str = `bom:${ctx.bomText.trim().slice(0, 3000)}`;
  return `bom_${simpleHash(str)}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// Staleness Check
// ══════════════════════════════════════════════════════════════════════════════

export function isResultStale(
  resultContextHash: string | null,
  currentContextHash: string,
): boolean {
  if (!resultContextHash) return false; // 결과 없으면 stale 아님
  return resultContextHash !== currentContextHash;
}
