import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, Download, Loader2, RotateCcw } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useExportStore } from '../../store/useExportStore';
import LrecParser from '../../core/LrecParser';
import CanvasRenderer from '../../core/CanvasRenderer';
import SmartCropper from '../../core/SmartCropper';
import AudioExtractor from '../../core/AudioExtractor';
import ffmpegManager from '../../core/FfmpegManager';
import { withRetry } from '../../core/utils';
import localforage from 'localforage';
import Swal from 'sweetalert2';

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
  
  const { 
    isPlaying, setPlaying, togglePlay, 
    currentTime, setTime, duration, setDuration,
    volume, setVolume, isFullscreen, setFullscreen,
    isLoading, setLoading
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

  const setAudioSource = (url) => {
    if (!audioRef.current) return;

    if (audioUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrlRef.current);
    }

    audioUrlRef.current = url;
    audioRef.current.src = url;
  };

  useEffect(() => {
    let isMounted = true;
    const audioElement = audioRef.current;
    
    const initPlayer = async () => {
      setLoading(true);
      
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
           const fileId = fileInfo.id || fileInfo.filename || fileInfo.name;
           const cacheKey = `audio_pcm_timed_v2_${fileId}`;
           
           try {
             const cachedAudioBlob = await localforage.getItem(cacheKey);
             if (cachedAudioBlob instanceof Blob && isMounted) {
               setAudioSource(URL.createObjectURL(cachedAudioBlob));
             } else {
               const buildPlayableAudio = async (chunks, targetDurationMs) => {
                 const trueSpeechWav = AudioExtractor.buildTrueSpeechWav(chunks);
                 const decodedPcmWav = await withRetry(
                   () => ffmpegManager.decodeTrueSpeechToPcmWav(trueSpeechWav),
                   3,
                   1000
                 );

                 return AudioExtractor.buildTimedPcmWav(chunks, decodedPcmWav, targetDurationMs) ?? decodedPcmWav;
               };

               const FAST_START_CHUNKS = 400;
               const needsBackgroundPass = parser.audioChunks.length > FAST_START_CHUNKS;
               const initialChunks = needsBackgroundPass
                 ? parser.audioChunks.slice(0, FAST_START_CHUNKS)
                 : parser.audioChunks;
               const initialDurationMs = needsBackgroundPass
                 ? initialChunks[initialChunks.length - 1]?.timestamp ?? parser.durationMs
                 : parser.durationMs;
               const initialPcmWav = await buildPlayableAudio(initialChunks, initialDurationMs);
               const initialBlob = new Blob([initialPcmWav.buffer], { type: 'audio/wav' });
               
               if (isMounted) {
                 setAudioSource(URL.createObjectURL(initialBlob));
               }

                if (needsBackgroundPass) {
                  setTimeout(async () => {
                  try {
                     const fullPcmWav = await buildPlayableAudio(parser.audioChunks, parser.durationMs);
                     const fullBlob = new Blob([fullPcmWav.buffer], { type: 'audio/wav' });
                     await localforage.setItem(cacheKey, fullBlob);

                   if (audioRef.current && isMounted) {
                     const currentPos = audioRef.current.currentTime;
                     const wasPlaying = !audioRef.current.paused;
                      setAudioSource(URL.createObjectURL(fullBlob));
                      audioRef.current.currentTime = currentPos;
                     if (wasPlaying) audioRef.current.play().catch(() => {});
                   }
                   if (isMounted) setIsAudioProcessing(false);
                 } catch (err) {
                   console.error("فشل معالجة الصوت في الخلفية", err);
                   if (isMounted) setIsAudioProcessing(false);
                  }
                  }, 100);
                  setIsAudioProcessing(true);
                } else {
                  await localforage.setItem(cacheKey, initialBlob);
                  setIsAudioProcessing(false);
                }
             }
           } catch (e) {
             console.warn("فشل حفظ الصوت في الذاكرة", e);
             setIsAudioProcessing(false);
           }
        }

        setLoading(false);
        renderUpToTime(0);

        setTimeout(async () => {
          if (canvasRef.current && isMounted) {
             const thumbBlob = await new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/jpeg', 0.5));
             const fileId = fileInfo.id || fileInfo.filename || fileInfo.name;
             await localforage.setItem(`thumb_${fileId}`, thumbBlob);
          }
        }, 1000);

      } catch (err) {
        setLoadingText('خطأ: ' + err.message);
      }
    };

    if (fileInfo) initPlayer();

    return () => {
      isMounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioElement) audioElement.pause();
      if (audioUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [fileInfo, retryCount]);

  const handleReload = async () => {
    const fileId = fileInfo.id || fileInfo.filename || fileInfo.name;
    setLoadingText('جاري مسح الذاكرة المؤقتة...');
    await localforage.removeItem(`audio_pcm_timed_v2_${fileId}`).catch(() => {});
    await localforage.removeItem(`thumb_${fileId}`).catch(() => {});
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
  }, [isPlaying, playbackRate]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  let lastFrameDrawn = -1;

  const syncVideoToAudio = () => {
    if (!audioRef.current || !parserRef.current || !isPlaying) return;
    const currentAudioTime = audioRef.current.currentTime;
    setTime(currentAudioTime);
    renderUpToTime(currentAudioTime * 1000);
    rafRef.current = requestAnimationFrame(syncVideoToAudio);
  };

  const renderUpToTime = (targetMs) => {
    const parser = parserRef.current;
    if (!parser) return;
    
    if (targetMs < (parser.frameIndex[lastFrameDrawn]?.timestamp || 0)) {
      rendererRef.current.clearScale();
      lastFrameDrawn = -1;
    }

    try {
        let frameDrew = false;
        let targetFrame = lastFrameDrawn;
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
        lastFrameDrawn = targetFrame;
    } catch (err) {
        console.error("خطأ في الرسم", err);
    }
  };

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
      const finalUrl = await Exporter.exportToMp4(
        parserRef.current, 
        audioRef.current?.src,
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
        <div className="absolute top-4 right-4 z-50 bg-black/60 backdrop-blur-md border border-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 animate-pulse">
           <Loader2 size={14} className="animate-spin text-primary" />
           جاري معالجة الصوت بالكامل...
        </div>
      )}

      {exportToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur-lg border border-primary/30 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4" dir="rtl">
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
      <div className={`absolute bottom-0 left-0 right-0 p-3 md:p-6 pt-12 md:pt-20 bg-gradient-to-t from-black via-black/60 to-transparent z-40 transition-all duration-500 ${showControls || !isPlaying ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        
        {/* Progress Bar */}
        <div className="w-full h-1.5 md:h-2 bg-white/20 hover:h-2.5 md:hover:h-3 rounded-full cursor-pointer mb-3 md:mb-6 relative transition-all group/progress" onClick={handleSeek}>
           <div className="absolute top-0 left-0 h-full bg-primary rounded-full shadow-[0_0_10px_rgba(var(--color-primary),0.5)]" style={{ width: `${(currentTime / duration) * 100}%` }} />
           <div className="absolute top-1/2 -mt-2 w-4 h-4 bg-white rounded-full scale-0 group-hover/progress:scale-100 transition-all shadow-xl border-2 border-primary" style={{ left: `calc(${(currentTime / duration) * 100}% - 8px)` }} />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between text-white/90 gap-3 md:gap-0">
          <div className="flex items-center justify-between w-full md:w-auto md:gap-6">
            <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="hover:text-primary transition-all active:scale-90">
                {isPlaying ? <Pause fill="currentColor" size={24} className="md:w-7 md:h-7" /> : <Play fill="currentColor" size={24} className="md:w-7 md:h-7" />}
              </button>
              
              <div className="hidden md:flex items-center gap-3 group/volume">
                <button onClick={() => setVolume(volume === 0 ? 1 : 0)} className="hover:text-primary transition-colors">
                  {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 h-1 accent-primary bg-white/20 rounded-full appearance-none cursor-pointer" />
              </div>
            </div>

            <div className="text-xs md:text-sm font-bold font-mono opacity-80 bg-white/10 px-2 md:px-3 py-1 rounded-lg border border-white/5 whitespace-nowrap">
              {formatTime(currentTime)} <span className="mx-0.5 md:mx-1 text-white/30">/</span> {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center justify-between w-full md:w-auto gap-2 md:gap-4 overflow-x-auto pb-1 md:pb-0 scrollbar-hide" dir="rtl">
            
            <button onClick={handleReload} title="إعادة معالجة المحاضرة" className="hover:text-primary transition-all hover:scale-110 active:scale-90 mr-auto md:mr-0 shrink-0">
               <RotateCcw size={20} className={`md:w-[22px] md:h-[22px] ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button onClick={() => {
                if (!document.fullscreenElement) { containerRef.current.requestFullscreen(); setFullscreen(true); }
                else { document.exitFullscreen(); setFullscreen(false); }
              }} className="hover:text-primary transition-all hover:scale-110 active:scale-90 ml-auto md:ml-0 shrink-0">
              <Maximize size={20} className="md:w-[22px] md:h-[22px]" />
            </button>

            <button onClick={handleExport} className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all active:scale-95 shrink-0">
              <Download size={14} className="md:w-[18px] md:h-[18px]" /> <span className="hidden sm:inline">تصدير MP4</span>
            </button>

            <div className="flex bg-white/10 p-0.5 md:p-1 rounded-lg md:rounded-xl border border-white/5 shrink-0" dir="ltr">
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
