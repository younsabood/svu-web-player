import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { X, Trash2, Save, LogOut, Settings as SettingsIcon } from 'lucide-react';
import localforage from 'localforage';

const SettingsModal = ({ isOpen, onClose }) => {
  const term = useSettingsStore(state => state.term);
  const program = useSettingsStore(state => state.program);
  const setTerm = useSettingsStore(state => state.setTerm);
  const setProgram = useSettingsStore(state => state.setProgram);
  const [terms, setTermsList] = useState([]);
  const [programs, setProgramsList] = useState([]);

  const [localTerm, setLocalTerm] = useState(term || '');
  const [localProgram, setLocalProgram] = useState(program || '');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        
        if (localTerm) {
            const progData = await fetchApi(`term?val=${localTerm}`);
            setProgramsList(progData);
        }
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
    onClose();
  };

  const handleReset = async () => {
    if (window.confirm("هل أنت متأكد؟ هذا سيؤدي إلى حذف جميع الإعدادات والمواد المحفوظة ومقاطع الفيديو المحملة بشكل دائم!")) {
        await localforage.clear();
        window.location.reload();
    }
  };

  if (!isOpen) return null;

  const selectClassBase = "w-full p-4 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none disabled:opacity-40 transition-all font-black text-sm appearance-none cursor-pointer hover:bg-primary/20 dark:hover:bg-primary/30 text-text-light-primary dark:text-white [&>option]:bg-white dark:[&>option]:bg-[#1a1a1a] [&>option]:text-black dark:[&>option]:text-white";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-0">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-bg-light dark:bg-[#111] border border-border-light dark:border-white/10 rounded-3xl shadow-2xl shadow-black/50 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border-light dark:border-white/5 flex items-center justify-between bg-black/5 dark:bg-white/5">
            <h2 className="text-xl font-black flex items-center gap-3 tracking-tight">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <SettingsIcon size={20} />
                </div>
                إعدادات النظام
            </h2>
            <button 
              onClick={onClose} 
              className="p-2.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-text-light-secondary dark:text-text-dark-secondary transition-colors active:scale-90"
            >
                <X size={20} />
            </button>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 space-y-8">
          {error && (
            <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-500/20 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div className="relative group">
              <label className="block text-[10px] uppercase tracking-widest font-black text-text-light-secondary dark:text-text-dark-secondary mb-2 px-1">الفصل الدراسي</label>
              <div className="relative">
                <select 
                  value={localTerm} 
                  onChange={handleTermChange} 
                  className={selectClassBase}
                >
                  <option value="">اختر الفصل</option>
                  {terms.map(t => <option key={t.value} value={t.value}>{t.text}</option>)}
                </select>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-light-secondary opacity-50">▼</div>
              </div>
            </div>

            <div className="relative group">
              <label className="block text-[10px] uppercase tracking-widest font-black text-text-light-secondary dark:text-text-dark-secondary mb-2 px-1">البرنامج الأكاديمي</label>
              <div className="relative">
                <select 
                  value={localProgram} 
                  onChange={(e) => setLocalProgram(e.target.value)} 
                  disabled={!programs.length}
                  className={selectClassBase}
                >
                  <option value="">اختر البرنامج</option>
                  {programs.map(t => <option key={t.value} value={t.value}>{t.text}</option>)}
                </select>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-light-secondary opacity-50">▼</div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button 
              onClick={handleSave}
              className="w-full py-4 bg-primary text-white font-black tracking-wide rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Save size={18} />
              حفظ التغييرات
            </button>
          </div>

          {/* Danger Zone */}
          <div className="pt-6 mt-6 border-t border-border-light dark:border-white/5">
             <h3 className="text-xs font-black uppercase tracking-widest text-red-500 mb-2 px-1">منطقة الخطر</h3>
             <p className="text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary mb-4 px-1 leading-relaxed">
               سيؤدي مسح مساحة التخزين إلى إزالة جميع الفصول الدراسية المحفوظة وحذف مقاطع الفيديو التي تم تنزيلها بشكل دائم من هذا المتصفح.
             </p>
             <button 
                onClick={handleReset}
                className="w-full py-3.5 border-2 border-red-500/20 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-500/10 transition-all flex items-center justify-center gap-2 active:scale-95"
             >
                <Trash2 size={18} />
                مسح جميع البيانات المحلية
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
