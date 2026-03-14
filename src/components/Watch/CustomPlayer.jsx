import React, { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, Download, Loader2, RotateCcw } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useExportStore } from '../../store/useExportStore';
import LrecParser from '../../core/LrecParser';
import CanvasRenderer from '../../core/CanvasRenderer';
import SmartCropper from '../../core/SmartCropper';
import AudioExtractor from '../../core/AudioExtractor';
import ffmpegManager from '../../core/FfmpegManager';
import { withRetry } from '../../core/utils';
import Swal from 'sweetalert2';
import {
  getAudioCacheKey,
  getLectureStorageId,
  getManagedItem,
  getThumbnailCacheKey,
  pruneStorageToLimit,
  removeManagedItem,
  setManagedItem,
  touchManagedKeys,
} from '../../lib/storageManager';

const formatTime = (seconds) => {
  if (isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const CustomPlayer = ({ fileInfo }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  
  const parserRef = useRef(null);
  const rendererRef = useRef(null);
  const rafRef = useRef(null);
  const cropperRef = useRef(null);
  const cropBoundsRef = useRef(null);
  const audioUrlRef = useRef(null);
  const audioBlobRef = useRef(null);
  const fullAudioBlobPromiseRef = useRef(null);
  const lastFrameDrawnRef = useRef(-1);
  
  const { 
    isPlaying, setPlaying, togglePlay, 
    currentTime, setTime, duration, setDuration,
    volume, setVolume, isFullscreen, setFullscreen,
    isLoading, setLoading, setCurrentFileMeta
  } = usePlayerStore();

  const { addExportTask, updateExportProgress, completeExport, failExport } = useExportStore();

  const [loadingText, setLoadingText] = useState('جاري تهيئة المشغل...');
  const [showControls, setShowControls] = useState(true);
  const [fitMode] = useState('contain');
  const [playbackRate, setInternalPlaybackRate] = useState(1);
  const [exportToast, setExportToast] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isAudioProcessing, setIsAudioProcessing] = useState(false);
  const controlsTimeoutRef = useRef(null);

  const buildPlayableAudioBlob = async (chunks, targetDurationMs) => {
    const trueSpeechWav = AudioExtractor.buildTrueSpeechWav(chunks);
    const decodedPcmWav = await withRetry(
      () => ffmpegManager.decodeTrueSpeechToPcmWav(trueSpeechWav),
      3,
      1000
    );
    const playableAudio = AudioExtractor.buildTimedPcmWav(chunks, decodedPcmWav, targetDurationMs) ?? decodedPcmWav;
    return new Blob([playableAudio], { type: 'audio/wav' });
  };

  const setAudioSource = (url) => {
    if (!audioRef.current) return;

    if (audioUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrlRef.current);
    }

    audioUrlRef.current = url;
    audioRef.current.src = url;
  };

  const setAudioBlobSource = useEffectEvent((blob) => {
    if (!(blob instanceof Blob)) return;
    audioBlobRef.current = blob;
    setAudioSource(URL.createObjectURL(blob));
  });

  const resolveExportAudioSource = async () => {
    if (fullAudioBlobPromiseRef.current) {
      try {
        return await fullAudioBlobPromiseRef.current;
      } catch (error) {
        console.warn('Falling back to current audio blob for export', error);
      }
    }

    if (audioBlobRef.current instanceof Blob) {
      return audioBlobRef.current;
    }

    return audioRef.current?.src || null;
  };

  const renderUpToTime = useCallback((targetMs) => {
    const parser = parserRef.current;
    if (!parser) return;
    
    if (targetMs < (parser.frameIndex[lastFrameDrawnRef.current]?.timestamp || 0)) {
      rendererRef.current.clearScale();
      lastFrameDrawnRef.current = -1;
    }

    try {
        let frameDrew = false;
        let targetFrame = lastFrameDrawnRef.current;
        while (targetFrame + 1 < parser.totalFrames && 
               parser.frameIndex[targetFrame + 1].timestamp <= targetMs) {
           targetFrame++;
           const tiles = parser.getFrameTiles(targetFrame);
           rendererRef.current.renderFrame(tiles, parser.palette);
           frameDrew = true;
        }

        if (frameDrew && cropperRef.current) {
           const shouldUpdateCrop = (cropperRef.current.framesAnalyzed < cropperRef.current.warmupFrames || targetFrame % 30 === 0);
           if (shouldUpdateCrop) {
              const imageData = rendererRef.current.ctx.getImageData(0, 0, parser.screenWidth, parser.screenHeight);
              const expanded = cropperRef.current.updateBounds(imageData);
              if (expanded || !cropBoundsRef.current) {
                 cropBoundsRef.current = cropperRef.current.getBounds();
              }
           }
           rendererRef.current.flush(cropBoundsRef.current);
        }
        lastFrameDrawnRef.current = targetFrame;
    } catch (err) {
        console.error("خطأ في الرسم", err);
    }
  }, []);

  const syncVideoToAudio = useEffectEvent(() => {
    if (!audioRef.current || !parserRef.current || !isPlaying) return;
    const currentAudioTime = audioRef.current.currentTime;
    setTime(currentAudioTime);
    renderUpToTime(currentAudioTime * 1000);
    rafRef.current = requestAnimationFrame(syncVideoToAudio);
  });

  useEffect(() => {
    let isMounted = true;
    const audioElement = audioRef.current;
    
    const initPlayer = async () => {
      setLoading(true);
      setCurrentFileMeta(fileInfo);
      
      // Informative alert about processing power
      const hasShownNotice = sessionStorage.getItem('svu_notice_shown');
      if (!hasShownNotice) {
        Swal.fire({
          title: 'تجهيز المحاضرة',
          text: 'عملية استخراج الصوت وتجهيز الإطارات تعتمد على قدرات جهازك، لن تستغرق هذه العملية سوى لحظات بسيطة.',
          icon: 'info',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 5000,
          timerProgressBar: true,
          background: document.documentElement.classList.contains('dark') ? '#1a1a1a' : '#fff',
          color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
        });
        sessionStorage.setItem('svu_notice_shown', 'true');
      }

      try {
        let buffer;
        const lectureId = getLectureStorageId(fileInfo);
        await touchManagedKeys([lectureId]);
        if (fileInfo.localFile) {
          setLoadingText('قراءة الملف المحلي...');
          buffer = await fileInfo.localFile.arrayBuffer();
        } else {
          setLoadingText('جلب من السيرفر...');
          throw new Error("يتم دعم الملفات المحلية فقط في هذه النسخة.");
        }

        if (!isMounted) return;
        
        setLoadingText('تحليل الإطارات...');
        const parser = new LrecParser(buffer);
        parser.indexFile();
        
        if (parser.totalFrames === 0) {
            throw new Error("لا توجد إطارات فيديو قابلة للتحليل. الملف قد يكون معطوباً.");
        }
        
        parserRef.current = parser;
        rendererRef.current = new CanvasRenderer(canvasRef.current, parser.screenWidth, parser.screenHeight);
        cropperRef.current = new SmartCropper(parser.screenWidth, parser.screenHeight);
        cropBoundsRef.current = null;
        
        setDuration(parser.durationMs / 1000);

        if (parser.audioChunks.length > 0) {
          setLoadingText('تجهيز الصوت...');
          const cacheKey = getAudioCacheKey(lectureId);

          try {
            const cachedAudioBlob = await getManagedItem(cacheKey);
            if (cachedAudioBlob instanceof Blob) {
              fullAudioBlobPromiseRef.current = Promise.resolve(cachedAudioBlob);
              if (isMounted) {
                setAudioBlobSource(cachedAudioBlob);
              }
              setIsAudioProcessing(false);
            } else {
              const FAST_START_CHUNKS = 400;
              const needsBackgroundPass = parser.audioChunks.length > FAST_START_CHUNKS;
              const initialChunks = needsBackgroundPass
                ? parser.audioChunks.slice(0, FAST_START_CHUNKS)
                : parser.audioChunks;
              const initialDurationMs = needsBackgroundPass
                ? initialChunks[initialChunks.length - 1]?.timestamp ?? parser.durationMs
                : parser.durationMs;
              const initialBlob = await buildPlayableAudioBlob(initialChunks, initialDurationMs);

              if (isMounted) {
                setAudioBlobSource(initialBlob);
              }

              if (needsBackgroundPass) {
                setIsAudioProcessing(true);
                const fullAudioBlobPromise = (async () => {
                  const fullBlob = await buildPlayableAudioBlob(parser.audioChunks, parser.durationMs);
                  await setManagedItem(cacheKey, fullBlob);
                  await pruneStorageToLimit({ activeLectureId: lectureId });
                  return fullBlob;
                })();

                fullAudioBlobPromiseRef.current = fullAudioBlobPromise;

                setTimeout(async () => {
                  try {
                    const fullBlob = await fullAudioBlobPromise;

                    if (audioRef.current && isMounted) {
                      const currentPos = audioRef.current.currentTime;
                      const wasPlaying = !audioRef.current.paused;
                      setAudioBlobSource(fullBlob);
                      audioRef.current.currentTime = currentPos;
                      if (wasPlaying) audioRef.current.play().catch(() => {});
                    }

                    if (isMounted) setIsAudioProcessing(false);
                  } catch (err) {
                    console.error("فشل معالجة الصوت في الخلفية", err);
                    if (isMounted) setIsAudioProcessing(false);
                  }
                }, 100);
              } else {
                await setManagedItem(cacheKey, initialBlob);
                await pruneStorageToLimit({ activeLectureId: lectureId });
                fullAudioBlobPromiseRef.current = Promise.resolve(initialBlob);
                setIsAudioProcessing(false);
              }
            }
          } catch (e) {
            console.warn("فشل حفظ الصوت في الذاكرة", e);
            fullAudioBlobPromiseRef.current = null;
            setIsAudioProcessing(false);
          }
        }

        setLoading(false);
        renderUpToTime(0);

        setTimeout(async () => {
          if (canvasRef.current && isMounted) {
             const thumbBlob = await new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/jpeg', 0.5));
             await setManagedItem(getThumbnailCacheKey(lectureId), thumbBlob);
             await pruneStorageToLimit({ activeLectureId: lectureId });
          }
        }, 1000);

      } catch (err) {
        setLoadingText('خطأ: ' + err.message);
      }
    };

    if (fileInfo) initPlayer();

    return () => {
      isMounted = false;
      setCurrentFileMeta(null);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioElement) audioElement.pause();
      if (audioUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      audioBlobRef.current = null;
      fullAudioBlobPromiseRef.current = null;
    };
  }, [fileInfo, renderUpToTime, retryCount, setCurrentFileMeta, setDuration, setLoading]);

  const handleReload = async () => {
    const lectureId = getLectureStorageId(fileInfo);
    setLoadingText('جاري مسح الذاكرة المؤقتة...');
    await removeManagedItem(getAudioCacheKey(lectureId)).catch(() => {});
    await removeManagedItem(getThumbnailCacheKey(lectureId)).catch(() => {});
    audioBlobRef.current = null;
    fullAudioBlobPromiseRef.current = null;
    setRetryCount(prev => prev + 1);
  };

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().catch(() => setPlaying(false));
      requestAnimationFrame(syncVideoToAudio);
    } else {
      audioRef.current.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  }, [isPlaying, playbackRate, setPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    
    // The player forces LTR for the progress bar explicitly in the UI hierarchy
    // meaning the visual representation matches the clientX physical coordinates exactly.
    const newTime = pos * duration;
    if (audioRef.current) audioRef.current.currentTime = newTime;
    setTime(newTime);
    renderUpToTime(newTime * 1000);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const handleExport = async () => {
    if (!parserRef.current) return;
    
    const taskId = Date.now().toString();
    const controller = new AbortController();
    const title = fileInfo.title || fileInfo.name || 'SVU_Lecture';

    const { default: Exporter } = await import('../../core/Exporter');
    const crop = Exporter.getOptimalCrop(parserRef.current);
    const resolution = `${crop.width}x${crop.height}`;

    addExportTask({
      id: taskId,
      title: title,
      controller: controller,
      resolution: resolution
    });

    setExportToast(true);
    setTimeout(() => setExportToast(false), 4000);

    try {
      const audioSource = await resolveExportAudioSource();
      const finalUrl = await Exporter.exportToMp4(
        parserRef.current, 
        audioSource,
        (progress) => updateExportProgress(taskId, progress),
        controller.signal
      );
      completeExport(taskId, finalUrl);
    } catch (err) {
      if (err.message !== 'Export aborted by user') {
        failExport(taskId, err.message);
      }
    }
  };

  const currentBounds = cropBoundsRef.current;
  const dynamicAspect = currentBounds ? `${currentBounds.width} / ${currentBounds.height}` : '16 / 9';

  return (
    <div 
      ref={containerRef}
      className={`relative w-full bg-black rounded-xl md:rounded-2xl overflow-hidden shadow-2xl group flex flex-col justify-center transition-all duration-500 ${isFullscreen ? 'fixed inset-0 z-[100] rounded-none' : 'hover:shadow-primary/20'}`}
      style={{
        aspectRatio: isFullscreen ? 'auto' : dynamicAspect,
        maxHeight: isFullscreen ? '100dvh' : 'calc(100dvh - 160px)'
      }}
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      dir="ltr" // Keeping player layout LTR for standard video controls feel, translating texts only
    >
      <audio ref={audioRef} onEnded={() => setPlaying(false)} className="hidden" />
      
      <div className="absolute inset-0 flex items-center justify-center p-0 m-0 overflow-hidden bg-black pointer-events-none">
        <canvas ref={canvasRef} className={`w-full h-full object-${fitMode} transition-all duration-500 ease-in-out`} />
      </div>

      {isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md text-white transition-all duration-300">
          <Loader2 className="w-12 h-12 md:w-16 md:h-16 text-primary animate-spin" />
          <h2 className="mt-4 md:mt-6 text-lg md:text-xl font-bold tracking-tight text-center px-4" dir="auto">{loadingText}</h2>
          
          <div className="flex flex-col gap-3 mt-8 w-full max-w-xs px-6">
            <p className="text-xs md:text-sm text-white/60 text-center">جاري تجهيز تجربة المشاهدة الخاصة بك...</p>
            {loadingText.includes('خطأ') && (
              <button 
                onClick={handleReload}
                className="mt-2 px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-full font-bold transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
              >
                <div className="rotate-0 group-hover:rotate-180 transition-transform duration-500">
                   <Settings size={18} />
                </div>
                إعادة المحاولة
              </button>
            )}
          </div>
        </div>
      )}

      {isAudioProcessing && !isLoading && (
        <div className="absolute right-3 top-3 z-50 flex items-center gap-2 rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-md animate-pulse sm:right-4 sm:top-4 sm:text-xs">
           <Loader2 size={14} className="animate-spin text-primary" />
           جاري معالجة الصوت بالكامل...
        </div>
      )}

      {exportToast && (
        <div className="absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/30 bg-black/80 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-lg animate-in fade-in slide-in-from-top-4 sm:top-4 sm:text-sm" dir="rtl">
          <Download size={16} className="text-primary animate-bounce" />
          بدأ التصدير في الخلفية
        </div>
      )}

      <div className="absolute inset-0 z-10 cursor-pointer" onClick={togglePlay} />

      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-20 transition-all duration-300 ${!isPlaying && !isLoading ? 'opacity-100 scale-100' : 'opacity-0 scale-150'}`}>
         <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/20 backdrop-blur-md flex items-center justify-center border border-primary/30 shadow-lg shadow-primary/20">
            <Play fill="currentColor" size={32} className="text-primary ml-1 md:w-10 md:h-10" />
         </div>
      </div>

      {/* Controls - Kept LTR for UX consistency but translated */}
      <div className={`absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black via-black/60 to-transparent p-3 pt-12 transition-all duration-500 md:p-6 md:pt-20 ${showControls || !isPlaying ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        
        {/* Progress Bar */}
        <div className="w-full h-1.5 md:h-2 bg-white/20 hover:h-2.5 md:hover:h-3 rounded-full cursor-pointer mb-3 md:mb-6 relative transition-all group/progress" onClick={handleSeek}>
           <div className="absolute top-0 left-0 h-full bg-primary rounded-full shadow-[0_0_10px_rgba(var(--color-primary),0.5)]" style={{ width: `${(currentTime / duration) * 100}%` }} />
           <div className="absolute top-1/2 -mt-2 w-4 h-4 bg-white rounded-full scale-0 group-hover/progress:scale-100 transition-all shadow-xl border-2 border-primary" style={{ left: `calc(${(currentTime / duration) * 100}% - 8px)` }} />
        </div>

        <div className="flex flex-col gap-3 text-white/90 md:flex-row md:items-center md:justify-between md:gap-0">
          <div className="flex w-full flex-wrap items-center justify-between gap-3 md:w-auto md:gap-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <button onClick={togglePlay} className="hover:text-primary transition-all active:scale-90">
                {isPlaying ? <Pause fill="currentColor" size={24} className="md:w-7 md:h-7" /> : <Play fill="currentColor" size={24} className="md:w-7 md:h-7" />}
              </button>

              <button onClick={() => setVolume(volume === 0 ? 1 : 0)} className="flex items-center justify-center text-white/90 transition-colors hover:text-primary md:hidden">
                {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
               
              <div className="hidden md:flex items-center gap-3 group/volume">
                <button onClick={() => setVolume(volume === 0 ? 1 : 0)} className="hover:text-primary transition-colors">
                  {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 h-1 accent-primary bg-white/20 rounded-full appearance-none cursor-pointer" />
              </div>
            </div>

            <div className="whitespace-nowrap rounded-lg border border-white/5 bg-white/10 px-2 py-1 text-xs font-bold font-mono opacity-80 md:px-3 md:text-sm">
              {formatTime(currentTime)} <span className="mx-0.5 md:mx-1 text-white/30">/</span> {formatTime(duration)}
            </div>
          </div>

          <div className="scrollbar-hide flex w-full flex-wrap items-center justify-end gap-2 pb-1 md:w-auto md:gap-4 md:pb-0" dir="rtl">
            
            <button onClick={handleReload} title="إعادة معالجة المحاضرة" className="mr-auto shrink-0 transition-all hover:scale-110 hover:text-primary active:scale-90 md:mr-0">
               <RotateCcw size={20} className={`md:w-[22px] md:h-[22px] ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button onClick={() => {
                if (!document.fullscreenElement) { containerRef.current.requestFullscreen(); setFullscreen(true); }
                else { document.exitFullscreen(); setFullscreen(false); }
              }} className="hover:text-primary transition-all hover:scale-110 active:scale-90 ml-auto md:ml-0 shrink-0">
              <Maximize size={20} className="md:w-[22px] md:h-[22px]" />
            </button>

            <button onClick={handleExport} className="flex shrink-0 items-center gap-1 rounded-lg border border-primary/30 bg-primary/20 px-3 py-1.5 text-xs font-bold text-primary transition-all active:scale-95 hover:bg-primary/30 md:gap-2 md:rounded-xl md:px-4 md:py-2 md:text-sm">
              <Download size={14} className="md:w-[18px] md:h-[18px]" /> <span>تصدير MP4</span>
            </button>

            <div className="flex shrink-0 rounded-lg border border-white/5 bg-white/10 p-0.5 md:rounded-xl md:p-1" dir="ltr">
                {[1, 1.5, 2].map(rate => (
                  <button key={rate} onClick={() => setInternalPlaybackRate(rate)} className={`px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg text-[10px] md:text-xs font-bold transition-all ${playbackRate === rate ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'hover:bg-white/20'}`}>
                    {rate}x
                  </button>
                ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomPlayer;
