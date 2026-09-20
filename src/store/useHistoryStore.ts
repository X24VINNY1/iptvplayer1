import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { HistoryItem } from '@/types';
import { useAuthStore } from './useAuthStore';

interface HistoryState {
  history: Record<string, HistoryItem[]>;
  addToHistory: (item: Omit<HistoryItem, 'id' | 'watchedAt'>) => void;
  updateProgress: (streamId: number, progress: number, duration: number) => void;
  getHistory: (limit?: number) => HistoryItem[];
  getContinueWatching: () => HistoryItem[];
}

const getAccountKey = () => {
  const { serverUrl, username } = useAuthStore.getState();
  return `${serverUrl}|${username}`;
};

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      history: {},
      
      addToHistory: (item) => {
        const key = getAccountKey();
        set((state) => {
          const currentHistory = state.history[key] || [];
          const filteredHistory = currentHistory.filter(
            (h) => !(h.type === item.type && h.streamId === item.streamId)
          );
          
          const newItem: HistoryItem = {
            ...item,
            id: crypto.randomUUID(),
            watchedAt: Date.now(),
          };
          
          const newHistory = [newItem, ...filteredHistory].slice(0, 100);
          
          return {
            history: {
              ...state.history,
              [key]: newHistory
            }
          };
        });
      },
      
      updateProgress: (streamId, progress, duration) => {
        const key = getAccountKey();
        set((state) => {
          const currentHistory = state.history[key] || [];
          const updatedHistory = currentHistory.map((item) => {
            if (item.streamId === streamId) {
              return { ...item, progress, duration, watchedAt: Date.now() };
            }
            return item;
          });
          
          return {
            history: {
              ...state.history,
              [key]: updatedHistory
            }
          };
        });
      },
      
      getHistory: (limit) => {
        const key = getAccountKey();
        const hist = get().history[key] || [];
        return limit ? hist.slice(0, limit) : hist;
      },
      
      getContinueWatching: () => {
        const key = getAccountKey();
        const hist = get().history[key] || [];
        return hist
          .filter(h => h.progress && h.progress > 0 && h.progress < 0.95)
          .sort((a, b) => b.watchedAt - a.watchedAt);
      }
    }),
    {
      name: 'onyxstream-history',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
