import { Prisma } from "@prisma/client";
import { normalizeQuery, tokenizeQuery } from "./synonyms";

/**
 * Search ranking weights
 * Higher scores = better match
 */
export const RANKING_WEIGHTS = {
  CATALOG_EXACT: 100,     // Exact catalog number match
  CATALOG_PREFIX: 60,     // Catalog number starts with query
  NAME_PREFIX: 40,        // Product name starts with query
  NAME_CONTAINS: 20,      // Product name contains query
  TRIGRAM_MAX: 20,        // Maximum score from trigram similarity (0-20)
  VENDOR_MATCH: 10,       // Vendor name matches
};

/**
 * Calculate relevance score for a product based on query
 */
export interface ScoringFactors {
  catalogExact: boolean;
  catalogPrefix: boolean;
  namePrefix: boolean;
  nameContains: boolean;
  trigramSimilarity: number; // 0-1
  vendorMatch: boolean;
}

export function calculateRelevanceScore(factors: ScoringFactors): number {
  let score = 0;

  if (factors.catalogExact) score += RANKING_WEIGHTS.CATALOG_EXACT;
  else if (factors.catalogPrefix) score += RANKING_WEIGHTS.CATALOG_PREFIX;

  if (factors.namePrefix) score += RANKING_WEIGHTS.NAME_PREFIX;
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
  category?: string;
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
  const allQueries = [normalizedQuery, ...expandedQueries.map(normalizeQuery)];

  // Build WHERE conditions
  const searchConditions: Prisma.ProductWhereInput[] = [];

  // For each query variant, add ILIKE conditions
  for (const q of allQueries) {
    searchConditions.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { catalogNumber: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
      ],
    });
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
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.product.name.localeCompare(b.product.name);
  });

  return scored;
}
