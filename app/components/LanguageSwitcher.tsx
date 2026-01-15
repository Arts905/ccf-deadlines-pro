'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Globe, ChevronDown } from 'lucide-react';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const labels = {
    en: 'English',
    zh: '简体中文',
    tw: '繁體中文'
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (lang: 'en' | 'zh' | 'tw') => {
    setLanguage(lang);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 transition-colors rounded-lg ${isOpen ? 'bg-gray-100 text-blue-600' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'}`}
        aria-label="Switch Language"
        aria-expanded={isOpen}
      >
        <Globe size={20} />
        <span className="text-sm font-medium hidden md:inline">{labels[language]}</span>
        <span className="text-sm font-medium md:hidden uppercase">{language}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={() => handleSelect('en')}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${language === 'en' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
          >
            English
          </button>
          <button
            onClick={() => handleSelect('zh')}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${language === 'zh' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
          >
            简体中文
          </button>
          <button
            onClick={() => handleSelect('tw')}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${language === 'tw' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
          >
            繁體中文
          </button>
        </div>
      )}
    </div>
  );
}
