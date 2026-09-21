import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useContentStore } from '@/store/useContentStore';
import { useCategoryStore } from '@/store/useCategoryStore';
import { useXtreamAPI } from '@/hooks/useXtreamAPI';
import { useTVRemote } from '@/hooks/useTVRemote';
import CategoryFilter from '@/components/ui/CategoryFilter';
import MovieCard from '@/components/cards/MovieCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import Modal from '@/components/ui/Modal';
import FavoriteButton from '@/components/ui/FavoriteButton';
import CategoryManagerModal from '@/components/ui/CategoryManagerModal';
import {
  Play,
  Star,
  Clock,
  Calendar,
  Info,
  SlidersHorizontal,
  Sparkles,
  LayoutGrid,
  Film,
  Search
} from 'lucide-react';
import { VodStream, VodInfo } from '@/types';

const MoviesPage: React.FC = () => {
  const navigate = useNavigate();
  const { connectionType, m3uChannels } = useAuthStore();
  const api = useXtreamAPI();
  const { vodCategories, vodStreams, isLoaded, syncAll, isSyncing } = useContentStore();
  const { getVisibleCategories, isCategoryHidden, filterUsOnly } = useCategoryStore();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // OwnTV-inspired View Mode: 'cinematic' vs 'grid'
  const [viewMode, setViewMode] = useState<'cinematic' | 'grid'>('cinematic');
  const [focusedMovie, setFocusedMovie] = useState<VodStream | null>(null);
  const [movieSearch, setMovieSearch] = useState('');

  const [selectedMovie, setSelectedMovie] = useState<VodStream | null>(null);
  const [movieInfo, setMovieInfo] = useState<VodInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);

  useTVRemote();

  useEffect(() => {
    if (connectionType === 'm3u') return;

    if (!isLoaded && !isSyncing) {
      setDataLoading(true);
      syncAll(api, connectionType, m3uChannels)
        .catch((err) => {
          console.error('Failed to load Movies:', err);
          setFetchError(err?.message || 'Failed to load movies');
        })
        .finally(() => {
          setDataLoading(false);
        });
    }
  }, [isLoaded, isSyncing, api, connectionType, m3uChannels, syncAll]);

  // Visible categories
  const visibleCategories = useMemo(() => {
    return getVisibleCategories('vod', vodCategories);
  }, [vodCategories, getVisibleCategories]);

  // Filter movies
  const filteredMovies = useMemo(() => {
    const hiddenSet = new Set(
      vodCategories.filter((c) => isCategoryHidden('vod', c.category_id)).map((c) => c.category_id)
    );

    let movies = vodStreams.filter((m) => !hiddenSet.has(m.category_id));

    if (selectedCategory !== null) {
      movies = movies.filter((m) => m.category_id === selectedCategory);
    }

    if (movieSearch.trim()) {
      const q = movieSearch.toLowerCase();
      movies = movies.filter((m) => m.name.toLowerCase().includes(q));
    }

    return movies;
  }, [vodStreams, vodCategories, selectedCategory, movieSearch, isCategoryHidden]);

  // Default focused movie to first in list
  useEffect(() => {
    if (!focusedMovie && filteredMovies.length > 0) {
      setFocusedMovie(filteredMovies[0]);
    } else if (focusedMovie && !filteredMovies.find((m) => m.stream_id === focusedMovie.stream_id)) {
      setFocusedMovie(filteredMovies[0] || null);
    }
  }, [filteredMovies, focusedMovie]);

  const handleMovieClick = async (movie: VodStream) => {
    setSelectedMovie(movie);
    setMovieInfo(null);
    if (api) {
      setInfoLoading(true);
      try {
        const info = await api.getVodInfo(movie.stream_id);
        setMovieInfo(info);
      } catch (err) {
        console.error('Failed to fetch movie info:', err);
      } finally {
        setInfoLoading(false);
      }
    }
  };

  const closeModal = () => {
    setSelectedMovie(null);
    setMovieInfo(null);
  };

  const handlePlay = (movieToPlay?: VodStream) => {
    const target = movieToPlay || selectedMovie || focusedMovie;
    if (target) {
      const ext = target.container_extension || 'mp4';
      navigate(
        `/player/vod/${target.stream_id}?ext=${encodeURIComponent(ext)}&name=${encodeURIComponent(
          target.name
        )}&icon=${encodeURIComponent(target.stream_icon || '')}`
      );
    }
  };

  const handleQuickUsFilter = () => {
    filterUsOnly('vod', vodCategories);
  };

  if (connectionType === 'm3u') {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col items-center justify-center p-6 text-center">
        <Info className="w-16 h-16 text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Movies Not Available</h2>
        <p className="text-gray-400 max-w-md">
          Your current connection is via M3U playlist. VOD is supported with Xtream Codes connections.
        </p>
      </div>
    );
  }

  if (dataLoading || isSyncing) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading Movies..." />
      </div>
    );
  }

  if (fetchError) {
    return <ErrorMessage message={fetchError} className="m-6" />;
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header & Controls */}
      <div className="flex-none pt-4 px-6 pb-2 bg-gray-950/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Movies / VOD
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Showing {filteredMovies.length} movies across {visibleCategories.length} categories
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
                <Film className="w-3.5 h-3.5" />
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

      {/* Main View Area */}
      {viewMode === 'cinematic' ? (
        /* OwnTV Signature Cinematic Layout */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Hero Backdrop Banner */}
          {focusedMovie ? (
            <div className="relative flex-none h-72 sm:h-80 md:h-96 w-full overflow-hidden border-b border-gray-800/80">
              {/* High-res backdrop or fallback to stream icon */}
              <div
                className="absolute inset-0 bg-cover bg-center filter blur-[1px] transform scale-105 transition-all duration-700 opacity-40"
                style={{
                  backgroundImage: `url(${focusedMovie.stream_icon || ''})`,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/80 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-black/40" />

              {/* Foreground Hero Content */}
              <div className="relative h-full max-w-5xl p-6 sm:p-8 flex flex-col justify-end z-10 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-indigo-600/90 text-white text-[11px] font-bold rounded-md uppercase tracking-wider">
                    Featured
                  </span>
                  {focusedMovie.rating && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-xs font-bold">
                      <Star className="w-3 h-3 fill-current" />
                      {parseFloat(focusedMovie.rating).toFixed(1)}
                    </span>
                  )}
                  {focusedMovie.container_extension && (
                    <span className="px-2 py-0.5 bg-gray-800/80 text-gray-300 rounded text-xs uppercase font-mono">
                      {focusedMovie.container_extension}
                    </span>
                  )}
                </div>

                <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight line-clamp-2 drop-shadow-md">
                  {focusedMovie.name}
                </h2>

                <p className="text-xs sm:text-sm text-gray-300 max-w-2xl line-clamp-2 drop-shadow">
                  High-definition on-demand streaming. Instant zero-lag playback with native audio decoders and full seek support.
                </p>

                <div data-tv-section="hero" className="flex items-center gap-3 pt-2">
                  <button
                    data-tv-focusable="true"
                    onClick={() => handlePlay(focusedMovie)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all outline-none focus:ring-4 focus:ring-indigo-400"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Play Now
                  </button>

                  <button
                    data-tv-focusable="true"
                    onClick={() => handleMovieClick(focusedMovie)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-900/80 hover:bg-gray-800 text-gray-200 font-semibold rounded-xl text-sm border border-gray-700/80 transition-all outline-none focus:ring-4 focus:ring-indigo-400"
                  >
                    <Info className="w-4 h-4 text-indigo-400" />
                    Details
                  </button>

                  <FavoriteButton
                    type="vod"
                    streamId={focusedMovie.stream_id}
                    name={focusedMovie.name}
                    icon={focusedMovie.stream_icon || ''}
                    categoryId={focusedMovie.category_id}
                    className="p-2.5 bg-gray-900/80 border border-gray-700/80 rounded-xl text-gray-300 hover:text-white"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Bottom Movie Poster Strip / Grid */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
            <div data-tv-section="content" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 pb-16">
              {filteredMovies.map((movie) => {
                const isFocused = focusedMovie?.stream_id === movie.stream_id;
                return (
                  <div
                    key={movie.stream_id}
                    onFocus={() => setFocusedMovie(movie)}
                    onMouseEnter={() => setFocusedMovie(movie)}
                    onClick={() => handlePlay(movie)}
                    className={`transition-all transform duration-200 ${
                      isFocused ? 'scale-105 z-10' : 'opacity-90 hover:opacity-100'
                    }`}
                  >
                    <MovieCard movie={movie} onClick={() => handlePlay(movie)} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Classic Grid Mode */
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {filteredMovies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-center">
              <p className="text-base font-medium mb-2">No movies found in this view.</p>
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-indigo-400 rounded-lg text-xs font-semibold"
              >
                Open Category Manager
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-20">
              {filteredMovies.map((movie) => (
                <MovieCard
                  key={movie.stream_id}
                  movie={movie}
                  onClick={() => handlePlay(movie)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Movie Details Modal */}
      {selectedMovie && (
        <Modal isOpen={!!selectedMovie} onClose={closeModal} title={selectedMovie.name}>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/3 flex-shrink-0 flex flex-col items-center">
              <img
                src={selectedMovie.stream_icon || 'https://via.placeholder.com/300x450?text=No+Poster'}
                alt={selectedMovie.name}
                className="w-full max-w-[200px] md:max-w-none rounded-xl shadow-lg border border-gray-800 object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).setAttribute('src', 'https://via.placeholder.com/300x450?text=No+Poster');
                }}
              />
              <div className="mt-4 flex gap-3 w-full">
                <button
                  onClick={() => handlePlay(selectedMovie)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-600/30 transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Play Movie
                </button>
                <FavoriteButton
                  type="vod"
                  streamId={selectedMovie.stream_id}
                  name={selectedMovie.name}
                  icon={selectedMovie.stream_icon || ''}
                  categoryId={selectedMovie.category_id}
                  className="p-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col space-y-4">
              <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                {selectedMovie.rating && (
                  <div className="flex items-center gap-1 text-amber-400 font-bold">
                    <Star className="w-4 h-4 fill-current" />
                    <span>{parseFloat(selectedMovie.rating).toFixed(1)} / 10</span>
                  </div>
                )}
                {movieInfo?.info?.releasedate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{movieInfo.info.releasedate}</span>
                  </div>
                )}
                {movieInfo?.info?.duration && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{movieInfo.info.duration}</span>
                  </div>
                )}
              </div>

              {movieInfo?.info?.genre && (
                <div className="flex flex-wrap gap-1.5">
                  {movieInfo.info.genre.split(',').map((g, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-0.5 bg-gray-800/80 text-gray-300 rounded-md text-xs"
                    >
                      {g.trim()}
                    </span>
                  ))}
                </div>
              )}

              <div className="border-t border-gray-800 pt-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Plot Synopsis
                </h4>
                {infoLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500 py-4">
                    <LoadingSpinner size="sm" /> Loading info...
                  </div>
                ) : (
                  <p className="text-xs text-gray-300 leading-relaxed max-h-40 overflow-y-auto">
                    {movieInfo?.info?.plot || 'No detailed plot summary available for this title.'}
                  </p>
                )}
              </div>

              {movieInfo?.info?.cast && (
                <div className="border-t border-gray-800 pt-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Cast
                  </h4>
                  <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                    {movieInfo.info.cast}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        type="vod"
        categories={vodCategories}
      />
    </div>
  );
};

export default MoviesPage;
