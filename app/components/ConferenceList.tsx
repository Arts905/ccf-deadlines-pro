'use client';

import { useState, useEffect, useMemo } from 'react';
import { Conference, ConferenceInstance } from '../types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { Star, Users, X, Download, Check, ShieldCheck, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

dayjs.extend(utc);
dayjs.extend(timezone);

const SUBS = {
  'DS': 'Computer Architecture/Parallel Programming/Storage Technology',
  'NW': 'Network System',
  'SC': 'Network and System Security',
  'SE': 'Software Engineering/Operating System/Programming Language Design',
  'DB': 'Database/Data Mining/Information Retrieval',
  'CT': 'Computing Theory',
  'CG': 'Graphics',
  'AI': 'Artificial Intelligence',
  'HI': 'Computer-Human Interaction',
  'MX': 'Interdiscipline/Mixture/Emerging'
};

const CATEGORY_COLORS: Record<string, string> = {
  'DS': 'bg-blue-100 text-blue-800',
  'NW': 'bg-green-100 text-green-800',
  'SC': 'bg-red-100 text-red-800',
  'SE': 'bg-yellow-100 text-yellow-800',
  'DB': 'bg-purple-100 text-purple-800',
  'CT': 'bg-pink-100 text-pink-800',
  'CG': 'bg-indigo-100 text-indigo-800',
  'AI': 'bg-orange-100 text-orange-800',
  'HI': 'bg-teal-100 text-teal-800',
  'MX': 'bg-gray-100 text-gray-800'
};

const RANK_COLORS: Record<string, string> = {
  'A': 'bg-red-500 text-white',
  'B': 'bg-yellow-500 text-white',
  'C': 'bg-blue-500 text-white',
  'N': 'bg-gray-400 text-white',
};

function getNextDeadline(conf: Conference) {
  const now = dayjs();
  let nextDeadlines: { date: dayjs.Dayjs, info: ConferenceInstance, comment?: string }[] = [];

  if (!conf.confs) return undefined;

  conf.confs.forEach(c => {
    if (!c.timeline) return;
    c.timeline.forEach(t => {
      if (t.deadline === 'TBD') return;
      
      let deadlineStr = t.deadline;
      let tz = c.timezone;
      
      if (tz === 'AoE') {
        tz = 'UTC-12';
      }

      let d = dayjs(deadlineStr);
      if (tz && tz.startsWith('UTC')) {
          const offset = parseInt(tz.replace('UTC', ''));
          d = dayjs(deadlineStr.replace(' ', 'T')).utcOffset(offset, true);
      } else {
          d = dayjs(deadlineStr);
      }
      
      if (d.isAfter(now)) {
        nextDeadlines.push({ date: d, info: c, comment: t.comment });
      }
    });
  });

  nextDeadlines.sort((a, b) => a.date.diff(b.date));
  return nextDeadlines[0];
}

