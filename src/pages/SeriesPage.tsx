import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useContentStore } from '@/store/useContentStore';
import { useCategoryStore } from '@/store/useCategoryStore';
import { useXtreamAPI } from '@/hooks/useXtreamAPI';
import { useTVRemote } from '@/hooks/useTVRemote';
import CategoryFilter from '@/components/ui/CategoryFilter';
import SeriesCard from '@/components/cards/SeriesCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CategoryManagerModal from '@/components/ui/CategoryManagerModal';
import FavoriteButton from '@/components/ui/FavoriteButton';
import {
  Info,
  SlidersHorizontal,
  Sparkles,
  Tv,
  LayoutGrid,
  Play,
  Star,
  Layers,
  Search
} from 'lucide-react';
import { Series } from '@/types';

const SeriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { connectionType, m3uChannels } = useAuthStore();
  const api = useXtreamAPI();
  const { seriesCategories, seriesList, isLoaded, syncAll, isSyncing } = useContentStore();
  const { getVisibleCategories, isCategoryHidden, filterUsOnly } = useCategoryStore();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // OwnTV-inspired View Mode: 'cinematic' vs 'grid'
  const [viewMode, setViewMode] = useState<'cinematic' | 'grid'>('cinematic');
  const [focusedSeries, setFocusedSeries] = useState<Series | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useTVRemote();

  useEffect(() => {
    if (connectionType === 'm3u') return;

    if (!isLoaded && !isSyncing) {
      setDataLoading(true);
      syncAll(api, connectionType, m3uChannels)
        .catch((err) => {
          console.error('Failed to load Series data:', err);
          setFetchError(err?.message || 'Failed to load series');
        })
        .finally(() => {
          setDataLoading(false);
        });
    }
  }, [isLoaded, isSyncing, api, connectionType, m3uChannels, syncAll]);

  // Visible categories
  const visibleCategories = useMemo(() => {
    return getVisibleCategories('series', seriesCategories);
  }, [seriesCategories, getVisibleCategories]);

  // Filter series
  const filteredSeries = useMemo(() => {
    const hiddenSet = new Set(
      seriesCategories.filter((c) => isCategoryHidden('series', c.category_id)).map((c) => c.category_id)
    );

    let list = seriesList.filter((s) => !hiddenSet.has(s.category_id));

    if (selectedCategory !== null) {
      list = list.filter((s) => s.category_id === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }

    return list;
  }, [seriesList, seriesCategories, selectedCategory, searchQuery, isCategoryHidden]);

  // Default focused series
  useEffect(() => {
    if (!focusedSeries && filteredSeries.length > 0) {
      setFocusedSeries(filteredSeries[0]);
    } else if (focusedSeries && !filteredSeries.find((s) => s.series_id === focusedSeries.series_id)) {
      setFocusedSeries(filteredSeries[0] || null);
    }
  }, [filteredSeries, focusedSeries]);

  const handleSeriesClick = (series: Series) => {
    navigate(`/series/${series.series_id}`);
  };

  const handleQuickUsFilter = () => {
    filterUsOnly('series', seriesCategories);
  };

  if (connectionType === 'm3u') {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col items-center justify-center p-6 text-center">
        <Info className="w-16 h-16 text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Series Not Available</h2>
        <p className="text-gray-400 max-w-md">
          Your current connection is via M3U playlist. TV Shows & Series are fully supported with Xtream Codes connections.
        </p>
      </div>
    );
  }

  if (dataLoading || isSyncing) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading Series..." />
      </div>
    );
  }

  if (fetchError) {
    return <ErrorMessage message={fetchError} className="m-6" />;
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header & Filter Controls */}
      <div className="flex-none pt-4 px-6 pb-2 bg-gray-950/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              TV Shows / Series
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Showing {filteredSeries.length} series across {visibleCategories.length} categories
            </p>
          </div>

          <div data-tv-section="categories" className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-0.5">
              <button
                data-tv-focusable="true"
                onClick={() => setViewMode('cinematic')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all outline-none focus:ring-2 focus:ring-indigo-400 ${
                  viewMode === 'cinematic'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Cinematic Hero Backdrop Mode (OwnTV style)"
              >
                <Tv className="w-3.5 h-3.5" />
                Cinematic
              </button>
              <button
                data-tv-focusable="true"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all outline-none focus:ring-2 focus:ring-indigo-400 ${
                  viewMode === 'grid'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Standard Poster Grid"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Grid
              </button>
            </div>

            <button
              data-tv-focusable="true"
              onClick={handleQuickUsFilter}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <Sparkles className="w-3.5 h-3.5" />
              US / EN Only
            </button>

            <button
              data-tv-focusable="true"
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-medium border border-gray-700 transition-all outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              Organize
            </button>
          </div>
        </div>

        <CategoryFilter
          categories={visibleCategories}
          selectedId={selectedCategory}
          onSelect={setSelectedCategory}
        />
      </div>

      {/* Main View */}
      {viewMode === 'cinematic' ? (
        /* OwnTV Signature Cinematic Layout */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Hero Backdrop Banner */}
          {focusedSeries ? (
            <div className="relative flex-none h-72 sm:h-80 md:h-96 w-full overflow-hidden border-b border-gray-800/80">
              <div
                className="absolute inset-0 bg-cover bg-center filter blur-[1px] transform scale-105 transition-all duration-700 opacity-40"
                style={{
                  backgroundImage: `url(${focusedSeries.cover || ''})`,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/80 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-black/40" />

              {/* Foreground Hero Content */}
              <div className="relative h-full max-w-5xl p-6 sm:p-8 flex flex-col justify-end z-10 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-indigo-600/90 text-white text-[11px] font-bold rounded-md uppercase tracking-wider">
                    Series
                  </span>
                  {focusedSeries.rating && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-xs font-bold">
                      <Star className="w-3 h-3 fill-current" />
                      {parseFloat(focusedSeries.rating).toFixed(1)}
                    </span>
                  )}
                  {focusedSeries.releaseDate && (
                    <span className="px-2 py-0.5 bg-gray-800/80 text-gray-300 rounded text-xs">
                      {focusedSeries.releaseDate}
                    </span>
                  )}
                </div>

                <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight line-clamp-2 drop-shadow-md">
                  {focusedSeries.name}
                </h2>

                <p className="text-xs sm:text-sm text-gray-300 max-w-2xl line-clamp-2 drop-shadow">
                  {focusedSeries.plot || 'Multi-season TV series with full episode catalog and resume support.'}
                </p>

                <div data-tv-section="hero" className="flex items-center gap-3 pt-2">
                  <button
                    data-tv-focusable="true"
                    onClick={() => handleSeriesClick(focusedSeries)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all outline-none focus:ring-4 focus:ring-indigo-400"
                  >
                    <Layers className="w-4 h-4" />
                    Browse Seasons & Episodes
                  </button>

                  <FavoriteButton
                    type="series"
                    streamId={focusedSeries.series_id}
                    name={focusedSeries.name}
                    icon={focusedSeries.cover || ''}
                    categoryId={focusedSeries.category_id}
                    className="p-2.5 bg-gray-900/80 border border-gray-700/80 rounded-xl text-gray-300 hover:text-white"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Bottom Series Poster Strip */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
            <div data-tv-section="content" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 pb-16">
              {filteredSeries.map((series) => {
                const isFocused = focusedSeries?.series_id === series.series_id;
                return (
                  <div
                    key={series.series_id}
                    onFocus={() => setFocusedSeries(series)}
                    onMouseEnter={() => setFocusedSeries(series)}
                    onClick={() => {
                      setFocusedSeries(series);
                      handleSeriesClick(series);
                    }}
                    className={`transition-all transform duration-200 ${
                      isFocused ? 'scale-105 z-10' : 'opacity-90 hover:opacity-100'
                    }`}
                  >
                    <SeriesCard series={series} onClick={() => handleSeriesClick(series)} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Classic Grid Mode */
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {filteredSeries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-center">
              <p className="text-base font-medium mb-2">No series found in this view.</p>
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-indigo-400 rounded-lg text-xs font-semibold"
              >
                Open Category Manager
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-20">
              {filteredSeries.map((series) => (
                <SeriesCard
                  key={series.series_id}
                  series={series}
                  onClick={() => handleSeriesClick(series)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        type="series"
        categories={seriesCategories}
      />
    </div>
  );
};

export default SeriesPage;
