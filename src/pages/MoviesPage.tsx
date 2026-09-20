import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useXtreamAPI } from '@/hooks/useXtreamAPI';
import CategoryFilter from '@/components/ui/CategoryFilter';
import MovieCard from '@/components/cards/MovieCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import Modal from '@/components/ui/Modal';
import FavoriteButton from '@/components/ui/FavoriteButton';
import { Play, Star, Clock, Calendar, Info } from 'lucide-react';
import { VodStream, Category, VodInfo } from '@/types';

const MoviesPage: React.FC = () => {
  const navigate = useNavigate();
  const { connectionType } = useAuthStore();
  const api = useXtreamAPI();

  const [categories, setCategories] = useState<Category[]>([]);
  const [movies, setMovies] = useState<VodStream[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [selectedMovie, setSelectedMovie] = useState<VodStream | null>(null);
  const [movieInfo, setMovieInfo] = useState<VodInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);

  useEffect(() => {
    if (connectionType === 'm3u') return;

    const fetchData = async () => {
      setDataLoading(true);
      setFetchError(null);
      try {
        if (api) {
          const [cats, allMovies] = await Promise.all([
            api.getVodCategories(),
            api.getVodStreams()
          ]);
          setCategories(cats);
          setMovies(allMovies);
        }
      } catch (err: any) {
        console.error('Failed to load Movies:', err);
        setFetchError(err?.message || 'Failed to load movies');
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [api, connectionType]);

  const filteredMovies = useMemo(() => {
    if (selectedCategory === null) return movies;
    return movies.filter(m => m.category_id === selectedCategory);
  }, [movies, selectedCategory]);

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

  const handlePlay = () => {
    if (selectedMovie) {
      navigate(`/player/vod/${selectedMovie.stream_id}?ext=${selectedMovie.container_extension}&name=${encodeURIComponent(selectedMovie.name)}&icon=${encodeURIComponent(selectedMovie.stream_icon || '')}`);
    }
  };

  if (connectionType === 'm3u') {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col items-center justify-center p-6 text-center">
        <Info className="w-16 h-16 text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Movies Not Available</h2>
        <p className="text-gray-400 max-w-md">Your current connection is via M3U playlist. VOD and Series are only fully supported with Xtream Codes connections.</p>
      </div>
    );
  }

  if (dataLoading) {
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
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="flex-none pt-4 px-6 pb-2 bg-gray-950/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-4">Movies</h1>
        <CategoryFilter
          categories={categories}
          selectedId={selectedCategory}
          onSelect={setSelectedCategory}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        {filteredMovies.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            No movies found in this category.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 pb-20">
            {filteredMovies.map(movie => (
              <MovieCard
                key={movie.stream_id}
                movie={movie}
                onClick={() => handleMovieClick(movie)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={!!selectedMovie} onClose={closeModal} size="xl">
        {selectedMovie && (
          <div className="flex flex-col md:flex-row gap-6 max-w-4xl mx-auto p-2">
            <div className="w-full md:w-1/3 flex-shrink-0">
              {selectedMovie.stream_icon ? (
                <img 
                  src={selectedMovie.stream_icon} 
                  alt={selectedMovie.name} 
                  className="w-full rounded-xl shadow-2xl object-cover aspect-[2/3]"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-gray-800 rounded-xl flex items-center justify-center">
                  <span className="text-gray-500">No Image</span>
                </div>
              )}
            </div>
            
            <div className="flex-1 flex flex-col pt-2">
              <div className="flex justify-between items-start">
                <h2 className="text-3xl font-bold text-white mb-2">{selectedMovie.name}</h2>
                <FavoriteButton 
                  type="vod" 
                  streamId={selectedMovie.stream_id} 
                  name={selectedMovie.name} 
                  icon={selectedMovie.stream_icon || ''} 
                  categoryId={selectedMovie.category_id} 
                />
              </div>
              
              <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-6">
                {(selectedMovie.rating || movieInfo?.info?.rating) && (
                  <div className="flex items-center text-yellow-500">
                    <Star className="w-4 h-4 mr-1 fill-current" />
                    <span>{movieInfo?.info?.rating || selectedMovie.rating}</span>
                  </div>
                )}
                {movieInfo?.info?.releasedate && (
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    <span>{movieInfo.info.releasedate}</span>
                  </div>
                )}
                {movieInfo?.info?.duration && (
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    <span>{movieInfo.info.duration}</span>
                  </div>
                )}
                {movieInfo?.info?.genre && (
                  <div className="bg-gray-800 px-2 py-0.5 rounded text-gray-300">
                    {movieInfo.info.genre}
                  </div>
                )}
              </div>

              {infoLoading ? (
                <div className="py-8"><LoadingSpinner size="sm" /></div>
              ) : (
                <>
                  <p className="text-gray-300 mb-6 leading-relaxed">
                    {movieInfo?.info?.plot || "No description available."}
                  </p>

                  {movieInfo?.info?.director && (
                    <div className="mb-2 text-sm">
                      <span className="text-gray-500">Director: </span>
                      <span className="text-gray-300">{movieInfo.info.director}</span>
                    </div>
                  )}
                  {movieInfo?.info?.cast && (
                    <div className="mb-6 text-sm">
                      <span className="text-gray-500">Cast: </span>
                      <span className="text-gray-300">{movieInfo.info.cast}</span>
                    </div>
                  )}
                </>
              )}

              <div className="mt-auto pt-6 flex gap-4">
                <button
                  onClick={handlePlay}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-indigo-600/20"
                >
                  <Play className="w-5 h-5 mr-2 fill-current" />
                  Play Movie
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MoviesPage;
