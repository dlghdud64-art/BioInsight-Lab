/**
 * §cas-hazard-classification P3b (호영님 2026-07-04) — Product 생성 시 CAS→위험분류 필드.
 *
 * 입고/생성 경로에서 OCR casNumber → casNo 저장 + 정적 CAS→GHS 분류로 hazardCodes/pictograms
 * 채움. 안전페이지 어댑터가 casNo 로 live 재분류하지만, hazardCodes 를 함께 저장하면
 * product-detail 등 다른 소비처도 즉시 정합(canonical 단일화).
 *
 * 순수 함수 — DB/네트워크 무의존. 미수록/무효 CAS = casNo 만 저장(분류 표시 없음 → 미분류).
 */
import { classifyByCas, normalizeCas, pictogramsFromHazardCodes } from "./cas-ghs-table";

export interface ProductHazardFields {
  casNo: string | null;
  hazardCodes?: string[];
  pictograms?: string[];
}

/**
 * 원본 CAS → Product.create/update 에 spread 할 위험 필드.
 *  - 정규화 실패: casNo=원본 trim(표시용), 분류 없음.
 *  - 정규화 성공·미수록: casNo 만(어댑터가 미분류 처리).
 *  - 정규화 성공·수록·위험: casNo + hazardCodes + pictograms.
 *  - 정규화 성공·수록·비위험(NaCl 등): casNo 만(어댑터가 casNo 로 classified=true·low 재파생).
 */
export function buildProductHazardFields(rawCas: string | null | undefined): ProductHazardFields {
  const normalized = normalizeCas(rawCas);
  if (!normalized) {
    const fallback = typeof rawCas === "string" && rawCas.trim() ? rawCas.trim() : null;
    return { casNo: fallback };
  }
  const r = classifyByCas(normalized);
  if (!r.matched || r.hazardCodes.length === 0) {
    return { casNo: normalized };
  }
  return {
    casNo: normalized,
    hazardCodes: r.hazardCodes,
    pictograms: pictogramsFromHazardCodes(r.hazardCodes),
  };
}
