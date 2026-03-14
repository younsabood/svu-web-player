import { create } from 'zustand';

export const useExportStore = create((set, get) => ({
  activeExports: [], // Array of export tasks: { id, title, progress, status: 'processing' | 'completed' | 'error', error: null, controller: AbortController, downloadUrl: null }
  
  addExportTask: (task) => set((state) => ({
    activeExports: [...state.activeExports, { 
      ...task, 
      progress: 0, 
      status: 'processing',
      resolution: task.resolution || 'Auto',
      quality: task.quality || 'High'
    }]
  })),

  updateExportProgress: (id, progress) => set((state) => ({
    activeExports: state.activeExports.map(task => 
      task.id === id ? { ...task, progress } : task
    )
  })),

  completeExport: (id, downloadUrl) => set((state) => ({
    activeExports: state.activeExports.map(task => 
      task.id === id ? { ...task, status: 'completed', progress: 100, downloadUrl } : task
    )
  })),

  failExport: (id, errorMsg) => set((state) => ({
    activeExports: state.activeExports.map(task => 
      task.id === id ? { ...task, status: 'error', error: errorMsg } : task
    )
  })),

  cancelExport: (id) => {
    const task = get().activeExports.find(t => t.id === id);
    if (task && task.controller) {
      task.controller.abort();
    }
    set((state) => ({
      activeExports: state.activeExports.filter(t => t.id !== id)
    }));
  },

  clearCompleted: () => set((state) => ({
    activeExports: state.activeExports.filter(t => t.status === 'processing')
  }))
}));