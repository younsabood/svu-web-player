import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Search, MonitorPlay, Download, Loader2, Play } from 'lucide-react';

const SvuBrowser = ({ onVideoSelect }) => {
  const term = useSettingsStore(state => state.term);
  const program = useSettingsStore(state => state.program);
  const [loadingAction, setLoadingAction] = useState('جاري تحميل المواد...');
  const [error, setError] = useState('');
  
  const [courses, setCourses] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedTutor, setSelectedTutor] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);
  const fetchApi = async (endpoint) => {
    const res = await fetch(`/api/svu/${endpoint}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  };

  useEffect(() => {
    if (!program) return;
    const init = async () => {
      try {
        setLoadingAction('جاري جلب المواد...');
        const data = await fetchApi(`program?term=${term}&val=${program}`);
        setCourses(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingAction('');
      }
    };
    init();
  }, [program, term]);

  const handleCourseChange = async (e) => {
    const val = e.target.value;
    setSelectedCourse(val);
    setTutors([]); setClasses([]); setSessions([]);
    if (!val) return;
    
    setLoadingAction('جاري جلب الدكاترة...');
    try {
      const data = await fetchApi(`course?term=${term}&program=${program}&val=${val}`);
      setTutors(data);
    } catch(err) { setError(err.message); }
    setLoadingAction('');
  };

  const handleTutorChange = async (e) => {
    const val = e.target.value;
    setSelectedTutor(val);
    setClasses([]); setSessions([]);
    if (!val) return;
    
    setLoadingAction('جاري جلب الفصول...');
    try {
      const data = await fetchApi(`tutor?term=${term}&program=${program}&course=${selectedCourse}&val=${val}`);
      setClasses(data);
    } catch(err) { setError(err.message); }
    setLoadingAction('');
  };

  const handleClassChange = async (e) => {
    const val = e.target.value;
    setSelectedClass(val);
    setSessions([]);
    if (!val) return;
    
    setLoadingAction('جاري جلب الجلسات...');
    try {
      const data = await fetchApi(`class?term=${term}&program=${program}&course=${selectedCourse}&tutor=${selectedTutor}&val=${val}&courseId=${selectedCourse}`);
      setSessions(data);
    } catch(err) { setError(err.message); }
    setLoadingAction('');
  };

  const handleSessionClick = async (session) => {
    setSelectedSession(session);
    setLoadingAction('جاري تحضير المحاضرة...');
    try {
      const sessionWithContext = {
        ...session,
        term,
        program,
        course_id: selectedCourse,
        tutor: selectedTutor,
        class_name: selectedClass
      };
      const encoded = encodeURIComponent(JSON.stringify(sessionWithContext));
      const data = await fetchApi(`links?session=${encoded}`);
      
      if (data && data.length > 0) {
        // Find best link or use first
        const downloadLink = data.find(l => l.filename && l.filename.endsWith('.lrec')) || data[0];
        
        const cachedBlob = await import('localforage').then(lf => lf.getItem(downloadLink.filename));
        if (cachedBlob) {
          onVideoSelect({
            id: downloadLink.id,
            name: downloadLink.filename,
            title: session?.course_name + ' - ' + session?.class_name,
            subject: session?.program,
            teacher: session?.tutor,
            localFile: new File([cachedBlob], downloadLink.filename) 
          });
        } else {
          onVideoSelect({
            id: downloadLink.id,
            name: downloadLink.filename,
            title: session?.course_name + ' - ' + session?.class_name,
            subject: session?.program,
            teacher: session?.tutor,
            _proxyDownloadUrl: downloadLink.link
          });
        }
      } else {
        throw new Error('لا توجد روابط تحميل لهذه الجلسة');
      }
    } catch(err) { 
      setError(err.message); 
    }
    setLoadingAction('');
  };

  const selectClassBase = "w-full p-3.5 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none disabled:opacity-40 transition-all font-bold text-sm appearance-none cursor-pointer hover:bg-primary/20 dark:hover:bg-primary/30 text-text-light-primary dark:text-white [&>option]:bg-white dark:[&>option]:bg-[#1a1a1a] [&>option]:text-black dark:[&>option]:text-white";

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-8 mb-8 relative overflow-hidden group/browser">
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 group-hover/browser:bg-primary/10 transition-colors duration-700 pointer-events-none" />
      
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center text-white shadow-lg">
          <Search size={24} strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight">قاعدة بيانات الجامعة</h2>
          <p className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">تصفح وقم بتشغيل ملفات المحاضرات الخام.</p>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 text-sm font-bold flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 relative z-10">
        <div className="relative">
          <select value={selectedCourse} onChange={handleCourseChange} disabled={!courses.length} className={selectClassBase}>
            <option value="">1. اختر المادة</option>
            {courses.map(t => <option key={t.value} value={t.value}>{t.text}</option>)}
          </select>
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-light-secondary opacity-50">▼</div>
        </div>

        <div className="relative">
          <select value={selectedTutor} onChange={handleTutorChange} disabled={!tutors.length} className={selectClassBase}>
            <option value="">2. اختر الدكتور</option>
            {tutors.map(t => <option key={t.value} value={t.value}>{t.text}</option>)}
          </select>
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-light-secondary opacity-50">▼</div>
        </div>

        <div className="relative">
          <select value={selectedClass} onChange={handleClassChange} disabled={!classes.length} className={selectClassBase}>
            <option value="">3. اختر الفصل/الشعبة</option>
            {classes.map(t => <option key={t.value} value={t.value}>{t.text}</option>)}
          </select>
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-light-secondary opacity-50">▼</div>
        </div>
      </div>

      {loadingAction && (
        <div className="flex items-center justify-center gap-3 py-12 text-primary font-bold">
          <Loader2 className="animate-spin w-6 h-6" />
          {loadingAction}
        </div>
      )}

      {sessions.length > 0 && !loadingAction && (
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4">
          <h3 className="font-black text-lg mb-4 flex items-center gap-2">
            الجلسات المتاحة <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md text-sm">{sessions.length}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((s, idx) => (
              <div 
                key={idx} 
                onClick={() => handleSessionClick(s)}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all active:scale-95 group/session ${
                  selectedSession?.id === s.id 
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' 
                    : 'border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 hover:border-primary/30'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                   <div className="font-bold text-sm sm:text-base text-primary leading-tight" dir="ltr">{s.date}</div>
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${selectedSession?.id === s.id ? 'bg-primary text-white' : 'bg-black/10 dark:bg-white/10 group-hover/session:bg-primary/20 group-hover/session:text-primary'}`}>
                      <MonitorPlay size={16} />
                   </div>
                </div>
                <div className="font-semibold text-sm line-clamp-1">{s.class_name}</div>
                <div className="text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary mt-1">{s.tutor} &bull; ترتيب: {s.order}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default SvuBrowser;
