import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Category } from '@/types';
import { useAuthStore } from './useAuthStore';

interface CategoryVisibilityState {
  // Keyed by `${accountKey}_${type}` -> array of hidden category_ids
  hiddenCategories: Record<string, string[]>;

  hideCategory: (type: 'live' | 'vod' | 'series', categoryId: string) => void;
  unhideCategory: (type: 'live' | 'vod' | 'series', categoryId: string) => void;
  toggleCategory: (type: 'live' | 'vod' | 'series', categoryId: string) => void;
  hideAll: (type: 'live' | 'vod' | 'series', categoryIds: string[]) => void;
  showAll: (type: 'live' | 'vod' | 'series') => void;
  filterUsOnly: (type: 'live' | 'vod' | 'series', categories: Category[]) => void;
  isCategoryHidden: (type: 'live' | 'vod' | 'series', categoryId: string) => boolean;
  getVisibleCategories: (type: 'live' | 'vod' | 'series', categories: Category[]) => Category[];
}

const getAccountKey = () => {
  const { serverUrl, username, connectionType } = useAuthStore.getState();
  return `${connectionType}_${serverUrl}_${username}`.replace(/[^a-zA-Z0-9_]/g, '_');
};

// Regex to detect US / USA / EN / English categories in various common IPTV naming conventions:
// e.g. "US | GENERAL", "USA NEWS", "[US] HBO", "EN | MOVIES", "ENGLISH CINEMA", "UNITED STATES"
export const isUsOrEnCategory = (categoryName: string): boolean => {
  const name = categoryName.trim().toUpperCase();
  
  // Direct patterns
  if (
    name.includes('USA') ||
    name.includes('UNITED STATES') ||
    name.includes('ENGLISH')
  ) {
    return true;
  }

  // Word boundary or separator matches for "US" and "EN" (to avoid false positives like "MUSIC" or "FRENCH")
  const usEnPattern = /(^|[\s|\[\(\-_/])(US|USA|EN)([\s|\]\)\-_/]|$)/i;
  return usEnPattern.test(name);
};

export const useCategoryStore = create<CategoryVisibilityState>()(
  persist(
    (set, get) => ({
      hiddenCategories: {},

      hideCategory: (type, categoryId) => {
        const key = `${getAccountKey()}_${type}`;
        const current = get().hiddenCategories[key] || [];
        if (!current.includes(categoryId)) {
          set((state) => ({
            hiddenCategories: {
              ...state.hiddenCategories,
              [key]: [...current, categoryId]
            }
          }));
        }
      },

      unhideCategory: (type, categoryId) => {
        const key = `${getAccountKey()}_${type}`;
        const current = get().hiddenCategories[key] || [];
        set((state) => ({
          hiddenCategories: {
            ...state.hiddenCategories,
            [key]: current.filter((id) => id !== categoryId)
          }
        }));
      },

      toggleCategory: (type, categoryId) => {
        const key = `${getAccountKey()}_${type}`;
        const current = get().hiddenCategories[key] || [];
        if (current.includes(categoryId)) {
          get().unhideCategory(type, categoryId);
        } else {
          get().hideCategory(type, categoryId);
        }
      },

      hideAll: (type, categoryIds) => {
        const key = `${getAccountKey()}_${type}`;
        set((state) => ({
          hiddenCategories: {
            ...state.hiddenCategories,
            [key]: [...new Set(categoryIds)]
          }
        }));
      },

      showAll: (type) => {
        const key = `${getAccountKey()}_${type}`;
        set((state) => ({
          hiddenCategories: {
            ...state.hiddenCategories,
            [key]: []
          }
        }));
      },

      // Keep only categories matching US / USA / EN, hide everything else
      filterUsOnly: (type, categories) => {
        const key = `${getAccountKey()}_${type}`;
        const toHide: string[] = [];

        for (const cat of categories) {
          if (!isUsOrEnCategory(cat.category_name)) {
            toHide.push(cat.category_id);
          }
        }

        set((state) => ({
          hiddenCategories: {
            ...state.hiddenCategories,
            [key]: toHide
          }
        }));
      },

      isCategoryHidden: (type, categoryId) => {
        const key = `${getAccountKey()}_${type}`;
        const current = get().hiddenCategories[key] || [];
        return current.includes(categoryId);
      },

      getVisibleCategories: (type, categories) => {
        const key = `${getAccountKey()}_${type}`;
        const hidden = get().hiddenCategories[key] || [];
        if (hidden.length === 0) return categories;
        return categories.filter((c) => !hidden.includes(c.category_id));
      }
    }),
    {
      name: 'onyxstream-categories'
    }
  )
);