function Countdown({ targetDate }: { targetDate: dayjs.Dayjs }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = dayjs();
      const diff = targetDate.diff(now);
      
      if (diff <= 0) {
        setTimeLeft('Deadline Passed');
        clearInterval(timer);
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return <span className="font-mono font-bold text-lg text-blue-600">{timeLeft}</span>;
}

export default function ConferenceList({ conferences }: { conferences: Conference[] }) {
  const { t, language } = useLanguage();
  console.log('Current language:', language);
  const [search, setSearch] = useState('');
  const [selectedSub, setSelectedSub] = useState<string>('All');
  const [selectedRank, setSelectedRank] = useState<string>('All');
  const [showPast, setShowPast] = useState(true);
  
  // Translation Cache
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    const translateTexts = async () => {
      if (language === 'en') return; // No need to translate if English

      const textsToTranslate = new Set<string>();
      
      // Collect all texts that need translation
      conferences.forEach(conf => {
        // Find next deadline manually if not pre-calculated yet (though it should be)
        // But since we are inside useEffect, we should probably use conferencesWithDeadline if we want to be safe,
        // OR re-calculate it here.
        // Actually, conferencesWithDeadline is a dependency if we use it.
        // Let's iterate over conferences and check its structure. 
        // The issue is that `conf` from `conferences` prop is type `Conference` which has `confs` array.
        // The `nextDeadline` property is added in `conferencesWithDeadline`.
        // So we should iterate over `conferencesWithDeadline` or calculate it on the fly.
        
        // Let's use the logic to find next deadline:
        const nextDl = getNextDeadline(conf);
        if (nextDl) {
           textsToTranslate.add(nextDl.info.place);
        }
      });

      const newTranslations: Record<string, string> = { ...translations };
      const missingTexts: string[] = [];

      textsToTranslate.forEach(text => {
        const key = `${language}_${text}`;
        if (!translations[key]) {
          missingTexts.push(text);
        }
      });

      if (missingTexts.length === 0) return;

      // Batch translate (or one by one if batch not supported easily)
      // For this demo, we'll do one by one but in parallel
      await Promise.all(missingTexts.map(async (text) => {
        try {
            const res = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, targetLang: language })
            });
            const data = await res.json();
            if (data.translatedText) {
                newTranslations[`${language}_${text}`] = data.translatedText;
            }
        } catch (err) {
            console.error('Failed to translate', text, err);
        }
      }));

      setTranslations(newTranslations);
    };

    translateTexts();
  }, [conferences, language]);

  const PLACE_TRANSLATIONS: Record<string, string> = {
    // Countries
    'China': '中国',
    'USA': '美国',
    'United States': '美国',
    'UK': '英国',
    'United Kingdom': '英国',
    'Canada': '加拿大',
    'Germany': '德国',
    'France': '法国',
    'Italy': '意大利',
    'Spain': '西班牙',
    'Japan': '日本',
    'South Korea': '韩国',
    'Korea': '韩国',
    'Singapore': '新加坡',
    'Australia': '澳大利亚',
    'Netherlands': '荷兰',
    'Switzerland': '瑞士',
    'Sweden': '瑞典',
    'Norway': '挪威',
    'Denmark': '丹麦',
    'Finland': '芬兰',
    'Belgium': '比利时',
    'Austria': '奥地利',
    'Brazil': '巴西',
    'India': '印度',
    'Russia': '俄罗斯',
    
    // Cities
    'Beijing': '北京',
    'Shanghai': '上海',
    'Guangzhou': '广州',
    'Shenzhen': '深圳',
    'Hangzhou': '杭州',
    'Hong Kong': '香港',
    'Macau': '澳门',
    'Taipei': '台北',
    'New York': '纽约',
    'San Francisco': '旧金山',
    'Los Angeles': '洛杉矶',
    'Chicago': '芝加哥',
    'Boston': '波士顿',
    'Seattle': '西雅图',
    'Washington DC': '华盛顿',
    'London': '伦敦',
    'Paris': '巴黎',
    'Berlin': '柏林',
    'Tokyo': '东京',
    'Seoul': '首尔',
    'Sydney': '悉尼',
    'Melbourne': '墨尔本',
    'Toronto': '多伦多',
    'Vancouver': '温哥华',
    'Montreal': '蒙特利尔',
    'Hague': '海牙',
    'Philadelphia': '费城',
    'Pennsylvania': '宾夕法尼亚州',
    'Rennes': '雷恩',
    'Barcelona': '巴塞罗那',
    'Munich': '慕尼黑',
    'Amsterdam': '阿姆斯特丹',
    'Zurich': '苏黎世',
    'Stockholm': '斯德哥尔摩',
    'Copenhagen': '哥本哈根',
    'Helsinki': '赫尔辛基',
    'Brussels': '布鲁塞尔',
    'Vienna': '维也纳',
    'Rome': '罗马',
    'Madrid': '马德里',
    'Lisbon': '里斯本',
    'Dublin': '都柏林',
    'Edinburgh': '爱丁堡',
    'Glasgow': '格拉斯哥',
    'Manchester': '曼彻斯特',
    'Cambridge': '剑桥',
    'Oxford': '牛津',
  };

  const getTranslatedText = (text: string) => {
      if (language === 'en') return text;
      
      // Check hardcoded dictionary first (partial match or full match)
      // Try to replace known parts
      let result = text;
      let hasReplacement = false;
      
      // Sort keys by length desc to replace longest matches first
      const keys = Object.keys(PLACE_TRANSLATIONS).sort((a, b) => b.length - a.length);
      
      for (const key of keys) {
        if (result.includes(key)) {
            result = result.replace(key, PLACE_TRANSLATIONS[key]);
            hasReplacement = true;
        }
      }
      
      if (hasReplacement) return result;

      // Fallback to API translation cache
      return translations[`${language}_${text}`] || text;
  };

  const formatDate = (dateStr: string) => {
    if (language === 'en') return dateStr;

    // Simple heuristic mapping
    const months: Record<string, string> = {
      'January': '1月', 'February': '2月', 'March': '3月', 'April': '4月',
      'May': '5月', 'June': '6月', 'July': '7月', 'August': '8月',
      'September': '9月', 'October': '10月', 'November': '11月', 'December': '12月'
    };

    let result = dateStr;
    Object.entries(months).forEach(([eng, local]) => {
      result = result.replace(eng, local);
    });

    // Handle "DD-DD" or "DD" pattern roughly
    // e.g. "November 15-19, 2026" -> "11月 15-19, 2026" -> we might want "2026年11月15-19日"
    // This simple replace is better than nothing, but let's try to match full pattern if possible
    // Regex for "Month DD-DD, YYYY"
    const rangeMatch = result.match(/(\d+月)\s+(\d+)-(\d+),\s+(\d+)/);
    if (rangeMatch) {
        return `${rangeMatch[4]}年${rangeMatch[1]}${rangeMatch[2]}-${rangeMatch[3]}日`;
    }
    
    // Regex for "Month DD, YYYY"
    const singleMatch = result.match(/(\d+月)\s+(\d+),\s+(\d+)/);
    if (singleMatch) {
        return `${singleMatch[3]}年${singleMatch[1]}${singleMatch[2]}日`;
    }

    return result;
  };

  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  
  // QR Modal State
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedQRConf, setSelectedQRConf] = useState<Conference | null>(null);
  const [wechatCopied, setWechatCopied] = useState(false);

  // Load favorites from local storage
  useEffect(() => {
    const stored = localStorage.getItem('ccf_favorites');
    if (stored) {
      setFavorites(new Set(JSON.parse(stored)));
    }
  }, []);

  const toggleFavorite = (title: string) => {
    const newFavs = new Set(favorites);
    if (newFavs.has(title)) {
      newFavs.delete(title);
    } else {
      newFavs.add(title);
    }
    setFavorites(newFavs);
    localStorage.setItem('ccf_favorites', JSON.stringify(Array.from(newFavs)));
  };

  const openQRModal = (conf: Conference) => {
    setSelectedQRConf(conf);
    setQrModalOpen(true);
  };

  const downloadQR = () => {
    // Mock download
    const link = document.createElement('a');
    link.href = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=JoinGroup_${selectedQRConf?.title}`;
    link.download = `${selectedQRConf?.title}_QRCode.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pre-calculate next deadlines
  const conferencesWithDeadline = useMemo(() => {
    return conferences.map(c => ({
      ...c,
      nextDeadline: getNextDeadline(c)
    }));
  }, [conferences]);

  const filtered = useMemo(() => {
    return conferencesWithDeadline.filter(c => {
      const title = c.title || '';
      const desc = c.description || '';
      const matchesSearch = title.toLowerCase().includes(search.toLowerCase()) || 
                            desc.toLowerCase().includes(search.toLowerCase());
      const matchesSub = selectedSub === 'All' || c.sub === selectedSub;
      const matchesRank = selectedRank === 'All' || (c.rank?.ccf || 'N') === selectedRank;
      const matchesFuture = showPast || !!c.nextDeadline;

      return matchesSearch && matchesSub && matchesRank && matchesFuture;
    }).sort((a, b) => {
        // Favorites first
        const aFav = favorites.has(a.title);
        const bFav = favorites.has(b.title);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;

        if (a.nextDeadline && b.nextDeadline) {
            return a.nextDeadline.date.diff(b.nextDeadline.date);
        }
        if (a.nextDeadline) return -1;
        if (b.nextDeadline) return 1;
        return 0;
    });
  }, [conferencesWithDeadline, search, selectedSub, selectedRank, showPast, favorites]);

  return (
    <div className="container mx-auto p-4">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-8 sticky top-4 z-10 border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            className="border rounded px-4 py-2 w-full focus:ring-2 focus:ring-blue-500 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex-1 min-w-[200px]">
          <select 
            className="border rounded px-4 py-2 w-full focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedSub}
            onChange={(e) => setSelectedSub(e.target.value)}
          >
            <option value="All">{t('allCategories')}</option>
            {Object.entries(SUBS).map(([key, label]) => (
              <option key={key} value={key}>{key} - {language === 'zh' ? t(`categories.${key}`) : label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[150px]">
          <select 
            className="border rounded px-4 py-2 w-full focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedRank}
            onChange={(e) => setSelectedRank(e.target.value)}
          >
            <option value="All">{t('allRanks')}</option>
            <option value="A">CCF A</option>
            <option value="B">CCF B</option>
            <option value="C">CCF C</option>
            <option value="N">Non-CCF</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
             <div className="flex items-center space-x-2 border rounded px-4 py-2 bg-gray-50 border-gray-200 h-[42px]">
                 <label className="flex items-center space-x-2 cursor-pointer select-none whitespace-nowrap">
                    <input 
                        type="checkbox" 
                        checked={showPast} 
                        onChange={e => setShowPast(e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-gray-700">{t('showPast')}</span>
                 </label>
             </div>

             <button 
                onClick={() => {
                    navigator.clipboard.writeText('HQUHXZ');
                    setWechatCopied(true);
                    setTimeout(() => setWechatCopied(false), 2000);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100 transition-colors group relative whitespace-nowrap h-[42px]"
             >
                {/* WeChat Icon SVG - Standard Logo Style */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-green-600">
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.6 15.5C3.85 15.5 0 12.14 0 8s3.85-7.5 8.6-7.5c4.75 0 8.6 3.36 8.6 7.5 0 4.14-3.85 7.5-8.6 7.5-.53 0-1.04-.04-1.53-.12l-3.4 1.7.58-2.67c-2.5-1.37-4.25-3.66-4.25-5.91h.01c.06 3.58 3.52 6.5 7.9 6.5.6 0 1.18-.06 1.74-.16l.16.06z" fill="currentColor"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M16.5 5c-3.59 0-6.5 2.46-6.5 5.5 0 3.04 2.91 5.5 6.5 5.5.65 0 1.28-.09 1.87-.25l2.73 1.36-.63-2.32c1.33-1.12 2.18-2.68 2.18-4.39C23 7.46 20.09 5 16.5 5zm-3.25 3.5c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75zm5 0c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75z" fill="#E0E0E0"/>
                    <path d="M16.5 5c-3.59 0-6.5 2.46-6.5 5.5 0 3.04 2.91 5.5 6.5 5.5.65 0 1.28-.09 1.87-.25l2.73 1.36-.63-2.32c1.33-1.12 2.18-2.68 2.18-4.39C23 7.46 20.09 5 16.5 5zm-3.25 3.5c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75zm5 0c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75z" fill="white"/>
                    <path d="M5.5 6.5c0-.41.34-.75.75-.75s.75.34.75.75-.34.75-.75.75-.75-.34-.75-.75zm4.5 0c0-.41.34-.75.75-.75s.75.34.75.75-.34.75-.75.75-.75-.34-.75-.75z" fill="white"/>
                </svg>
                <span className="text-sm font-medium">{t('addWeChat')}</span>
                {wechatCopied ? <Check size={16} /> : <Copy size={16} className="text-green-500" />}
                
                <AnimatePresence>
                    {wechatCopied && (
                        <motion.span 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50"
                        >
                            {t('wechatCopied')}
                        </motion.span>
                    )}
                </AnimatePresence>
             </button>
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 gap-6">
        {filtered.map((conf, idx) => (
          <div key={idx} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-gray-100 relative group">
            <div className="p-6 pr-24"> {/* Add padding right for buttons */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-gray-900">{conf.title}</h2>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${RANK_COLORS[conf.rank?.ccf || 'N'] || 'bg-gray-400 text-white'}`}>
                      CCF {conf.rank?.ccf || 'N'}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${CATEGORY_COLORS[conf.sub] || 'bg-gray-100 text-gray-800'}`}>
                      {conf.sub || 'MX'}
                    </span>
                    {favorites.has(conf.title) && (
                        <Star size={20} className="text-yellow-400 fill-current" />
                    )}
                  </div>
                  <p className="text-gray-600 text-sm mb-1">{conf.description}</p>
                  {conf.sub && <p className="text-gray-500 text-xs italic">{t(`categories.${conf.sub}`)}</p>}
                </div>
                {conf.nextDeadline && (
                    <div className="text-right">
                        <div className="text-sm text-gray-500">Next Deadline</div>
                        <Countdown targetDate={conf.nextDeadline.date} />
                        <div className="text-xs text-gray-400 mt-1">
                            {conf.nextDeadline.date.format('YYYY-MM-DD HH:mm:ss')} (UTC{conf.nextDeadline.date.utcOffset() / 60 >= 0 ? '+' : ''}{conf.nextDeadline.date.utcOffset() / 60})
                        </div>
                    </div>
                )}
              </div>

              {/* Deadline Info */}
              {conf.nextDeadline ? (
                  <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-100">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                          <div>
                              <span className="font-semibold text-blue-900 block">{conf.nextDeadline.info.year} {getTranslatedText(conf.nextDeadline.info.place)}</span>
                              <span className="text-blue-700 text-sm block">{formatDate(conf.nextDeadline.info.date)}</span>
                          </div>
                          {conf.nextDeadline.comment && (
                              <span className="bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded">
                                  {conf.nextDeadline.comment}
                              </span>
                          )}
                          <a 
                              href={conf.nextDeadline.info.link} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline flex items-center gap-1"
                          >
                              {t('visitWebsite')} →
                          </a>
                      </div>
                  </div>
              ) : (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4 text-center text-gray-500 italic">
                      {t('noConferences')}
                  </div>
              )}
            </div>

            {/* Right Action Buttons */}
            <div className="absolute top-0 right-0 h-full w-20 bg-gray-50 border-l border-gray-100 flex flex-col items-center justify-center gap-4 transition-transform translate-x-0">
                {/* Favorite Button */}
                <button
                    onClick={() => toggleFavorite(conf.title)}
                    className="p-2 rounded-full hover:bg-white hover:shadow-md transition-all text-gray-400 hover:text-yellow-500"
                    title={favorites.has(conf.title) ? t('unfavorite') : t('favorite')}
                >
                    <Star size={24} className={favorites.has(conf.title) ? "text-yellow-400 fill-current" : ""} />
                </button>

                {/* WeChat Group Button */}
                <button
                    onClick={() => openQRModal(conf)}
                    className="flex flex-col items-center gap-1 group/btn"
                    title={t('joinGroup')}
                >
                    <div className="p-2 rounded-full bg-green-100 text-green-600 group-hover/btn:bg-green-600 group-hover/btn:text-white transition-all shadow-sm">
                        <Users size={20} />
                    </div>
                    <span className="text-[10px] text-gray-500 group-hover/btn:text-green-600 font-medium">{t('joinGroup')}</span>
                </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
            <div className="text-center py-20 text-gray-500">
                No conferences found matching your criteria.
            </div>
        )}
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrModalOpen && selectedQRConf && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={() => setQrModalOpen(false)}
                />
                
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-[1001] overflow-hidden"
                >
                    <button 
                        onClick={() => setQrModalOpen(false)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    >
                        <X size={24} />
                    </button>

                    <div className="text-center">
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedQRConf.title} {t('groupTitle')}</h3>
                        <p className="text-sm text-gray-500 mb-6">{t('scanToJoin')}</p>
                        
                        <div className="relative w-64 h-64 mx-auto mb-6 bg-gray-100 rounded-xl p-4 flex items-center justify-center border-2 border-dashed border-gray-200">
                             {/* User provided QR Code */}
                             <img 
                                src="/wechat-qr.png" 
                                alt={`${selectedQRConf.title} QR Code`}
                                className="w-full h-full object-contain mix-blend-multiply"
                                onError={(e) => {
                                     // Fallback if image fails to load - use WeChat ID
                                     e.currentTarget.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=HQUHXZ`;
                                 }}
                              />
                              
                              {/* Security Badge */}
                             <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-sm">
                                <ShieldCheck size={12} />
                                {t('officialVerified')}
                             </div>
                        </div>

                        <div className="space-y-3">
                            <button 
                                onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = '/wechat-qr.png';
                                    link.download = `CCF_Group_QR.png`;
                                    link.target = '_blank';
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                                <Download size={18} />
                                {t('saveQR')}
                            </button>
                            
                            <button 
                                onClick={() => setQrModalOpen(false)}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                                <Check size={18} />
                                {t('joined')}
                            </button>
                        </div>
                        
                        <p className="text-xs text-gray-400 mt-4">
                            {t('qrDisclaimer')}
                        </p>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}
