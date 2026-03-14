import { create } from 'zustand';

/**
 * Manages the Video Player state:
 * - Playback status (playing, paused)
 * - Current Time / Duration
 * - Loaded LREC File reference
 * - Volume / Fullscreen state
 */
export const usePlayerStore = create((set) => ({
  // Playback
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  playbackRate: 1,
  isFullscreen: false,
  
  // File Context
  currentLrecBuffer: null,
  currentFileMeta: null,
  
  // Decoding / Audio state
  isLoading: false,
  audioUrl: null, // Blobl URl to transcoded MP3
  
  // Exporter state
  isExporting: false,
  exportProgress: 0,

  // Actions
  setPlaying: (playing) => set({ isPlaying: playing }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (vol) => set({ volume: vol }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setFullscreen: (val) => set({ isFullscreen: val }),
  
  loadFile: (buffer, meta) => set({ 
    currentLrecBuffer: buffer, 
    currentFileMeta: meta,
    currentTime: 0,
    isPlaying: false,
    audioUrl: null
  }),
  
  setAudioUrl: (url) => set({ audioUrl: url }),
  setLoading: (loading) => set({ isLoading: loading }),
  
  setExporting: (exporting, initialProgress = 0) => set({ 
    isExporting: exporting, 
    exportProgress: initialProgress 
  }),
  setExportProgress: (progress) => set({ exportProgress: progress }),
}));
