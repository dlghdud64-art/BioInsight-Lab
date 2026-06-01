import { Prisma, ProductCategory } from "@prisma/client";
import { normalizeQuery, tokenizeQuery } from "./synonyms";

/**
 * Search ranking weights
 * Higher scores = better match
 */
export const RANKING_WEIGHTS = {
  CATALOG_EXACT: 100,        // Exact catalog number match
  CATALOG_PREFIX: 60,        // Catalog number starts with query
  NAME_PREFIX: 40,           // Product name starts with query
  NAME_WORD_BOUNDARY: 30,    // §11.335b — name 의 단어(공백/구분자 뒤)가 query 로 시작
  NAME_CONTAINS: 20,         // Product name contains query (단어 중간 포함)
  TRIGRAM_MAX: 20,           // Maximum score from trigram similarity (0-20)
  VENDOR_MATCH: 10,          // Vendor name matches
};

/**
 * Calculate relevance score for a product based on query
 */
export interface ScoringFactors {
  catalogExact: boolean;
  catalogPrefix: boolean;
  namePrefix: boolean;
  nameWordBoundary: boolean; // §11.335b — 단어경계(공백/구분자 뒤) 시작 일치
  nameContains: boolean;
  trigramSimilarity: number; // 0-1
  vendorMatch: boolean;
}

export function calculateRelevanceScore(factors: ScoringFactors): number {
  let score = 0;

  if (factors.catalogExact) score += RANKING_WEIGHTS.CATALOG_EXACT;
  else if (factors.catalogPrefix) score += RANKING_WEIGHTS.CATALOG_PREFIX;

  // §11.335b — 시작 일치 > 단어경계 > 포함 순으로 강도 차등.
  if (factors.namePrefix) score += RANKING_WEIGHTS.NAME_PREFIX;
  else if (factors.nameWordBoundary) score += RANKING_WEIGHTS.NAME_WORD_BOUNDARY;
  else if (factors.nameContains) score += RANKING_WEIGHTS.NAME_CONTAINS;

  // Trigram similarity adds 0-20 points
  score += factors.trigramSimilarity * RANKING_WEIGHTS.TRIGRAM_MAX;

  if (factors.vendorMatch) score += RANKING_WEIGHTS.VENDOR_MATCH;

  return score;
}

/**
 * Build PostgreSQL search query with ranking
 * Uses pg_trgm for similarity and custom scoring logic
 */
export interface SearchQueryOptions {
  query: string;
  expandedQueries?: string[]; // Synonym expansions
  vendorId?: string;
  category?: ProductCategory;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  similarityThreshold?: number; // Minimum trigram similarity (0-1)
}

export interface SearchFilters {
  where: Prisma.ProductWhereInput;
  orderBy: Prisma.ProductOrderByWithRelationInput[];
}

/**
 * Build search query for basic filtering (step 1)
 * Returns products matching ILIKE or trigram similarity
 */
export function buildSearchQuery(options: SearchQueryOptions): SearchFilters {
  const {
    query,
    expandedQueries = [],
    vendorId,
    category,
    minPrice,
    maxPrice,
    similarityThreshold = 0.2,
  } = options;

  const normalizedQuery = normalizeQuery(query);

  // §11.337-v2 Part A — 쿼리 길이 게이트(옵션 A: ranked search 의 base set 정밀화).
  //   짧은 쿼리(≤2자)는 단어 중간 contains 가 noise("P"→Capricorn/PCR 단어중간 'p').
  //   → 품명/Cat.No 의 시작(startsWith)만 base set 에 포함. brand 중간매칭 + synonyms 변형 컷.
  //   긴 쿼리(≥3자)는 의도 명확 → 현행 contains + synonyms 확장 유지("PCR"→PCR Tube 정상).
  //   점수(scoreProduct: CATALOG_PREFIX/NAME_PREFIX 우선)는 그대로 정렬에 사용.
  //
  // §11.335b (호영님 P2, §11.337 승계) — 소싱 검색 매칭 정밀화("조이기").
  //   결정: ① min 2글자(1글자는 결과 없음 → UI 빈 상태 "2글자 이상").
  //         ② 2글자: 단어 중간 contains 컷 — 품명/Cat.No 시작(startsWith) + 품명 단어경계
  //            (공백 뒤 시작)만. brand 제외. ("P" noise 원천 차단; min2 라 1글자는 아예 컷)
  //         ③ ≥3자: 전 필드 contains 보존(§11.335 Cat.No 검색 + 단어 내 매칭).
  //   랭킹 강도(scoreProduct): 시작 일치 > 단어경계 > 포함. 본 WHERE 는 base set 만.
  const QUERY_MIN_LENGTH = 2;
  const isShortQuery = normalizedQuery.length === 2;
  const allQueries = isShortQuery
    ? [normalizedQuery] // 짧은 쿼리: synonyms 확장 억제(noise 방지)
    : [normalizedQuery, ...expandedQueries.map(normalizeQuery)];

  // Build WHERE conditions
  const searchConditions: Prisma.ProductWhereInput[] = [];

  // ① min 2글자 게이트 — 1글자(또는 빈 값)는 매칭 0건(never-match). UI 는 빈 상태로 안내.
  if (normalizedQuery.length < QUERY_MIN_LENGTH) {
    return {
      where: { AND: [{ id: { equals: "__never_match__" } }] },
      orderBy: [{ updatedAt: "desc" }],
    };
  }

  // For each query variant, add ILIKE conditions
  for (const q of allQueries) {
    if (isShortQuery) {
      // ② 2글자: 품명/Cat.No 시작 + 품명 단어경계(공백 뒤 시작)만. 단어 중간 contains 컷.
      searchConditions.push({
        OR: [
          { name: { startsWith: q, mode: "insensitive" } },
          { name: { contains: ` ${q}`, mode: "insensitive" } }, // 단어경계(공백 뒤)
          { catalogNumber: { startsWith: q, mode: "insensitive" } },
        ],
      });
    } else {
      // ③ ≥3자: 전 필드 부분일치(현행 보존 — §11.335 Cat.No 검색 + 단어 내 매칭).
      searchConditions.push({
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { catalogNumber: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
        ],
      });
    }
  }

  const where: Prisma.ProductWhereInput = {
    AND: [
      // Search condition (OR of all variants)
      { OR: searchConditions },

      // Additional filters
      ...(vendorId ? [{ vendors: { some: { vendorId } } }] : []),
      ...(category ? [{ category }] : []),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? [
            {
              vendors: {
                some: {
                  AND: [
                    ...(minPrice !== undefined ? [{ priceInKRW: { gte: minPrice } }] : []),
                    ...(maxPrice !== undefined ? [{ priceInKRW: { lte: maxPrice } }] : []),
                  ],
                },
              },
            },
          ]
        : []),
    ],
  };

  // Default ordering (will be overridden with custom ranking)
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
    { updatedAt: "desc" },
  ];

  return { where, orderBy };
}

