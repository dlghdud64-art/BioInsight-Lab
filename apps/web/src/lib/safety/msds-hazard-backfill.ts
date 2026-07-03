/**
 * §cas-hazard-classification P3c (호영님 2026-07-04) — MSDS 업로드 시 위험분류 backfill.
 *
 * 기존 제품(CAS 미보유)을 MSDS 문서 업로드 시점에 organic 하게 분류: PDF→텍스트→GPT 로
 * hazardCodes/pictograms 추출 → Product 에 **fill-empty** 저장. CAS 정적분류·큐레이션이
 * 이미 채운 경우는 보존(canonical 우선순위: 저장값 > AI 추출).
 *
 * best-effort — 절대 예외를 던지지 않는다(SDS 업로드 성공이 canonical, backfill 은 부가).
 *   OPENAI_API_KEY 없음/PDF 아님/이미 분류됨/추출 실패 → 조용히 skip(가짜 성공 없음).
 */
import { db } from "@/lib/db";
import { extractTextFromPDF } from "@/lib/ai/pdf-parser";
import { extractSafetyInfoFromMSDS } from "@/lib/ai/safety-extractor";

export type MsdsBackfillReason =
  | "no_api_key" | "not_sds" | "not_pdf" | "already_classified"
  | "no_text" | "no_hazard_found" | "extract_failed";

export interface MsdsBackfillResult {
  backfilled: boolean;
  reason?: MsdsBackfillReason;
  hazardCodes?: string[];
}

export async function backfillHazardFromMsds(opts: {
  productId: string;
  buffer: Buffer;
  contentType?: string | null;
  docType: string;
}): Promise<MsdsBackfillResult> {
  const { productId, buffer, contentType, docType } = opts;
  try {
    if (docType !== "sds") return { backfilled: false, reason: "not_sds" };
    if (!process.env.OPENAI_API_KEY) return { backfilled: false, reason: "no_api_key" };
    // PDF 만 텍스트 추출 지원(doc/docx 는 별도 트랙).
    const isPdf = (contentType ?? "").toLowerCase().includes("pdf");
    if (!isPdf) return { backfilled: false, reason: "not_pdf" };

    // fill-empty: 이미 hazardCodes 있으면 보존(CAS/큐레이션 우선).
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { hazardCodes: true },
    });
    const existing = product?.hazardCodes;
    if (Array.isArray(existing) && existing.length > 0) {
      return { backfilled: false, reason: "already_classified" };
    }

    const text = await extractTextFromPDF(buffer);
    if (!text || text.trim().length === 0) return { backfilled: false, reason: "no_text" };

    const info = await extractSafetyInfoFromMSDS(text);
    const codes = Array.isArray(info.hazardCodes) ? info.hazardCodes.filter((c) => typeof c === "string") : [];
    if (codes.length === 0) return { backfilled: false, reason: "no_hazard_found" };

    const pictos = Array.isArray(info.pictograms) ? info.pictograms.filter((p) => typeof p === "string") : [];
    await db.product.update({
      where: { id: productId },
      data: {
        hazardCodes: codes,
        ...(pictos.length > 0 ? { pictograms: pictos } : {}),
        ...(info.storageCondition ? { storageCondition: info.storageCondition } : {}),
        ...(Array.isArray(info.ppe) && info.ppe.length > 0 ? { ppe: info.ppe } : {}),
        ...(info.summary ? { safetyNote: info.summary } : {}),
      },
    });
    return { backfilled: true, hazardCodes: codes };
  } catch {
    // 절대 업로드를 깨지 않는다.
    return { backfilled: false, reason: "extract_failed" };
  }
}
