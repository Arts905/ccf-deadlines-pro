import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Conference } from '@/app/types';

// Helper to load data
function getConferences(): Conference[] {
  try {
    const filePath = path.join(process.cwd(), 'public', 'conferences.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error("Failed to load conferences:", error);
    return [];
  }
}

// "AI" Logic: Simple Keyword Matching & Rule-based Filtering
// In a real scenario, this would call an LLM (OpenAI/Gemini) with function calling.
// Here we simulate it with a robust local search.
function analyzeQuery(query: string, allConferences: Conference[]) {
  const lowerQuery = query.toLowerCase();
  let results = allConferences;
  const conditions: string[] = [];

  // 1. Rank Filtering (e.g., "CCF A", "A类")
  if (lowerQuery.match(/ccf\s*[a]|a类|rank a/)) {
    results = results.filter(c => c.rank?.ccf === 'A');
    conditions.push("CCF A类");
  } else if (lowerQuery.match(/ccf\s*[b]|b类|rank b/)) {
    results = results.filter(c => c.rank?.ccf === 'B');
    conditions.push("CCF B类");
  } else if (lowerQuery.match(/ccf\s*[c]|c类|rank c/)) {
    results = results.filter(c => c.rank?.ccf === 'C');
    conditions.push("CCF C类");
  }

  // 2. Category Filtering
  // 'DS': 'Computer Architecture/Parallel Programming/Storage Technology',
  // 'NW': 'Network System',
  // 'SC': 'Network and System Security',
  // 'SE': 'Software Engineering/Operating System/Programming Language Design',
  // 'DB': 'Database/Data Mining/Information Retrieval',
  // 'CT': 'Computing Theory',
  // 'CG': 'Graphics',
  // 'AI': 'Artificial Intelligence',
  // 'HI': 'Computer-Human Interaction',
  // 'MX': 'Interdiscipline/Mixture/Emerging'
  
  const catKeywords: Record<string, string[]> = {
    'AI': ['ai', 'artificial intelligence', '人工智能', 'machine learning', '深度学习'],
    'SE': ['se', 'software engineering', '软件工程', 'system software', '系统软件'],
    'DB': ['db', 'database', '数据库', 'data mining', '数据挖掘'],
    'SC': ['security', 'network security', '安全', '信息安全', '网络安全'],
    'CG': ['graphics', 'multimedia', '图形学', '多媒体', 'cv', 'vision'],
    'NW': ['network', 'computernetwork', '网络', '计算机网络'],
    'DS': ['architecture', 'system', '体系结构', '存储', 'storage', 'distributed'],
    'HI': ['hci', 'human', '交互', '人机'],
    'CT': ['theory', 'theoretical', '理论'],
  };

  let matchedCat = false;
  for (const [code, keywords] of Object.entries(catKeywords)) {
    if (keywords.some(k => lowerQuery.includes(k))) {
      results = results.filter(c => c.sub === code);
      conditions.push(code + "领域");
      matchedCat = true;
      break; // Assume one category for simplicity, or allow multiple? let's strict to one for now to avoid empty results
    }
  }

  // 3. Date/Location Filtering (Simple string match)
  // e.g., "China", "2026"
  if (lowerQuery.includes('china') || lowerQuery.includes('中国')) {
      results = results.filter(c => 
          c.confs?.some(inst => inst.place.toLowerCase().includes('china') || inst.place.includes('中国'))
      );
      conditions.push("在中国举办");
  }
  
  if (lowerQuery.includes('2026')) {
      results = results.filter(c => 
          c.confs?.some(inst => inst.year === 2026)
      );
      conditions.push("2026年");
  }

  // 4. Keyword Search (if query has specific conference name like "CVPR")
  // If the result set is still huge (== all) or the query is short, maybe they just searched for a name
  const nameMatch = results.filter(c => 
      c.title.toLowerCase().includes(lowerQuery) || 
      c.description.toLowerCase().includes(lowerQuery)
  );
  
  // If specific name match returns fewer results than general filter, prefer it
  if (nameMatch.length > 0 && nameMatch.length < results.length && !matchedCat) {
      results = nameMatch;
      conditions.push(`包含 "${query}"`);
  }

  return { results, conditions };
}

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    
    if (!message) {
      return NextResponse.json({ message: "请输入您的问题。" }, { status: 400 });
    }

    const allConferences = getConferences();
    const { results, conditions } = analyzeQuery(message, allConferences);

    // Limit results for chat display
    const topResults = results.slice(0, 5);
    
    let replyText = "";
    
    if (results.length === 0) {
        replyText = "抱歉，我没有找到符合您要求的会议。您可以尝试放宽筛选条件，例如只询问“AI类会议”或“CCF A类会议”。";
    } else if (conditions.length > 0) {
        replyText = `为您找到 ${results.length} 个符合条件的会议（筛选条件：${conditions.join(' + ')}）。以下是为您推荐的前 ${topResults.length} 个：`;
    } else {
        // Broad query or no keywords detected
        replyText = "我不太确定您的具体需求。您可以试着问我：“最近有哪些AI会议？”或者“帮我找一下CCF A类的安全会议”。这里为您随机推荐几个：";
    }

    return NextResponse.json({
      message: replyText,
      conferences: topResults
    });

  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ message: "系统繁忙，请稍后再试。" }, { status: 500 });
  }
}
