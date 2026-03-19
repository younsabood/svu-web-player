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
      <div className="flex h-[52vh] w-full items-center justify-center rounded-[1.5rem] border border-black/5 bg-black/5 px-6 text-center text-lg font-bold text-text-light-secondary dark:border-white/10 dark:bg-white/5 dark:text-text-dark-secondary sm:h-[60vh] sm:text-xl">
        قم باختيار محاضرة للبدء
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:gap-6 xl:flex-row">
      <div className="flex-1 min-w-0">
        
        {error ? (
          <div className="mb-4 flex aspect-[4/3] w-full items-center justify-center rounded-[1.5rem] bg-red-500/10 p-6 text-center font-bold text-red-500 shadow-inner sm:aspect-video sm:p-8">
            {error}
          </div>
        ) : downloadProgress ? (
          <div className="mb-4 flex aspect-[4/3] w-full flex-col items-center justify-center rounded-[1.5rem] border border-border-light bg-black/5 p-6 shadow-inner dark:border-border-dark dark:bg-white/5 sm:aspect-video sm:p-8">
            <div className="mb-5 h-14 w-14 animate-spin rounded-full border-4 border-primary border-t-transparent sm:mb-6 sm:h-16 sm:w-16"></div>
            <h2 className="mb-2 text-lg font-bold text-primary sm:text-xl" dir="ltr">{downloadProgress.text}</h2>
            <div className="mt-2 h-3 w-full max-w-md overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
               <div className="bg-primary h-full transition-all duration-300 ease-out" style={{ width: `${downloadProgress.perc}%` }}></div>
            </div>
            <p className="mt-4 text-center text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
              جاري جلب ملفات المحاضرة بشكل آمن...
            </p>
          </div>
        ) : playableFile ? (
          <CustomPlayer fileInfo={playableFile} />
        ) : null}
        
          <div className="glass-panel mt-4 flex flex-col items-start gap-3 rounded-[1.5rem] p-4 sm:p-5">
            <h1 className="line-clamp-2 text-xl font-bold leading-tight text-text-light-primary dark:text-text-dark-primary md:text-2xl" dir="auto">
              {file.title || file.name || 'محاضرة غير معروفة'}
            </h1>
            <div className="rounded-xl bg-black/5 px-3 py-2 text-sm font-bold text-text-light-secondary dark:bg-white/10 dark:text-text-dark-secondary">
              {file.subject || 'الجامعة الافتراضية السورية'}
            </div>
          </div>
      </div>
    </div>
  );
};

export default Watch;
