/**
 * §scan-reverse-match-v2 (호영님 2026-06-30) — 스캔 역매칭 v2.
 *
 * §scan-secondary-match(§11.309b matchProduct 재사용)의 한계 보정:
 *   ① 단방향(기존.name CONTAINS 스캔.name)만 → 양방향(스캔⊇기존도) + 정규화
 *   ② result-level 단일 score(0.4/0.6) → per-candidate 신뢰도
 *   ③ 미정렬 → 신뢰도순 정렬 + cap 3
 *
 * 가드(FP 방지): 단일 토큰 매칭 금지(≥2 공유), brand 단독 매칭 금지(보조 신호만).
 * canonical 무접촉 — 후보는 suggestion(자동확정 X). matchProduct(§11.309b)는 무변경.
 *
 * Prisma `contains` 는 단방향(column CONTAINS literal)뿐 → 역방향·토큰은 pool fetch 후 app-side 계산.
 * server-only: scan-label 라우트에서만 import.
 */

export interface ReverseMatchInput {
  productName?: string | null;
  brand?: string | null;
}

export interface ScoredCandidate {
  id: string;
  name: string;
  brand: string | null;
  catalogNumber: string | null;
  confidence: number; // 0..1 (per-candidate)
  level: "high" | "medium" | "low";
  basis: "exact" | "contains" | "token" | "synonym" | "cas";
}

interface RawProduct {
  id: string;
  name: string;
  brand: string | null;
  catalogNumber: string | null;
}

/** Prisma-compatible 최소 인터페이스 — 실 client 또는 mock 주입. */
export interface ReverseMatcherDb {
  product: {
    findMany: (args: unknown) => Promise<RawProduct[]>;
  };
}

const POOL_TAKE = 50;
const MAX_CANDIDATES = 3;
const MAX_TOKEN_OR = 6;
// 측정 단위/제형/등급 — 매칭 신호로 부적합한 흔한 토큰.
const STOPWORDS = new Set([
  "solution", "sol", "powder", "liquid", "grade", "for", "and",
  "ml", "mg", "g", "l", "kg", "mm", "nm", "um", "reagent", "acs", "usp", "bp",
]);

/** 소문자·구분자(-,_,/) 공백화·collapse·trim. 양방향 비교·토큰화 공통. */
function norm(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase().replace(/[-_/]/g, " ").replace(/\s+/g, " ").trim();
}

/** 유의 토큰: 길이≥2, 순수 숫자/퍼센트 제외, stopword 제외. */
function tokenize(value: string | null | undefined): string[] {
  const n = norm(value);
  if (!n) return [];
  return n
    .split(" ")
    .filter((t) => t.length >= 2 && !/^\d+(\.\d+)?%?$/.test(t) && !STOPWORDS.has(t));
}

/**
 * catalogNo 미매칭 시 name/brand 로 기존 품목 후보를 양방향·토큰으로 점수화.
 * @returns 신뢰도순 정렬 + cap 3. 후보 없으면 [].
 */
