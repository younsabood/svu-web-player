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
import { showConfirmDialog, showErrorDialog, showSuccessToast } from '../../lib/dialogs';

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

    const isConfirmed = await showConfirmDialog({
      title: 'حذف المحاضرة',
      text: `سيتم حذف "${video.filename}" وكل الملفات المؤقتة التابعة له.`,
      confirmButtonText: 'حذف نهائياً',
      cancelButtonText: 'إلغاء',
    });

    if (!isConfirmed) {
      return;
    }

    try {
      await removeLectureAssets(lectureId, {
        aliases: [video.filename, video.name, video.id, video.storageId],
      });
      setSavedVideos((currentVideos) =>
        currentVideos.filter((currentVideo) => getLectureStorageId(currentVideo) !== lectureId)
      );
      await showSuccessToast({
        title: 'تم الحذف',
        text: 'تم حذف المحاضرة وملفاتها المؤقتة.',
      });
    } catch (err) {
      console.error("Error deleting offline video:", err);
      await showErrorDialog({
        title: 'فشل حذف الملف',
        text: err.message,
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 animate-in fade-in duration-500 sm:gap-8">
      <div>
        <SvuBrowser onVideoSelect={onVideoSelect} />
      </div>
      
      <div className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-border-light pb-4 dark:border-border-dark sm:flex-row sm:items-center">
        
        <div className="scrollbar-hide flex w-full gap-3 overflow-x-auto px-1 sm:w-auto">
          {filters.map(filter => (
            <FilterPill 
              key={filter} 
              label={filter} 
              active={activeFilter === filter} 
              onClick={() => setActiveFilter(filter)} 
            />
          ))}
        </div>

        <label className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all active:scale-95 hover:bg-primary-hover sm:w-auto">
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
        <div className="glass-panel flex h-[34vh] flex-col items-center justify-center rounded-[1.5rem] p-6 text-center sm:h-[40vh] sm:rounded-3xl sm:p-8">
           <FolderOpen className="mb-4 h-14 w-14 text-text-light-secondary/30 dark:text-text-dark-secondary/30 sm:h-16 sm:w-16" />
           <h2 className="mb-2 text-xl font-black text-text-light-secondary dark:text-text-dark-secondary sm:text-2xl">لا توجد فيديوهات محفوظة</h2>
           <p className="max-w-sm text-sm font-medium text-text-light-secondary/70 dark:text-text-dark-secondary/70">
             الفيديوهات التي تقوم بتشغيلها أو تنزيلها ستظهر هنا لمشاهدتها بدون إنترنت. يمكنك أيضاً فتح ملف محلي مباشرة.
           </p>
           <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-black/5 px-4 py-2 text-xs font-black text-text-light-secondary dark:bg-white/5 dark:text-text-dark-secondary">
             <Trash2 size={14} />
             يمكنك حذف أي ملف مباشرة من البطاقة
           </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Explore;
