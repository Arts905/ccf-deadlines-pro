-- ============================================
-- 步骤 1: 启用 pgvector 扩展（如果没有）
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 步骤 2: 添加 embedding 列
-- ============================================
-- Jina embeddings v3 输出 1024 维向量
ALTER TABLE conferences ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- ============================================
-- 步骤 3: 创建向量索引（加速搜索）
-- ============================================
CREATE INDEX IF NOT EXISTS conferences_embedding_idx
ON conferences
USING hnsw (embedding vector_cosine_ops);

-- ============================================
-- 步骤 4: 添加 search_text 列（用于重新生成 embedding）
-- ============================================
ALTER TABLE conferences ADD COLUMN IF NOT EXISTS search_text text;

-- 更新 search_text（组合标题、描述、关键词）
UPDATE conferences
SET search_text = CONCAT_WS(' ',
  title,
  description,
  sub,
  COALESCE(keywords::text, '')
)
WHERE search_text IS NULL;

-- ============================================
-- 验证
-- ============================================
SELECT id, title, search_text IS NOT NULL as has_search_text
FROM conferences
LIMIT 5;
