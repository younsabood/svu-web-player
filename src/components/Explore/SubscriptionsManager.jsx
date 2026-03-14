import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Plus, Trash2, Library, BookOpen, User, Users, Loader2 } from 'lucide-react';

const SubscriptionsManager = () => {
  const { term, program, subscriptions, addSubscription, removeSubscription } = useSettingsStore();

  const [loadingAction, setLoadingAction] = useState('');
  const [error, setError] = useState('');

  // Dropdown states
  const [courses, setCourses] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [classes, setClasses] = useState([]);

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedTutor, setSelectedTutor] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  const fetchApi = async (endpoint) => {
    const res = await fetch(`/api/svu/${endpoint}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  };

  useEffect(() => {
    if (!program) return;
    const init = async () => {
      setLoadingAction('جاري جلب المواد...');
      try {
        const data = await fetchApi(`program?term=${term}&val=${program}`);
        setCourses(data);
      } catch (err) { setError(err.message); }
      setLoadingAction('');
    };
    init();
  }, [program, term]);

  const handleCourseChange = async (e) => {
    const val = e.target.value;
    setSelectedCourse(val);
    setTutors([]); setClasses([]); setSelectedTutor(''); setSelectedClass('');
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
    setClasses([]); setSelectedClass('');
    if (!val) return;
    
    setLoadingAction('جاري جلب الفصول...');
    try {
      const data = await fetchApi(`tutor?term=${term}&program=${program}&course=${selectedCourse}&val=${val}`);
      setClasses(data);
    } catch(err) { setError(err.message); }
    setLoadingAction('');
  };

  const handleSubscribe = () => {
    if (!selectedCourse || !selectedTutor || !selectedClass) return;

    const courseObj = courses.find(c => c.value === selectedCourse);
    const tutorObj = tutors.find(t => t.value === selectedTutor);
    const classObj = classes.find(c => c.value === selectedClass);

    addSubscription({
      term,
      program,
      courseId: selectedCourse,
      courseName: courseObj?.text || selectedCourse,
      tutorId: selectedTutor,
      tutorName: tutorObj?.text || selectedTutor,
      classId: selectedClass,
      className: classObj?.text || selectedClass
    });

    setSelectedCourse('');
    setTutors([]); setClasses([]); setSelectedTutor(''); setSelectedClass('');
  };

  const selectClassBase = "w-full p-3.5 pr-10 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-40 transition-all font-medium text-sm appearance-none cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 [&>option]:bg-white [&>option]:text-black dark:[&>option]:bg-[#1a1a1a] dark:[&>option]:text-white";

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center text-white shadow-lg shadow-primary/20">
          <Library size={28} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight">موادي</h1>
          <p className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary mt-1">
            قم ببناء جدولك الخاص. المواد المشترك بها ستظهر في الصفحة الرئيسية.
          </p>
        </div>
      </div>

      {/* Add Subscription Form */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden group/form">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 group-hover/form:bg-primary/10 transition-colors duration-700 pointer-events-none" />
        
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          إضافة مادة 
          <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-md tracking-wider" dir="ltr">
            {term} &bull; {program}
          </span>
        </h2>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 text-sm font-bold">{error}</div>}
        
        {loadingAction && (
          <div className="flex items-center gap-3 text-primary text-sm font-bold mb-6">
            <Loader2 className="w-5 h-5 animate-spin" />
            {loadingAction}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
          
          <div className="md:col-span-3 relative">
            <label className="text-xs font-bold text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-widest mb-2 block">المادة</label>
            <div className="relative">
              <BookOpen size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-light-secondary opacity-50" />
              <select value={selectedCourse} onChange={handleCourseChange} className={selectClassBase} disabled={loadingAction !== ''}>
                <option value="">اختر المادة</option>
                {courses.map(c => <option key={c.value} value={c.value}>{c.text}</option>)}
              </select>
            </div>
          </div>

          <div className="md:col-span-3 relative">
            <label className="text-xs font-bold text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-widest mb-2 block">الدكتور</label>
            <div className="relative">
              <User size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-light-secondary opacity-50" />
              <select value={selectedTutor} onChange={handleTutorChange} className={selectClassBase} disabled={!tutors.length || loadingAction !== ''}>
                <option value="">اختر الدكتور</option>
                {tutors.map(t => <option key={t.value} value={t.value}>{t.text}</option>)}
              </select>
            </div>
          </div>

          <div className="md:col-span-3 relative">
            <label className="text-xs font-bold text-text-light-secondary dark:text-text-dark-secondary uppercase tracking-widest mb-2 block">الفصل / الشعبة</label>
            <div className="relative">
              <Users size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-light-secondary opacity-50" />
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className={selectClassBase} disabled={!classes.length || loadingAction !== ''}>
                <option value="">اختر الشعبة</option>
                {classes.map(c => <option key={c.value} value={c.value}>{c.text}</option>)}
              </select>
            </div>
          </div>

          <div className="md:col-span-3">
            <button 
              onClick={handleSubscribe} 
              disabled={!selectedClass || loadingAction !== ''}
              className="w-full flex items-center justify-center gap-2 p-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/30 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
            >
              <Plus size={20} /> إضافة مادة
            </button>
          </div>
        </div>
      </div>

      {/* Active Subscriptions */}
      <div>
        <h2 className="text-xl font-black mb-6 flex items-center gap-3">
          المواد المشترك بها 
          <span className="bg-black/5 dark:bg-white/10 px-3 py-0.5 rounded-full text-sm">{subscriptions.length}</span>
        </h2>
        
        {subscriptions.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-border-light dark:border-border-dark rounded-3xl text-text-light-secondary dark:text-text-dark-secondary bg-black/5 dark:bg-white/5">
            <Library className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-bold">لا توجد اشتراكات</h3>
            <p className="text-sm mt-1 max-w-sm mx-auto">لم تقم بالاشتراك في أي مادة بعد. استخدم النموذج أعلاه لإضافة مادتك الأولى.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {subscriptions.map((sub, idx) => (
              <div 
                key={sub.classId} 
                className="group relative overflow-hidden p-6 rounded-2xl bg-bg-light dark:bg-bg-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 group-hover:bg-primary/10 transition-colors" />
                
                <div className="flex flex-col h-full justify-between gap-6 relative z-10">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-primary mb-2" dir="ltr">
                      ID: {sub.classId}
                    </div>
                    <h3 className="font-bold text-lg mb-2 leading-tight">{sub.courseName}</h3>
                    <div className="flex items-center gap-2 text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
                      <User size={14} /> د. {sub.tutorName}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-auto">
                    <div className="text-xs px-3 py-1.5 bg-black/5 dark:bg-white/10 rounded-lg font-bold">
                      {sub.className}
                    </div>
                    <button 
                      onClick={() => removeSubscription(sub.classId)}
                      className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all rounded-lg active:scale-90"
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
