import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import localforage from 'localforage';

// Setup localforage as the storage engine for zustand
const lfStorage = {
  getItem: async (name) => {
    try {
      if (typeof localforage.ready === 'function') await localforage.ready();
      return await localforage.getItem(name);
    } catch (e) {
      console.warn("LocalForage getItem error:", e);
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      if (typeof localforage.ready === 'function') await localforage.ready();
      await localforage.setItem(name, value);
    } catch (e) {
       console.warn("LocalForage setItem error:", e);
    }
  },
  removeItem: async (name) => {
    try {
      if (typeof localforage.ready === 'function') await localforage.ready();
      await localforage.removeItem(name);
    } catch (e) {
       console.warn("LocalForage removeItem error:", e);
    }
  },
};

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // Global configuration
      term: '',
      program: '',
      
      // Array of subscribed classes
      // Shape: { courseId, courseName, tutorId, tutorName, classId, className }
      subscriptions: [],

      // Actions
      setTerm: (term) => set({ term }),
      setProgram: (program) => set({ program }),
      
      addSubscription: (sub) => set((state) => {
        // Prevent duplicate subscriptions to the exact same class
        const exists = state.subscriptions.some(s => s.classId === sub.classId);
        if (exists) return state;
        return { subscriptions: [...state.subscriptions, sub] };
      }),
      
      removeSubscription: (classId) => set((state) => ({
        subscriptions: state.subscriptions.filter(s => s.classId !== classId)
      })),
      
      clearAllSettings: () => set({ term: '', program: '', subscriptions: [] }),
    }),
    {
      name: 'svu-settings-storage', // unique name
      storage: createJSONStorage(() => lfStorage),
    }
  )
);
