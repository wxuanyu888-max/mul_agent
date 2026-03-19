// Offline Embedding Provider
// 使用简单的词袋模型和 TF-IDF 实现，不需要外部 API

import type { EmbeddingProvider } from './base.js';

interface TFIDFEntry {
  term: string;
  idf: number;
}

/**
 * 简单的 Offline Embedding 提供商
 * 使用词袋模型 + TF-IDF
 */
export class OfflineEmbeddingProvider implements EmbeddingProvider {
  id = 'offline';
  model = 'tfidf';

  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private documentCount = 0;
  private documents: Map<string, string[]> = new Map();

  /**
   * 对文本进行分词
   */
  private tokenize(text: string): string[] {
    // 简单分词：转小写，去除标点，按空格和中文分割
    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 1);
  }

  /**
   * 计算 TF-IDF 向量
   */
  private computeTFIDF(tokens: string[]): number[] {
    const tf = new Map<string, number>();
    const totalTokens = tokens.length;

    // 计算词频
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }

    // 计算 TF-IDF
    const vector: number[] = [];
    for (const [term, index] of this.vocabulary) {
      const termFreq = (tf.get(term) || 0) / totalTokens;
      const idf = this.idf.get(term) || 0;
      vector[index] = termFreq * idf;
    }

    // 归一化
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      return vector.map((v) => v / magnitude);
    }
    return vector;
  }

  /**
   * 添加文档到索引
   */
  addDocument(id: string, text: string): void {
    const tokens = this.tokenize(text);

    // 更新词汇表
    for (const token of new Set(tokens)) {
      if (!this.vocabulary.has(token)) {
        const index = this.vocabulary.size;
        this.vocabulary.set(token, index);
      }
    }

    // 保存文档的 tokens
    this.documents.set(id, tokens);

    // 更新 IDF
    for (const token of new Set(tokens)) {
      const currentIdf = this.idf.get(token) || 0;
      this.idf.set(token, currentIdf + 1);
    }

    this.documentCount++;
  }

  /**
   * 为查询生成嵌入向量
   */
  async embedQuery(text: string): Promise<number[]> {
    const tokens = this.tokenize(text);

    // 如果没有词汇表，返回随机向量
    if (this.vocabulary.size === 0) {
      return new Array(128).fill(0).map(() => Math.random() * 0.1);
    }

    // 计算查询的 TF-IDF 向量
    const vector = new Array(this.vocabulary.size).fill(0);
    const uniqueTokens = new Set(tokens);

    for (const token of uniqueTokens) {
      if (this.vocabulary.has(token)) {
        const index = this.vocabulary.get(token)!;
        const tf = (tokens.filter((t) => t === token).length) / tokens.length;
        const idf = Math.log(this.documentCount / ((this.idf.get(token) || 1) + 1)) + 1;
        vector[index] = tf * idf;
      }
    }

    // 归一化
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      return vector.map((v) => v / magnitude);
    }
    return vector;
  }

  /**
   * 批量嵌入
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embedQuery(text)));
  }

  /**
   * 搜索相似文档
   */
  search(query: string, topK: number = 5): Array<{ id: string; score: number }> {
    const queryVector = this.computeTFIDF(this.tokenize(query));
    const results: Array<{ id: string; score: number }> = [];

    for (const [id, tokens] of this.documents) {
      const docVector = this.computeTFIDF(tokens);

      // 计算余弦相似度
      let dotProduct = 0;
      for (let i = 0; i < queryVector.length; i++) {
        dotProduct += queryVector[i] * docVector[i];
      }

      results.push({ id, score: dotProduct });
    }

    // 按相似度排序
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}

/**
 * 创建 Offline Embedding Provider
 */
export function createOfflineEmbeddingProvider(): EmbeddingProvider {
  return new OfflineEmbeddingProvider();
}
