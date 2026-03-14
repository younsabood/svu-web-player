import React from 'react';
import { Home, Compass, PlaySquare, DownloadCloud, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useExportStore } from '../../store/useExportStore';

const SidebarItem = ({ icon, label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-sm transition-all duration-200 ${
      active
        ? 'border border-primary/15 bg-white font-black text-primary shadow-sm dark:border-white/10 dark:bg-white/10'
        : 'border border-transparent font-semibold hover:bg-black/5 dark:hover:bg-white/10'
    }`}
  >
    <div className="flex min-w-0 items-center gap-3">
      {React.createElement(icon, {
        size: 22,
        className: active ? '' : 'text-text-light-secondary dark:text-text-dark-secondary',
      })}
      <span className="truncate">{label}</span>
    </div>
    {badge > 0 && (
      <span className="animate-pulse rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-black text-white">
        {badge}
      </span>
    )}
  </button>
);

const Sidebar = ({ onViewChange, currentView }) => {
  const isSidebarOpen = useAppStore((state) => state.isSidebarOpen);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const activeExports = useExportStore((state) =>
    state.activeExports.filter((item) => item.status === 'processing').length
  );

  const navigate = (view) => {
    onViewChange(view);
    if (window.innerWidth < 768) toggleSidebar();
  };

  return (
    <>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm transition-opacity md:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full flex-col overflow-hidden border-l border-black/5 bg-bg-light/96 shadow-2xl backdrop-blur-md transition-all duration-300 ease-out dark:border-white/8 dark:bg-[#0d0f12]/96 md:relative md:top-auto md:h-auto md:min-h-full md:bg-transparent md:shadow-none md:backdrop-blur-none ${
          isSidebarOpen
            ? 'w-[min(86vw,22rem)] translate-x-0 px-3 opacity-100 md:w-72 md:px-4'
            : 'w-0 translate-x-full px-0 opacity-0 md:w-0 md:px-0'
        }`}
      >
        <button
          onClick={toggleSidebar}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-2xl text-text-light-secondary transition-colors hover:bg-black/5 dark:text-text-dark-secondary dark:hover:bg-white/10 md:hidden"
          aria-label="إغلاق الشريط الجانبي"
        >
          <X size={24} />
        </button>

        <div className="border-b border-border-light px-1 pb-4 pt-20 dark:border-border-dark md:pt-5">
          <div className="mb-4 rounded-[1.4rem] border border-black/5 bg-white/75 p-4 dark:border-white/8 dark:bg-white/5">
            <div className="mb-1 text-[11px] font-black uppercase tracking-[0.24em] text-primary">تنقل واضح</div>
            <div className="text-base font-black">اختر القسم المطلوب فقط</div>
            <div className="mt-1 text-xs font-medium leading-6 text-text-light-secondary dark:text-text-dark-secondary">
              الرئيسية للمتابعة السريعة، المواد للضبط، الاستكشاف للبحث، والتصدير للنتائج.
            </div>
          </div>

          <div className="space-y-1.5">
            <SidebarItem icon={Home} label="الرئيسية" active={currentView === 'home'} onClick={() => navigate('home')} />
            <SidebarItem icon={Compass} label="استكشاف" active={currentView === 'explore'} onClick={() => navigate('explore')} />
            <SidebarItem icon={PlaySquare} label="موادي" active={currentView === 'classes'} onClick={() => navigate('classes')} />
            <SidebarItem
              icon={DownloadCloud}
              label="التصدير"
              active={currentView === 'exports'}
              onClick={() => navigate('exports')}
              badge={activeExports}
            />
          </div>
        </div>

        <div className="mt-auto px-1 pb-4 pt-4">
          <div className="rounded-[1.4rem] border border-black/5 bg-white/75 p-4 text-center dark:border-white/8 dark:bg-white/5">
            <div className="mb-2 inline-flex items-center justify-center rounded-xl bg-primary/10 px-3 py-1 text-[10px] font-black tracking-[0.22em] text-primary" dir="ltr">
              LOCAL FIRST
            </div>
            <p className="text-xs font-bold leading-relaxed text-text-light-secondary dark:text-text-dark-secondary">
              تشغيل محلي، تصدير محلي،
              <br />
              وتنقل أوضح بين الصفحات.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
