import React, { useEffect, useState } from 'react';
import localforage from 'localforage';
import {
  AlertCircle,
  BookMarked,
  FolderOpen,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { fetchSvu } from '../../lib/svuApi';
import { showErrorDialog } from '../../lib/dialogs';
import { getManagedItem } from '../../lib/storageManager';
import { createSessionPlaceholder, resolveSessionTitles } from '../../core/sessionMetadata';

const getGradientFromString = (text) => {
  if (!text) return 'from-blue-600 to-cyan-500';
  const code = text.charCodeAt(0) + (text.charCodeAt(text.length - 1) || 0);
  const gradients = [
    'from-red-500 to-orange-500',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-indigo-500 to-sky-500',
    'from-orange-500 to-amber-500',
    'from-primary to-orange-500',
  ];
  return gradients[code % gradients.length];
};

const QuickStat = ({ label, value }) => (
  <div className="rounded-[1.2rem] border border-black/5 bg-white/75 px-4 py-3.5 dark:border-white/8 dark:bg-white/5 sm:rounded-[1.35rem] sm:px-5">
    <div className="text-[11px] font-black tracking-[0.14em] text-text-light-secondary dark:text-text-dark-secondary sm:text-xs">{label}</div>
    <div className="mt-2 text-base font-black text-text-light-primary dark:text-text-dark-primary sm:text-2xl" dir="auto">{value}</div>
  </div>
);

const ChannelRow = ({ subscription, onVideoSelect, refreshTrigger }) => {
  const term = useSettingsStore((state) => state.term);
  const program = useSettingsStore((state) => state.program);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadingVideoId, setLoadingVideoId] = useState(null);

  useEffect(() => {
    if (!term || !program) return;

    let cancelled = false;

    const fetchClassSessions = async (isRefresh = false) => {
      setLoading(true);
      setError('');

      try {
        const sessionsCacheKey = `svu_class_${subscription.classId}`;
        const enrichedCacheKey = `svu_enriched_${subscription.classId}`;
        let sessionPayload = null;
        let enrichedCache = [];

        if (!isRefresh) {
          sessionPayload = await localforage.getItem(sessionsCacheKey);
          enrichedCache = await localforage.getItem(enrichedCacheKey);
        }

        if (!sessionPayload) {
          const freshData = await fetchSvu('class', {
            term,
            program,
            course: subscription.courseId,
            tutor: subscription.tutorId,
            val: subscription.classId,
            courseId: subscription.courseId,
          });
          sessionPayload = { success: true, data: freshData };
          await localforage.setItem(sessionsCacheKey, sessionPayload);
        }

        if (!sessionPayload?.success) {
          throw new Error('تعذر تحميل جلسات هذه الشعبة.');
        }

        const cachedSessionsById = new Map(
          Array.isArray(enrichedCache)
            ? enrichedCache.map((item) => [item.id, item])
            : []
        );

        const initialSessions = sessionPayload.data.map((session, index) => {
          const placeholderTitle = createSessionPlaceholder(session, index);
          const cachedSession = cachedSessionsById.get(session.id);
          const { title, displayTitle } = resolveSessionTitles({
            session,
            index,
            title: cachedSession?.title || cachedSession?.displayTitle,
            fallbackTitle: placeholderTitle,
          });

          return {
            id: session.id,
            title,
            displayTitle,
            placeholderTitle,
            subject: subscription.courseName,
            teacher: subscription.tutorName,
            date: session.date,
            _rawSession: {
              ...session,
              term,
              program,
              course_id: subscription.courseId,
              tutor: subscription.tutorId,
              class_name: subscription.classId,
            },
          };
        });

        if (!cancelled) {
          setSessions(initialSessions);
          setLoading(false);
        }

        await localforage.setItem(enrichedCacheKey, initialSessions);

        const enrichedSessions = [...initialSessions];
        let hasChanges = false;
        const metadataResults = await Promise.allSettled(
          initialSessions.map(async (currentVideo, index) => {
            if (cancelled) return null;

            const linkCacheKey = `svu_links_${currentVideo.id}`;
            let linkPayload = null;

            if (!isRefresh) {
              linkPayload = await localforage.getItem(linkCacheKey);
            }

            if (!linkPayload) {
              const links = await fetchSvu('links', { session: JSON.stringify(currentVideo._rawSession) });
              linkPayload = { success: true, data: links };
              await localforage.setItem(linkCacheKey, linkPayload);
            }

            if (!linkPayload?.success || !linkPayload.data?.length) {
              return null;
            }

            const bestLink = linkPayload.data.find((item) => item.link.includes('.lrec')) || linkPayload.data[0];
            return {
              index,
              ...resolveSessionTitles({
                session: currentVideo._rawSession,
                index,
                title: bestLink.description,
                fallbackTitle: currentVideo.placeholderTitle,
              }),
            };
          })
        );

        metadataResults.forEach((result) => {
          if (result.status !== 'fulfilled' || !result.value) {
            if (result.status === 'rejected') {
              console.warn('Unable to enrich session metadata', result.reason);
            }
            return;
          }

          const { index, title, displayTitle } = result.value;
          const existingSession = enrichedSessions[index];
          if (
            existingSession &&
            (existingSession.title !== title || existingSession.displayTitle !== displayTitle)
          ) {
            enrichedSessions[index] = {
              ...existingSession,
              title,
              displayTitle,
            };
            hasChanges = true;
          }
        });

        if (!cancelled && hasChanges) {
          setSessions([...enrichedSessions]);
          await localforage.setItem(enrichedCacheKey, enrichedSessions);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message);
          setLoading(false);
        }
      }
    };

    fetchClassSessions(refreshTrigger > 0);

    return () => {
      cancelled = true;
    };
  }, [program, refreshTrigger, subscription, term]);

  const handleCardClick = async (video) => {
    setLoadingVideoId(video.id);

    try {
      const linkCacheKey = `svu_links_${video.id}`;
      let payload = await localforage.getItem(linkCacheKey);

      if (!payload) {
        const links = await fetchSvu('links', { session: JSON.stringify(video._rawSession) });
        payload = { success: true, data: links };
        await localforage.setItem(linkCacheKey, payload);
      }

      if (!payload?.data?.length) {
        throw new Error('لا توجد ملفات قابلة للتشغيل لهذه الجلسة.');
      }

      const bestLink = payload.data.find((item) => item.link.includes('.lrec')) || payload.data[0];
      const { title: finalTitle, displayTitle: finalDisplayTitle } = resolveSessionTitles({
        title: bestLink.description,
        fallbackTitle: video.placeholderTitle || video.displayTitle,
      });
      const cachedBlob = await getManagedItem(bestLink.filename);

      if (cachedBlob) {
        onVideoSelect({
          ...video,
          title: finalTitle,
          displayTitle: finalDisplayTitle,
          filename: bestLink.filename,
          localFile: new File([cachedBlob], bestLink.filename),
        });
        return;
      }

      onVideoSelect({
        ...video,
        title: finalTitle,
        displayTitle: finalDisplayTitle,
        _proxyDownloadUrl: bestLink.link,
        filename: bestLink.filename,
      });
    } catch (requestError) {
      await showErrorDialog({
        title: 'فشل تحميل رابط الجلسة',
        text: requestError.message,
      });
    } finally {
      setLoadingVideoId(null);
    }
  };

  if (loading && sessions.length === 0) {
    return (
      <div className="mb-10 animate-pulse">
        <div className="mb-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-black/5 dark:bg-white/5" />
          <div className="space-y-2">
            <div className="h-5 w-48 rounded-md bg-black/5 dark:bg-white/5" />
            <div className="h-3 w-32 rounded-md bg-black/5 dark:bg-white/5" />
          </div>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map((item) => (
            <div key={item} className="w-72 shrink-0 space-y-3">
              <div className="aspect-video rounded-3xl bg-black/5 dark:bg-white/5" />
              <div className="h-4 w-full rounded-md bg-black/5 dark:bg-white/5" />
              <div className="h-3 w-2/3 rounded-md bg-black/5 dark:bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && sessions.length === 0) {
    return (
      <div className="mb-8 rounded-[1.75rem] border border-red-500/20 bg-red-500/8 p-5">
        <div className="flex items-start gap-3 text-red-600 dark:text-red-400">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-black">{subscription.courseName}</div>
            <div className="mt-1 text-sm font-medium">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) return null;

  const gradient = getGradientFromString(subscription.courseName);

  return (
    <div className="mb-10 sm:mb-12">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-lg font-black text-white shadow-lg sm:h-12 sm:w-12 sm:text-xl`}>
            {(subscription.tutorName || 'S').charAt(0)}
          </div>
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-black sm:text-2xl" dir="auto">
              {subscription.courseName}
              <Sparkles size={16} className="text-primary" />
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-text-light-secondary dark:text-text-dark-secondary">
              <span className="rounded-full bg-black/5 px-3 py-1 dark:bg-white/10">
                د. <span dir="auto">{subscription.tutorName}</span>
              </span>
              <span dir="auto">{subscription.className}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 pb-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {sessions.map((video) => (
          <button
            key={video.id}
            onClick={() => handleCardClick(video)}
            className="group w-full text-start"
          >
            <div className={`relative mb-3 aspect-video overflow-hidden rounded-[1.35rem] bg-gradient-to-br ${gradient} ring-1 ring-black/5 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-primary/20 sm:rounded-[1.75rem] dark:ring-white/5`}>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }} />
              <div className="absolute inset-0 bg-black/0 transition-all duration-300 group-hover:bg-black/25" />
              <div className="absolute inset-0 flex items-center justify-center">
                {loadingVideoId === video.id ? (
                  <Loader2 className="h-9 w-9 animate-spin text-white sm:h-10 sm:w-10" />
                ) : (
                  <div className="flex h-11 w-11 scale-100 items-center justify-center rounded-full bg-primary/90 text-white opacity-100 transition-all duration-300 sm:h-14 sm:w-14 sm:scale-75 sm:opacity-0 sm:group-hover:scale-100 sm:group-hover:opacity-100">
                    <Play className="mr-[-2px] h-6 w-6 fill-current" />
                  </div>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent p-3 sm:p-4">
                <h3 className="line-clamp-2 text-base font-black leading-tight text-white sm:text-lg" dir="auto">{subscription.courseName}</h3>
              </div>
              <div className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-[10px] font-black text-white sm:text-[11px]" dir="ltr">{video.date}</div>
            </div>

            <h3 className="line-clamp-2 pr-1 text-sm font-black leading-6 transition-colors group-hover:text-primary sm:text-base" dir="auto">
              {video.displayTitle || video.title}
            </h3>
            <p className="mt-1 text-xs font-medium text-text-light-secondary dark:text-text-dark-secondary">جلسة متاحة الآن</p>
          </button>
        ))}
      </div>
    </div>
  );
};

const HomeFeed = ({ onVideoSelect, onViewChange }) => {
  const term = useSettingsStore((state) => state.term);
  const program = useSettingsStore((state) => state.program);
  const subscriptions = useSettingsStore((state) => state.subscriptions);
  const isHydrated = useSettingsStore((state) => state.isHydrated);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadOfflineCount = async () => {
      if (typeof localforage.ready === 'function') await localforage.ready();
      const keys = await localforage.keys();
      if (!cancelled) {
        setOfflineCount(keys.filter((item) => item.endsWith('.lrec')).length);
      }
    };

    loadOfflineCount();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger((current) => current + 1);
    window.setTimeout(() => setIsRefreshing(false), 1800);
  };

  if (!isHydrated) {
    return (
      <div className="glass-panel rounded-[2rem] p-8 text-center text-sm font-bold text-text-light-secondary dark:text-text-dark-secondary">
        جاري تجهيز الصفحة الرئيسية...
      </div>
    );
  }

  if (!term || !program) {
    return (
      <div className="glass-panel rounded-[2rem] p-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-10 w-10" />
        </div>
        <h2 className="mt-6 text-3xl font-black">ابدأ من الإعدادات</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-7 text-text-light-secondary dark:text-text-dark-secondary">
          حدد الفصل الدراسي والبرنامج من نافذة التهيئة حتى يتمكن الموقع من جلب جلساتك وعرضها هنا بشكل تلقائي.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 sm:gap-6">
      <section className="glass-panel relative overflow-hidden rounded-[1.5rem] p-5 sm:rounded-[2rem] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(234,51,35,0.10),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(28,61,90,0.10),_transparent_32%)]" />
        <div className="relative z-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-[10px] font-black tracking-[0.18em] text-primary sm:px-4 sm:text-xs">
                <BookMarked size={14} />
                لوحة محاضراتك
              </div>
              <h1 className="mt-4 text-2xl font-black leading-tight text-text-light-primary dark:text-text-dark-primary sm:mt-5 sm:text-4xl">
                تحكم أوضح وأخف بين موادك وجلساتك.
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-text-light-secondary dark:text-text-dark-secondary sm:mt-4 sm:text-base">
                راجع المواد المشتركة، شغّل آخر جلسة بسرعة، أو انتقل إلى إدارة المواد والاستكشاف بدون ازدحام بصري.
              </p>
            </div>

            <div className="grid w-full gap-3 min-[520px]:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap">
              <button
                onClick={() => onViewChange?.('classes')}
                className="w-full rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-[0_14px_28px_rgba(234,51,35,0.18)] transition-colors hover:bg-primary-hover lg:w-auto"
              >
                إدارة المواد
              </button>
              <button
                onClick={() => onViewChange?.('explore')}
                className="glass-button w-full rounded-2xl px-5 py-3 text-sm font-black text-text-light-primary dark:text-text-dark-primary lg:w-auto"
              >
                استكشاف الملفات
              </button>
              <button
                onClick={handleRefresh}
                className="glass-button flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-text-light-primary dark:text-text-dark-primary sm:col-span-2 lg:w-auto"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                تحديث
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 min-[520px]:grid-cols-3 sm:mt-8 sm:gap-4">
            <QuickStat label="الفصل والبرنامج" value={`${term} • ${program}`} />
            <QuickStat label="المواد المشتركة" value={subscriptions.length} />
            <QuickStat label="المحاضرات المحفوظة" value={offlineCount} />
          </div>
        </div>
      </section>

      {subscriptions.length === 0 ? (
        <div className="glass-panel flex min-h-[32vh] flex-col items-center justify-center rounded-[1.5rem] p-5 text-center sm:min-h-[40vh] sm:rounded-[2rem] sm:p-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FolderOpen className="h-10 w-10" />
          </div>
          <h2 className="mt-5 text-xl font-black sm:mt-6 sm:text-2xl">قائمتك فارغة حاليًا</h2>
          <p className="mt-3 max-w-xl text-sm font-medium leading-7 text-text-light-secondary dark:text-text-dark-secondary">
            أضف المواد من صفحة "موادي" ليبدأ الموقع بتجميع أحدث الجلسات لكل مادة في مكان واحد.
          </p>
          <button
            onClick={() => onViewChange?.('classes')}
            className="mt-8 rounded-2xl bg-primary px-8 py-4 text-sm font-black text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-hover"
          >
            الانتقال إلى إدارة المواد
          </button>
        </div>
      ) : (
        <>
          <div className="flex justify-stretch sm:justify-end">
            <button
              onClick={handleRefresh}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-primary/10 px-4 py-3 text-sm font-black text-primary transition-colors hover:bg-primary/15 sm:w-auto ${
                isRefreshing ? 'pointer-events-none opacity-70' : ''
              }`}
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              تحديث كل الصفوف
            </button>
          </div>

          {subscriptions.map((subscription) => (
            <ChannelRow
              key={subscription.classId}
              subscription={subscription}
              onVideoSelect={onVideoSelect}
              refreshTrigger={refreshTrigger}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default HomeFeed;
