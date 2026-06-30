/**
 * §pubchem-enrich (호영님 2026-06-30) — Tier 2 substance 보강 (PLAN_pubchem-enrich-layer).
 *
 * 무키·무료 PubChem PUG REST 로 CAS(우선) 또는 제품명 → 정규화명·동의어·분자식 조회.
 * canonical(db.product) 무접촉 — suggestion projection. 실패/무결과/타임아웃 → null(best-effort).
 * 벤더 Cat# 는 free 소스 0 이라 다루지 않음(SCOPING_manufacturer-catalog-free-source).
 *
 * server-only: GET /api/catalog/enrich 에서만 import.
 */

const PUBCHEM_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";
const TIMEOUT_MS = 2500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_SYNONYMS = 8;

export interface PubchemEnrichment {
  source: "pubchem";
  cid: number;
  canonicalName: string; // PubChem Title (사람이 읽는 표준명)
  iupacName: string | null;
  molecularFormula: string | null;
  synonyms: string[]; // 상위 N개(원본 query 제외 가능)
}

// 모듈 스코프 인메모리 캐시(서버리스 인스턴스 단위, rate-limit 5/s 완화). key = normalized query.
const cache = new Map<string, { at: number; value: PubchemEnrichment | null }>();

function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

async function fetchJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null; // 404(무매칭)/5xx → null
    return await res.json();
  } catch {
    return null; // timeout/network → null (best-effort)
  } finally {
    clearTimeout(t);
  }
}

/**
 * CAS 우선, 없으면 name 으로 PubChem 조회. 둘 다 없으면 null.
 * @returns 보강 결과 또는 null(무결과·실패).
 */
export async function pubchemEnrich(args: { cas?: string | null; name?: string | null }): Promise<PubchemEnrichment | null> {
  const query = (args.cas?.trim() || args.name?.trim() || "");
  if (!query) return null;

  const key = normalizeQuery(query);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  // 1) name(=CAS 또는 제품명) → CID + property
  const enc = encodeURIComponent(query);
  const propJson = await fetchJson(`${PUBCHEM_BASE}/compound/name/${enc}/property/Title,IUPACName,MolecularFormula/JSON`);
  const prop = propJson?.PropertyTable?.Properties?.[0];
  if (!prop?.CID) {
    cache.set(key, { at: Date.now(), value: null });
    return null;
  }

  // 2) CID → synonyms (best-effort; 실패해도 보강은 진행)
  let synonyms: string[] = [];
  const synJson = await fetchJson(`${PUBCHEM_BASE}/compound/cid/${prop.CID}/synonyms/JSON`);
  const synList: unknown = synJson?.InformationList?.Information?.[0]?.Synonym;
  if (Array.isArray(synList)) {
    synonyms = (synList as string[])
      .filter((s) => typeof s === "string" && s.trim() && s.trim().toLowerCase() !== key)
      .slice(0, MAX_SYNONYMS);
  }

  const value: PubchemEnrichment = {
    source: "pubchem",
    cid: prop.CID,
    canonicalName: typeof prop.Title === "string" && prop.Title.trim() ? prop.Title : query,
    iupacName: typeof prop.IUPACName === "string" ? prop.IUPACName : null,
    molecularFormula: typeof prop.MolecularFormula === "string" ? prop.MolecularFormula : null,
    synonyms,
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}
