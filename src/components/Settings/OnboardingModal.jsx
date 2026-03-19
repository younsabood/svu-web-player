import React from 'react';
import {
  AlertCircle,
  GraduationCap,
  RadioTower,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAcademicSetup } from './useAcademicSetup';

const selectClassName =
  'w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-[15px] font-extrabold text-text-light-primary outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#171717] dark:text-white';

const summaryCardClass =
  'rounded-[1.35rem] border border-black/5 bg-black/5 p-3.5 dark:border-white/10 dark:bg-white/5';

const FeatureCard = ({ icon, title, body }) => (
  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl">
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white">
      {React.createElement(icon, { size: 18 })}
    </div>
    <h3 className="text-base font-black text-white">{title}</h3>
    <p className="mt-2 text-sm font-medium leading-6 text-white/65">{body}</p>
  </div>
);

const SummaryCard = ({ label, value }) => (
  <div className={summaryCardClass}>
    <div className="text-[11px] font-black tracking-[0.14em] text-text-light-secondary dark:text-text-dark-secondary">
      {label}
    </div>
    <div className="mt-2 line-clamp-2 text-base font-black leading-6 text-text-light-primary dark:text-text-dark-primary">
      {value}
    </div>
  </div>
);

const OnboardingModal = () => {
  const term = useSettingsStore((state) => state.term);
  const program = useSettingsStore((state) => state.program);
  const isHydrated = useSettingsStore((state) => state.isHydrated);
  const setTerm = useSettingsStore((state) => state.setTerm);
  const setProgram = useSettingsStore((state) => state.setProgram);

  const isOpen = isHydrated && !(term && program);

  const {
    terms,
    programs,
    localTerm,
    localProgram,
    loadingStage,
    error,
    isBusy,
    setError,
    setLocalProgram,
    handleTermChange,
    reload,
  } = useAcademicSetup({
    enabled: isOpen,
    savedTerm: term,
    savedProgram: program,
  });

  const selectedTermLabel =
    terms.find((item) => item.value === localTerm)?.text || localTerm || 'لم يتم الاختيار بعد';
  const selectedProgramLabel =
    programs.find((item) => item.value === localProgram)?.text || localProgram || 'اختر البرنامج المناسب';

  const handleSave = () => {
    if (!localTerm || !localProgram) {
      setError('اختر الفصل الدراسي والبرنامج الأكاديمي للمتابعة.');
      return;
    }

    setTerm(localTerm);
    setProgram(localProgram);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#050505] p-0 backdrop-blur-xl md:p-4">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-none border border-white/10 bg-[#0c0c0c] shadow-2xl shadow-black/60 md:flex-row md:rounded-[2.5rem]">
        <div className="relative hidden min-w-0 flex-1 overflow-hidden md:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(234,51,35,0.34),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(28,61,90,0.32),_transparent_30%),linear-gradient(160deg,_#111_0%,_#070707_100%)]" />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative z-10 flex h-full flex-col p-8 lg:p-10">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-black tracking-[0.24em] text-white/80">
                <Sparkles size={14} />
                SVU PLAYER
              </div>
              <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-black text-white/60">
                إعداد أولي مختصر
              </div>
            </div>

            <div className="mt-8 max-w-xl">
              <h1 className="text-[clamp(2.6rem,4vw,4.6rem)] font-black leading-[0.96] text-white">
                بيئة مشاهدة منظمة بدل التنقل العشوائي بين الجلسات.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-white/70">
                اختر الفصل الدراسي والبرنامج مرة واحدة فقط، وسيجهز الموقع الصفحة الرئيسية والاستكشاف وإدارة المواد مباشرة.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-sm font-black text-white/80">
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2">فصل واحد</span>
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2">برنامج واحد</span>
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2">دخول أسرع</span>
            </div>

            <div className="mt-auto grid gap-3 lg:grid-cols-3">
              <FeatureCard
                icon={Rocket}
                title="بداية أسرع"
                body="اضبط المسار مرة واحدة ثم ادخل للواجهة مباشرة."
              />
              <FeatureCard
                icon={RadioTower}
                title="حالة أوضح"
                body="التحميل والفشل وإعادة المحاولة أصبحت ظاهرة وواضحة."
              />
              <FeatureCard
                icon={ShieldCheck}
                title="استقرار أعلى"
                body="اعتماد أكبر على البيانات المحلية وأقل على الحالة المؤقتة."
              />
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col bg-white p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] dark:bg-[#101010] md:w-[430px] md:shrink-0 md:p-6 lg:w-[460px] lg:p-7">
          <div className="mb-4 rounded-[1.5rem] bg-[linear-gradient(135deg,_rgba(234,51,35,0.10),_rgba(28,61,90,0.08))] p-4 md:hidden">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black tracking-[0.16em] text-primary">
              <Sparkles size={13} />
              SVU PLAYER
            </div>
            <h1 className="mt-3 text-[1.8rem] font-black leading-[1.08]">
              إعداد سريع وواضح قبل دخول الواجهة.
            </h1>
            <p className="mt-2 text-sm font-medium leading-6 text-text-light-secondary dark:text-text-dark-secondary">
              اختر الفصل والبرنامج فقط، ثم ابدأ الاستخدام بدون تشتيت.
            </p>
          </div>

          <div className="flex flex-1 flex-col">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <GraduationCap size={24} />
              </div>
              <div className="min-w-0">
                <h2 className="text-[1.7rem] font-black leading-[1.05] tracking-tight md:text-[2rem]">
                  تهيئة الحساب الأكاديمي
                </h2>
                <p className="mt-1 text-sm font-medium leading-6 text-text-light-secondary dark:text-text-dark-secondary">
                  يمكنك تعديل هذه البيانات لاحقاً من زر الإعدادات في الأعلى.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <SummaryCard label="الفصل المحدد" value={selectedTermLabel} />
              <SummaryCard label="البرنامج المحدد" value={selectedProgramLabel} />
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-black">تعذر تحميل البيانات</div>
                    <div className="mt-1 font-medium leading-6">{error}</div>
                  </div>
                  <button
                    onClick={reload}
                    className="rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-red-600"
                  >
                    إعادة
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-black tracking-[0.18em] text-text-light-secondary dark:text-text-dark-secondary">
                  الفصل الدراسي
                </label>
                <select
                  value={localTerm}
                  onChange={(event) => handleTermChange(event.target.value)}
                  disabled={isBusy && loadingStage === 'terms'}
                  className={selectClassName}
                >
                  <option value="">اختر الفصل</option>
                  {terms.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.text}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black tracking-[0.18em] text-text-light-secondary dark:text-text-dark-secondary">
                  البرنامج الأكاديمي
                </label>
                <select
                  value={localProgram}
                  onChange={(event) => setLocalProgram(event.target.value)}
                  disabled={!programs.length || isBusy}
                  className={selectClassName}
                >
                  <option value="">اختر البرنامج</option>
                  {programs.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.text}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-auto space-y-3 pt-4">
              <div className="flex items-center justify-between rounded-2xl border border-black/5 bg-black/5 px-4 py-3 text-sm font-bold text-text-light-secondary dark:border-white/10 dark:bg-white/5 dark:text-text-dark-secondary">
                <span>حالة الإعداد</span>
                <span className="text-primary">
                  {loadingStage === 'idle'
                    ? 'جاهز للمتابعة'
                    : loadingStage === 'terms'
                      ? 'تحميل الفصول...'
                      : 'تحميل البرامج...'}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={reload}
                  disabled={isBusy}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-black/5 text-text-light-secondary transition-colors hover:bg-black/10 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-text-dark-secondary dark:hover:bg-white/10"
                  title="إعادة التحميل"
                >
                  <RefreshCw size={20} className={isBusy ? 'animate-spin' : ''} />
                </button>

                <button
                  onClick={handleSave}
                  disabled={!localTerm || !localProgram || isBusy}
                  className="flex h-14 flex-1 items-center justify-center gap-3 rounded-2xl bg-primary px-5 text-base font-black text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {isBusy ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      جاري التحضير...
                    </>
                  ) : (
                    <>
                      <Rocket size={18} />
                      دخول إلى المشغل
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
