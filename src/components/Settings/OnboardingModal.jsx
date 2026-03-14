import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';

const OnboardingModal = () => {
  const term = useSettingsStore(state => state.term);
  const program = useSettingsStore(state => state.program);
  const setTerm = useSettingsStore(state => state.setTerm);
  const setProgram = useSettingsStore(state => state.setProgram);
  const [terms, setTermsList] = useState([]);
  const [programs, setProgramsList] = useState([]);

  const [localTerm, setLocalTerm] = useState(term || '');
  const [localProgram, setLocalProgram] = useState(program || '');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isOpen, setIsOpen] = useState(!(term && program));

  useEffect(() => {
    setIsOpen(!(term && program));
  }, [term, program]);

  const fetchApi = async (endpoint) => {
    const res = await fetch(`/api/svu/${endpoint}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  };

  useEffect(() => {
    if (!isOpen) return;
    
    const init = async () => {
      try {
        setLoading(true);
        const data = await fetchApi('init');
        setTermsList(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [isOpen]);

  const handleTermChange = async (e) => {
    const val = e.target.value;
    setLocalTerm(val);
    setLocalProgram('');
    setProgramsList([]);
    if (!val) return;
    
    setLoading(true);
    try {
      const data = await fetchApi(`term?val=${val}`);
      setProgramsList(data);
    } catch(err) { setError(err.message); }
    setLoading(false);
  };

  const handleSave = () => {
    if (!localTerm || !localProgram) {
      setError("يرجى اختيار كل من الفصل الدراسي والبرنامج.");
      return;
    }
    setTerm(localTerm);
    setProgram(localProgram);
  };

  if (!isOpen) return null;

  const selectClassBase = "w-full p-4 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none disabled:opacity-40 transition-all font-black text-sm appearance-none cursor-pointer hover:bg-primary/20 dark:hover:bg-primary/30 text-text-light-primary dark:text-white [&>option]:bg-white dark:[&>option]:bg-[#1a1a1a] [&>option]:text-black dark:[&>option]:text-white";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-700">
      <div className="relative w-full max-w-4xl h-auto md:h-[600px] flex flex-col md:flex-row overflow-hidden rounded-[2.5rem] shadow-2xl shadow-primary/10 border border-white/10 bg-bg-light dark:bg-[#0a0a0a] animate-in zoom-in-95 duration-500">
        
        {/* Left Side: Hero Brand Area */}
        <div className="hidden md:flex flex-1 relative items-center justify-center p-12 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img src="/hero-bg.png" alt="Hero" className="w-full h-full object-cover opacity-20 dark:opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-[#0a0a0a]/80 to-primary/20" />
          </div>
          
          <div className="relative z-10 text-center animate-float">
            <div className="w-28 h-28 mx-auto mb-8 bg-white/10 rounded-3xl backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-2xl overflow-hidden">
               <img src="/logo.png" alt="SVU Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-4xl font-black text-white mb-3 tracking-tight" dir="ltr">
               مشغل <span className="text-primary font-black bg-primary/10 px-2 py-1 rounded-lg">SVU</span>
            </h1>
            <p className="text-white/60 font-medium max-w-[250px] mx-auto text-sm leading-relaxed mt-2">
              تجربة البث والمشاهدة الأفضل والمخصصة لطلاب الجامعة الافتراضية السورية.
            </p>
          </div>
        </div>

        {/* Right Side: Selection Form */}
        <div className="w-full md:w-[450px] bg-white dark:bg-[#111111] p-8 sm:p-12 flex flex-col justify-center relative border-r border-border-light dark:border-white/5">
          <div className="md:hidden flex flex-col items-center mb-8 mt-4">
             <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 border border-primary/20">
                <img src="/logo.png" alt="Logo" className="w-12 h-12" />
             </div>
             <h2 className="text-2xl font-black tracking-tight text-primary">مرحباً بك</h2>
          </div>

          <h2 className="hidden md:block text-3xl font-black mb-3 tracking-tight">ابدأ الآن</h2>
          <p className="text-text-light-secondary dark:text-text-dark-secondary mb-8 text-sm font-medium leading-relaxed text-center md:text-right">
            يرجى اختيار الفصل الدراسي والبرنامج الخاص بك لمزامنة محاضراتك والمواد تلقائياً.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 text-xs font-bold animate-in slide-in-from-top-2">
              {error}
            </div>
          )}

          {loading && terms.length === 0 && (
            <div className="flex items-center justify-center gap-3 text-primary text-sm font-bold mb-8 py-4 bg-primary/5 rounded-xl border border-primary/10">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
              جاري الاتصال بسيرفر الجامعة...
            </div>
          )}

          <div className="space-y-6 mb-10">
            <div className="relative group">
              <label className="block text-xs uppercase font-black text-text-light-secondary dark:text-text-dark-secondary mb-2 px-1">الفصل الدراسي</label>
              <div className="relative">
                <select 
                  value={localTerm} 
                  onChange={handleTermChange} 
                  disabled={loading && terms.length === 0}
                  className={selectClassBase}
                >
                  <option value="">اختر الفصل</option>
                  {terms.map(t => <option key={t.value} value={t.value}>{t.text}</option>)}
                </select>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-light-secondary opacity-50">▼</div>
              </div>
            </div>

            <div className="relative group">
              <label className="block text-xs uppercase font-black text-text-light-secondary dark:text-text-dark-secondary mb-2 px-1">البرنامج الأكاديمي</label>
              <div className="relative">
                <select 
                  value={localProgram} 
                  onChange={(e) => setLocalProgram(e.target.value)} 
                  disabled={!programs.length || loading}
                  className={selectClassBase}
                >
                  <option value="">اختر البرنامج</option>
                  {programs.map(t => <option key={t.value} value={t.value}>{t.text}</option>)}
                </select>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-light-secondary opacity-50">▼</div>
              </div>
            </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={!localTerm || !localProgram || loading}
            className="w-full py-4 bg-primary text-white font-black tracking-wide rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/30 transition-all active:scale-95 disabled:opacity-30 disabled:shadow-none flex items-center justify-center gap-3"
          >
            {loading ? (
               <>
                 <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                 جاري الإعداد...
               </>
            ) : 'دخول للمشغل'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
