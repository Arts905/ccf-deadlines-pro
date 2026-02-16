import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types matching the schema
export interface ConferenceRow {
  id: string;
  title: string;
  description: string | null;
  sub: string | null;
  acceptance_rate: Array<{year: number; rate: number; accepted?: number; total?: number}> | null;
  keywords: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface RankRow {
  id: string;
  conference_id: string;
  ccf: string | null;
  core: string | null;
  thcpl: string | null;
  created_at: string;
}

export interface ConferenceInstanceRow {
  id: string;
  conference_id: string;
  year: number;
  date: string | null;
  place: string | null;
  timezone: string | null;
  link: string | null;
  created_at: string;
}

export interface TimelineItemRow {
  id: string;
  instance_id: string;
  deadline: string | null;
  abstract_deadline: string | null;
  comment: string | null;
  created_at: string;
}

// Helper function to fetch all conferences with their relations
export async function getConferencesFromDB() {
  const { data: conferences, error } = await supabase
    .from('conferences')
    .select(`
      id,
      title,
      description,
      sub,
      acceptance_rate,
      keywords,
      embedding,
      search_text,
      ranks (
        ccf,
        core,
        thcpl
      ),
      conference_instances (
        id,
        year,
        date,
        place,
        timezone,
        link,
        timeline_items (
          deadline,
          abstract_deadline,
          comment
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching conferences:', error);
    throw error;
  }

  // Transform to match the original Conference type
  return conferences?.map(conf => {
    // 解析 embedding 字符串为数组
    let embedding: number[] | undefined;
    if (conf.embedding) {
      try {
        // PostgreSQL vector 格式: "[0.1,0.2,0.3]"
        embedding = JSON.parse(conf.embedding);
      } catch {
        console.warn(`Failed to parse embedding for ${conf.title}`);
      }
    }

    return {
      id: conf.id,
      title: conf.title,
      description: conf.description,
      sub: conf.sub,
      rank: conf.ranks ? {
        ccf: conf.ranks.ccf,
        core: conf.ranks.core,
        thcpl: conf.ranks.thcpl
      } : undefined,
      acceptanceRate: conf.acceptance_rate || undefined,
      keywords: conf.keywords || undefined,
      embedding,
      searchText: conf.search_text || undefined,
      confs: conf.conference_instances?.map(instance => ({
        year: instance.year,
        date: instance.date,
        place: instance.place,
        timezone: instance.timezone,
        link: instance.link,
        timeline: instance.timeline_items?.map(item => ({
          deadline: item.deadline,
          abstract_deadline: item.abstract_deadline,
          comment: item.comment
        })) || []
      })) || []
    };
  }) || [];
}

/**
 * 向量相似度搜索
 * 使用 Supabase pgvector 的余弦距离搜索
 */
export async function vectorSearchConferences(
  queryEmbedding: number[],
  limit: number = 20,
  filters?: {
    rank?: string;
    sub?: string;
  }
) {
  // 将数组转换为 PostgreSQL vector 格式
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  // 构建基础查询
  let query = supabase
    .rpc('vector_search_conferences', {
      query_embedding: vectorStr,
      match_limit: limit,
    });

  // 如果没有存储过程，使用直接查询
  // 直接使用 SQL 查询
  const { data, error } = await supabase
    .from('conferences')
    .select(`
      id,
      title,
      description,
      sub,
      keywords,
      embedding,
      ranks (ccf, core, thcpl)
    `)
    .not('embedding', 'is', null);

  if (error || !data) {
    console.error('Vector search error:', error);
    return [];
  }

  // 在内存中计算相似度并排序
  const results = data
    .map(conf => {
      let embedding: number[] = [];
      if (conf.embedding) {
        try {
          // PostgreSQL vector 格式解析
          embedding = JSON.parse(conf.embedding.replace(/[\[\]]/g, '[$&]'));
        } catch {
          embedding = [];
        }
      }

      const similarity = cosineSimilarity(queryEmbedding, embedding);

      return {
        ...conf,
        similarity,
      };
    })
    .filter(r => r.similarity > 0.3) // 过滤低相似度
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

// 余弦相似度计算
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;

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
