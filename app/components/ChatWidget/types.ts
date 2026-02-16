import { Conference } from '@/app/types';

export type MessageRole = 'user' | 'assistant';

// 检索过程信息（用户视角）
export interface SearchProcess {
  understanding: string;        // "您正在寻找 AI 方向的 CCF A 类会议"
  totalSearched: number;        // 511
  filtersApplied: string[];     // ["CCF A类", "AI领域", "2个月内截稿"]
  matchCount: number;           // 3
  searchMethod: 'semantic' | 'keyword'; // 语义搜索 or 关键词匹配
  topMatches: Array<{
    title: string;
    score: number;
    reason: string;             // "内容匹配度92%，时间充裕"
  }>;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  relatedConferences?: Conference[];
  searchProcess?: SearchProcess; // 检索过程摘要
}

export interface ChatResponse {
  message: string;
  conferences?: Conference[];
  searchProcess?: SearchProcess;
}
