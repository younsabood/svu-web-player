import React from 'react';
import { Menu, User, Sun, Moon } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const Navbar = ({ onGoHome, onOpenSettings }) => {
  const theme = useAppStore(state => state.theme);
  const toggleTheme = useAppStore(state => state.toggleTheme);
  const toggleSidebar = useAppStore(state => state.toggleSidebar);
  const isDark = theme === 'dark';

  return (
    <nav className="sticky top-0 z-50 w-full px-4 py-3 flex items-center justify-between bg-bg-light/80 dark:bg-bg-dark/80 backdrop-blur-xl border-b border-border-light/50 dark:border-border-dark/50 shadow-sm transition-all duration-300">
      <div className="flex items-center gap-2 sm:gap-4">
        <button 
          onClick={toggleSidebar}
          className="p-2 sm:p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-text-light-secondary dark:text-text-dark-secondary transition-colors active:scale-95"
          aria-label="تبديل القائمة"
        >
          <Menu size={22} />
        </button>
        <div 
          onClick={onGoHome}
          className="flex items-center gap-3 cursor-pointer group px-2 py-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <div className="relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-orange-500 shadow-md shadow-primary/20 group-hover:shadow-primary/40 transition-shadow overflow-hidden">
             <img src="/logo.png" alt="SVU" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-lg sm:text-xl tracking-tight hidden sm:flex items-center gap-1.5">
            مشغل <span className="text-primary font-black bg-primary/10 px-2 py-0.5 rounded-md text-sm mr-1">SVU</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <button 
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-text-light-secondary dark:text-text-dark-secondary transition-colors active:scale-95"
          aria-label="تبديل المظهر"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button 
          onClick={onOpenSettings}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-svu-blue to-blue-600 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all"
          title="إعدادات الحساب"
          id="profile-btn"
        >
          <User size={18} strokeWidth={2.5} />
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
