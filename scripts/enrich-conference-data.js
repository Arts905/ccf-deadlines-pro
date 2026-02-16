/**
 * 会议数据增强脚本
 * 1. 从 GitHub 获取录用率数据
 * 2. 用 DeepSeek 生成关键词
 * 3. 更新到 Supabase
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const https = require('https');
const { createClient } = require('@supabase/supabase-js');

// 配置
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/lixin4ever/Conference-Acceptance-Rate/master/README.md';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 分批处理配置
const BATCH_SIZE = 30;  // 每批处理数量（减小以避免超时）
const BATCH_DELAY = 2000;  // 批次间隔(毫秒)
// 支持: node script.js 50 或 START_FROM=50 node script.js
const START_FROM = parseInt(process.argv[2] || process.env.START_FROM || '0');  // 从第几个开始

// 会议名称映射（GitHub名称 -> 数据库名称）
const CONF_NAME_MAP = {
  'ACL': 'ACL',
  'EMNLP': 'EMNLP',
  'NAACL-HLT': 'NAACL',
  'NAACL': 'NAACL',
  'COLING': 'COLING',
  'CVPR': 'CVPR',
  'ICCV': 'ICCV',
  'ECCV': 'ECCV',
  'ICML': 'ICML',
  'NeurIPS': 'NeurIPS',
  'NIPS': 'NeurIPS',
  'ICLR': 'ICLR',
  'COLT': 'COLT',
  'UAI': 'UAI',
  'AISTATS': 'AISTATS',
  'AAAI': 'AAAI',
  'IJCAI': 'IJCAI',
  'KDD': 'KDD',
  'SIGIR': 'SIGIR',
  'TheWebConf': 'TheWebConf',
  'WWW': 'TheWebConf',
  'WSDM': 'WSDM',
  'CIKM': 'CIKM',
  'ICDM': 'ICDM',
  'RecSys': 'RecSys',
  'INTERSPEECH': 'INTERSPEECH',
  'ICASSP': 'ICASSP',
};

// HTTP GET 请求
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// 解析 GitHub README 中的录用率数据
function parseAcceptanceRates(markdown) {
  const rates = {};

  // 匹配表格行: | Conference'YY | XX.X% (accepted/total) | ... |
  const rowRegex = /\|\s*([A-Z][A-Za-z\-]+)'(\d{2})\s*\|\s*([\d.]+)%\s*\((\d+)\/(\d+)\)/g;

  let match;
  while ((match = rowRegex.exec(markdown)) !== null) {
    const [, confName, yearShort, rate, accepted, total] = match;
    const fullYear = 2000 + parseInt(yearShort);
    const normalizedName = CONF_NAME_MAP[confName] || confName;

    if (!rates[normalizedName]) {
      rates[normalizedName] = [];
    }

    rates[normalizedName].push({
      year: fullYear,
      rate: parseFloat(rate),
      accepted: parseInt(accepted),
      total: parseInt(total)
    });
  }

  // 按年份排序
  for (const conf in rates) {
    rates[conf].sort((a, b) => a.year - b.year);
  }

  return rates;
}

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 带重试的 DeepSeek API 调用
async function callDeepSeekAPI(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 200
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`  [API错误] HTTP ${response.status}: ${errorText.substring(0, 100)}`);

        // 如果是 429 (限流) 或 500 (服务器错误)，等待后重试
        if (response.status === 429 || response.status >= 500) {
          const waitTime = (i + 1) * 3000; // 递增等待时间
          console.log(`  [重试] 等待 ${waitTime/1000}s 后重试 (${i + 1}/${retries})...`);
          await delay(waitTime);
          continue;
        }
        return null;
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '[]';
    } catch (e) {
      console.error(`  [网络错误] ${e.message}`);
      if (i < retries - 1) {
        console.log(`  [重试] 等待 3s 后重试 (${i + 1}/${retries})...`);
        await delay(3000);
      }
    }
  }
  return null;
}

// 用 DeepSeek 生成关键词
async function generateKeywords(conference) {
  if (!DEEPSEEK_API_KEY) {
    return null;
  }

  const prompt = `请为以下学术会议生成 5-8 个研究主题关键词（中文），用于论文匹配。

会议名称: ${conference.title}
会议描述: ${conference.description || '无'}
领域分类: ${conference.sub || '未知'}

要求：
1. 关键词应涵盖该会议的主要研究方向
2. 使用中文，每个关键词 2-6 个字
3. 返回 JSON 数组格式，如 ["深度学习", "计算机视觉", "自然语言处理"]

只返回 JSON 数组，不要其他内容。`;

  const content = await callDeepSeekAPI(prompt);
  if (!content) return null;

  try {
    // 提取 JSON 数组
    const jsonMatch = content.match(/\[.*\]/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (e) {
    console.error(`  [解析错误] ${e.message}`);
    return null;
  }
}

// 主函数
async function main() {
  console.log('='.repeat(50));
  console.log('会议数据增强脚本');
  console.log('='.repeat(50));

  // 1. 获取 GitHub 录用率数据
  console.log('\n[1/4] 从 GitHub 获取录用率数据...');
  let acceptanceRates = {};
  try {
    const markdown = await httpsGet(GITHUB_RAW_URL);
    acceptanceRates = parseAcceptanceRates(markdown);
    console.log(`  成功解析 ${Object.keys(acceptanceRates).length} 个会议的录用率数据`);

    // 打印示例
    const sampleConf = Object.keys(acceptanceRates)[0];
    if (sampleConf) {
      console.log(`  示例: ${sampleConf} - ${JSON.stringify(acceptanceRates[sampleConf].slice(-2))}`);
    }
  } catch (e) {
    console.error(`  [错误] 获取录用率失败: ${e.message}`);
  }

  // 2. 连接 Supabase
  console.log('\n[2/4] 连接 Supabase...');
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('  [错误] 缺少 Supabase 配置');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 获取所有会议
  const { data: conferences, error } = await supabase
    .from('conferences')
    .select('id, title, description, sub');

  if (error) {
    console.error(`  [错误] 查询会议失败: ${error.message}`);
    process.exit(1);
  }
  console.log(`  找到 ${conferences.length} 个会议`);

  // 3. 为每个会议匹配录用率和生成关键词
  console.log('\n[3/4] 处理会议数据...');
  let updated = 0;

  // 分批处理
  const totalBatches = Math.ceil(conferences.length / BATCH_SIZE);
  const startIndex = START_FROM;
  const endIndex = Math.min(startIndex + BATCH_SIZE, conferences.length);
  const batchConferences = conferences.slice(startIndex, endIndex);

  console.log(`  总共 ${conferences.length} 个会议`);
  console.log(`  本次处理: ${startIndex + 1} - ${endIndex} (共 ${batchConferences.length} 个)`);
  console.log(`  提示: 设置 START_FROM 环境变量可从指定位置继续\n`);

  for (const conf of batchConferences) {
    const shortName = conf.title.split(' ')[0].toUpperCase();
    const rates = acceptanceRates[shortName];

    if (!rates && !DEEPSEEK_API_KEY) continue;

    console.log(`\n处理: ${conf.title}`);

    // 匹配录用率
    if (rates) {
      console.log(`  录用率: ${rates.length} 年数据`);
      console.log(`  最新: ${rates[rates.length - 1].year} - ${rates[rates.length - 1].rate}%`);
    }

    // 生成关键词
    let keywords = null;
    if (DEEPSEEK_API_KEY) {
      console.log('  正在生成关键词...');
      keywords = await generateKeywords(conf);
      if (keywords) {
        console.log(`  关键词: ${keywords.slice(0, 3).join(', ')}...`);
      }
      // 避免请求过快
      await delay(1500);
    }

    // 更新数据库
    const updateData = {};
    if (rates) updateData.acceptance_rate = rates;
    if (keywords) updateData.keywords = keywords;

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('conferences')
        .update(updateData)
        .eq('id', conf.id);

      if (updateError) {
        console.error(`  [错误] 更新失败: ${updateError.message}`);
      } else {
        updated++;
        console.log(`  ✓ 已更新`);
      }
    }
  }

  console.log('\n[4/4] 完成');
  console.log(`  本批处理了 ${updated} 个会议`);

  // 显示进度和下一步
  const progress = endIndex >= conferences.length;
  if (progress) {
    console.log('\n✅ 所有会议已处理完成！');
  } else {
    console.log(`\n📊 进度: ${endIndex}/${conferences.length}`);
    console.log(`\n💡 继续处理下一批，请运行:`);
    console.log(`   START_FROM=${endIndex} npm run enrich-data`);
  }

  // 输出 JSON 供确认
  console.log('\n' + '='.repeat(50));
  console.log('录用率数据预览 (前5个会议):');
  console.log('='.repeat(50));

  const preview = {};
  for (const [name, rates] of Object.entries(acceptanceRates).slice(0, 5)) {
    preview[name] = {
      最新录用率: rates[rates.length - 1]?.rate + '%',
      年份数: rates.length,
      最近三年: rates.slice(-3).map(r => `${r.year}: ${r.rate}%`)
    };
  }
  console.log(JSON.stringify(preview, null, 2));
}

main().catch(console.error);
