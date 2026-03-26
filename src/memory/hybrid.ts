/**
 * Hybrid Search
 *
 * Combines vector search, full-text search, and exact match with MMR and temporal decay.
 * Supports dynamic weight adjustment based on query characteristics.
 */

import type {
  HybridSource,
  HybridVectorResult,
  HybridKeywordResult,
  MMRConfig,
  TemporalDecayConfig,
  MemorySearchResult,
  QueryAnalysis,
} from './types.js';

export {
  type HybridSource,
  type HybridVectorResult,
  type HybridKeywordResult,
  type MMRConfig,
  type TemporalDecayConfig,
} from './types.js';

export const DEFAULT_MMR_CONFIG: MMRConfig = {
  lambda: 0.5,
  withDiversity: true,
};

export const DEFAULT_TEMPORAL_DECAY_CONFIG: TemporalDecayConfig = {
  enabled: true,
  halfLifeDays: 90,
};

// Default weights for different search channels
export const DEFAULT_WEIGHTS = {
  vector: 0.7,
  fts: 0.3,
  exact: 0.0, // Disabled by default
};

/**
 * Analyze query to determine its characteristics
 * Used for dynamic weight adjustment
 */
export function analyzeQuery(query: string): QueryAnalysis {
  const tokens = query.toLowerCase().split(/\s+/);

  // Count different types of terms
  const hasQuotes = query.includes('"') || query.includes("'");
  const hasOperators = /\b(and|or|not)\b/i.test(query);
  const isShort = tokens.length <= 2;
  const isLong = tokens.length >= 6;
  const hasNumbers = /\d+/.test(query);
  const hasSpecialChars = /[!@#$%^&*()_+=\[\]{}|\\:;'",.<>?/~`]/.test(query);

  // Determine query type
  let queryType: 'keyword' | 'semantic' | 'exact' | 'mixed' = 'keyword';

  if (hasQuotes || hasOperators) {
    queryType = 'exact';
  } else if (isShort && !hasNumbers) {
    queryType = 'semantic'; // Short queries benefit from vector search
  } else if (isLong) {
    queryType = 'mixed'; // Long queries benefit from both
  }

  return {
    queryType,
    termCount: tokens.length,
    hasQuotes,
    hasOperators,
    isShort,
    isLong,
    hasNumbers,
    hasSpecialChars,
  };
}

/**
 * Calculate dynamic weights based on query analysis
 */
export function calculateDynamicWeights(analysis: QueryAnalysis): {
  vector: number;
  fts: number;
  exact: number;
} {
  // Default weights
  let vector = DEFAULT_WEIGHTS.vector;
  let fts = DEFAULT_WEIGHTS.fts;
  let exact = DEFAULT_WEIGHTS.exact;

  // Adjust based on query type
  switch (analysis.queryType) {
    case 'exact':
      // Exact match queries benefit from FTS and exact matching
      vector = 0.2;
      fts = 0.5;
      exact = 0.3;
      break;

    case 'semantic':
      // Short semantic queries benefit from vector search
      vector = 0.8;
      fts = 0.2;
      exact = 0.0;
      break;

    case 'mixed':
      // Long queries benefit from balanced approach
      vector = 0.5;
      fts = 0.4;
      exact = 0.1;
      break;

    case 'keyword':
    default:
      // Default behavior - already set
      break;
  }

  // Boost FTS for queries with numbers or special characters
  if (analysis.hasNumbers || analysis.hasSpecialChars) {
    fts = Math.min(1.0, fts + 0.1);
    vector = Math.max(0, vector - 0.1);
  }

  // Boost vector for very short queries
  if (analysis.isShort) {
    vector = Math.min(1.0, vector + 0.1);
    fts = Math.max(0, fts - 0.1);
  }

  // Normalize weights
  const total = vector + fts + exact;
  return {
    vector: total > 0 ? vector / total : 0.7,
    fts: total > 0 ? fts / total : 0.3,
    exact: total > 0 ? exact / total : 0,
  };
}

/**
 * Perform exact match search (keyword matching)
 */
export function exactMatchSearch(query: string, documents: string[]): Array<{ index: number; score: number }> {
  const results: Array<{ index: number; score: number }> = [];
  const queryLower = query.toLowerCase();

  for (let i = 0; i < documents.length; i++) {
    const docLower = documents[i].toLowerCase();

    // Check for exact substring match
    if (docLower.includes(queryLower)) {
      // Exact match - highest score
      results.push({ index: i, score: 1.0 });
    } else {
      // Check for word-level match
      const queryWords = queryLower.split(/\s+/).filter(Boolean);
      const docWords = docLower.split(/\s+/);
      const matches = queryWords.filter((w) => docWords.includes(w)).length;

      if (matches > 0) {
        results.push({ index: i, score: matches / queryWords.length });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Build FTS query from raw search string
 */
export function buildFtsQuery(raw: string): string | null {
  const tokens = raw
    .match(/[\p{L}\p{N}_]+/gu)
    ?.map((t) => t.trim())
    .filter(Boolean);

  if (!tokens || tokens.length === 0) {
    return null;
  }

  const quoted = tokens.map((t) => `"${t.replaceAll('"', '')}"`);
  return quoted.join(' AND ');
}

/**
 * Convert BM25 rank to score
 */
export function bm25RankToScore(rank: number): number {
  if (!Number.isFinite(rank)) {
    return 1 / (1 + 999);
  }
  if (rank < 0) {
    const relevance = -rank;
    return relevance / (1 + relevance);
  }
  return 1 / (1 + rank);
}

/**
 * Apply MMR (Maximal Marginal Relevance) to results for diversity
 */
export function applyMMRToHybridResults(
  results: Array<{ path: string; snippet: string; score: number }>,
  lambda: number,
  limit: number
): Array<{ path: string; snippet: string; score: number }> {
  if (!lambda || lambda <= 0 || results.length <= limit) {
    return results.slice(0, limit);
  }

  const selected: Array<{ path: string; snippet: string; score: number }> = [];
  const remaining = [...results];

  // Select first result (highest score)
  const first = remaining.shift();
  if (first) {
    selected.push(first);
  }

  // Select remaining results with MMR
  while (selected.length < limit && remaining.length > 0) {
    let bestIdx = -1;
    let bestMMR = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];

      // Relevance to query
      const relevance = item.score;

      // Diversity - max similarity to already selected
      let maxSimilarity = 0;
      for (const sel of selected) {
        const similarity = computeSimilarity(item.snippet, sel.snippet);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      // MMR formula
      const mmr = lambda * relevance - (1 - lambda) * maxSimilarity;

      if (mmr > bestMMR) {
        bestMMR = mmr;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      selected.push(remaining.splice(bestIdx, 1)[0]);
    }
  }

  return selected;
}

/**
 * Simple similarity computation using character overlap
 */
function computeSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Apply temporal decay to results
 */
export function applyTemporalDecayToHybridResults(
  results: Array<{ path: string; score: number; indexedAt?: number }>,
  config: TemporalDecayConfig,
  nowMs?: number
): Array<{ path: string; score: number }> {
  if (!config.enabled || !config.halfLifeDays) {
    return results.map((r) => ({ path: r.path, score: r.score }));
  }

  const now = nowMs || Date.now();
  const halfLifeMs = config.halfLifeDays * 24 * 60 * 60 * 1000;

  return results.map((r) => {
    if (!r.indexedAt) {
      return { path: r.path, score: r.score };
    }

    const ageMs = now - r.indexedAt;
    const decayFactor = Math.pow(0.5, ageMs / halfLifeMs);

    return {
      path: r.path,
      score: r.score * decayFactor,
    };
  });
}

/**
 * Merge vector and keyword search results
 */
export async function mergeHybridResults(params: {
  vector: HybridVectorResult[];
  keyword: HybridKeywordResult[];
  vectorWeight: number;
  textWeight: number;
  mmr?: Partial<MMRConfig>;
  temporalDecay?: Partial<TemporalDecayConfig>;
  nowMs?: number;
}): Promise<MemorySearchResult[]> {
  const { vector, keyword, vectorWeight, textWeight, mmr, temporalDecay, nowMs } = params;

  const byId = new Map<
    string,
    {
      id: string;
      path: string;
      startLine: number;
      endLine: number;
      source: HybridSource;
      snippet: string;
      vectorScore: number;
      textScore: number;
      indexedAt?: number;
    }
  >();

  // Add vector results
  for (const r of vector) {
    const existing = byId.get(r.id);
    const score = r.vectorScore;
    byId.set(r.id, {
      ...r,
      vectorScore: score,
      textScore: existing?.textScore || 0,
      indexedAt: existing?.indexedAt,
    });
  }

  // Add keyword results
  for (const r of keyword) {
    const existing = byId.get(r.id);
    const score = bm25RankToScore(r.textScore);
    byId.set(r.id, {
      ...r,
      vectorScore: existing?.vectorScore || 0,
      textScore: score,
      indexedAt: existing?.indexedAt,
    });
  }

  // Convert to array and calculate combined scores
  let results = Array.from(byId.values()).map((r) => ({
    id: r.id,
    path: r.path,
    startLine: r.startLine,
    endLine: r.endLine,
    source: r.source,
    snippet: r.snippet,
    score: r.vectorScore * vectorWeight + r.textScore * textWeight,
    indexedAt: r.indexedAt,
  }));

  // Sort by score
  results.sort((a, b) => b.score - a.score);

  // Apply MMR for diversity if enabled
  const mmrConfig = { ...DEFAULT_MMR_CONFIG, ...mmr };
  if (mmrConfig.withDiversity) {
    results = applyMMRToHybridResults(
      results.map((r) => ({ path: r.path, snippet: r.snippet, score: r.score })),
      mmrConfig.lambda,
      results.length
    ) as typeof results;
  }

  // Apply temporal decay if enabled
  const decayConfig = { ...DEFAULT_TEMPORAL_DECAY_CONFIG, ...temporalDecay };
  const decayedResults = applyTemporalDecayToHybridResults(results, decayConfig, nowMs);

  // Merge decay scores back
  results = results.map((r) => ({
    ...r,
    score: decayedResults.find((d) => d.path === r.path)?.score || r.score,
  }));

  // Re-sort after decay
  results.sort((a, b) => b.score - a.score);

  // Convert to final format
  return results.map((r) => ({
    path: r.path,
    startLine: r.startLine,
    endLine: r.endLine,
    score: r.score,
    snippet: r.snippet,
    source: r.source as 'memory' | 'sessions',
  }));
}
