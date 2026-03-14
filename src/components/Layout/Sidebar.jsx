import React from 'react';
import { Home, Compass, PlaySquare, DownloadCloud, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useExportStore } from '../../store/useExportStore';

const SidebarItem = ({ icon: Icon, label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-black/5 dark:bg-white/10 font-bold text-primary' 
        : 'hover:bg-black/5 dark:hover:bg-white/10 font-medium'
    }`}
  >
    <div className="flex items-center gap-4">
      <Icon size={24} className={active ? '' : 'text-text-light-secondary dark:text-text-dark-secondary'} />
      <span className="truncate">{label}</span>
    </div>
    {badge > 0 && (
      <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
        {badge}
      </span>
    )}
  </button>
);

const Sidebar = ({ onViewChange, currentView }) => {
  const isSidebarOpen = useAppStore(state => state.isSidebarOpen);
  const toggleSidebar = useAppStore(state => state.toggleSidebar);
  const activeExports = useExportStore(state => state.activeExports.filter(e => e.status === 'processing').length);

  return (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed md:relative top-0 right-0 h-full bg-bg-light dark:bg-bg-dark z-50 transition-all duration-300 ease-in-out border-l border-border-light dark:border-border-dark flex flex-col pt-16 md:pt-4 pb-4 shadow-2xl md:shadow-none overflow-hidden
        ${isSidebarOpen ? 'w-64 translate-x-0 opacity-100 px-3' : 'w-0 translate-x-full md:translate-x-0 opacity-0 px-0'}`}
      >
        {/* Mobile Close Button */}
        <button 
          onClick={toggleSidebar}
          className="md:hidden absolute top-4 left-4 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X size={24} />
        </button>

        <div className="space-y-1 pb-4 border-b border-border-light dark:border-border-dark mb-4 mt-2 md:mt-0">
          <SidebarItem 
            icon={Home} 
            label="الرئيسية" 
            active={currentView === 'home'} 
            onClick={() => { onViewChange('home'); if(window.innerWidth < 768) toggleSidebar(); }}
          />
          <SidebarItem 
            icon={Compass} 
            label="استكشاف" 
            active={currentView === 'explore'} 
            onClick={() => { onViewChange('explore'); if(window.innerWidth < 768) toggleSidebar(); }}
          />
          <SidebarItem 
            icon={PlaySquare} 
            label="موادي" 
            active={currentView === 'classes'} 
            onClick={() => { onViewChange('classes'); if(window.innerWidth < 768) toggleSidebar(); }}
          />
          <SidebarItem 
            icon={DownloadCloud} 
            label="التصدير" 
            active={currentView === 'exports'} 
            onClick={() => { onViewChange('exports'); if(window.innerWidth < 768) toggleSidebar(); }}
            badge={activeExports}
          />
        </div>

        <div className="mt-auto px-3 pb-2">
          <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-center">
             <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black tracking-widest mb-3" dir="ltr">
                SVU PLAYER v2.0
             </div>
             <p className="text-xs font-bold text-text-light-secondary dark:text-text-dark-secondary leading-relaxed mb-3">
               معالجة محلية <span className="text-primary font-black">100%</span><br/>
               أمان تام بدون خوادم خارجية
             </p>
             <div className="h-px w-8 bg-black/10 dark:bg-white/10 mx-auto mb-3" />
             <p className="text-[10px] font-black text-text-light-secondary dark:text-text-dark-secondary opacity-60">
               &copy; 2026 تم التطوير بواسطة<br/>طالب في SVU
             </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
