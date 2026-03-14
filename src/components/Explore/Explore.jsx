import React, { useState } from 'react';
import VideoGrid from '../Home/VideoGrid';
import SvuBrowser from '../Home/SvuBrowser';
import { FolderOpen, Trash2 } from 'lucide-react';
import {
  getLectureStorageId,
  getManagedItem,
  getStoredLectureSummaries,
  removeLectureAssets,
} from '../../lib/storageManager';

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

  const loadSaved = React.useCallback(async () => {
    try {
      const savedLectures = await getStoredLectureSummaries();
      setSavedVideos(
        savedLectures.map((lecture, index) => ({
          id: `local_id_${index}`,
          title: lecture.filename,
          subject: 'جلسة محملة',
          teacher: 'الذاكرة المؤقتة',
          date: 'بدون إنترنت',
          filename: lecture.filename,
          storageId: lecture.storageId,
          size: lecture.size,
        }))
      );
    } catch (err) {
      console.error("Failed to load saved videos", err);
    }
  }, []);

  React.useEffect(() => {
    loadSaved();
  }, [loadSaved]);

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
        const blob = await getManagedItem(getLectureStorageId(video));
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

  const handleDeleteOfflineVideo = async (video) => {
    const lectureId = getLectureStorageId(video);

    if (!window.confirm(`سيتم حذف "${video.filename}" وكل الملفات المؤقتة التابعة له. هل تريد المتابعة؟`)) {
      return;
    }

    try {
      await removeLectureAssets(lectureId, {
        aliases: [video.filename, video.name, video.id, video.storageId],
      });
      setSavedVideos((currentVideos) =>
        currentVideos.filter((currentVideo) => getLectureStorageId(currentVideo) !== lectureId)
      );
    } catch (err) {
      console.error("Error deleting offline video:", err);
      window.alert(`فشل حذف الملف: ${err.message}`);
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
        <VideoGrid
          videos={filteredVideos}
          onVideoSelect={handleOfflineVideoClick}
          onDeleteVideo={handleDeleteOfflineVideo}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-[40vh] text-center glass-panel rounded-3xl m-2 sm:m-4 p-8">
           <FolderOpen className="w-16 h-16 text-text-light-secondary/30 dark:text-text-dark-secondary/30 mb-4" />
           <h2 className="text-xl sm:text-2xl font-black mb-2 text-text-light-secondary dark:text-text-dark-secondary">لا توجد فيديوهات محفوظة</h2>
           <p className="text-sm font-medium text-text-light-secondary/70 dark:text-text-dark-secondary/70 max-w-sm">
             الفيديوهات التي تقوم بتشغيلها أو تنزيلها ستظهر هنا لمشاهدتها بدون إنترنت. يمكنك أيضاً فتح ملف محلي مباشرة.
           </p>
           <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-black/5 px-4 py-2 text-xs font-black text-text-light-secondary dark:bg-white/5 dark:text-text-dark-secondary">
             <Trash2 size={14} />
             يمكنك حذف أي ملف مباشرة من البطاقة
           </div>
        </div>
      )}
    </div>
  );
};

export default Explore;
