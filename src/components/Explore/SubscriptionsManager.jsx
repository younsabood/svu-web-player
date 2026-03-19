import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  GraduationCap,
  Library,
  Loader2,
  Plus,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { fetchSvu } from '../../lib/svuApi';

const selectClassBase =
  'w-full appearance-none rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm font-bold text-text-light-primary outline-none transition-all hover:border-primary/30 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-[#171717] dark:text-white';

const SubscriptionsManager = () => {
  const term = useSettingsStore((state) => state.term);
  const program = useSettingsStore((state) => state.program);
  const subscriptions = useSettingsStore((state) => state.subscriptions);
  const isHydrated = useSettingsStore((state) => state.isHydrated);
  const addSubscription = useSettingsStore((state) => state.addSubscription);
  const removeSubscription = useSettingsStore((state) => state.removeSubscription);

  const [loadingAction, setLoadingAction] = useState('');
  const [error, setError] = useState('');
  const [courses, setCourses] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedTutor, setSelectedTutor] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  useEffect(() => {
    if (!term || !program) {
      setCourses([]);
      setTutors([]);
      setClasses([]);
      setSelectedCourse('');
      setSelectedTutor('');
      setSelectedClass('');
      return;
    }

    let cancelled = false;

    const loadCourses = async () => {
      setError('');
      setLoadingAction('جاري جلب المواد...');

      try {
        const data = await fetchSvu('program', { term, val: program });
        if (!cancelled) {
          setCourses(data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message);
        }
      } finally {
        if (!cancelled) {
          setLoadingAction('');
        }
      }
    };

    loadCourses();

    return () => {
      cancelled = true;
    };
  }, [program, term]);

  const handleCourseChange = async (event) => {
    const value = event.target.value;
    setSelectedCourse(value);
    setSelectedTutor('');
    setSelectedClass('');
    setTutors([]);
    setClasses([]);
    setError('');

    if (!value) return;

    setLoadingAction('جاري جلب المدرسين...');
    try {
      const data = await fetchSvu('course', { term, program, val: value });
      setTutors(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingAction('');
    }
  };

  const handleTutorChange = async (event) => {
    const value = event.target.value;
    setSelectedTutor(value);
    setSelectedClass('');
    setClasses([]);
    setError('');

    if (!value) return;

    setLoadingAction('جاري جلب الشعب...');
    try {
      const data = await fetchSvu('tutor', { term, program, course: selectedCourse, val: value });
      setClasses(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingAction('');
    }
  };

  const handleSubscribe = () => {
    if (!selectedCourse || !selectedTutor || !selectedClass) return;

    const courseObj = courses.find((item) => item.value === selectedCourse);
    const tutorObj = tutors.find((item) => item.value === selectedTutor);
    const classObj = classes.find((item) => item.value === selectedClass);

    addSubscription({
      term,
      program,
      courseId: selectedCourse,
      courseName: courseObj?.text || selectedCourse,
      tutorId: selectedTutor,
      tutorName: tutorObj?.text || selectedTutor,
      classId: selectedClass,
      className: classObj?.text || selectedClass,
    });

    setSelectedCourse('');
    setSelectedTutor('');
    setSelectedClass('');
    setTutors([]);
    setClasses([]);
  };

  if (!isHydrated) {
    return (
      <div className="glass-panel rounded-[2rem] p-8 text-center text-sm font-bold text-text-light-secondary dark:text-text-dark-secondary">
        جاري تحميل الاشتراكات المحلية...
      </div>
    );
  }

  if (!term || !program) {
    return (
      <div className="glass-panel rounded-[1.5rem] p-5 sm:rounded-[2rem] sm:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
              <GraduationCap size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black">لا يمكن إدارة المواد قبل الإعداد</h1>
              <p className="mt-2 max-w-xl text-sm font-medium leading-7 text-text-light-secondary dark:text-text-dark-secondary">
                حدد الفصل الدراسي والبرنامج من نافذة الإعدادات أولًا، ثم ستظهر هنا المواد والمدرسون والشعب المناسبة لك.
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-primary/10 px-4 py-3 text-sm font-black text-primary">الإعدادات مطلوبة</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 sm:space-y-8">
      <div className="overflow-hidden rounded-[1.5rem] border border-black/5 bg-gradient-to-br from-white via-white to-primary/5 p-5 shadow-sm dark:border-white/10 dark:from-[#151515] dark:via-[#131313] dark:to-primary/10 sm:rounded-[2rem] sm:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-orange-500 text-white shadow-lg shadow-primary/20">
              <Library size={26} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">موادي</h1>
              <p className="mt-2 text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
                ابن قائمتك الدراسية مرة واحدة، وستظهر أحدث الجلسات في الصفحة الرئيسية تلقائيًا.
              </p>
            </div>
          </div>

          <div className="w-full rounded-2xl bg-black/5 px-4 py-3 text-sm font-black text-text-light-secondary dark:bg-white/5 dark:text-text-dark-secondary md:w-auto">
            {term} • {program} • {subscriptions.length} اشتراك
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-[1.5rem] p-5 sm:rounded-[2rem] sm:p-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black">إضافة مادة جديدة</h2>
            <p className="mt-1 text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
              اختر المادة ثم المدرس ثم الشعبة لتثبيت المسار في الصفحة الرئيسية.
            </p>
          </div>
          {loadingAction && (
            <div className="flex w-full items-center gap-2 rounded-2xl bg-primary/10 px-4 py-3 text-sm font-black text-primary lg:w-auto">
              <Loader2 size={16} className="animate-spin" />
              {loadingAction}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-black">تعذر تحميل المسار الدراسي</div>
                <div className="mt-1 font-medium">{error}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-12 md:items-end md:gap-5">
          <div className="space-y-2 md:col-span-3">
            <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-light-secondary dark:text-text-dark-secondary">
              المادة
            </label>
            <div className="relative">
              <BookOpen size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-light-secondary opacity-50" />
              <select value={selectedCourse} onChange={handleCourseChange} className={`${selectClassBase} pr-11`} disabled={!!loadingAction}>
                <option value="">اختر المادة</option>
                {courses.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.text}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 md:col-span-3">
            <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-light-secondary dark:text-text-dark-secondary">
              المدرس
            </label>
            <div className="relative">
              <User size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-light-secondary opacity-50" />
              <select value={selectedTutor} onChange={handleTutorChange} className={`${selectClassBase} pr-11`} disabled={!tutors.length || !!loadingAction}>
                <option value="">اختر المدرس</option>
                {tutors.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.text}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 md:col-span-3">
            <label className="block text-xs font-black uppercase tracking-[0.2em] text-text-light-secondary dark:text-text-dark-secondary">
              الشعبة
            </label>
            <div className="relative">
              <Users size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-light-secondary opacity-50" />
              <select
                value={selectedClass}
                onChange={(event) => setSelectedClass(event.target.value)}
                className={`${selectClassBase} pr-11`}
                disabled={!classes.length || !!loadingAction}
              >
                <option value="">اختر الشعبة</option>
                {classes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.text}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="md:col-span-3">
            <button
              onClick={handleSubscribe}
              disabled={!selectedClass || !!loadingAction}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 font-black text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              <Plus size={20} />
              إضافة مادة
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">المواد المشترَك بها</h2>
          <span className="rounded-full bg-black/5 px-3 py-1 text-sm font-black dark:bg-white/10">{subscriptions.length}</span>
        </div>

        {subscriptions.length === 0 ? (
          <div className="rounded-[2rem] border-2 border-dashed border-black/10 bg-black/5 p-12 text-center text-text-light-secondary dark:border-white/10 dark:bg-white/5 dark:text-text-dark-secondary">
            <Library className="mx-auto mb-4 h-12 w-12 opacity-20" />
            <h3 className="text-lg font-black">لا توجد اشتراكات بعد</h3>
            <p className="mt-2 text-sm font-medium">أضف أول مادة من النموذج أعلاه لتبدأ الصفحة الرئيسية بعرض الجلسات الجديدة.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5">
            {subscriptions.map((subscription) => (
              <div
                key={subscription.classId}
                className="group relative overflow-hidden rounded-[1.5rem] border border-black/5 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 dark:border-white/10 dark:bg-[#151515] sm:rounded-[1.75rem] sm:p-6"
              >
                <div className="absolute left-0 top-0 h-24 w-24 rounded-br-full bg-primary/6 transition-colors group-hover:bg-primary/10" />

                <div className="relative z-10 flex h-full flex-col justify-between gap-6">
                  <div>
                    <div className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-primary">Class ID: {subscription.classId}</div>
                    <h3 className="text-lg font-black leading-8">{subscription.courseName}</h3>
                    <div className="mt-2 flex items-center gap-2 text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
                      <User size={15} />
                      د. {subscription.tutorName}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="rounded-2xl bg-black/5 px-3 py-2 text-xs font-black dark:bg-white/10">
                      {subscription.className}
                    </div>
                    <button
                      onClick={() => removeSubscription(subscription.classId)}
                      className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 transition-colors hover:bg-red-500 hover:text-white"
                      title="إلغاء الاشتراك"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionsManager;
