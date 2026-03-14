import React from 'react';
import { 
  Download, XCircle, AlertCircle, CheckCircle2, 
  Loader2, Trash2, HardDriveDownload, 
  Activity, Zap, Clock, ShieldCheck, Film, Music
} from 'lucide-react';
import { useExportStore } from '../../store/useExportStore';

const Exports = () => {
  const { activeExports, cancelExport, clearCompleted } = useExportStore();

  const processingCount = activeExports.filter(t => t.status === 'processing').length;
  const completedCount = activeExports.filter(t => t.status === 'completed').length;

  if (activeExports.length === 0) {
    return (
      <div className="mx-auto flex h-[60vh] max-w-lg flex-col items-center justify-center p-6 text-center animate-in fade-in duration-700 sm:h-[70vh]">
        <div className="relative mb-8 sm:mb-10">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] border-4 border-white/20 bg-gradient-to-br from-primary to-orange-500 shadow-2xl transition-transform duration-500 hover:rotate-0 sm:h-32 sm:w-32 sm:rounded-[2.5rem] sm:rotate-3">
            <HardDriveDownload className="h-12 w-12 text-white sm:h-16 sm:w-16" strokeWidth={1.5} />
          </div>
          <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl border-4 border-bg-light bg-bg-dark shadow-lg dark:border-bg-dark sm:h-12 sm:w-12">
            <Activity className="h-5 w-5 animate-pulse text-primary sm:h-6 sm:w-6" />
          </div>
        </div>
        
        <h2 className="mb-3 text-2xl font-black tracking-tight gradient-text sm:mb-4 sm:text-3xl">محرك التصدير جاهز</h2>
        <p className="text-text-light-secondary dark:text-text-dark-secondary font-medium leading-relaxed max-w-md">
          لم تقم ببدء أي عملية تصدير بعد. يمكنك تحويل محاضراتك إلى مقاطع MP4 عالية الجودة من خلال زر التصدير في المشغل.
        </p>
      </div>
    );
  }

  const handleDownload = (url, title) => {
    const fileName = `${title.replace(/[^a-z0-9\u0600-\u06FF]/gi, '_').toLowerCase() || 'svu_lecture'}.mp4`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  };

  return (
    <div data-guide-id="exports-queue" className="mx-auto max-w-5xl space-y-6 px-1 py-4 animate-in fade-in slide-in-from-bottom-6 duration-700 sm:px-0 md:space-y-8 md:py-10">
      
      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-3xl flex items-center gap-4 border-l-4 border-l-primary">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Zap size={24} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-50">قيد المعالجة</div>
            <div className="text-2xl font-black">{processingCount}</div>
          </div>
        </div>
        
        <div className="glass-panel p-5 rounded-3xl flex items-center gap-4 border-l-4 border-l-green-500">
          <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-50">مكتمل</div>
            <div className="text-2xl font-black">{completedCount}</div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-3xl flex items-center gap-4 border-l-4 border-l-blue-500">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-50">الجودة</div>
            <div className="text-lg font-black leading-tight">H.264 High</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
            قائمة التصدير
            <span className="text-xs bg-black/5 dark:bg-white/10 px-2 py-1 rounded-md opacity-60 font-bold">{activeExports.length}</span>
          </h1>
        </div>
        
        {activeExports.some(t => t.status === 'completed' || t.status === 'error') && (
          <button
            onClick={clearCompleted}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-red-500 transition-all active:scale-95 hover:bg-red-500/20 sm:w-auto"
          >
            <Trash2 size={14} /> مسح الكل
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {activeExports.map((task, idx) => (
          <div 
            key={task.id} 
            className={`glass-panel relative overflow-hidden rounded-[1.5rem] p-1 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 active:scale-[0.99] sm:rounded-[2rem] ${task.status === 'completed' ? 'border-green-500/20' : ''}`}
            style={{ animationDelay: `${idx * 150}ms` }}
          >
            <div className="relative z-10 flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-7">
              
              <div className="flex w-full min-w-0 flex-col gap-4 sm:w-auto sm:flex-1 sm:flex-row sm:items-center sm:gap-5">
                <div className={`w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center border-2 transition-transform duration-500 group-hover:scale-110 ${
                  task.status === 'processing' ? 'bg-primary/10 border-primary/20 text-primary' :
                  task.status === 'completed' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                  'bg-red-500/10 border-red-500/20 text-red-500'
                }`}>
                  {task.status === 'processing' ? <Loader2 size={28} className="animate-spin" /> :
                   task.status === 'completed' ? <CheckCircle2 size={28} /> :
                   <AlertCircle size={28} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 overflow-hidden">
                    <h3 className="font-black text-lg md:text-xl leading-tight truncate" title={task.title} dir="auto">
                      {task.title}
                    </h3>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-light-secondary opacity-70">
                      <Film size={12} /> {task.resolution} &bull; MP4
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-light-secondary opacity-70">
                      <Music size={12} /> AAC 192kbps
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${
                      task.quality === 'High' ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'
                    }`}>
                      <Zap size={10} /> {task.quality}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:items-end">
                {task.status === 'processing' && (
                  <div className="w-full sm:w-48">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">المزامنة</span>
                      <span className="text-sm font-black text-primary italic leading-none">{Math.round(task.progress)}%</span>
                    </div>
                    <div className="h-2 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden border border-black/5 dark:border-white/5">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-orange-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                  {task.status === 'processing' && (
                    <button 
                      onClick={() => cancelExport(task.id)}
                      className="w-full rounded-xl border border-border-light px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all active:scale-95 hover:bg-black/5 dark:border-border-dark dark:hover:bg-white/5 sm:w-auto"
                    >
                      إلغاء
                    </button>
                  )}
                  {task.status === 'completed' && (
                    <button 
                      onClick={() => handleDownload(task.downloadUrl, task.title)}
                      className="w-full sm:w-auto px-8 py-3 bg-primary hover:bg-primary-hover text-white rounded-2xl text-sm font-black shadow-xl shadow-primary/30 transition-all active:scale-95 hover:-translate-y-1 flex items-center justify-center gap-2"
                    >
                      <Download size={18} strokeWidth={2.5} /> حفظ الفيديو
                    </button>
                  )}
                  {task.status === 'error' && (
                    <div className="max-w-full truncate rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-500 sm:max-w-[200px]" dir="ltr">
                      Error: {task.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Background Texture Effect */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Exports;
