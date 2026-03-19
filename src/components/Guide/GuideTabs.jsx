import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { DEFAULT_GUIDE_BY_VIEW, GUIDE_BY_ID, GUIDE_ITEMS } from './guideConfig';

const GuideTabs = ({ currentView, onNavigate, hasSelectedFile }) => {
  const activeGuideId = useAppStore((state) => state.activeGuideId);
  const setActiveGuideId = useAppStore((state) => state.setActiveGuideId);

  const resolvedItem =
    GUIDE_BY_ID[activeGuideId] && GUIDE_BY_ID[activeGuideId].view === currentView
      ? GUIDE_BY_ID[activeGuideId]
      : GUIDE_BY_ID[DEFAULT_GUIDE_BY_VIEW[currentView]];

  useEffect(() => {
    document.querySelectorAll('.guide-focus').forEach((node) => node.classList.remove('guide-focus'));

    if (!resolvedItem) return undefined;

    const timer = window.setTimeout(() => {
      const section = document.querySelector(`[data-guide-id="${resolvedItem.target}"]`);
      if (section) {
        section.classList.add('guide-focus');
      }
    }, 90);

    return () => {
      window.clearTimeout(timer);
      document.querySelectorAll('.guide-focus').forEach((node) => node.classList.remove('guide-focus'));
    };
  }, [resolvedItem]);

  if (!resolvedItem) return null;

  const ActiveIcon = resolvedItem.icon;
  const description =
    resolvedItem.id === 'guide-watch' && !hasSelectedFile
      ? 'افتح أي جلسة أولاً من الرئيسية أو الاستكشاف، ثم سيظهر المشغل هنا بشكل واضح.'
      : resolvedItem.description;

  const jumpToSection = (item) => {
    setActiveGuideId(item.id);
    onNavigate(item.view, item.id);

    window.setTimeout(() => {
      const section = document.querySelector(`[data-guide-id="${item.target}"]`);
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, item.view === currentView ? 60 : 260);
  };

  return (
    <section className="sticky top-[calc(env(safe-area-inset-top,0px)+4.5rem)] z-30 mb-4 sm:top-[calc(env(safe-area-inset-top,0px)+4.9rem)] sm:mb-6">
      <div className="rounded-[1.4rem] border border-black/5 bg-white/92 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)] backdrop-blur-md dark:border-white/8 dark:bg-[#111318]/92 dark:shadow-[0_18px_40px_rgba(0,0,0,0.2)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-black tracking-[0.18em] text-primary">دليل سريع</div>
            <div className="mt-2 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ActiveIcon size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-text-light-primary dark:text-text-dark-primary">
                  {resolvedItem.title}
                </h2>
                <p className="mt-1 text-sm font-medium leading-7 text-text-light-secondary dark:text-text-dark-secondary">
                  {description}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => jumpToSection(resolvedItem)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/5 bg-black/5 px-4 py-3 text-sm font-black text-text-light-primary transition-colors hover:bg-black/10 dark:border-white/8 dark:bg-white/5 dark:text-text-dark-primary dark:hover:bg-white/10"
          >
            اذهب إلى القسم
            <ArrowLeft size={16} />
          </button>
        </div>

        <div className="scrollbar-hide mt-4 flex gap-2 overflow-x-auto pb-1">
          {GUIDE_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === resolvedItem.id;

            return (
              <button
                key={item.id}
                onClick={() => jumpToSection(item)}
                className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-[0_14px_32px_rgba(234,51,35,0.22)]'
                    : 'bg-black/5 text-text-light-secondary hover:bg-black/10 hover:text-text-light-primary dark:bg-white/5 dark:text-text-dark-secondary dark:hover:bg-white/10 dark:hover:text-text-dark-primary'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default GuideTabs;
