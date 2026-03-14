import React, { useState } from 'react';
import VideoGrid from '../Home/VideoGrid';
import SvuBrowser from '../Home/SvuBrowser';
import { FolderOpen } from 'lucide-react';

const FilterPill = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
      active
        ? 'bg-text-light-primary text-white dark:bg-white dark:text-black shadow-lg shadow-black/10 dark:shadow-white/10'
        : 'bg-black/5 text-text-light-secondary hover:text-text-light-primary hover:bg-black/10 dark:bg-white/5 dark:text-text-dark-secondary dark:hover:text-text-dark-primary dark:hover:bg-white/10'
    }`}
  >
    {label}
  </button>
);

const Explore = ({ onVideoSelect }) => {
  const [activeFilter, setActiveFilter] = useState('التنزيلات');
  const [savedVideos, setSavedVideos] = useState([]);
  
  const filters = ['التنزيلات']; 

  React.useEffect(() => {
    const loadSaved = async () => {
      try {
        const localforage = (await import('localforage')).default;
        if (typeof localforage.ready === 'function') await localforage.ready();
        const keys = await localforage.keys();
        const lrecKeys = keys.filter(k => k.endsWith('.lrec'));
        
        const videos = lrecKeys.map((key, i) => ({
          id: `local_id_${i}`,
          title: key,
          subject: 'جلسة محملة',
          teacher: 'الذاكرة المؤقتة',
          date: 'بدون إنترنت',
          filename: key
        }));
        setSavedVideos(videos);
      } catch (err) {
        console.error("Failed to load saved videos", err);
      }
    };
    loadSaved();
  }, []);

  const filteredVideos = savedVideos;

  const handleLocalFileDrop = (e) => {
    const file = e.target.files[0];
    if (file) {
      onVideoSelect({
        id: 'local-' + Date.now(),
        title: file.name,
        subject: 'ملف محلي',
        teacher: 'أنت',
        date: 'الآن',
        localFile: file
      });
    }
  };

  const handleOfflineVideoClick = async (video) => {
    try {
      if (video.id.startsWith('local_id_')) {
        // Use statically imported localforage
        if (typeof localforage.ready === 'function') await localforage.ready();
        const blob = await localforage.getItem(video.filename);
        if (blob) {
          onVideoSelect({
            ...video,
            localFile: new File([blob], video.filename)
          });
          return;
        }
      }
      onVideoSelect(video);
    } catch (err) {
      console.error("Error loading offline video:", err);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
      <SvuBrowser onVideoSelect={onVideoSelect} />
      
      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b border-border-light dark:border-border-dark pb-4">
        
        <div className="flex gap-3 overflow-x-auto w-full sm:w-auto scrollbar-hide px-1">
          {filters.map(filter => (
            <FilterPill 
              key={filter} 
              label={filter} 
              active={activeFilter === filter} 
              onClick={() => setActiveFilter(filter)} 
            />
          ))}
        </div>

        <label className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap bg-primary text-white cursor-pointer hover:bg-primary-hover shadow-lg shadow-primary/30 transition-all active:scale-95 w-full sm:w-auto">
          <FolderOpen size={18} />
          <span>فتح ملف .lrec محلي</span>
          <input type="file" accept=".lrec" className="hidden" onChange={handleLocalFileDrop} />
        </label>
        
      </div>

      {/* Grid */}
      {filteredVideos.length > 0 ? (
        <VideoGrid videos={filteredVideos} onVideoSelect={handleOfflineVideoClick} />
      ) : (
        <div className="flex flex-col items-center justify-center h-[40vh] text-center glass-panel rounded-3xl m-2 sm:m-4 p-8">
           <FolderOpen className="w-16 h-16 text-text-light-secondary/30 dark:text-text-dark-secondary/30 mb-4" />
           <h2 className="text-xl sm:text-2xl font-black mb-2 text-text-light-secondary dark:text-text-dark-secondary">لا توجد فيديوهات محفوظة</h2>
           <p className="text-sm font-medium text-text-light-secondary/70 dark:text-text-dark-secondary/70 max-w-sm">
             الفيديوهات التي تقوم بتشغيلها أو تنزيلها ستظهر هنا لمشاهدتها بدون إنترنت. يمكنك أيضاً فتح ملف محلي مباشرة.
           </p>
        </div>
      )}
    </div>
  );
};

export default Explore;
