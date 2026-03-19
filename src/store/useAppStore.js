import { create } from 'zustand';
import localforage from 'localforage';

/**
 * Manages global application state:
 * - Sidebar toggle
 * - Search query
 * - Fetched lectures data from API/Cloudflare
 * - Favorites (Saved in IndexedDB via localforage)
 * - History (Saved in IndexedDB)
 */
export const useAppStore = create((set, get) => ({
  // UI State
  isSidebarOpen: true,
  searchQuery: '',
  theme: 'dark', // 'dark' | 'light'
  
  // Data State
  lectures: [], 
  favorites: [], 
  history: {}, 
  
  // Actions
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setLectures: (data) => set({ lectures: data }),
  
  setTheme: (theme) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('svu_theme', theme);
    set({ theme });
  },

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(newTheme);
  },
  
  // Persistent Actions
  initPersistentData: async () => {
    try {
      if (typeof localforage.ready === 'function') await localforage.ready();
      const favs = await localforage.getItem('svu_favorites') || [];
      const hist = await localforage.getItem('svu_history') || {};
      const savedTheme = localStorage.getItem('svu_theme') || 'dark';
      
      // Apply theme correctly on boot
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(savedTheme);

      set({ favorites: favs, history: hist, theme: savedTheme });
    } catch (e) {
      console.error("LocalForage load error:", e);
    }
  },
  
  toggleFavorite: async (lectureId) => {
    const state = get();
    const newFavs = state.favorites.includes(lectureId)
      ? state.favorites.filter(id => id !== lectureId)
      : [...state.favorites, lectureId];
      
    set({ favorites: newFavs });
    try {
      if (typeof localforage.ready === 'function') await localforage.ready();
      await localforage.setItem('svu_favorites', newFavs);
    } catch (e) { console.error(e); }
  },
  
  updateHistory: async (lectureId, time) => {
    const state = get();
    const newHistory = { ...state.history, [lectureId]: { lastWatchedTime: time, timestamp: Date.now() } };
    set({ history: newHistory });
    try {
      if (typeof localforage.ready === 'function') await localforage.ready();
      await localforage.setItem('svu_history', newHistory);
    } catch (e) { console.error(e); }
  }
}));
