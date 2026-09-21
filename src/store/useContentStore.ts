import { create } from 'zustand';
import { LiveStream, VodStream, Series, Category, M3UChannel } from '@/types';
import { XtreamAPI } from '@/api/xtream';
import { m3uChannelsToLiveStreams, m3uChannelsToCategories } from '@/api/m3u-parser';

interface ContentState {
  liveCategories: Category[];
  liveStreams: LiveStream[];
  vodCategories: Category[];
  vodStreams: VodStream[];
  seriesCategories: Category[];
  seriesList: Series[];

  isSyncing: boolean;
  syncStep: string;
  syncProgress: number; // 0 - 100
  syncCounts: { live: number; vod: number; series: number };
  isLoaded: boolean;
  syncError: string | null;

  syncAll: (
    api: XtreamAPI | null,
    connectionType: 'xtream' | 'm3u',
    m3uChannels?: M3UChannel[]
  ) => Promise<void>;
  clear: () => void;
}

export const useContentStore = create<ContentState>((set, get) => ({
  liveCategories: [],
  liveStreams: [],
  vodCategories: [],
  vodStreams: [],
  seriesCategories: [],
  seriesList: [],

  isSyncing: false,
  syncStep: '',
  syncProgress: 0,
  syncCounts: { live: 0, vod: 0, series: 0 },
  isLoaded: false,
  syncError: null,

  syncAll: async (api, connectionType, m3uChannels = []) => {
    set({
      isSyncing: true,
      syncProgress: 10,
      syncStep: 'Connecting to service...',
      syncError: null
    });

    try {
      if (connectionType === 'm3u') {
        set({ syncStep: 'Parsing M3U live channels...', syncProgress: 40 });
        const categories = m3uChannelsToCategories(m3uChannels);
        const streams = m3uChannelsToLiveStreams(m3uChannels);

        set({
          liveCategories: categories,
          liveStreams: streams,
          vodCategories: [],
          vodStreams: [],
          seriesCategories: [],
          seriesList: [],
          syncCounts: { live: streams.length, vod: 0, series: 0 },
          syncProgress: 100,
          syncStep: 'Complete!',
          isLoaded: true,
          isSyncing: false
        });
        return;
      }

      if (!api) {
        throw new Error('API client not initialized');
      }

      // Step 1: Live TV
      set({ syncStep: 'Loading Live TV categories & channels...', syncProgress: 25 });
      const [liveCats, liveStreams] = await Promise.all([
        api.getLiveCategories().catch((e) => {
          console.warn('Failed to load live categories', e);
          return [] as Category[];
        }),
        api.getLiveStreams().catch((e) => {
          console.warn('Failed to load live streams', e);
          return [] as LiveStream[];
        })
      ]);

      set({
        liveCategories: liveCats,
        liveStreams: liveStreams,
        syncCounts: { live: liveStreams.length, vod: 0, series: 0 },
        syncProgress: 55,
        syncStep: 'Loading Movies / VOD catalog...'
      });

      // Step 2: Movies (VOD)
      const [vodCats, vodStreams] = await Promise.all([
        api.getVodCategories().catch((e) => {
          console.warn('Failed to load vod categories', e);
          return [] as Category[];
        }),
        api.getVodStreams().catch((e) => {
          console.warn('Failed to load vod streams', e);
          return [] as VodStream[];
        })
      ]);

      set({
        vodCategories: vodCats,
        vodStreams: vodStreams,
        syncCounts: { live: liveStreams.length, vod: vodStreams.length, series: 0 },
        syncProgress: 80,
        syncStep: 'Loading TV Series catalog...'
      });

      // Step 3: TV Series
      const [seriesCats, seriesList] = await Promise.all([
        api.getSeriesCategories().catch((e) => {
          console.warn('Failed to load series categories', e);
          return [] as Category[];
        }),
        api.getSeries().catch((e) => {
          console.warn('Failed to load series list', e);
          return [] as Series[];
        })
      ]);

      set({
        seriesCategories: seriesCats,
        seriesList: seriesList,
        syncCounts: {
          live: liveStreams.length,
          vod: vodStreams.length,
          series: seriesList.length
        },
        syncProgress: 100,
        syncStep: 'All content ready!',
        isLoaded: true,
        isSyncing: false
      });
    } catch (err: any) {
      console.error('Initial sync error:', err);
      set({
        syncError: err?.message || 'Failed to load content',
        isSyncing: false
      });
      throw err;
    }
  },

  clear: () =>
    set({
      liveCategories: [],
      liveStreams: [],
      vodCategories: [],
      vodStreams: [],
      seriesCategories: [],
      seriesList: [],
      isSyncing: false,
      syncStep: '',
      syncProgress: 0,
      syncCounts: { live: 0, vod: 0, series: 0 },
      isLoaded: false,
      syncError: null
    })
}));
