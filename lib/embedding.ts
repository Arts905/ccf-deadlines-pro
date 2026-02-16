/**
 * Jina Embedding 服务
 * 用于生成文本向量，支持语义搜索
 */

interface EmbeddingResponse {
  model: string;
  object: string;
  usage: { total_tokens: number };
  data: Array<{
    object: string;
    index: number;
    embedding: number[];
  }>;
}

// 缓存
const embeddingCache = new Map<string, number[]>();
const CONFERENCE_EMBEDDINGS_KEY = 'conference_embeddings';

/**
 * 调用 Jina API 获取文本 embedding
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) {
    console.log('[Embedding] No JINA_API_KEY configured');
    return null;
  }

  // 检查缓存
  const cacheKey = text.slice(0, 100);
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  try {
    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'jina-embeddings-v3',
        task: 'text-matching',
        input: [text],
      }),
    });

    if (!response.ok) {
      console.error(`[Embedding] API error: ${response.status}`);
      return null;
    }

    const data: EmbeddingResponse = await response.json();
    const embedding = data.data?.[0]?.embedding;

    if (embedding) {
      embeddingCache.set(cacheKey, embedding);
    }

    return embedding || null;
  } catch (error) {
    console.error('[Embedding] Error:', error);
    return null;
  }
}

/**
 * 批量获取 embedding（更高效）
 */
export async function getBatchEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey || texts.length === 0) {
    return texts.map(() => null);
  }

  // 找出未缓存的
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];
  const results: (number[] | null)[] = new Array(texts.length).fill(null);

  texts.forEach((text, i) => {
    const cacheKey = text.slice(0, 100);
    if (embeddingCache.has(cacheKey)) {
      results[i] = embeddingCache.get(cacheKey)!;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(text);
    }
  });

  if (uncachedTexts.length === 0) {
    return results;
  }

  try {
    // Jina 支持批量请求，但限制每批数量
    const BATCH_SIZE = 10;

    for (let i = 0; i < uncachedTexts.length; i += BATCH_SIZE) {
      const batch = uncachedTexts.slice(i, i + BATCH_SIZE);
      const batchIndices = uncachedIndices.slice(i, i + BATCH_SIZE);

      const response = await fetch('https://api.jina.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'jina-embeddings-v3',
          task: 'text-matching',
          input: batch,
        }),
      });

      if (!response.ok) {
        console.error(`[Embedding] Batch API error: ${response.status}`);
        continue;
      }

      const data: EmbeddingResponse = await response.json();

      batch.forEach((text, j) => {
        const embedding = data.data?.[j]?.embedding;
        if (embedding) {
          results[batchIndices[j]] = embedding;
          const cacheKey = text.slice(0, 100);
          embeddingCache.set(cacheKey, embedding);
        }
      });

      // 避免 API 限流
      if (i + BATCH_SIZE < uncachedTexts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  } catch (error) {
    console.error('[Embedding] Batch error:', error);
    return results;
  }
}

/**
 * 计算余弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 为会议生成搜索文本
 */
export function generateConferenceSearchText(conf: {
  title: string;
  description?: string;
  sub?: string;
  keywords?: string[];
}): string {
  const parts = [
    conf.title,
    conf.description || '',
    conf.sub || '',
    (conf.keywords || []).join(' '),
  ];

  return parts.filter(Boolean).join(' ').slice(0, 500);
}

/**
 * 语义搜索会议
 */
export async function semanticSearch(
  query: string,
  conferences: Array<{
    title: string;
    description?: string;
    sub?: string;
    keywords?: string[];
    embedding?: number[];
  }>,
  topK: number = 10
): Promise<Array<{ index: number; similarity: number }>> {
  const queryEmbedding = await getEmbedding(query);

  if (!queryEmbedding) {
    return [];
  }

  // 计算相似度
  const similarities = conferences.map((conf, index) => {
    if (!conf.embedding) {
      return { index, similarity: 0 };
    }

    const similarity = cosineSimilarity(queryEmbedding, conf.embedding);
    return { index, similarity };
  });

  // 排序并返回 topK
  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, topK);
}
