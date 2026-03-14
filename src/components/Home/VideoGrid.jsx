import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { getLectureStorageId, getManagedItem, getThumbnailCacheKey } from '../../lib/storageManager';

const getGradientFromString = (str) => {
  if (!str) return 'from-blue-600 to-purple-600';
  const charCode = str.charCodeAt(0) + (str.charCodeAt(str.length - 1) || 0);
  const colors = [
    'from-red-500 to-orange-500',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-purple-500 to-pink-500',
    'from-indigo-500 to-purple-500',
    'from-orange-500 to-amber-500',
    'from-svu-blue to-blue-500'
  ];
  return colors[charCode % colors.length];
};

const VideoCard = ({ video, onSelect, onDelete }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const gradient = getGradientFromString(video.subject);

  useEffect(() => {
    let objectUrl = null;

    const loadThumb = async () => {
      const thumbBlob = await getManagedItem(getThumbnailCacheKey(getLectureStorageId(video)));
      if (thumbBlob) {
        objectUrl = URL.createObjectURL(thumbBlob);
        setThumbnailUrl(objectUrl);
      }
    };
    loadThumb();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [video]);
  
  return (
    <div
      className="group flex w-full cursor-pointer flex-col gap-3"
      onClick={() => onSelect(video)}
    >
      <div className={`relative w-full aspect-video overflow-hidden rounded-[1.35rem] bg-gradient-to-br ${gradient} shadow-md transition-all duration-300 ring-1 ring-black/5 group-hover:shadow-primary/20 sm:rounded-[1.1rem] sm:shadow-lg dark:ring-white/5`}>
        {typeof onDelete === 'function' && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete(video);
            }}
            className="absolute left-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-xl bg-black/70 text-white opacity-100 transition-all hover:bg-red-500 sm:opacity-0 sm:group-hover:opacity-100"
            title="حذف الملف"
          >
            <Trash2 size={16} />
          </button>
        )}
        
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={video.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
        )}
        
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-all duration-300 sm:bg-black/0 sm:group-hover:bg-black/30">
          <div className="flex h-11 w-11 scale-100 items-center justify-center rounded-full bg-primary/90 backdrop-blur-sm opacity-100 shadow-xl shadow-primary/20 transition-all duration-300 sm:h-14 sm:w-14 sm:scale-75 sm:opacity-0 sm:group-hover:scale-100 sm:group-hover:opacity-100">
            <svg className="w-6 h-6 md:w-7 md:h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>

        {!thumbnailUrl && (
          <div className="absolute inset-0 p-3 md:p-4 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent">
            <div className="text-white">
              <h3 className="text-sm md:text-xl font-bold line-clamp-2 leading-tight drop-shadow-md" dir="auto">{video.title}</h3>
              <p className="text-xs md:text-sm opacity-90 font-medium drop-shadow-md line-clamp-1" dir="auto">{video.subject}</p>
            </div>
          </div>
        )}

        <div className="absolute bottom-1.5 right-1.5 md:bottom-2 md:right-2 bg-black/80 backdrop-blur-md text-white text-[9px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 rounded md:rounded-md border border-white/10 uppercase tracking-tighter" dir="auto">
          {video.duration || 'تسجيل'}
        </div>
      </div>

      <div className="flex gap-3 px-1 sm:px-0">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br ${gradient} text-sm font-bold text-white shadow-sm sm:h-10 sm:w-10 sm:rounded-xl md:text-base`}>
          {video.teacher ? video.teacher.charAt(0) : 'د'}
        </div>
        <div className="flex flex-col overflow-hidden">
          <h4 className="text-text-light-primary dark:text-text-dark-primary font-bold line-clamp-2 leading-tight group-hover:text-primary transition-colors text-sm md:text-base" dir="auto">
            {video.title}
          </h4>
          <p className="text-text-light-secondary dark:text-text-dark-secondary text-xs mt-1 md:mt-1.5 font-medium flex items-center gap-1 line-clamp-1" dir="auto">
            {video.teacher || 'دكتور غير معروف'}
          </p>
          <div className="flex items-center gap-1.5 text-text-light-secondary dark:text-text-dark-secondary text-[10px] md:text-[11px] mt-0.5 md:mt-1 font-medium opacity-70">
            <span dir="auto">{video.views || '0'} مشاهدة</span>
            <span className="w-1 h-1 rounded-full bg-current opacity-30"></span>
            <span dir="auto">{video.date || 'مؤخراً'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const VideoGrid = ({ videos, onVideoSelect, onDeleteVideo }) => {
  if (!videos || videos.length === 0) {
    return (
      <div className="w-full text-center py-20 text-text-light-secondary dark:text-text-dark-secondary">
        <p className="font-bold">لا توجد محاضرات.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((vid, i) => (
        <VideoCard key={vid.id || i} video={vid} onSelect={onVideoSelect} onDelete={onDeleteVideo} />
      ))}
    </div>
  );
};

export default VideoGrid;
