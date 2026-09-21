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

// Comprehensive pattern to detect | US |, | USA |, | EN |, [US], [USA], [EN], US |, USA |, EN |, etc.
export const isUsOrEn = (text: string | undefined | null): boolean => {
  if (!text) return false;
  const str = text.trim().toUpperCase();

  // Explicit IPTV pipes: | US |, | USA |, | EN |
  if (
    str.includes('| US |') ||
    str.includes('| USA |') ||
    str.includes('| EN |') ||
    str.includes('|US|') ||
    str.includes('|USA|') ||
    str.includes('|EN|')
  ) {
    return true;
  }

  // Bracket or parenthesis tags: [US], [USA], [EN], (US), (USA), (EN)
  if (
    str.includes('[US]') ||
    str.includes('[USA]') ||
    str.includes('[EN]') ||
    str.includes('(US)') ||
    str.includes('(USA)') ||
    str.includes('(EN)')
  ) {
    return true;
  }

  // Common prefix formats: "US |", "USA |", "EN |", "US -", "USA -", "EN -", "US:", "USA:", "EN:"
  if (
    str.startsWith('US |') ||
    str.startsWith('USA |') ||
    str.startsWith('EN |') ||
    str.startsWith('US|') ||
    str.startsWith('USA|') ||
    str.startsWith('EN|') ||
    str.startsWith('US -') ||
    str.startsWith('USA -') ||
    str.startsWith('EN -') ||
    str.startsWith('US:') ||
    str.startsWith('USA:') ||
    str.startsWith('EN:')
  ) {
    return true;
  }

  // Substrings containing USA, UNITED STATES, ENGLISH
  if (
    str.includes(' USA ') ||
    str.endsWith(' USA') ||
    str.startsWith('USA ') ||
    str.includes('UNITED STATES') ||
    str.includes('ENGLISH')
  ) {
    return true;
  }

  // Word boundary regex: \b(US|USA|EN)\b
  const regex = /(^|[\s|\[\(\-_/:])(US|USA|EN)([\s|\]\)\-_/:]|$)/i;
  return regex.test(str);
};

export const isUsOrEnCategory = isUsOrEn;

interface CategoryVisibilityState {
  hiddenCategories: Record<string, string[]>;
  usOnlyEnabled: boolean;

  setUsOnlyEnabled: (enabled: boolean) => void;
  toggleUsOnly: () => void;
  hideCategory: (type: 'live' | 'vod' | 'series', categoryId: string) => void;
  unhideCategory: (type: 'live' | 'vod' | 'series', categoryId: string) => void;
  toggleCategory: (type: 'live' | 'vod' | 'series', categoryId: string) => void;
  hideAll: (type: 'live' | 'vod' | 'series', categoryIds: string[]) => void;
  showAll: (type: 'live' | 'vod' | 'series') => void;
  filterUsOnly: (type: 'live' | 'vod' | 'series', categories: Category[]) => void;
  isCategoryHidden: (type: 'live' | 'vod' | 'series', categoryId: string) => boolean;
  getVisibleCategories: (type: 'live' | 'vod' | 'series', categories: Category[]) => Category[];
}

export const useCategoryStore = create<CategoryVisibilityState>()(
  persist(
    (set, get) => ({
      hiddenCategories: {},
      usOnlyEnabled: true, // Active by default for clean US / EN experience

      setUsOnlyEnabled: (usOnlyEnabled) => set({ usOnlyEnabled }),
      toggleUsOnly: () => set((state) => ({ usOnlyEnabled: !state.usOnlyEnabled })),

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
          if (!isUsOrEn(cat.category_name)) {
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
        const { usOnlyEnabled } = get();
        const key = `${getAccountKey()}_${type}`;
        const hidden = get().hiddenCategories[key] || [];

        let result = categories;
        if (hidden.length > 0) {
          result = result.filter((c) => !hidden.includes(c.category_id));
        }

        // When US-only mode is active (default), filter strictly to US / USA / EN categories
        if (usOnlyEnabled) {
          const usOnly = result.filter((c) => isUsOrEn(c.category_name));
          if (usOnly.length > 0) {
            return usOnly;
          }
        }

        return result;
      }
    }),
    {
      name: 'onyxstream-categories'
    }
  )
);
