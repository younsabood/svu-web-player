import React from 'react';
import { Menu, User, Sun, Moon } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const Navbar = ({ onGoHome, onOpenSettings }) => {
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const isDark = theme === 'dark';

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-black/5 bg-bg-light/92 px-3 py-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-md transition-all duration-300 dark:border-white/8 dark:bg-[#0d0f12]/92 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={toggleSidebar}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/5 text-text-light-secondary transition-colors active:scale-95 hover:bg-black/10 dark:bg-white/5 dark:text-text-dark-secondary dark:hover:bg-white/10"
            aria-label="تبديل القائمة"
          >
            <Menu size={22} />
          </button>

          <button
            onClick={onGoHome}
            className="group flex min-w-0 items-center gap-3 rounded-2xl px-2 py-1.5 text-start transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br from-primary to-orange-500 shadow-sm transition-shadow group-hover:shadow-md dark:border-white/10 sm:h-11 sm:w-11">
              <img src="/logo.png" alt="SVU" className="h-full w-full object-cover" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-black tracking-tight sm:text-base lg:text-lg">مشغل الجامعة</span>
              <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                SVU Player
              </span>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleTheme}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/5 text-text-light-secondary transition-colors active:scale-95 hover:bg-black/10 dark:bg-white/5 dark:text-text-dark-secondary dark:hover:bg-white/10"
            aria-label="تبديل المظهر"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={onOpenSettings}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_12px_26px_rgba(234,51,35,0.2)] transition-all active:scale-95 hover:bg-primary-hover"
            title="إعدادات الحساب"
            id="profile-btn"
          >
            <User size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
