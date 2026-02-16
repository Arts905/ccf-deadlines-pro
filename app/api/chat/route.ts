import { NextResponse } from 'next/server';
import { Conference } from '@/app/types';
import { getConferencesFromDB } from '@/lib/supabase';
import {
  getEmbedding,
  cosineSimilarity,
  generateConferenceSearchText
} from '@/lib/embedding';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// ============ 匹配度打分接口 ============
interface MatchScore {
  contentMatch: number;      // 内容匹配度 0-100
  timeFeasibility: number;   // 时间可行性 0-100
  difficultyScore: number;   // 难度评估 0-100 (100=最简单)
  overallScore: number;      // 综合得分
}

interface UserIntent {
  researchTopic?: string;      // 研究方向/关键词
  estimatedDays?: number;      // 预计完稿天数
  rankPreference?: string;     // 等级偏好 A/B/C
  keywords: string[];          // 提取的关键词
}

// ============ 扩展的会议类型（含 embedding）============
interface ConferenceWithEmbedding extends Conference {
  embedding?: number[];
  searchText?: string;
}

// Helper to load data from Supabase with caching
let cachedConferences: ConferenceWithEmbedding[] | null = null;
let lastLoadedTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

async function getConferences(): Promise<ConferenceWithEmbedding[]> {
  const now = Date.now();

  // 1. If no cache, load it
  if (!cachedConferences) {
    try {
      const data = await getConferencesFromDB();
      // 为每个会议生成搜索文本
      cachedConferences = data.map(conf => ({
        ...conf,
        searchText: generateConferenceSearchText(conf),
      }));
      lastLoadedTime = now;
      console.log(`[Data] Conferences loaded from Supabase: ${cachedConferences.length} items`);
      return cachedConferences;
    } catch (error) {
      console.error("Failed to load conferences from Supabase:", error);
      return [];
    }
  }

  // 2. TTL Check
  if (now - lastLoadedTime > CACHE_TTL) {
    console.log('[Data] Cache expired (TTL), reloading from Supabase...');
    try {
      cachedConferences = await getConferencesFromDB();
      lastLoadedTime = now;
    } catch (error) {
      console.error("Failed to reload conferences, using stale cache:", error);
    }
  }

  return cachedConferences;
}

// Time Service & Status Logic
function getServerTime() {
  return dayjs().tz("Asia/Shanghai");
}

function getNextDeadline(conf: Conference) {
  const now = getServerTime();
  let nextDeadlines: { date: dayjs.Dayjs, info: any, comment?: string }[] = [];

  if (!conf.confs) return null;

  conf.confs.forEach(c => {
    if (!c.timeline) return;
    c.timeline.forEach(t => {
      if (t.deadline === 'TBD') return;
      
      let deadlineStr = t.deadline;
      let tz = c.timezone;
      
      // Normalize timezone string
      if (tz === 'AoE') {
        tz = 'UTC-12';
      }

      let d;
      // Handle UTC offsets
      if (tz && tz.startsWith('UTC')) {
          const offset = parseInt(tz.replace('UTC', ''));
          // Create date object and set offset
          d = dayjs(deadlineStr.replace(' ', 'T')).utcOffset(offset, true);
      } else {
          d = dayjs(deadlineStr);
      }
      
      if (d.isValid()) {
         nextDeadlines.push({ date: d, info: c, comment: t.comment });
      }
    });
  });

  // Sort by date
  nextDeadlines.sort((a, b) => a.date.valueOf() - b.date.valueOf());
  
  // Find first future deadline
  const future = nextDeadlines.find(d => d.date.isAfter(now));
  
  // If no future deadline, return the last past one (to show expired status)
  return future || nextDeadlines[nextDeadlines.length - 1] || null;
}

