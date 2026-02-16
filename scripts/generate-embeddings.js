/**
 * 预生成会议 Embedding 脚本
 * 1. 从 Supabase 读取所有会议
 * 2. 调用 Jina API 生成 embedding
 * 3. 存储回 Supabase
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const JINA_API_KEY = process.env.JINA_API_KEY;

// 配置
const BATCH_SIZE = 10;  // Jina API 批量限制
const DELAY_MS = 500;   // 批次间隔

// 生成搜索文本
function generateSearchText(conf) {
  const parts = [
    conf.title,
    conf.description || '',
    conf.sub || '',
    (conf.keywords || []).join(' '),
  ];
  return parts.filter(Boolean).join(' ').slice(0, 500);
}

// 调用 Jina API 获取 embedding
async function getBatchEmbeddings(texts) {
  if (!JINA_API_KEY) {
    throw new Error('JINA_API_KEY not configured');
  }

  const response = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JINA_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'jina-embeddings-v3',
      task: 'text-matching',
      input: texts,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Jina API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data.map(d => d.embedding);
}

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 将数组转换为 PostgreSQL vector 格式
function toVectorString(embedding) {
  return `[${embedding.join(',')}]`;
}

async function main() {
  console.log('='.repeat(50));
  console.log('预生成会议 Embedding 脚本');
  console.log('='.repeat(50));

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[错误] 缺少 Supabase 配置');
    process.exit(1);
  }

  if (!JINA_API_KEY) {
    console.error('[错误] 缺少 JINA_API_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 1. 获取所有会议
  console.log('\n[1/3] 获取会议数据...');
  const { data: conferences, error } = await supabase
    .from('conferences')
    .select('id, title, description, sub, keywords, search_text');

  if (error) {
    console.error(`[错误] 查询失败: ${error.message}`);
    process.exit(1);
  }

  // 过滤已生成 embedding 的会议
  const { data: existingEmbeddings } = await supabase
    .from('conferences')
    .select('id')
    .not('embedding', 'is', null);

  const existingIds = new Set(existingEmbeddings?.map(e => e.id) || []);
  const toProcess = conferences.filter(c => !existingIds.has(c.id));

  console.log(`  总共 ${conferences.length} 个会议`);
  console.log(`  已有 embedding: ${existingIds.size}`);
  console.log(`  需要生成: ${toProcess.length}`);

  if (toProcess.length === 0) {
    console.log('\n✅ 所有会议已有 embedding！');
    process.exit(0);
  }

  // 2. 分批生成 embedding
  console.log('\n[2/3] 生成 Embedding...');
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    const texts = batch.map(conf => {
      // 优先使用已有的 search_text，否则生成新的
      if (conf.search_text) return conf.search_text;
      const newText = generateSearchText(conf);
      return newText;
    });

    try {
      console.log(`  处理 ${i + 1}-${Math.min(i + BATCH_SIZE, toProcess.length)} / ${toProcess.length}...`);
      const embeddings = await getBatchEmbeddings(texts);

      // 更新数据库
      for (let j = 0; j < batch.length; j++) {
        const conf = batch[j];
        const embedding = embeddings[j];
        const searchText = texts[j];

        const { error: updateError } = await supabase
          .from('conferences')
          .update({
            embedding: toVectorString(embedding),
            search_text: searchText,
          })
          .eq('id', conf.id);

        if (updateError) {
          console.error(`    [错误] ${conf.title}: ${updateError.message}`);
          failed++;
        } else {
          processed++;
        }
      }

      console.log(`    ✓ 本批完成 ${batch.length} 个`);

      // 避免限流
      if (i + BATCH_SIZE < toProcess.length) {
        await delay(DELAY_MS);
      }
    } catch (e) {
      console.error(`    [错误] 批次失败: ${e.message}`);
      failed += batch.length;
    }
  }

  // 3. 验证
  console.log('\n[3/3] 验证结果...');
  const { data: verify } = await supabase
    .from('conferences')
    .select('id, title')
    .not('embedding', 'is', null)
    .limit(5);

  console.log(`  成功: ${processed}`);
  console.log(`  失败: ${failed}`);

  if (verify && verify.length > 0) {
    console.log('\n示例（前5个）:');
    verify.forEach(v => console.log(`  - ${v.title}`));
  }

  console.log('\n✅ 完成！');
}

main().catch(console.error);
