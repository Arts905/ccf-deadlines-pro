import { Conference } from '@/app/types';

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  relatedConferences?: Conference[]; // Results from the "AI"
}

export interface ChatResponse {
  message: string;
  conferences?: Conference[];
}
