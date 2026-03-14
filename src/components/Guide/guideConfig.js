import {
  BookMarked,
  Compass,
  DownloadCloud,
  FolderOpen,
  Library,
  PlaySquare,
} from 'lucide-react';

export const GUIDE_ITEMS = [
  {
    id: 'guide-home',
    label: 'ابدأ',
    title: 'هذه هي لوحة البداية',
    description: 'ابدأ من هنا لتراجع موادك وأحدث الجلسات الجاهزة للتشغيل.',
    view: 'home',
    target: 'home-overview',
    icon: BookMarked,
  },
  {
    id: 'guide-classes',
    label: 'موادي',
    title: 'أضف المواد أولاً',
    description: 'اختر المادة والمدرس والشعبة ثم ثبّت المسار الذي تريد متابعته.',
    view: 'classes',
    target: 'classes-builder',
    icon: Library,
  },
  {
    id: 'guide-browser',
    label: 'تصفح الجامعة',
    title: 'ابحث مباشرة في قاعدة الجامعة',
    description: 'استخدم هذا القسم للوصول لأي جلسة حتى لو لم تظهر في الرئيسية.',
    view: 'explore',
    target: 'explore-browser',
    icon: Compass,
  },
  {
    id: 'guide-library',
    label: 'ملفاتك',
    title: 'هنا تجد المحاضرات المحلية',
    description: 'كل ملف تم تنزيله أو فتحه محلياً سيظهر هنا مع إمكانية الحذف أو التشغيل.',
    view: 'explore',
    target: 'explore-library',
    icon: FolderOpen,
  },
  {
    id: 'guide-watch',
    label: 'المشاهدة',
    title: 'هذا هو المشغل',
    description: 'من هنا تتحكم بالتشغيل، القفز، إعادة المعالجة، والتصدير.',
    view: 'watch',
    target: 'watch-player',
    icon: PlaySquare,
  },
  {
    id: 'guide-exports',
    label: 'التصدير',
    title: 'تابع عمليات التصدير',
    description: 'ستجد هنا كل المهام الجارية والمكتملة مع أزرار الإلغاء والتنزيل.',
    view: 'exports',
    target: 'exports-queue',
    icon: DownloadCloud,
  },
];

export const GUIDE_BY_ID = Object.fromEntries(GUIDE_ITEMS.map((item) => [item.id, item]));

export const DEFAULT_GUIDE_BY_VIEW = {
  home: 'guide-home',
  classes: 'guide-classes',
  explore: 'guide-browser',
  watch: 'guide-watch',
  exports: 'guide-exports',
};
