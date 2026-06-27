/**
 * §msds-version-validation — MSDS 버전 상태 휴리스틱 분류 (호영님 2026-06-27)
 *
 * 핸드오프(MSDS 버전검증)는 KOSHA 라이브 DB 대조를 전제하나, repo엔 OCR·공공 DB 연동이 없음(OOS).
 * 따라서 **저장된 버전 메타(docVersion·issuedAt·expiresAt·supersededAt) 기반 휴리스틱**으로만 분류한다.
 * UI 라벨은 "메타 기반 추정"으로 표기하고 "KOSHA 검증"이라 과대표기하지 않는다.
 *
 * 분류:
 *  - unknown(출처 없음)   : 개정일·버전 메타 전무 → 업로드본 출처 미상.
 *  - stale(구버전 의심)   : 교체됨(supersededAt) / 만료(expiresAt < now) / 개정일 3년 경과.
 *  - current(최신본 확보) : 메타 존재 + 위 stale 조건 미해당.
 *
 * supersededAt 은 soft-state(삭제 금지, GMP 추적성). null = 현행 유효본.
 */

export type MsdsVersionStatus = "current" | "stale" | "unknown";

export interface MsdsVersionMeta {
  docVersion?: string | null;
  issuedAt?: string | Date | null;
  expiresAt?: string | Date | null;
  supersededAt?: string | Date | null;
}

/** 개정일 경과 임계 = 3년(핸드오프 §2 "개정일 3년 경과"). */
export const MSDS_STALE_AFTER_MS = 3 * 365 * 24 * 60 * 60 * 1000;

function toTime(v?: string | Date | null): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

export function classifyMsdsVersion(
  meta: MsdsVersionMeta,
  now: Date = new Date(),
): MsdsVersionStatus {
  const issued = toTime(meta.issuedAt);
  const hasMeta = Boolean(issued) || Boolean(meta.docVersion);
  // 출처 없음 — 개정일/버전 메타 전무.
  if (!hasMeta) return "unknown";
  // 구버전 의심 — 교체됨 / 만료 / 개정일 3년 경과.
  if (toTime(meta.supersededAt)) return "stale";
  const expires = toTime(meta.expiresAt);
  if (expires !== null && expires < now.getTime()) return "stale";
  if (issued !== null && now.getTime() - issued > MSDS_STALE_AFTER_MS) return "stale";
  return "current";
}

export interface MsdsVersionSummary {
  current: number;
  stale: number;
  unknown: number;
  total: number;
}

/** 문서 메타 목록 → 버전상태 집계(단일 카운트 소스). */
export function summarizeMsdsVersions(
  docs: MsdsVersionMeta[],
  now: Date = new Date(),
): MsdsVersionSummary {
  const summary: MsdsVersionSummary = { current: 0, stale: 0, unknown: 0, total: docs.length };
  for (const d of docs) summary[classifyMsdsVersion(d, now)] += 1;
  return summary;
}
