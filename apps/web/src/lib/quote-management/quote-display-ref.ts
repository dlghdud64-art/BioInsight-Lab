/**
 * §quote-table-sian-realign — 견적 케이스 표시 ref (지시문 §10 internal-key 보호)
 *
 * 사람이 읽는 견적 케이스 식별자. canonical `quoteNumber`(Q-YYYYMMDD-XXXXXX, 정식 견적)가
 * 있으면 그대로 쓰고, 없으면(RFQ draft 등) 클라이언트 파생(저장 0): `RFQ-<YYMM>-<id 끝4 대문자>`.
 *
 * ★ cuid 원본(quote.id) 직접 노출 금지 — `#${id.slice(0,8)}` 같은 internal-key 노출을 이 헬퍼로 대체.
 *   파생값은 결정적·표시 전용(키 아님). 큰 통합(소싱 생성 시 quoteNumber 실부여)은 별도 트랙.
 */
export function quoteDisplayRef(q: {
  quoteNumber?: string | null;
  createdAt?: string | Date | null;
  id: string;
}): string {
  if (q.quoteNumber) return q.quoteNumber;
  const d = q.createdAt ? new Date(q.createdAt) : new Date();
  const valid = !Number.isNaN(d.getTime());
  const base = valid ? d : new Date();
  const yy = String(base.getFullYear()).slice(2);
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const suffix = (q.id || "").slice(-4).toUpperCase() || "0000";
  return `RFQ-${yy}${mm}-${suffix}`;
}
