import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Play, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import localforage from 'localforage';

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

const ChannelRow = ({ subscription, onVideoSelect, onViewChange, refreshTrigger }) => {
  const { term, program } = useSettingsStore();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingVideoId, setLoadingVideoId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchClassSessions = async (isRefresh = false) => {
      try {
        if (!isMounted) return;
        setLoading(true);
        setError(null);
        
        const sessionsCacheKey = `svu_class_${subscription.classId}`;
        const enrichedCacheKey = `svu_enriched_${subscription.classId}`;
        
        let data = null;
        if (!isRefresh) {
            data = await localforage.getItem(sessionsCacheKey);
        }

        if (!data) {
            const res = await fetch(`/api/svu/class?term=${term}&program=${program}&course=${subscription.courseId}&tutor=${subscription.tutorId}&val=${subscription.classId}&courseId=${subscription.courseId}`);
            data = await res.json();
            if (data.success) {
                await localforage.setItem(sessionsCacheKey, data);
            }
        }

        if (!data || !data.success) throw new Error(data?.error || "Failed to load class sessions");
        if (!isMounted) return;

        const initialSessions = data.data.map(s => ({
          id: s.id,
          title: `جلسة ${s.order}`, 
          displayTitle: `جلسة ${s.order}`,
          subject: subscription.courseName,
          teacher: subscription.tutorName,
          date: s.date,
          _rawSession: {
            ...s,
            term: term,
            program: program,
            course_id: subscription.courseId,
            tutor: subscription.tutorId,
            class_name: subscription.classId
          }
        }));

        if (!isRefresh) {
            const enriched = await localforage.getItem(enrichedCacheKey);
            // Verify enriched cache matches the length of initial to not miss new sessions
            if (enriched && enriched.length === initialSessions.length) {
                setSessions(enriched);
                setLoading(false);
                return;
            }
        }
        
        setSessions(initialSessions);
        setLoading(false);

        // Fetch real names from links in background sequentially or in parallel safely
        const updatedSessions = [...initialSessions];
        let hasChanges = false;
        
        for (let i = 0; i < initialSessions.length; i++) {
          if (!isMounted) return;
          const video = initialSessions[i];
          try {
            const encoded = encodeURIComponent(JSON.stringify(video._rawSession));
            const linkCacheKey = `svu_links_${video.id}`;
            let linkData = null;
            
            if (!isRefresh) {
                linkData = await localforage.getItem(linkCacheKey);
            }
            
            if (!linkData) {
                const linkRes = await fetch(`/api/svu/links?session=${encoded}`);
                linkData = await linkRes.json();
                if (linkData.success) {
                    await localforage.setItem(linkCacheKey, linkData);
                }
            }
            
            if (linkData && linkData.success && linkData.data && linkData.data.length > 0) {
              const bestLink = linkData.data.find(l => l.link.includes('.lrec')) || linkData.data[0];
              const realTitle = bestLink.description || `Lecture ${video._rawSession.order}`;
              
              if (updatedSessions[i].title !== realTitle) {
                  updatedSessions[i] = { ...updatedSessions[i], displayTitle: realTitle, title: realTitle };
                  hasChanges = true;
                  setSessions([...updatedSessions]);
              }
            }
          } catch (e) {
              console.warn("Failed to fetch link metadata for video background cache", e);
          }
        }

        if (hasChanges && isMounted) {
           await localforage.setItem(enrichedCacheKey, updatedSessions);
        }

      } catch (err) {
        if (isMounted) {
           setError(err.message);
           setLoading(false);
        }
      }
    };
    
    // Convert generic 0,1 counter to boolean refresh flag
    const isRefresh = refreshTrigger > 0;
    fetchClassSessions(isRefresh);

    return () => { isMounted = false; };
  }, [subscription, term, program, refreshTrigger]);

  const handleCardClick = async (video) => {
    try {
      setLoadingVideoId(video.id);
      const linkCacheKey = `svu_links_${video.id}`;
      let data = await localforage.getItem(linkCacheKey);
      
      if (!data) {
          const encoded = encodeURIComponent(JSON.stringify(video._rawSession));
          const res = await fetch(`/api/svu/links?session=${encoded}`);
          data = await res.json();
          if (data.success) {
             await localforage.setItem(linkCacheKey, data);
          } else {
             throw new Error(data.error);
          }
      }

      if (data && data.data && data.data.length > 0) {
        const link = data.data.find(l => l.link.includes('.lrec')) || data.data[0];
        const finalTitle = link.description || video.displayTitle;
        
        const cachedBlob = await localforage.getItem(link.filename);
        if (cachedBlob) {
           onVideoSelect({
            ...video,
            title: finalTitle,
            filename: link.filename,
            localFile: new File([cachedBlob], link.filename)
          });
          return;
        }

        onVideoSelect({
          ...video,
          title: finalTitle,
          _proxyDownloadUrl: link.link, 
          filename: link.filename
        });
      }
    } catch(err) {
      console.error(err);
      alert("Failed to load session links: " + err.message);
    } finally {
      setLoadingVideoId(null);
    }
  };

  if (loading && sessions.length === 0) return (
    <div className="mb-10 w-full animate-pulse">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5" />
        <div className="space-y-2">
           <div className="h-5 w-48 bg-black/5 dark:bg-white/5 rounded-md" />
           <div className="h-3 w-32 bg-black/5 dark:bg-white/5 rounded-md" />
        </div>
      </div>
      <div className="flex gap-4 overflow-hidden">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="w-72 shrink-0 space-y-3">
             <div className="w-full aspect-video bg-black/5 dark:bg-white/5 rounded-2xl" />
             <div className="h-4 w-full bg-black/5 dark:bg-white/5 rounded-md" />
             <div className="h-3 w-2/3 bg-black/5 dark:bg-white/5 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );

  if (error && sessions.length === 0) return null; // Silently fail or show minimal error
  if (sessions.length === 0) return null;

  const gradient = getGradientFromString(subscription.courseName);

  return (
    <div className="mb-12 w-full relative group/row">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-xl uppercase shadow-lg border border-white/20 shrink-0 transform transition-transform group-hover/row:scale-105`}>
            {subscription.tutorName.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
              {subscription.courseName}
              <Sparkles size={16} className="text-primary hidden sm:block opacity-0 group-hover/row:opacity-100 transition-opacity" />
            </h2>
            <div className="text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary flex items-center gap-2 mt-0.5">
              <span className="bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md">د. {subscription.tutorName}</span>
              <span className="opacity-50">&bull;</span>
              <span>{subscription.className}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 scrollbar-hide snap-x px-1 -mx-1">
        {sessions.map((video, idx) => (
          <div 
            key={video.id} 
            onClick={() => handleCardClick(video)}
            className="w-64 sm:w-72 shrink-0 group cursor-pointer snap-start"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div className={`w-full aspect-video rounded-2xl bg-gradient-to-br ${gradient} overflow-hidden shadow-md group-hover:shadow-xl group-hover:shadow-primary/20 transition-all duration-300 ring-1 ring-black/5 dark:ring-white/5 relative mb-3`}>
              
              <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
              
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all duration-300">
                 {loadingVideoId === video.id ? (
                    <Loader2 className="w-10 h-10 text-white animate-spin drop-shadow-lg" />
                 ) : (
                    <div className="w-14 h-14 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300 shadow-xl shadow-primary/30">
                       <Play className="w-6 h-6 text-white ml-1 fill-current" />
                    </div>
                 )}
              </div>
              
              <div className="absolute inset-0 p-4 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none">
                 <h3 className="text-lg font-bold text-white line-clamp-2 leading-tight drop-shadow-md">
                    {subscription.courseName}
                 </h3>
              </div>

              <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-black rounded-md border border-white/10 tracking-wider">
                {video.date}
              </div>
            </div>
            
            <h3 className="font-bold text-sm sm:text-base line-clamp-2 leading-tight mb-1 group-hover:text-primary transition-colors pr-2">
              {video.title.split(' - ')[1] || video.title}
            </h3>
            <p className="text-xs sm:text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
              Lecture Session
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const HomeFeed = ({ onVideoSelect, onViewChange }) => {
  const subscriptions = useSettingsStore(state => state.subscriptions);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
    
    // Stop the spinning animation after roughly 2 seconds
    setTimeout(() => {
        setIsRefreshing(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-2 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
      
      {subscriptions.length > 0 && (
         <div className="flex justify-end mb-4 px-2">
            <button 
                onClick={handleRefresh} 
                className={`flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-bold transition-all active:scale-95 ${isRefreshing ? 'opacity-80 pointer-events-none' : ''}`}
            >
               <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
               تحديث البيانات
            </button>
         </div>
      )}

      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center glass-panel rounded-3xl m-4 p-8">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-black mb-3">قائمتك فارغة</h2>
          <p className="text-text-light-secondary dark:text-text-dark-secondary max-w-md font-medium mb-8">
            اذهب إلى "موادي" للاشتراك في المواد. ستظهر المحاضرات الجديدة هنا تلقائياً وبشكل منظم.
          </p>
          <button 
            onClick={() => onViewChange && onViewChange('classes')}
            className="px-8 py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-lg shadow-primary/30 transition-all active:scale-95"
          >
            إدارة المواد
          </button>
        </div>
      ) : (
        subscriptions.map(sub => (
          <ChannelRow 
            key={sub.classId} 
            subscription={sub} 
            onVideoSelect={onVideoSelect} 
            refreshTrigger={refreshTrigger}
          />
        ))
      )}
    </div>
  );
};

export default HomeFeed;