function calculateDeadlineStatus(deadlineDate: dayjs.Dayjs) {
  const now = getServerTime();
  const diff = deadlineDate.diff(now);
  
  if (diff < 0) {
    return { status: 'Expired', text: '已截止' };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  let text = '';
  if (days > 3) {
    text = `还剩${days}天`;
  } else if (days > 0) {
    text = `还剩${days}天${hours}小时`;
  } else {
    text = `还剩${hours}小时${minutes}分钟`; // Less than 1 day
  }
  
  return { status: 'Active', text };
}

// ============ 打分算法 ============

// 从用户查询中提取意图
function extractUserIntent(query: string): UserIntent {
  const intent: UserIntent = { keywords: [] };

  // 1. 提取等级偏好
  if (query.match(/ccf\s*[a]|a类|rank a/i)) {
    intent.rankPreference = 'A';
  } else if (query.match(/ccf\s*[b]|b类|rank b/i)) {
    intent.rankPreference = 'B';
  } else if (query.match(/ccf\s*[c]|c类|rank c/i)) {
    intent.rankPreference = 'C';
  }

  // 2. 提取时间约束（天数）
  const timePatterns = [
    /(\d+)\s*个?月/,
    /(\d+)\s*周/,
    /(\d+)\s*天/,
    /(\d+)\s*weeks?/i,
    /(\d+)\s*months?/i,
    /(\d+)\s*days?/i,
  ];

  for (const pattern of timePatterns) {
    const match = query.match(pattern);
    if (match) {
      const num = parseInt(match[1]);
      if (query.includes('月') || /month/i.test(query)) {
        intent.estimatedDays = num * 30;
      } else if (query.includes('周') || /week/i.test(query)) {
        intent.estimatedDays = num * 7;
      } else {
        intent.estimatedDays = num;
      }
      break;
    }
  }

  // 3. 提取研究方向关键词
  const researchKeywords = [
    // AI 相关
    '深度学习', '机器学习', '强化学习', '多智能体', '自然语言处理', 'NLP', '计算机视觉', 'CV',
    '图像识别', '目标检测', '语义分割', '知识图谱', '大模型', 'LLM', '生成模型', 'AIGC',
    'deep learning', 'machine learning', 'reinforcement learning', 'multi-agent',
    // 系统相关
    '分布式', '云计算', '边缘计算', '容器', '微服务', '数据库', '存储',
    'distributed', 'cloud', 'database', 'storage',
    // 安全相关
    '安全', '密码学', '隐私', '网络安全', 'security', 'cryptography', 'privacy',
    // 网络相关
    '网络', '5G', '物联网', 'IoT', 'network', 'wireless',
    // 图形学
    '图形学', '渲染', '虚拟现实', 'VR', 'AR', 'graphics', 'rendering',
    // 人机交互
    '人机交互', 'HCI', '交互设计', '用户体验',
    // 理论
    '算法', '理论', 'algorithm', 'theory',
  ];

  for (const keyword of researchKeywords) {
    if (query.toLowerCase().includes(keyword.toLowerCase())) {
      intent.keywords.push(keyword);
    }
  }

  // 4. 提取完整度暗示
  if (query.includes('完成度') || query.includes('进度') || query.includes('刚开始') || query.includes('快完成')) {
    if (!intent.estimatedDays) {
      if (query.includes('刚开始') || query.includes('60%') || query.includes('一半')) {
        intent.estimatedDays = 60; // 约2个月
      } else if (query.includes('快完成') || query.includes('80%') || query.includes('90%')) {
        intent.estimatedDays = 30; // 约1个月
      } else {
        intent.estimatedDays = 90; // 默认3个月
      }
    }
  }

  // 5. 如果没有明确关键词，提取可能的研究主题
  if (intent.keywords.length === 0) {
    // 尝试从查询中提取名词短语
    const words = query.replace(/[，。？！、]/g, ' ').split(/\s+/);
    for (const word of words) {
      if (word.length >= 2 && word.length <= 10 && !['推荐', '会议', '期刊', '请问', '帮我'].includes(word)) {
        intent.keywords.push(word);
      }
    }
  }

  return intent;
}

// 计算内容匹配度
// 计算内容匹配度（支持 Embedding 语义搜索）
async function calculateContentMatch(
  conf: ConferenceWithEmbedding,
  userKeywords: string[],
  queryEmbedding?: number[] | null
): Promise<number> {
  // 1. 优先使用 Embedding 相似度
  if (queryEmbedding && conf.embedding) {
    const similarity = cosineSimilarity(queryEmbedding, conf.embedding);
    // 将相似度 (-1 到 1) 映射到 0-100
    const embeddingScore = Math.round((similarity + 1) * 50);
    if (embeddingScore > 60) {
      return embeddingScore;
    }
  }

  // 2. 回退到关键词匹配
  if (userKeywords.length === 0) {
    // 尝试用 embedding 计算相似度
    if (queryEmbedding && !conf.embedding && conf.searchText) {
      const confEmbedding = await getEmbedding(conf.searchText);
      if (confEmbedding) {
        conf.embedding = confEmbedding; // 缓存
        const similarity = cosineSimilarity(queryEmbedding, confEmbedding);
        return Math.round((similarity + 1) * 50);
      }
    }
    return 50;
  }

  const confKeywords = conf.keywords || [];
  const confTitle = conf.title.toLowerCase();
  const confDesc = (conf.description || '').toLowerCase();

  let matchCount = 0;
  let maxScore = userKeywords.length;

  for (const keyword of userKeywords) {
    const kw = keyword.toLowerCase();

    // 检查会议关键词
    if (confKeywords.some(k => k.includes(kw) || kw.includes(k))) {
      matchCount += 1;
      continue;
    }

    // 检查标题和描述
    if (confTitle.includes(kw) || confDesc.includes(kw)) {
      matchCount += 0.8;
      continue;
    }

    // 检查领域分类
    const subMap: Record<string, string[]> = {
      'AI': ['ai', '人工智能', '机器学习', '深度学习', 'nlp', 'cv', 'vision'],
      'SE': ['软件', 'software', '工程', 'engineering'],
      'DB': ['数据库', 'database', '数据挖掘', 'mining'],
      'SC': ['安全', 'security', '密码', 'crypto'],
      'CG': ['图形', 'graphics', '视觉', 'vision', '多媒体'],
      'NW': ['网络', 'network'],
      'DS': ['系统', 'system', '体系结构', 'architecture', '分布式'],
      'HI': ['交互', 'hci', '人机'],
      'CT': ['理论', 'theory', '算法', 'algorithm'],
    };

    const subKeywords = subMap[conf.sub] || [];
    if (subKeywords.some(k => kw.includes(k) || k.includes(kw))) {
      matchCount += 0.6;
    }
  }

  return Math.round((matchCount / maxScore) * 100);
}

// 计算时间可行性
function calculateTimeFeasibility(deadlineDate: dayjs.Dayjs, estimatedDays?: number): number {
  if (!estimatedDays) return 70; // 未提供时间时默认较高

  const now = getServerTime();
  const daysUntilDeadline = deadlineDate.diff(now, 'day');

  if (daysUntilDeadline < 0) return 0; // 已截止

  const buffer = daysUntilDeadline - estimatedDays;

  if (buffer < 0) {
    return Math.max(0, Math.round(50 + buffer * 2)); // 时间不够
  } else if (buffer < 7) {
    return 75; // 刚好够，有压力
  } else if (buffer < 14) {
    return 85; // 稍有富余
  } else if (buffer < 30) {
    return 95; // 充裕
  } else {
    return 100; // 非常充裕
  }
}

// 计算难度评估（100 = 最简单）
function calculateDifficulty(conf: Conference): number {
  let score = 50; // 基础分

  // 1. CCF 等级
  const rankScore: Record<string, number> = {
    'A': 30,  // A类最难
    'B': 50,
    'C': 70,
  };
  score = rankScore[conf.rank?.ccf || ''] || 50;

  // 2. 录用率调整
  const rates = conf.acceptanceRate || [];
  if (rates.length > 0) {
    const latestRate = rates[rates.length - 1].rate;
    // 录用率越高，难度越低
    const rateAdjust = (latestRate - 25) * 0.5; // 25%为基准
    score = Math.min(90, Math.max(20, score + rateAdjust));
  }

  return Math.round(score);
}

// 综合打分（异步，支持 Embedding）
async function calculateMatchScore(
  conf: ConferenceWithEmbedding,
  deadlineDate: dayjs.Dayjs,
  intent: UserIntent,
  queryEmbedding?: number[] | null
): Promise<MatchScore> {
  const contentMatch = await calculateContentMatch(conf, intent.keywords, queryEmbedding);
  const timeFeasibility = calculateTimeFeasibility(deadlineDate, intent.estimatedDays);
  const difficultyScore = calculateDifficulty(conf);

  // 权重：内容匹配 40%，时间可行 35%，难度 25%
  const overallScore = Math.round(
    contentMatch * 0.4 + timeFeasibility * 0.35 + difficultyScore * 0.25
  );

  return {
    contentMatch,
    timeFeasibility,
    difficultyScore,
    overallScore,
  };
}

// "AI" Logic: Enhanced Query Analysis with Scoring
async function analyzeQuery(query: string, allConferences: ConferenceWithEmbedding[]) {
  const lowerQuery = query.toLowerCase();
  const intent = extractUserIntent(query);
  let results = allConferences;
  const conditions: string[] = [];

  // 1. Rank Filtering (e.g., "CCF A", "A类")
  if (intent.rankPreference) {
    results = results.filter(c => c.rank?.ccf === intent.rankPreference);
    conditions.push(`CCF ${intent.rankPreference}类`);
  }

  // 2. Category Filtering
  const catKeywords: Record<string, string[]> = {
    'AI': ['ai', 'artificial intelligence', '人工智能', 'machine learning', '深度学习', '强化学习', 'nlp', 'cv'],
    'SE': ['se', 'software engineering', '软件工程', 'system software', '系统软件'],
    'DB': ['db', 'database', '数据库', 'data mining', '数据挖掘'],
    'SC': ['security', 'network security', '安全', '信息安全', '网络安全', '密码'],
    'CG': ['graphics', 'multimedia', '图形学', '多媒体', 'cv', 'vision', '视觉', '渲染'],
    'NW': ['network', 'computernetwork', '网络', '计算机网络', '5g', '无线'],
    'DS': ['architecture', 'system', '体系结构', '存储', 'storage', 'distributed', '分布式'],
    'HI': ['hci', 'human', '交互', '人机', 'ux', '用户体验'],
    'CT': ['theory', 'theoretical', '理论', '算法', 'algorithm'],
  };

  let matchedCat = false;
  for (const [code, keywords] of Object.entries(catKeywords)) {
    if (keywords.some(k => lowerQuery.includes(k))) {
      results = results.filter(c => c.sub === code);
      conditions.push(code + "领域");
      matchedCat = true;
      break;
    }
  }

  // 3. Date/Location Filtering
  if (lowerQuery.includes('china') || lowerQuery.includes('中国')) {
    results = results.filter(c =>
      c.confs?.some(inst => inst.place.toLowerCase().includes('china') || inst.place.includes('中国'))
    );
    conditions.push("在中国举办");
  }

  if (lowerQuery.includes('2026')) {
    results = results.filter(c => c.confs?.some(inst => inst.year === 2026));
    conditions.push("2026年");
  }

  // 4. Keyword Search
  const nameMatch = results.filter(c =>
    c.title.toLowerCase().includes(lowerQuery) ||
    c.description.toLowerCase().includes(lowerQuery)
  );

  if (nameMatch.length > 0 && nameMatch.length < results.length && !matchedCat) {
    results = nameMatch;
    conditions.push(`包含 "${query}"`);
  } else {
    // General discovery query -> Auto-filter expired
    const pastKeywords = ['past', 'history', 'expired', 'previous', '往届', '过期', '历史', '2020', '2021', '2022', '2023', '2024'];
    const wantsPast = pastKeywords.some(k => lowerQuery.includes(k));

    if (!wantsPast) {
      results = results.filter(c => {
        const nextDl = getNextDeadline(c);
        if (nextDl) {
          const status = calculateDeadlineStatus(nextDl.date);
          return status.status !== 'Expired';
        }
        return false;
      });
    }
  }

  // 5. 获取查询的 Embedding（用于语义搜索）
  let queryEmbedding: number[] | null = null;
  if (process.env.JINA_API_KEY) {
    try {
      queryEmbedding = await getEmbedding(query);
      if (queryEmbedding) {
        console.log('[Embedding] Query embedding generated');
      }
    } catch (e) {
      console.error('[Embedding] Failed to get query embedding:', e);
    }
  }

  // 6. Calculate scores for each conference
  const scoredResults = await Promise.all(
    results.map(async (conf) => {
      const nextDeadline = getNextDeadline(conf);
      const deadlineDate = nextDeadline?.date || dayjs().add(1, 'year');
      const score = await calculateMatchScore(conf, deadlineDate, intent, queryEmbedding);

      return {
        conf,
        score,
        deadline: nextDeadline,
      };
    })
  );

  // 7. Sort by overall score (descending)
  scoredResults.sort((a, b) => b.score.overallScore - a.score.overallScore);

  return {
    results: scoredResults.map(r => r.conf),
    scoredResults,
    conditions,
    intent
  };
}

async function callDeepSeek(
  query: string,
  contextData: string,
  scoredResults: Array<{
    conf: Conference;
    score: MatchScore;
    deadline: { date: dayjs.Dayjs; info: any; comment?: string } | null;
  }>,
  intent: UserIntent
) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  // 构建表格数据
  let tableData = "";
  if (scoredResults.length > 0) {
    tableData = "\n| 会议 | 等级 | 截稿时间 | 剩余时间 | 内容匹配 | 时间可行 | 难度 | 综合分 |\n";
    tableData += "|------|------|----------|----------|----------|----------|------|--------|\n";

    scoredResults.slice(0, 8).forEach(({ conf, score, deadline }) => {
      const status = deadline ? calculateDeadlineStatus(deadline.date) : null;
      const remainText = status?.text || '待定';
      const dlStr = deadline ? deadline.date.format('MM-DD') : 'TBD';

      tableData += `| ${conf.title} | CCF ${conf.rank?.ccf || 'N'} | ${dlStr} | ${remainText} | ${score.contentMatch}% | ${score.timeFeasibility}% | ${score.difficultyScore >= 60 ? '✅' : score.difficultyScore >= 40 ? '⚠️' : '🔴'} ${score.difficultyScore}% | **${score.overallScore}%** |\n`;
    });
  }

  // 根据用户意图生成任务建议
  let taskSuggestions = "";
  if (intent.keywords.length > 0 || intent.estimatedDays) {
    taskSuggestions = `
[任务建议]
根据您的需求，您可能还想了解：
1. 如需更详细的进度规划，请告诉我您的具体研究方向，我可以为您生成周/天级进度安排
2. 如果想查看更多会议，请描述更多关于您论文的关键词或摘要
3. 点击会议名称可以查看详情并收藏到收藏夹
4. 如需了解某会议的具体要求（页数限制、格式等），请直接提问如"ECCV 2026的页数限制是多少"
`;
  }

  const systemPrompt = `
你是 CCF 会议推荐助手，帮助研究人员找到合适的学术会议投稿。

[当前时间]
${dayjs().tz("Asia/Shanghai").format('YYYY-MM-DD HH:mm:ss (z)')}

[用户意图分析]
- 研究关键词: ${intent.keywords.join(', ') || '未提取'}
- 预计完稿时间: ${intent.estimatedDays ? intent.estimatedDays + '天' : '未指定'}
- 等级偏好: ${intent.rankPreference ? 'CCF ' + intent.rankPreference : '不限'}

[推荐的会议数据]
${contextData}

[评分说明]
- 内容匹配: 基于您的研究关键词与会议主题的匹配程度
- 时间可行: 基于截稿时间与您预计完稿时间的对比
- 难度评估: 基于CCF等级和录用率（越高越容易）

[输出要求]
1. 首先用1-2句话总结推荐结果
2. 然后输出会议推荐表格（直接使用下面提供的表格格式）
3. 最后根据情况给出建议

[预生成的表格]
${tableData || "（暂无匹配结果）"}
${taskSuggestions}

请用中文回复，保持专业简洁。直接使用上面的表格，不要重新生成。
`;

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content;
  } catch (e) {
    console.error("DeepSeek API call failed", e);
    return null;
  }
}