export async function rankReverseCandidates(
  input: ReverseMatchInput,
  deps: { db: ReverseMatcherDb },
): Promise<ScoredCandidate[]> {
  const sNameRaw = (input.productName ?? "").trim();
  const sBrandRaw = (input.brand ?? "").trim();
  const sName = norm(sNameRaw);
  const sBrand = norm(sBrandRaw);
  const sTokens = tokenize(sNameRaw);
  if (!sName && !sBrand) return [];

  // ── pool fetch (forward name + 토큰 + brand OR, bounded) ──
  //   역방향(스캔⊇기존) 후보까지 풀에 포함되도록 토큰 조건 추가.
  const or: Array<Record<string, unknown>> = [];
  if (sNameRaw) or.push({ name: { contains: sNameRaw, mode: "insensitive" } });
  for (const t of sTokens.slice(0, MAX_TOKEN_OR)) {
    or.push({ name: { contains: t, mode: "insensitive" } });
  }
  if (sBrandRaw) or.push({ brand: { contains: sBrandRaw, mode: "insensitive" } });
  if (or.length === 0) return [];

  const pool = await deps.db.product.findMany({
    where: { OR: or },
    take: POOL_TAKE,
    select: { id: true, name: true, brand: true, catalogNumber: true },
  });

  const scored: ScoredCandidate[] = [];
  for (const p of pool) {
    const eName = norm(p.name);
    const eBrand = norm(p.brand);
    const eTokens = tokenize(p.name);

    // brand 는 보조 신호만 — 단독으로 후보 자격을 주지 않음.
    const brandMatch = !!(
      sBrand && eBrand && (eBrand.includes(sBrand) || sBrand.includes(eBrand))
    );

    let confidence = 0;
    let basis: ScoredCandidate["basis"] | null = null;

    if (sName && eName && sName === eName) {
      confidence = brandMatch ? 0.95 : 0.85;
      basis = "exact";
    } else if (sName && eName && (eName.includes(sName) || sName.includes(eName))) {
      // 양방향 contains — 길이비로 약화(짧은 부분일치는 낮게).
      const ratio = Math.min(sName.length, eName.length) / Math.max(sName.length, eName.length);
      confidence = 0.6 + 0.15 * ratio + (brandMatch ? 0.05 : 0);
      basis = "contains";
    } else {
      // 토큰: ≥2 공유 필수(단일 토큰 매칭 금지 — FP 방지).
      const shared = sTokens.filter((t) => eTokens.includes(t));
      if (shared.length >= 2) {
        confidence = Math.min(0.6, 0.45 + 0.05 * shared.length) + (brandMatch ? 0.05 : 0);
        basis = "token";
      }
    }

    // 이름 신호 0(brand 만) → 후보 아님.
    if (!basis) continue;

    confidence = Math.min(confidence, 0.99);
    const level: ScoredCandidate["level"] =
      confidence >= 0.8 ? "high" : confidence >= 0.55 ? "medium" : "low";
    scored.push({
      id: p.id,
      name: p.name,
      brand: p.brand,
      catalogNumber: p.catalogNumber,
      confidence: Number(confidence.toFixed(2)),
      level,
      basis,
    });
  }

  scored.sort((a, b) => b.confidence - a.confidence);
  return scored.slice(0, MAX_CANDIDATES);
}

/** §scan-synonym-bridge (호영님 2026-06-30) — PubChem 동의어로 약어↔풀네임 역매칭(Tier 3). */
export interface SynonymMatchInput {
  synonyms: string[];
  canonicalName?: string | null;
}

const MIN_ALIAS_LEN = 3;

/**
 * PubChem 동의어(+정규화명)로 기존 품목 역매칭 — reverse-match(name/token) 0건일 때 fallback.
 * synonym=간접 신호 → 보수 점수(상한 0.8). alias 최소 3자(짧은 약어 FP 억제). dedupe·정렬·cap 3.
 * canonical 무접촉 — 후보는 suggestion(자동확정 X).
 */
export async function rankSynonymCandidates(
  input: SynonymMatchInput,
  deps: { db: ReverseMatcherDb },
): Promise<ScoredCandidate[]> {
  const raw = [input.canonicalName ?? "", ...(input.synonyms ?? [])];
  const aliases = Array.from(new Set(raw.map(norm))).filter((a) => a.length >= MIN_ALIAS_LEN).slice(0, 10);
  if (aliases.length === 0) return [];

  const pool = await deps.db.product.findMany({
    where: { OR: aliases.map((a) => ({ name: { contains: a, mode: "insensitive" } })) },
    take: POOL_TAKE,
    select: { id: true, name: true, brand: true, catalogNumber: true },
  });

  const byId = new Map<string, ScoredCandidate>();
  for (const p of pool) {
    const eName = norm(p.name);
    if (eName.length < MIN_ALIAS_LEN) continue;
    let best = 0;
    for (const a of aliases) {
      if (eName === a) best = Math.max(best, 0.75);
      else if (eName.includes(a) || a.includes(eName)) {
        const ratio = Math.min(a.length, eName.length) / Math.max(a.length, eName.length);
        best = Math.max(best, 0.55 + 0.1 * ratio);
      }
    }
    if (best <= 0) continue;
    const confidence = Math.min(best, 0.8); // synonym=간접 → high 상한 억제
    const level: ScoredCandidate["level"] = confidence >= 0.8 ? "high" : confidence >= 0.55 ? "medium" : "low";
    const cand: ScoredCandidate = {
      id: p.id, name: p.name, brand: p.brand, catalogNumber: p.catalogNumber,
      confidence: Number(confidence.toFixed(2)), level, basis: "synonym",
    };
    const prev = byId.get(p.id);
    if (!prev || cand.confidence > prev.confidence) byId.set(p.id, cand);
  }
  return [...byId.values()].sort((a, b) => b.confidence - a.confidence).slice(0, MAX_CANDIDATES);
}
