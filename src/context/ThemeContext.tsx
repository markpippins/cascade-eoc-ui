import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppTheme } from '../types';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  isDark: boolean;
  isSteel: boolean;
  isLight: boolean;
  themeClasses: {
    bg: string;
    bgCard: string;
    bgCardHover: string;
    bgMuted: string;
    border: string;
    borderSubtle: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    headerBg: string;
    sidebarBg: string;
    inputBg: string;
    codeBg: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('cascade_theme') as AppTheme;
    return (saved === 'light' || saved === 'steel' || saved === 'dark') ? saved : 'steel';
  });

  const setTheme = (t: AppTheme) => {
    setThemeState(t);
    localStorage.setItem('cascade_theme', t);
  };

  useEffect(() => {
    document.documentElement.classList.remove('theme-dark', 'theme-steel', 'theme-light');
    document.documentElement.classList.add(`theme-${theme}`);
  }, [theme]);

  const isDark = theme === 'dark';
  const isSteel = theme === 'steel';
  const isLight = theme === 'light';

  // Theme-aware Tailwind class presets
  const themeClasses = {
    bg: isDark ? 'bg-[#090d16]' : isSteel ? 'bg-[#0f172a]' : 'bg-[#f8fafc]',
    bgCard: isDark ? 'bg-[#121826]' : isSteel ? 'bg-[#1e293b]/40 backdrop-blur-sm' : 'bg-[#ffffff]',
    bgCardHover: isDark ? 'hover:bg-[#182132]' : isSteel ? 'hover:bg-slate-800/60' : 'hover:bg-[#f1f5f9]',
    bgMuted: isDark ? 'bg-[#162033]' : isSteel ? 'bg-slate-800/40' : 'bg-[#f1f5f9]',
    border: isDark ? 'border-[#1e293b]' : isSteel ? 'border-slate-700/50' : 'border-[#e2e8f0]',
    borderSubtle: isDark ? 'border-[#172236]' : isSteel ? 'border-slate-700/30' : 'border-[#f1f5f9]',
    textPrimary: isDark ? 'text-slate-100' : isSteel ? 'text-slate-100' : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-400' : isSteel ? 'text-slate-300' : 'text-slate-600',
    textMuted: isDark ? 'text-slate-500' : isSteel ? 'text-slate-400' : 'text-slate-400',
    accent: isDark ? 'text-cyan-400' : isSteel ? 'text-blue-400' : 'text-indigo-600',
    headerBg: isDark ? 'bg-[#0d131f]/90' : isSteel ? 'bg-[#0f172a]/80' : 'bg-white/90',
    sidebarBg: isDark ? 'bg-[#0a0f1a]' : isSteel ? 'bg-[#1e293b]' : 'bg-[#ffffff]',
    inputBg: isDark ? 'bg-[#0a0f1a]' : isSteel ? 'bg-[#0f172a]' : 'bg-[#ffffff]',
    codeBg: isDark ? 'bg-[#060911]' : isSteel ? 'bg-slate-900/60' : 'bg-[#f8fafc]',
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, isSteel, isLight, themeClasses }}>
      <div className={`h-full w-full min-h-screen ${themeClasses.bg} ${themeClasses.textPrimary} transition-colors duration-200 antialiased font-sans`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
};