// 生成用户友好的检索过程描述
function generateSearchProcess(
  query: string,
  intent: UserIntent,
  conditions: string[],
  allConferencesCount: number,
  scoredResults: Array<{
    conf: Conference;
    score: MatchScore;
    deadline: { date: dayjs.Dayjs; info: any; comment?: string } | null;
  }>
): SearchProcess {
  // 1. 理解用户需求
  let understanding = "您正在寻找";
  const understandingParts: string[] = [];

  if (intent.keywords.length > 0) {
    understandingParts.push(`"${intent.keywords.slice(0, 3).join('、')}"相关研究`);
  }
  if (intent.rankPreference) {
    understandingParts.push(`CCF ${intent.rankPreference}类会议`);
  } else {
    understandingParts.push("任意等级会议");
  }
  if (intent.estimatedDays) {
    if (intent.estimatedDays <= 30) {
      understandingParts.push(`${intent.estimatedDays}天内截稿`);
    } else if (intent.estimatedDays <= 90) {
      understandingParts.push(`${Math.round(intent.estimatedDays / 30)}个月内截稿`);
    } else {
      understandingParts.push("时间较充裕");
    }
  }

  understanding += understandingParts.join("的");

  // 2. 筛选条件
  const filtersApplied: string[] = [];
  if (intent.rankPreference) {
    filtersApplied.push(`仅CCF ${intent.rankPreference}类`);
  }
  if (intent.keywords.length > 0) {
    filtersApplied.push(`匹配"${intent.keywords[0]}"等关键词`);
  }
  if (intent.estimatedDays && intent.estimatedDays <= 90) {
    filtersApplied.push(`截稿时间在${Math.round(intent.estimatedDays / 30)}个月内`);
  }
  filtersApplied.push("排除已截稿会议");

  // 3. 顶级匹配
  const topMatches = scoredResults.slice(0, 3).map(({ conf, score, deadline }) => {
    const reasons: string[] = [];
    if (score.contentMatch >= 70) {
      reasons.push(`内容匹配${score.contentMatch}%`);
    }
    if (score.timeFeasibility >= 80) {
      reasons.push("时间充裕");
    } else if (score.timeFeasibility >= 50) {
      reasons.push("时间合适");
    }
    if (score.difficultyScore >= 60) {
      reasons.push("难度适中");
    }

    return {
      title: conf.title,
      score: score.overallScore,
      reason: reasons.length > 0 ? reasons.join("，") : "综合推荐"
    };
  });

  return {
    understanding,
    totalSearched: allConferencesCount,
    filtersApplied: filtersApplied.length > 0 ? filtersApplied : ["全部会议"],
    matchCount: scoredResults.length,
    topMatches
  };
}