/**
 * Calculate score for a single product result
 * This should be called on each result to compute its relevance score
 */
export interface ProductForScoring {
  name: string;
  catalogNumber: string | null;
  vendors?: Array<{ vendor?: { name: string } | null }>;
}

export function scoreProduct(
  product: ProductForScoring,
  query: string,
  vendorFilter?: string
): number {
  const normalizedQuery = normalizeQuery(query);
  const normalizedName = normalizeQuery(product.name);
  const normalizedCatalog = product.catalogNumber
    ? normalizeQuery(product.catalogNumber)
    : "";

  const factors: ScoringFactors = {
    catalogExact: normalizedCatalog === normalizedQuery,
    catalogPrefix: normalizedCatalog.startsWith(normalizedQuery),
    namePrefix: normalizedName.startsWith(normalizedQuery),
    nameWordBoundary: hasWordBoundaryMatch(normalizedName, normalizedQuery),
    nameContains: normalizedName.includes(normalizedQuery),
    trigramSimilarity: calculateTrigramSimilarity(normalizedName, normalizedQuery),
    vendorMatch: false,
  };

  // Check vendor match if provided
  if (vendorFilter && product.vendors) {
    factors.vendorMatch = product.vendors.some(
      (pv) => pv.vendor?.name.toLowerCase().includes(vendorFilter.toLowerCase())
    );
  }

  return calculateRelevanceScore(factors);
}

/**
 * §11.335b — 단어경계 매칭: text 를 공백/하이픈/언더스코어/슬래시로 토큰화한 뒤
 * 어떤 단어가 query 로 시작하는지(첫 단어 제외 — 그건 namePrefix 로 이미 처리).
 * 예: "Microplate shaker" + "sh" → true("shaker"), "Microplate" 중간 'p' → false.
 */
export function hasWordBoundaryMatch(text: string, query: string): boolean {
  if (!text || !query) return false;
  const words = text.split(/[\s\-_/]+/).filter(Boolean);
  // 첫 단어 startsWith 는 namePrefix(상위 티어)와 중복 → 2번째 단어부터 검사.
  return words.slice(1).some((w) => w.startsWith(query));
}

/**
 * Simple trigram similarity estimation
 * For accurate results, use PostgreSQL's similarity() function
 * This is a client-side approximation
 */
function calculateTrigramSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const trigrams1 = getTrigrams(str1);
  const trigrams2 = getTrigrams(str2);

  if (trigrams1.size === 0 || trigrams2.size === 0) return 0;

  const intersection = new Set([...trigrams1].filter((x) => trigrams2.has(x)));
  const union = new Set([...trigrams1, ...trigrams2]);

  return intersection.size / union.size;
}

function getTrigrams(str: string): Set<string> {
  const trigrams = new Set<string>();
  const paddedStr = `  ${str} `; // Add padding for edge trigrams

  for (let i = 0; i < paddedStr.length - 2; i++) {
    trigrams.add(paddedStr.substring(i, i + 3));
  }

  return trigrams;
}

/**
 * Sort products by relevance score
 */
export interface ScoredProduct<T> {
  product: T;
  score: number;
}

export function sortByRelevance<T extends ProductForScoring>(
  products: T[],
  query: string,
  vendorFilter?: string
): ScoredProduct<T>[] {
  const scored = products.map((product) => ({
    product,
    score: scoreProduct(product, query, vendorFilter),
  }));

  // Sort by score descending, then by name ascending
  scored.sort((a: any, b: any) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.product.name.localeCompare(b.product.name);
  });

  return scored;
}
