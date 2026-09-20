import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { FavoriteItem } from '@/types';
import { useAuthStore } from './useAuthStore';

interface FavoritesState {
  favorites: Record<string, FavoriteItem[]>;
  toggleFavorite: (item: FavoriteItem) => void;
  isFavorite: (type: string, streamId: number) => boolean;
  getFavorites: () => FavoriteItem[];
}

const getAccountKey = () => {
  const { serverUrl, username } = useAuthStore.getState();
  return `${serverUrl}|${username}`;
};

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: {},
      
      toggleFavorite: (item) => {
        const key = getAccountKey();
        set((state) => {
          const currentFavorites = state.favorites[key] || [];
          const exists = currentFavorites.some(
            (f) => f.type === item.type && f.streamId === item.streamId
          );
          
          let newFavorites;
          if (exists) {
            newFavorites = currentFavorites.filter(
              (f) => !(f.type === item.type && f.streamId === item.streamId)
            );
          } else {
            newFavorites = [...currentFavorites, item];
          }
          
          return {
            favorites: {
              ...state.favorites,
              [key]: newFavorites
            }
          };
        });
      },
      
      isFavorite: (type, streamId) => {
        const key = getAccountKey();
        const currentFavorites = get().favorites[key] || [];
        return currentFavorites.some(
          (f) => f.type === type && f.streamId === streamId
        );
      },
      
      getFavorites: () => {
        const key = getAccountKey();
        return get().favorites[key] || [];
      }
    }),
    {
      name: 'onyxstream-favorites',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