interface SearchProcess {
  understanding: string;
  totalSearched: number;
  filtersApplied: string[];
  matchCount: number;
  topMatches: Array<{
    title: string;
    score: number;
    reason: string;
  }>;
}

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ message: "请输入您的问题。" }, { status: 400 });
    }

    const allConferences = await getConferences();
    const { results, scoredResults, conditions, intent } = await analyzeQuery(message, allConferences);

    // Limit results for chat display context
    const topScoredResults = scoredResults.slice(0, 10);

    // Construct Context Data for AI
    let contextText = "";

    if (topScoredResults.length === 0) {
      contextText = "未找到匹配的会议。";
    } else {
      topScoredResults.forEach(({ conf, score, deadline }) => {
        const status = deadline ? calculateDeadlineStatus(deadline.date) : null;
        const countdownText = status?.text || '待定';
        const dlStr = deadline ? deadline.date.format('YYYY-MM-DD HH:mm:ss') : 'TBD';

        contextText += `【${conf.title}】\n`;
        contextText += `  描述: ${conf.description || '无'}\n`;
        contextText += `  等级: CCF ${conf.rank?.ccf || 'N'}\n`;
        contextText += `  截稿: ${dlStr} (${countdownText})\n`;
        contextText += `  关键词: ${(conf.keywords || []).slice(0, 5).join(', ') || '无'}\n`;
        if (conf.acceptanceRate && conf.acceptanceRate.length > 0) {
          const latest = conf.acceptanceRate[conf.acceptanceRate.length - 1];
          contextText += `  录用率: ${latest.rate}% (${latest.year}年)\n`;
        }
        contextText += `  评分: 内容${score.contentMatch}% | 时间${score.timeFeasibility}% | 难度${score.difficultyScore}% | 综合${score.overallScore}%\n`;
        contextText += `\n`;
      });
    }

    // Try calling DeepSeek API
    const aiResponse = await callDeepSeek(message, contextText, topScoredResults, intent);

    // 生成用户友好的检索过程
    const searchProcess = generateSearchProcess(
      message,
      intent,
      conditions,
      allConferences.length,
      topScoredResults
    );

    if (aiResponse) {
      return NextResponse.json({
        message: aiResponse,
        conferences: topScoredResults.slice(0, 5).map(r => r.conf),
        scores: topScoredResults.slice(0, 5).map(r => ({
          title: r.conf.title,
          ...r.score
        })),
        searchProcess
      });
    }

    // Fallback to Rule-Based Logic
    let replyText = "";
    const serverTime = getServerTime().format('YYYY-MM-DD HH:mm:ss');

    if (conditions.length > 0) {
      replyText = `为您找到 ${results.length} 个符合条件的会议（筛选条件：${conditions.join(' + ')}）。\n\n`;
    } else {
      replyText = "为您推荐以下会议：\n\n";
    }

    // 生成表格
    replyText += "| 会议 | 等级 | 截稿时间 | 匹配度 | 综合分 |\n";
    replyText += "|------|------|----------|--------|--------|\n";

    topScoredResults.slice(0, 8).forEach(({ conf, score, deadline }) => {
      const status = deadline ? calculateDeadlineStatus(deadline.date) : null;
      const dlStr = deadline ? deadline.date.format('MM-DD') : 'TBD';
      replyText += `| ${conf.title} | CCF ${conf.rank?.ccf || 'N'} | ${dlStr} | ${score.contentMatch}% | **${score.overallScore}%** |\n`;
    });

    replyText += `\n💡 **建议**：点击会议名称查看详情并收藏\n`;
    replyText += `\n> 时间基准：${serverTime} (UTC+8)`;

    return NextResponse.json({
      message: replyText,
      conferences: topScoredResults.slice(0, 5).map(r => r.conf),
      scores: topScoredResults.slice(0, 5).map(r => ({
        title: r.conf.title,
        ...r.score
      })),
      searchProcess
    });

  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ message: "系统繁忙，请稍后再试。" }, { status: 500 });
  }
}
