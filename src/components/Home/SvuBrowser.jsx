import React, { useEffect, useState } from 'react';
import localforage from 'localforage';
import { AlertCircle, Loader2, MonitorPlay, Search, Settings2 } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { fetchSvu } from '../../lib/svuApi';

const selectClassBase =
  'w-full appearance-none rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm font-bold text-text-light-primary outline-none transition-all hover:border-primary/30 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-[#171717] dark:text-white';

const SvuBrowser = ({ onVideoSelect }) => {
  const term = useSettingsStore((state) => state.term);
  const program = useSettingsStore((state) => state.program);
  const isHydrated = useSettingsStore((state) => state.isHydrated);

  const [loadingAction, setLoadingAction] = useState('');
  const [error, setError] = useState('');
  const [courses, setCourses] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedTutor, setSelectedTutor] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    if (!term || !program) {
      setCourses([]);
      setTutors([]);
      setClasses([]);
      setSessions([]);
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
        if (cancelled) return;
        setCourses(data);
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
    setSessions([]);
    setSelectedSession(null);
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
    setSessions([]);
    setSelectedSession(null);
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

  const handleClassChange = async (event) => {
    const value = event.target.value;
    setSelectedClass(value);
    setSessions([]);
    setSelectedSession(null);
    setError('');

    if (!value) return;

    setLoadingAction('جاري جلب الجلسات...');
    try {
      const data = await fetchSvu('class', {
        term,
        program,
        course: selectedCourse,
        tutor: selectedTutor,
        val: value,
        courseId: selectedCourse,
      });
      setSessions(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingAction('');
    }
  };

  const handleSessionClick = async (session) => {
    setSelectedSession(session);
    setLoadingAction('جاري تحضير المحاضرة...');
    setError('');

    try {
      const sessionWithContext = {
        ...session,
        term,
        program,
        course_id: selectedCourse,
        tutor: selectedTutor,
        class_name: selectedClass,
      };

      const data = await fetchSvu('links', { session: JSON.stringify(sessionWithContext) });
      if (!data.length) {
        throw new Error('لا توجد روابط تحميل متاحة لهذه الجلسة.');
      }

      const downloadLink = data.find((item) => item.filename?.endsWith('.lrec')) || data[0];
      if (typeof localforage.ready === 'function') await localforage.ready();
      const cachedBlob = await localforage.getItem(downloadLink.filename);

      if (cachedBlob) {
        onVideoSelect({
          id: downloadLink.id,
          name: downloadLink.filename,
          title: `${session?.course_name} - ${session?.class_name}`,
          subject: session?.program,
          teacher: session?.tutor,
          localFile: new File([cachedBlob], downloadLink.filename),
        });
        return;
      }

      onVideoSelect({
        id: downloadLink.id,
        name: downloadLink.filename,
        title: `${session?.course_name} - ${session?.class_name}`,
        subject: session?.program,
        teacher: session?.tutor,
        _proxyDownloadUrl: downloadLink.link,
        filename: downloadLink.filename,
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingAction('');
    }
  };

  if (!isHydrated) {
    return (
      <div className="glass-panel mb-8 rounded-[2rem] p-8 text-center text-sm font-bold text-text-light-secondary dark:text-text-dark-secondary">
        جاري تجهيز إعدادات التصفح...
      </div>
    );
  }

  if (!term || !program) {
    return (
      <div className="glass-panel mb-8 overflow-hidden rounded-[2rem] border border-primary/10 p-6 sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
              <Settings2 size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black">أكمل الإعدادات أولًا</h2>
              <p className="mt-2 max-w-xl text-sm font-medium leading-7 text-text-light-secondary dark:text-text-dark-secondary">
                التصفح المباشر يحتاج الفصل الدراسي والبرنامج الأكاديمي حتى يتمكن من جلب المواد والمدرسين والجلسات الصحيحة.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-primary/10 px-4 py-3 text-sm font-black text-primary">
            افتح الإعدادات من زر الملف الشخصي في الشريط العلوي.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel relative mb-8 overflow-hidden rounded-[2rem] p-6 sm:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(234,51,35,0.08),_transparent_24%),radial-gradient(circle_at_bottom_left,_rgba(28,61,90,0.08),_transparent_28%)] pointer-events-none" />

      <div className="relative z-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-orange-500 text-white shadow-lg">
              <Search size={22} strokeWidth={2.4} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">قاعدة بيانات الجامعة</h2>
              <p className="mt-1 text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
                تصفح المحاضرات الخام مباشرة حسب المادة والمدرس والشعبة.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-black/5 px-4 py-3 text-sm font-bold text-text-light-secondary dark:bg-white/5 dark:text-text-dark-secondary">
            {term} • {program}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-black">حدث خطأ أثناء الجلب</div>
                <div className="mt-1 font-medium">{error}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-3">
          <div className="relative">
            <select value={selectedCourse} onChange={handleCourseChange} disabled={!courses.length || !!loadingAction} className={selectClassBase}>
              <option value="">1. اختر المادة</option>
              {courses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.text}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <select value={selectedTutor} onChange={handleTutorChange} disabled={!tutors.length || !!loadingAction} className={selectClassBase}>
              <option value="">2. اختر المدرس</option>
              {tutors.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.text}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <select value={selectedClass} onChange={handleClassChange} disabled={!classes.length || !!loadingAction} className={selectClassBase}>
              <option value="">3. اختر الشعبة</option>
              {classes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.text}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadingAction && (
          <div className="flex items-center justify-center gap-3 py-12 text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm font-black">{loadingAction}</span>
          </div>
        )}

        {sessions.length > 0 && !loadingAction && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">الجلسات المتاحة</h3>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-black text-primary">{sessions.length}</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSessionClick(session)}
                  className={`rounded-[1.5rem] border p-4 text-right transition-all active:scale-[0.98] ${
                    selectedSession?.id === session.id
                      ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                      : 'border-black/5 bg-black/5 hover:border-primary/30 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-primary">{session.date}</div>
                      <div className="mt-1 text-xs font-bold text-text-light-secondary dark:text-text-dark-secondary">
                        ترتيب الجلسة: {session.order}
                      </div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/5 text-primary dark:bg-white/10">
                      <MonitorPlay size={18} />
                    </div>
                  </div>

                  <div className="font-black">{session.class_name}</div>
                  <div className="mt-1 text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
                    {session.tutor}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SvuBrowser;
