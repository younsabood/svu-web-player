import React from 'react';
import localforage from 'localforage';
import {
  AlertCircle,
  CalendarRange,
  Database,
  GraduationCap,
  Layers3,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  Trash2,
  X,
} from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAcademicSetup } from './useAcademicSetup';
import {
  clearTemporaryStorage,
  formatStorageSize,
  getLectureStorageId,
  getStorageStats,
} from '../../lib/storageManager';
import { showConfirmDialog, showErrorDialog, showSuccessToast } from '../../lib/dialogs';
import { usePlayerStore } from '../../store/usePlayerStore';

const summaryCardClass =
  'rounded-2xl border border-black/5 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5';

const selectClassName =
  'w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm font-bold text-text-light-primary outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#171717] dark:text-white';

const SummaryCard = ({ icon, label, value, accent = 'text-primary' }) => (
  <div className={summaryCardClass}>
    <div className="mb-3 flex items-center gap-3">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 ${accent}`}>
        {React.createElement(icon, { size: 20 })}
      </div>
      <span className="text-xs font-black uppercase tracking-[0.2em] text-text-light-secondary dark:text-text-dark-secondary">
        {label}
      </span>
    </div>
    <div className="truncate text-base font-black text-text-light-primary dark:text-text-dark-primary">
      {value}
    </div>
  </div>
);

const SettingsModal = ({ isOpen, onClose }) => {
  const term = useSettingsStore((state) => state.term);
  const program = useSettingsStore((state) => state.program);
  const isHydrated = useSettingsStore((state) => state.isHydrated);
  const setTerm = useSettingsStore((state) => state.setTerm);
  const setProgram = useSettingsStore((state) => state.setProgram);
  const currentFileMeta = usePlayerStore((state) => state.currentFileMeta);

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
    enabled: isOpen && isHydrated,
    savedTerm: term,
    savedProgram: program,
  });

  const selectedTermLabel = terms.find((item) => item.value === localTerm)?.text || localTerm || 'غير محدد';
  const selectedProgramLabel =
    programs.find((item) => item.value === localProgram)?.text || localProgram || 'اختر برنامجًا';
  const [storageStats, setStorageStats] = React.useState(null);
  const [storageBusy, setStorageBusy] = React.useState(false);

  const loadStorageStats = React.useCallback(async () => {
    if (!isOpen || !isHydrated) return;

    try {
      const stats = await getStorageStats();
      setStorageStats(stats);
    } catch (statsError) {
      console.error('Storage stats error:', statsError);
    }
  }, [isHydrated, isOpen]);

  React.useEffect(() => {
    loadStorageStats();
  }, [loadStorageStats]);

  const handleSave = () => {
    if (!localTerm || !localProgram) {
      setError('اختر الفصل الدراسي والبرنامج الأكاديمي قبل الحفظ.');
      return;
    }

    setTerm(localTerm);
    setProgram(localProgram);
    onClose();
  };

  const handleReset = async () => {
    const isConfirmed = await showConfirmDialog({
      title: 'مسح جميع البيانات المحلية',
      text: 'سيؤدي هذا إلى حذف الإعدادات والاشتراكات وكل الملفات المخزنة محليًا بشكل نهائي.',
      confirmButtonText: 'مسح نهائي',
      cancelButtonText: 'إلغاء',
    });

    if (isConfirmed) {
      await localforage.clear();
      window.location.reload();
    }
  };

  const handleClearTemporaryData = async () => {
    const isConfirmed = await showConfirmDialog({
      title: 'تنظيف الملفات المؤقتة',
      text: 'سيتم حذف الصوت المؤقت، الصور المصغرة، وبيانات الجلب المؤقتة فقط مع الإبقاء على المحاضرات المحفوظة وعدم لمس المحاضرة المفتوحة حالياً.',
      confirmButtonText: 'تنظيف الآن',
      cancelButtonText: 'إلغاء',
    });

    if (!isConfirmed) {
      return;
    }

    setStorageBusy(true);
    try {
      await clearTemporaryStorage({
        preserveLectureIds: currentFileMeta ? [getLectureStorageId(currentFileMeta)] : [],
      });
      await loadStorageStats();
      await showSuccessToast({
        title: 'تم التنظيف',
        text: 'تم حذف الملفات المؤقتة غير المستخدمة.',
      });
    } catch (cleanupError) {
      setError(`فشل تنظيف التخزين المؤقت: ${cleanupError.message}`);
      await showErrorDialog({
        title: 'فشل تنظيف التخزين المؤقت',
        text: cleanupError.message,
      });
    } finally {
      setStorageBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-stretch justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative z-10 flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-none border border-white/10 bg-bg-light shadow-2xl shadow-black/40 dark:bg-[#111] sm:h-auto sm:max-h-[92vh] sm:rounded-[2rem]">
        <div className="border-b border-black/5 bg-black/5 px-4 py-4 dark:border-white/10 dark:bg-white/5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <SettingsIcon size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">إعدادات النظام</h2>
                <p className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
                  عدل الفصل والبرنامج بدون فقدان اشتراكاتك الحالية.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={reload}
                disabled={!isHydrated || isBusy}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/5 text-text-light-secondary transition-colors hover:bg-black/10 disabled:opacity-50 dark:bg-white/5 dark:text-text-dark-secondary dark:hover:bg-white/10"
                title="إعادة تحميل البيانات"
              >
                <RefreshCw size={18} className={isBusy ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/5 text-text-light-secondary transition-colors hover:bg-black/10 dark:bg-white/5 dark:text-text-dark-secondary dark:hover:bg-white/10"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-none flex-1 overflow-y-auto px-4 py-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:max-h-[calc(92vh-88px)] sm:px-6 sm:py-6">
          {!isHydrated ? (
            <div className="flex min-h-52 items-center justify-center rounded-3xl border border-black/5 bg-black/5 text-sm font-bold text-text-light-secondary dark:border-white/10 dark:bg-white/5 dark:text-text-dark-secondary">
              جاري مزامنة الإعدادات المحلية...
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <SummaryCard icon={CalendarRange} label="الفصل الحالي" value={selectedTermLabel} />
                <SummaryCard icon={GraduationCap} label="البرنامج الحالي" value={selectedProgramLabel} />
                <SummaryCard
                  icon={Layers3}
                  label="حالة الجلب"
                  value={loadingStage === 'idle' ? 'جاهز' : loadingStage === 'terms' ? 'تحميل الفصول' : 'تحميل البرامج'}
                  accent="text-svu-blue"
                />
              </div>

              {storageStats && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <SummaryCard icon={Database} label="الحجم المحلي" value={formatStorageSize(storageStats.totalBytes)} />
                  <SummaryCard icon={Trash2} label="المؤقت" value={formatStorageSize(storageStats.temporaryBytes)} accent="text-orange-500" />
                  <SummaryCard
                    icon={Save}
                    label="حد التخزين"
                    value={`${formatStorageSize(storageStats.limitBytes)} / ${storageStats.lectureCount} محاضرة`}
                    accent="text-emerald-500"
                  />
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="font-black">تعذر تحميل بيانات الجامعة</div>
                      <div className="mt-1 font-medium">{error}</div>
                    </div>
                    <button
                      onClick={reload}
                      className="rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-red-600"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-[1.5rem] border border-black/5 bg-gradient-to-br from-white via-white to-primary/5 p-4 shadow-sm dark:border-white/10 dark:from-[#161616] dark:via-[#141414] dark:to-primary/10 sm:rounded-[1.75rem] sm:p-5">
                <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row">
                  <div>
                    <h3 className="text-lg font-black">المسار الأكاديمي</h3>
                    <p className="mt-1 text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
                      عند تغيير الفصل أو البرنامج سيتم استخدامه مباشرة في الصفحة الرئيسية والاستكشاف وإدارة المواد.
                    </p>
                  </div>
                  <div className="w-full rounded-2xl bg-primary/10 px-3 py-2 text-xs font-black text-primary sm:w-auto">
                    {terms.length} فصل • {programs.length} برنامج
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-light-secondary dark:text-text-dark-secondary">
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
                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-light-secondary dark:text-text-dark-secondary">
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

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={handleSave}
                    disabled={!localTerm || !localProgram || isBusy}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-black text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                  >
                    <Save size={18} />
                    حفظ التغييرات
                  </button>

                  <div className="flex items-center justify-center rounded-2xl border border-black/5 bg-black/5 px-4 text-sm font-bold text-text-light-secondary dark:border-white/10 dark:bg-white/5 dark:text-text-dark-secondary">
                    التغيير لا يمس الفيديوهات المحفوظة أو الاشتراكات إلا إذا اخترت المسح الكامل.
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-red-500/20 bg-red-500/[0.06] p-4 sm:rounded-[1.75rem] sm:p-5">
                <div className="mb-4 flex items-center gap-3 text-red-500">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em]">منطقة الخطر</h3>
                    <p className="mt-1 text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
                      امسح كل ما تم حفظه محليًا إذا أردت إعادة ضبط الموقع بالكامل.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleClearTemporaryData}
                  disabled={storageBusy}
                  className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-500/30 px-4 py-3.5 font-black text-orange-500 transition-colors hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={18} />
                  {storageBusy ? 'جاري تنظيف الملفات المؤقتة...' : 'تنظيف الملفات المؤقتة فقط'}
                </button>

                <button
                  onClick={handleReset}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 px-4 py-3.5 font-black text-red-500 transition-colors hover:bg-red-500/10"
                >
                  <Trash2 size={18} />
                  مسح جميع البيانات المحلية
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
