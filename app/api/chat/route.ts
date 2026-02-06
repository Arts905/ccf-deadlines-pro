import { NextResponse } from 'next/server';
import { Conference } from '@/app/types';
import { getConferencesFromDB } from '@/lib/supabase';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// Helper to load data from Supabase with caching
let cachedConferences: Conference[] | null = null;
let lastLoadedTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

async function getConferences(): Promise<Conference[]> {
  const now = Date.now();

  // 1. If no cache, load it
  if (!cachedConferences) {
    try {
      cachedConferences = await getConferencesFromDB();
      lastLoadedTime = now;
      console.log(`[Data] Conferences loaded from Supabase at ${new Date().toISOString()}`);
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
      results = results.filter(c => 
          c.confs?.some(inst => inst.year === 2026)
      );
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

  return { results, conditions };
}

async function callDeepSeek(query: string, contextData: string) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return null;

    const systemPrompt = `
You are a professional academic conference assistant for the CCF Conference Tracker website.
Your goal is to answer user queries based STRICTLY on the provided real-time data.

[Current Server Time]
${dayjs().tz("Asia/Shanghai").format('YYYY-MM-DD HH:mm:ss (z)')}

[Real-time Conference Data]
${contextData}

[Instructions]
1. Only use the data provided above in the [Real-time Conference Data] section. Do not use your internal knowledge about past conference dates.
2. If the data says a conference is "Expired" or "已截止", explicitly state it.
3. If the user asks for a recommendation, use the provided list.
4. Keep the answer concise, professional, and helpful. Use Markdown for formatting.
5. If [Real-time Conference Data] is empty, say "抱歉，根据您的条件，我没有找到相关的会议信息。"
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
                temperature: 0.3
            })
        });
        
        const data = await response.json();
        return data.choices?.[0]?.message?.content;
    } catch (e) {
        console.error("DeepSeek API call failed", e);
        return null;
    }
}

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ message: "请输入您的问题。" }, { status: 400 });
    }

    const allConferences = await getConferences();
    const { results, conditions } = analyzeQuery(message, allConferences);

    // Limit results for chat display context
    const topResults = results.slice(0, 10); 
    
    // Construct Context Data for AI or Fallback
    let contextText = "";
    
    if (topResults.length === 0) {
        contextText = "No matching conferences found.";
    } else {
        topResults.forEach(conf => {
            const nextDeadline = getNextDeadline(conf);
            let status = 'Upcoming'; 
            let countdownText = '待定';
            let deadlineStr = 'TBD';
            
            if (nextDeadline) {
                const statusObj = calculateDeadlineStatus(nextDeadline.date);
                status = statusObj.status;
                countdownText = statusObj.text;
                deadlineStr = nextDeadline.date.format('YYYY-MM-DD HH:mm:ss');
            }

            contextText += `Name: ${conf.title} (${conf.description})\n`;
            contextText += `Rank: CCF ${conf.rank?.ccf || 'N'}\n`;
            contextText += `Status: ${status} (${status === 'Active' ? '进行中' : '已截止'})\n`;
            contextText += `Countdown: ${countdownText}\n`;
            contextText += `Deadline: ${deadlineStr}\n`;
            contextText += `-------------------\n`;
        });
    }

    // Try calling DeepSeek API first
    const aiResponse = await callDeepSeek(message, contextText);
    
    if (aiResponse) {
        return NextResponse.json({
            message: aiResponse,
            conferences: topResults.slice(0, 5) 
        });
    }

    // Fallback to Rule-Based Logic
    let replyText = "";
    const serverTime = getServerTime().format('YYYY-MM-DD HH:mm:ss');

    if (conditions.length > 0) {
        replyText = `(Fallback) 为您找到 ${results.length} 个符合条件的会议（筛选条件：${conditions.join(' + ')}）。\n\n`;
    } else {
        replyText = "(Fallback) 为您推荐以下会议：\n\n";
    }

    topResults.slice(0, 5).forEach(conf => {
        const nextDeadline = getNextDeadline(conf);
        let status = 'Upcoming'; 
        let countdownText = '待定';
        
        if (nextDeadline) {
            const statusObj = calculateDeadlineStatus(nextDeadline.date);
            status = statusObj.status;
            countdownText = statusObj.text;
        } else {
            status = 'Upcoming'; 
            countdownText = '时间待定';
        }

        replyText += `### ${conf.title} (${conf.description})\n`;
        replyText += `- 会议等级：CCF ${conf.rank?.ccf || 'N'}\n`;
        replyText += `- 当前状态：${status === 'Active' ? '🟢 进行中' : (status === 'Expired' ? '🔴 已截止' : '⚪ 未开始')}\n`;
        replyText += `- 截稿倒计时：**${countdownText}**\n`;
        if (nextDeadline) {
                replyText += `- 截止时间：${nextDeadline.date.format('YYYY-MM-DD HH:mm:ss')} (UTC${nextDeadline.date.utcOffset()/60})\n`;
        }
        replyText += `\n`;
    });
    
    replyText += `\n> 时间基准：服务器时间 ${serverTime} (UTC+8)`;

    return NextResponse.json({
      message: replyText,
      conferences: topResults.slice(0, 5)
    });

  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ message: "系统繁忙，请稍后再试。" }, { status: 500 });
  }
}
