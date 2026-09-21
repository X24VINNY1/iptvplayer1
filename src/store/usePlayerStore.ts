import { create } from 'zustand';

export type AntiLagMode = 'smooth' | 'balanced' | 'low-latency';

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

  // Anti-Lag & Buffer Health
  antiLagEnabled: boolean;
  antiLagMode: AntiLagMode;
  bufferLength: number; // Seconds buffered ahead
  lagRecoveries: number; // Count of auto-stalls bypassed

  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setIsFullscreen: (fullscreen: boolean) => void;
  setIsPiP: (pip: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  setAntiLagEnabled: (enabled: boolean) => void;
  setAntiLagMode: (mode: AntiLagMode) => void;
  setBufferLength: (secs: number) => void;
  incrementLagRecovery: () => void;
  
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
  antiLagEnabled: true,
  antiLagMode: 'smooth' as AntiLagMode,
  bufferLength: 0,
  lagRecoveries: 0,
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

  setAntiLagEnabled: (antiLagEnabled) => set({ antiLagEnabled }),
  setAntiLagMode: (antiLagMode) => set({ antiLagMode }),
  setBufferLength: (bufferLength) => set({ bufferLength }),
  incrementLagRecovery: () => set((state) => ({ lagRecoveries: state.lagRecoveries + 1 })),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  incrementReconnect: () => set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),
  resetReconnect: () => set({ reconnectAttempts: 0 }),
  reset: () => set((state) => ({
    ...initialState,
    antiLagEnabled: state.antiLagEnabled,
    antiLagMode: state.antiLagMode
  })),
}));
