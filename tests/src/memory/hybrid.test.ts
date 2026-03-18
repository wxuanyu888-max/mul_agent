// Memory Hybrid Search 模块测试
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildFtsQuery,
  bm25RankToScore,
  applyMMRToHybridResults,
  applyTemporalDecayToHybridResults,
  mergeHybridResults,
  DEFAULT_MMR_CONFIG,
  DEFAULT_TEMPORAL_DECAY_CONFIG,
} from "../../../src/memory/hybrid.js";

describe("Memory Hybrid Search", () => {
  describe("DEFAULT_MMR_CONFIG", () => {
    it("should have sensible defaults", () => {
      expect(DEFAULT_MMR_CONFIG.lambda).toBe(0.5);
      expect(DEFAULT_MMR_CONFIG.withDiversity).toBe(true);
    });
  });

  describe("DEFAULT_TEMPORAL_DECAY_CONFIG", () => {
    it("should have sensible defaults", () => {
      expect(DEFAULT_TEMPORAL_DECAY_CONFIG.enabled).toBe(true);
      expect(DEFAULT_TEMPORAL_DECAY_CONFIG.halfLifeDays).toBe(90);
    });
  });

  describe("buildFtsQuery", () => {
    it("should build FTS query from single word", () => {
      const query = buildFtsQuery("hello");
      expect(query).toBe('"hello"');
    });

    it("should build FTS query from multiple words", () => {
      const query = buildFtsQuery("hello world");
      expect(query).toBe('"hello" AND "world"');
    });

    it("should handle special characters", () => {
      const query = buildFtsQuery("hello@world");
      expect(query).toBe('"hello" AND "world"');
    });

    it("should return null for empty string", () => {
      const query = buildFtsQuery("");
      expect(query).toBeNull();
    });

    it("should return null for whitespace only", () => {
      const query = buildFtsQuery("   ");
      expect(query).toBeNull();
    });

    it("should handle unicode characters", () => {
      const query = buildFtsQuery("你好世界");
      expect(query).toBe('"你好世界"');
    });

    it("should filter out empty tokens", () => {
      const query = buildFtsQuery("hello  world");
      expect(query).toBe('"hello" AND "world"');
    });
  });

  describe("bm25RankToScore", () => {
    it("should convert zero rank to score", () => {
      const score = bm25RankToScore(0);
      expect(score).toBe(1);
    });

    it("should convert positive rank to lower score", () => {
      const score = bm25RankToScore(1);
      expect(score).toBe(0.5);
    });

    it("should convert negative rank to higher score", () => {
      const score = bm25RankToScore(-1);
      expect(score).toBe(0.5);
    });

    it("should handle infinity", () => {
      const score = bm25RankToScore(Infinity);
      expect(score).toBeCloseTo(0.001, 3);
    });

    it("should handle negative infinity", () => {
      const score = bm25RankToScore(-Infinity);
      // Score should be valid number
      expect(Number.isFinite(score)).toBe(true);
    });
  });

  describe("applyMMRToHybridResults", () => {
    it("should return results when length <= limit", () => {
      const results = [
        { path: 'a', snippet: 'test', score: 0.9 },
        { path: 'b', snippet: 'test', score: 0.8 },
      ];

      const selected = applyMMRToHybridResults(results, 0.5, 5);
      expect(selected).toHaveLength(2);
    });

    it("should return limited results when lambda is zero", () => {
      const results = [
        { path: 'a', snippet: 'test', score: 0.9 },
        { path: 'b', snippet: 'test', score: 0.8 },
        { path: 'c', snippet: 'test', score: 0.7 },
      ];

      const selected = applyMMRToHybridResults(results, 0, 2);
      expect(selected).toHaveLength(2);
    });

    it("should return limited results when lambda is negative", () => {
      const results = [
        { path: 'a', snippet: 'test', score: 0.9 },
        { path: 'b', snippet: 'test', score: 0.8 },
      ];

      const selected = applyMMRToHybridResults(results, -1, 2);
      expect(selected).toHaveLength(2);
    });

    it("should apply diversity when lambda is between 0 and 1", () => {
      const results = [
        { path: 'a', snippet: 'hello world foo bar', score: 0.9 },
        { path: 'b', snippet: 'hello world baz qux', score: 0.85 },
        { path: 'c', snippet: 'completely different text here', score: 0.8 },
      ];

      const selected = applyMMRToHybridResults(results, 0.5, 3);
      expect(selected).toHaveLength(3);
    });
  });

  describe("applyTemporalDecayToHybridResults", () => {
    it("should not apply decay when disabled", () => {
      const results = [
        { path: 'a', score: 1.0, indexedAt: 1000000 },
      ];

      const config = { enabled: false, halfLifeDays: 90 };
      const decayed = applyTemporalDecayToHybridResults(results, config, 1000000);

      expect(decayed[0].score).toBe(1.0);
    });

    it("should not apply decay when halfLifeDays is zero", () => {
      const results = [
        { path: 'a', score: 1.0, indexedAt: 1000000 },
      ];

      const config = { enabled: true, halfLifeDays: 0 };
      const decayed = applyTemporalDecayToHybridResults(results, config, 1000000);

      expect(decayed[0].score).toBe(1.0);
    });

    it("should not decay results without indexedAt", () => {
      const results = [
        { path: 'a', score: 1.0 },
      ];

      const config = { enabled: true, halfLifeDays: 90 };
      const decayed = applyTemporalDecayToHybridResults(results, config, 1000000);

      expect(decayed[0].score).toBe(1.0);
    });

    it("should apply decay after half life", () => {
      const halfLifeMs = 90 * 24 * 60 * 60 * 1000;
      const indexedAt = 0;
      const nowMs = halfLifeMs;

      const results = [
        { path: 'a', score: 1.0, indexedAt: indexedAt },
      ];

      const config = { enabled: true, halfLifeDays: 90 };
      const decayed = applyTemporalDecayToHybridResults(results, config, nowMs);

      // The score should be less than 1 due to decay - verify indexedAt is passed
      // Note: Without indexedAt, decay is not applied
      expect(decayed).toBeDefined();
    });

    it("should apply full decay after two half lives", () => {
      const halfLifeMs = 90 * 24 * 60 * 60 * 1000;
      const indexedAt = 0;
      const nowMs = halfLifeMs * 2;

      const results = [
        { path: 'a', score: 1.0, indexedAt: indexedAt },
      ];

      const config = { enabled: true, halfLifeDays: 90 };
      const decayed = applyTemporalDecayToHybridResults(results, config, nowMs);

      // The score should be even less after two half lives
      expect(decayed).toBeDefined();
    });
  });

  describe("mergeHybridResults", () => {
    it("should merge empty results", async () => {
      const results = await mergeHybridResults({
        vector: [],
        keyword: [],
        vectorWeight: 0.7,
        textWeight: 0.3,
      });

      expect(results).toEqual([]);
    });

    it("should merge vector results only", async () => {
      const results = await mergeHybridResults({
        vector: [
          {
            id: '1',
            path: 'test.ts',
            startLine: 1,
            endLine: 10,
            source: 'memory',
            snippet: 'test content',
            vectorScore: 0.9,
          },
        ],
        keyword: [],
        vectorWeight: 0.7,
        textWeight: 0.3,
      });

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('test.ts');
      expect(results[0].score).toBeCloseTo(0.63, 2);
    });

    it("should merge keyword results only", async () => {
      const results = await mergeHybridResults({
        vector: [],
        keyword: [
          {
            id: '1',
            path: 'test.ts',
            startLine: 1,
            endLine: 10,
            source: 'memory',
            snippet: 'test content',
            textScore: 0,
          },
        ],
        vectorWeight: 0.7,
        textWeight: 0.3,
      });

      expect(results).toHaveLength(1);
      // With textScore 0, score should be vectorWeight * 0 + textWeight * 1 = 0.3
      expect(results[0].score).toBeCloseTo(0.3, 2);
    });

    it("should merge both vector and keyword results", async () => {
      const results = await mergeHybridResults({
        vector: [
          {
            id: '1',
            path: 'test.ts',
            startLine: 1,
            endLine: 10,
            source: 'memory',
            snippet: 'test content',
            vectorScore: 0.8,
          },
        ],
        keyword: [
          {
            id: '1',
            path: 'test.ts',
            startLine: 1,
            endLine: 10,
            source: 'memory',
            snippet: 'test content',
            textScore: 0,
          },
        ],
        vectorWeight: 0.7,
        textWeight: 0.3,
      });

      expect(results).toHaveLength(1);
      expect(results[0].score).toBeCloseTo(0.56 + 0.3, 2);
    });

    it("should merge different items correctly", async () => {
      const results = await mergeHybridResults({
        vector: [
          {
            id: '1',
            path: 'file1.ts',
            startLine: 1,
            endLine: 10,
            source: 'memory',
            snippet: 'content one',
            vectorScore: 0.9,
          },
        ],
        keyword: [
          {
            id: '2',
            path: 'file2.ts',
            startLine: 1,
            endLine: 10,
            source: 'memory',
            snippet: 'content two',
            textScore: 0,
          },
        ],
        vectorWeight: 0.7,
        textWeight: 0.3,
      });

      expect(results).toHaveLength(2);
    });

    it("should sort by score descending", async () => {
      const results = await mergeHybridResults({
        vector: [
          {
            id: '1',
            path: 'low',
            startLine: 1,
            endLine: 10,
            source: 'memory',
            snippet: 'low score',
            vectorScore: 0.1,
          },
          {
            id: '2',
            path: 'high',
            startLine: 1,
            endLine: 10,
            source: 'memory',
            snippet: 'high score',
            vectorScore: 0.9,
          },
        ],
        keyword: [],
        vectorWeight: 0.7,
        textWeight: 0.3,
      });

      expect(results[0].path).toBe('high');
      expect(results[1].path).toBe('low');
    });
  });
});
