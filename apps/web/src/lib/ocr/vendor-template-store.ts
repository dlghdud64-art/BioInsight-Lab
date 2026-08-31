/**
 * §scan-recognition-upgrade P4 — 공급사 템플릿 저장·조회 (서버 전용 · 전부 best-effort).
 *
 * 쓰기(recordVendorTemplates)는 **확정 경로에서만** 호출된다 —
 *   P1 confirmCoa(inspect PATCH lotSource=coa_ocr). /api/ocr/correct 는 아직
 *   저장 placeholder(503)라 배선 대상이 아님(활성화 배치에서 동반 배선).
 * 실패는 전부 무시(학습은 부가 기능 — canonical 흐름을 절대 막지 않는다).
 */

import { db } from "@/lib/db";
import {
  extractTemplateCandidates,
  type TemplateCandidate,
} from "./vendor-template";
import { normalizeVendorName } from "@/lib/receiving/receipt-match";

export interface RecordVendorTemplatesInput {
  organizationId: string | null;
  vendorName: string | null;
  docType: "coa" | "invoice" | "label";
  rawText: string | null;
  /** 사람 확정값 (fieldKey → 값) */
  confirmedFields: Record<string, string | null | undefined>;
  /** OCR 추출값 (fieldKey → 값) — 보정 판별 기준 */
  ocrFields: Record<string, string | null | undefined>;
}

/** 확정 시 보정 필드 학습 — 저장 건수 반환(실패 = 0, 비차단). */
export async function recordVendorTemplates(
  input: RecordVendorTemplatesInput,
): Promise<number> {
  try {
    if (!input.organizationId || !input.rawText || !input.vendorName) return 0;
    const vendorKey = normalizeVendorName(input.vendorName);
    if (!vendorKey) return 0;
    const candidates = extractTemplateCandidates(
      input.rawText,
      input.confirmedFields,
      input.ocrFields,
    );
    for (const c of candidates) {
      await db.vendorParseTemplate.upsert({
        where: {
          organizationId_vendorKey_docType_fieldKey_anchorPattern: {
            organizationId: input.organizationId,
            vendorKey,
            docType: input.docType,
            fieldKey: c.fieldKey,
            anchorPattern: c.anchorPattern,
          },
        },
        create: {
          organizationId: input.organizationId,
          vendorKey,
          docType: input.docType,
          fieldKey: c.fieldKey,
          anchorPattern: c.anchorPattern,
          valuePattern: c.valuePattern ?? null,
        },
        update: { valuePattern: c.valuePattern ?? null }, // updatedAt 자동 갱신 → 캐시 버전 상승
      });
    }
    return candidates.length;
  } catch (err) {
    console.warn("[vendor-template] learn skipped:", (err as Error).message);
    return 0;
  }
}

/** 조직 템플릿 로드 — 사용 빈도순 상위 50 (실패 = []). */
export async function loadVendorTemplates(
  organizationId: string,
): Promise<TemplateCandidate[]> {
  try {
    const rows = await db.vendorParseTemplate.findMany({
      where: { organizationId },
      orderBy: [{ hits: "desc" }, { updatedAt: "desc" }],
      take: 50,
      select: { fieldKey: true, anchorPattern: true, valuePattern: true },
    });
    return rows as TemplateCandidate[];
  } catch {
    return [];
  }
}

/** 템플릿 버전 = max(updatedAt) — 학습 이후 구캐시 무효화 판정용 (실패 = null). */
export async function getTemplateVersion(
  organizationId: string,
): Promise<Date | null> {
  try {
    const agg = await db.vendorParseTemplate.aggregate({
      where: { organizationId },
      _max: { updatedAt: true },
    });
    return agg._max.updatedAt ?? null;
  } catch {
    return null;
  }
}

/** 힌트 적중 기록 — hits 증가 + lastUsedAt (fire-and-forget). */
export async function markTemplateHits(
  organizationId: string,
  fieldKeys: string[],
): Promise<void> {
  try {
    if (fieldKeys.length === 0) return;
    await db.vendorParseTemplate.updateMany({
      where: { organizationId, fieldKey: { in: fieldKeys } },
      data: { hits: { increment: 1 }, lastUsedAt: new Date() },
    });
  } catch {
    // 무시 — 통계 실패가 파싱을 막지 않는다
  }
}
