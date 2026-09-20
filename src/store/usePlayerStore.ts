import { create } from 'zustand';

interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  isPiP: boolean;
  isLoading: boolean;
  error: string | null;
  reconnectAttempts: number;

  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setIsFullscreen: (fullscreen: boolean) => void;
  setIsPiP: (pip: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  toggleMute: () => void;
  incrementReconnect: () => void;
  resetReconnect: () => void;
  reset: () => void;
}

const initialState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  isFullscreen: false,
  isPiP: false,
  isLoading: true,
  error: null,
  reconnectAttempts: 0,
};

export const usePlayerStore = create<PlayerState>((set) => ({
  ...initialState,

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
  setIsPiP: (isPiP) => set({ isPiP }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  incrementReconnect: () => set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),
  resetReconnect: () => set({ reconnectAttempts: 0 }),
  reset: () => set(initialState),
}));
