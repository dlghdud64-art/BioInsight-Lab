/**
 * Synonym dictionary for search query expansion
 * Maps common abbreviations and alternative terms to their expanded forms
 */

export interface SynonymGroup {
  terms: string[]; // All equivalent terms
  primary: string; // Primary/canonical term
}

// Common lab reagent and equipment synonyms
export const SYNONYM_GROUPS: SynonymGroup[] = [
  // Buffers
  {
    terms: ["pbs", "phosphate buffered saline", "phosphate buffer"],
    primary: "phosphate buffered saline",
  },
  {
    terms: ["tbs", "tris buffered saline", "tris buffer"],
    primary: "tris buffered saline",
  },
  {
    terms: ["hepes", "4-(2-hydroxyethyl)-1-piperazineethanesulfonic acid"],
    primary: "hepes",
  },

  // Solvents
  {
    terms: ["etoh", "ethanol", "ethyl alcohol"],
    primary: "ethanol",
  },
  {
    terms: ["meoh", "methanol", "methyl alcohol"],
    primary: "methanol",
  },
  {
    terms: ["dmso", "dimethyl sulfoxide"],
    primary: "dmso",
  },
  {
    terms: ["acn", "acetonitrile", "ch3cn"],
    primary: "acetonitrile",
  },

  // Common reagents
  {
    terms: ["edta", "ethylenediaminetetraacetic acid"],
    primary: "edta",
  },
  {
    terms: ["sds", "sodium dodecyl sulfate", "sodium lauryl sulfate"],
    primary: "sds",
  },
  {
    terms: ["bsa", "bovine serum albumin"],
    primary: "bovine serum albumin",
  },
  {
    terms: ["dtt", "dithiothreitol"],
    primary: "dtt",
  },
  {
    terms: ["pmsf", "phenylmethylsulfonyl fluoride"],
    primary: "pmsf",
  },

  // Equipment
  {
    terms: ["pcr", "polymerase chain reaction"],
    primary: "pcr",
  },
  {
    terms: ["hplc", "high performance liquid chromatography"],
    primary: "hplc",
  },
  {
    terms: ["gc", "gas chromatography"],
    primary: "gas chromatography",
  },
  {
    terms: ["ms", "mass spectrometry", "mass spec"],
    primary: "mass spectrometry",
  },

  // Cell culture
  {
    terms: ["fbs", "fetal bovine serum"],
    primary: "fetal bovine serum",
  },
  {
    terms: ["dmem", "dulbecco's modified eagle medium"],
    primary: "dmem",
  },
  {
    terms: ["rpmi", "roswell park memorial institute medium"],
    primary: "rpmi",
  },

  // Common typos and variants
  {
    terms: ["tip", "tips", "pipette tip"],
    primary: "pipette tip",
  },
  {
    terms: ["tube", "tubes", "centrifuge tube"],
    primary: "tube",
  },
  {
    terms: ["plate", "plates", "microplate", "well plate"],
    primary: "microplate",
  },
];

// Build reverse lookup map for fast access
const synonymMap = new Map<string, string[]>();

for (const group of SYNONYM_GROUPS) {
  for (const term of group.terms) {
    const normalized = term.toLowerCase();
    synonymMap.set(normalized, group.terms);
  }
}

/**
 * Expand query with synonyms
 * Returns array of alternative queries to search
 * Limits to maximum 3 expansions to avoid performance issues
 */
export function expandQueryWithSynonyms(query: string): string[] {
  const normalized = query.toLowerCase().trim();

  // If query is a single word/term, check for direct synonym match
  const synonyms = synonymMap.get(normalized);
  if (synonyms) {
    // Return original query plus up to 2 most relevant synonyms
    return [query, ...synonyms.filter(s => s !== normalized).slice(0, 2)];
  }

  // For multi-word queries, check each word
  const words = normalized.split(/\s+/);
  const expandedWords: string[][] = [];

  for (const word of words) {
    const wordSynonyms = synonymMap.get(word);
    if (wordSynonyms) {
      // Include original word and one synonym
      expandedWords.push([word, ...wordSynonyms.filter(s => s !== word).slice(0, 1)]);
    } else {
      expandedWords.push([word]);
    }
  }

  // Generate query combinations (limit to 3 total)
  const queries = new Set<string>();
  queries.add(query); // Always include original

  // Add variation with first synonym substitution
  if (expandedWords.some(words => words.length > 1)) {
    const variation = expandedWords.map(words => words[0]).join(" ");
    if (variation !== normalized) {
      queries.add(variation);
    }
  }

  return Array.from(queries).slice(0, 3);
}

/**
 * Normalize query for consistent searching
 * - Lowercase
 * - Trim whitespace
 * - Remove special characters (except hyphen and space)
 */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Tokenize query into individual terms
 */
export function tokenizeQuery(query: string): string[] {
  return normalizeQuery(query)
    .split(/\s+/)
    .filter(term => term.length > 0);
}

/**
 * Check if a term is likely a catalog number
 * Catalog numbers typically contain letters and numbers, often with hyphens
 */
export function isCatalogNumber(term: string): boolean {
  // Must contain at least one digit
  if (!/\d/.test(term)) return false;

  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(term)) return false;

  // Should be reasonably short (typical catalog numbers are < 20 chars)
  if (term.length > 20) return false;

  return true;
}
