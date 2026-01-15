'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'zh' | 'tw';

type Translations = {
  [key in Language]: {
    [key: string]: string;
  };
};

const translations: Translations = {
  en: {
    'searchPlaceholder': 'Search conferences...',
    'allCategories': 'All Categories',
    'allRanks': 'All Ranks',
    'showPast': 'Show Past/Undetermined',
    'addWeChat': 'Add WeChat ID: HQUHXZ',
    'wechatCopied': 'WeChat ID Copied',
    'nextDeadline': 'Next Deadline',
    'deadlinePassed': 'Deadline Passed',
    'visitWebsite': 'Visit Website',
    'joinGroup': 'Join Group',
    'favorite': 'Favorite',
    'unfavorite': 'Unfavorite',
    'officialVerified': 'Official Verified',
    'saveQR': 'Save QR Image',
    'joined': 'I\'ve Joined',
    'qrDisclaimer': 'QR code valid for 7 days • No repeated joining • No ads',
    'groupTitle': 'Group',
    'scanToJoin': 'Scan code to join discussion',
    'chatTooltip': 'Can I help you find a suitable conference?',
    'askNow': 'Ask now',
    'chatPlaceholder': 'Type a message...',
    'chatTitle': 'AI Assistant',
    'chatSubtitle': 'Ask me anything about conferences',
    'categories.DS': 'Computer Architecture/Parallel Programming/Storage Technology',
    'categories.NW': 'Network System',
    'categories.SC': 'Network and System Security',
    'categories.SE': 'Software Engineering/Operating System/Programming Language Design',
    'categories.DB': 'Database/Data Mining/Information Retrieval',
    'categories.CT': 'Computing Theory',
    'categories.CG': 'Graphics',
    'categories.AI': 'Artificial Intelligence',
    'categories.HI': 'Computer-Human Interaction',
    'categories.MX': 'Interdiscipline/Mixture/Emerging',
    'noConferences': 'No conferences found matching your criteria.',
    'online': 'Online',
    'thinking': 'Thinking...',
    'viewDetails': 'View Details',
    'errorMessage': 'Sorry, I cannot answer your question right now. Please try again later.',
    'welcomeMessage': 'Hello! I am your conference assistant. Ask me anything, e.g., "Find CCF A AI conferences" or "Upcoming conferences in China".',
  },
  zh: {
    'searchPlaceholder': '搜索会议...',
    'allCategories': '所有类别',
    'allRanks': '所有等级',
    'showPast': '显示已过/未定',
    'addWeChat': '添加微信号: HQUHXZ',
    'wechatCopied': '微信号已复制',
    'nextDeadline': '下个截止日期',
    'deadlinePassed': '截止日期已过',
    'visitWebsite': '访问官网',
    'joinGroup': '进群',
    'favorite': '收藏会议',
    'unfavorite': '取消收藏',
    'officialVerified': '官方认证',
    'saveQR': '保存二维码图片',
    'joined': '我已加入',
    'qrDisclaimer': '二维码有效期7天 • 请勿重复加群 • 严禁广告',
    'groupTitle': '交流群',
    'scanToJoin': '扫码加入会议讨论组',
    'chatTooltip': '可以问问我哪些会议适合你？',
    'askNow': '立即提问',
    'chatPlaceholder': '输入消息...',
    'chatTitle': 'AI 助手',
    'chatSubtitle': '问我任何关于会议的问题',
    'categories.DS': '计算机体系结构/并行与分布计算/存储系统',
    'categories.NW': '计算机网络',
    'categories.SC': '网络与信息安全',
    'categories.SE': '软件工程/系统软件/程序设计语言',
    'categories.DB': '数据库/数据挖掘/内容检索',
    'categories.CT': '计算机科学理论',
    'categories.CG': '计算机图形学与多媒体',
    'categories.AI': '人工智能',
    'categories.HI': '人机交互与普适计算',
    'categories.MX': '交叉/综合/新兴',
    'noConferences': '没有找到符合条件的会议。',
    'online': '在线',
    'thinking': '正在思考...',
    'viewDetails': '查看详情',
    'errorMessage': '抱歉，我现在无法回答您的问题，请稍后再试。',
    'welcomeMessage': '您好！我是您的会议助手。您可以问我关于会议的任何问题，例如：“帮我找一下人工智能类的CCF A类会议”、“最近有哪些在中国举办的会议？”',
  },
  tw: {
    'searchPlaceholder': '搜尋會議...',
    'allCategories': '所有類別',
    'allRanks': '所有等級',
    'showPast': '顯示已過/未定',
    'addWeChat': '添加微信號: HQUHXZ',
    'wechatCopied': '微信號已複製',
    'nextDeadline': '下個截止日期',
    'deadlinePassed': '截止日期已過',
    'visitWebsite': '訪問官網',
    'joinGroup': '進群',
    'favorite': '收藏會議',
    'unfavorite': '取消收藏',
    'officialVerified': '官方認證',
    'saveQR': '保存二維碼圖片',
    'joined': '我已加入',
    'qrDisclaimer': '二維碼有效期7天 • 請勿重複加群 • 嚴禁廣告',
    'groupTitle': '交流群',
    'scanToJoin': '掃碼加入會議討論組',
    'chatTooltip': '可以問問我哪些會議適合你？',
    'askNow': '立即提問',
    'chatPlaceholder': '輸入消息...',
    'chatTitle': 'AI 助手',
    'chatSubtitle': '問我任何關於會議的問題',
    'categories.DS': '計算機體系結構/並行與分佈計算/存儲系統',
    'categories.NW': '計算機網絡',
    'categories.SC': '網絡與信息安全',
    'categories.SE': '軟件工程/系統軟件/程序設計語言',
    'categories.DB': '數據庫/數據挖掘/內容檢索',
    'categories.CT': '計算機科學理論',
    'categories.CG': '計算機圖形學與多媒體',
    'categories.AI': '人工智能',
    'categories.HI': '人機交互與普適計算',
    'categories.MX': '交叉/綜合/新興',
    'noConferences': '沒有找到符合條件的會議。',
    'online': '在線',
    'thinking': '正在思考...',
    'viewDetails': '查看詳情',
    'errorMessage': '抱歉，我現在無法回答您的問題，請稍後再試。',
    'welcomeMessage': '您好！我是您的會議助手。您可以問我關於會議的任何問題，例如：“幫我找一下人工智能類的CCF A類會議”、“最近有哪些在中國舉辦的會議？”',
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('zh'); // Default to Chinese based on recent requests

  useEffect(() => {
    const savedLang = localStorage.getItem('app_language') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'zh' || savedLang === 'tw')) {
      setLanguage(savedLang);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
