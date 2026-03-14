import React, { useState, useEffect } from 'react';
import CustomPlayer from './CustomPlayer';
import {
  getLectureStorageId,
  getManagedItem,
  pruneStorageToLimit,
  setManagedItem,
} from '../../lib/storageManager';

const Watch = ({ file }) => {
  const [playableFile, setPlayableFile] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) {
      setPlayableFile(null);
      return;
    }

    if (file.localFile) {
      setPlayableFile(file);
      return;
    }

    if (file._proxyDownloadUrl) {
      const controller = new AbortController();
      const signal = controller.signal;
      const lectureId = getLectureStorageId(file);

      const fetchAndCache = async () => {
        try {
          if (signal.aborted) return;
          setDownloadProgress({ text: 'جاري بدء التحميل...', perc: 0 });

          const cacheKey = lectureId;
          const cachedBlob = await getManagedItem(cacheKey);
          
          if (cachedBlob) {
            if (signal.aborted) return;
            setPlayableFile({
              ...file,
              storageId: lectureId,
              localFile: new File([cachedBlob], cacheKey)
            });
            setDownloadProgress(null);
            return;
          }

          const encodedUrl = encodeURIComponent(file._proxyDownloadUrl);
          const res = await fetch(`/api/svu/download?url=${encodedUrl}`, { signal });
          
          if (!res.ok) throw new Error('فشل جلب ملفات المحاضرة');

          const contentLength = res.headers.get('content-length');
          const total = parseInt(contentLength, 10) || 0;
          let loaded = 0;

          const reader = res.body.getReader();
          const chunks = [];

          let lastUpdate = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done || signal.aborted) break;
            chunks.push(value);
            loaded += value.length;

            const now = Date.now();
            if (now - lastUpdate > 100 || loaded === total) {
              lastUpdate = now;
              if (total > 0) {
                const perc = Math.round((loaded / total) * 100);
                setDownloadProgress({ text: `جاري التحميل ${perc}%...`, perc });
              } else {
                setDownloadProgress({ text: `جاري التحميل ${(loaded/1024/1024).toFixed(1)}MB...`, perc: 50 });
              }
            }
          }

          if (signal.aborted) return;

          setDownloadProgress({ text: 'جاري الحفظ في الذاكرة...', perc: 100 });
          const finalBlob = new Blob(chunks);
          await setManagedItem(cacheKey, finalBlob);
          await pruneStorageToLimit({ activeLectureId: lectureId });

          setPlayableFile({
            ...file,
            storageId: lectureId,
            localFile: new File([finalBlob], cacheKey)
          });
          setDownloadProgress(null);

        } catch (err) {
          if (err.name === 'AbortError') return;
          console.error("Watch proxy download error:", err);
          setError("فشل تحميل مسار المحاضرة: " + err.message);
          setDownloadProgress(null);
        }
      };

      fetchAndCache();
      return () => controller.abort();
    }
  }, [file]);

  if (!file) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center text-text-light-secondary dark:text-text-dark-secondary font-bold text-xl">
        قم باختيار محاضرة للبدء
      </div>
    );
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6 mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex-1 min-w-0">
        
        {error ? (
          <div className="w-full aspect-video bg-red-500/10 flex items-center justify-center text-red-500 rounded-xl mb-4 font-bold p-8 text-center shadow-inner">
            {error}
          </div>
        ) : downloadProgress ? (
          <div className="w-full aspect-video bg-black/5 dark:bg-white/5 flex flex-col items-center justify-center rounded-xl mb-4 border border-border-light dark:border-border-dark shadow-inner p-8">
            <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin mb-6"></div>
            <h2 className="text-xl font-bold mb-2 text-primary" dir="ltr">{downloadProgress.text}</h2>
            <div className="w-full max-w-md bg-black/10 dark:bg-white/10 rounded-full h-3 overflow-hidden mt-2">
               <div className="bg-primary h-full transition-all duration-300 ease-out" style={{ width: `${downloadProgress.perc}%` }}></div>
            </div>
            <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary mt-4 font-medium">
              جاري جلب ملفات المحاضرة بشكل آمن...
            </p>
          </div>
        ) : playableFile ? (
          <CustomPlayer fileInfo={playableFile} />
        ) : null}
        
          <div className="mt-4 flex flex-col items-start gap-2">
            <h1 className="text-xl md:text-2xl font-bold line-clamp-2 leading-tight text-text-light-primary dark:text-text-dark-primary" dir="auto">
              {file.title || file.name || 'محاضرة غير معروفة'}
            </h1>
            <div className="text-sm font-bold text-text-light-secondary dark:text-text-dark-secondary bg-black/5 dark:bg-white/10 px-3 py-1 rounded-md">
              {file.subject || 'الجامعة الافتراضية السورية'}
            </div>
          </div>
      </div>
    </div>
  );
};

export default Watch;
