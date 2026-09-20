import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useAuthStore } from '@/store/useAuthStore';
import ChannelCard from '@/components/cards/ChannelCard';
import MovieCard from '@/components/cards/MovieCard';
import SeriesCard from '@/components/cards/SeriesCard';
import { Heart } from 'lucide-react';
import { LiveStream, VodStream, Series, FavoriteItem } from '@/types';

type FilterType = 'all' | 'live' | 'vod' | 'series';

const FavoritesPage: React.FC = () => {
  const navigate = useNavigate();
  const { getFavorites } = useFavoritesStore();
  const { connectionType } = useAuthStore();
  const [filter, setFilter] = useState<FilterType>('all');

  const favorites = getFavorites();

  const filteredFavorites = useMemo(() => {
    if (filter === 'all') return favorites;
    return favorites.filter(fav => fav.type === filter);
  }, [favorites, filter]);

  const handleLiveClick = (fav: FavoriteItem) => {
    navigate(`/player/live/${fav.streamId}?name=${encodeURIComponent(fav.name)}&icon=${encodeURIComponent(fav.icon || '')}`);
  };

  const handleVodClick = (fav: FavoriteItem) => {
    navigate(`/player/vod/${fav.streamId}?ext=mp4&name=${encodeURIComponent(fav.name)}&icon=${encodeURIComponent(fav.icon || '')}`);
  };

  const handleSeriesClick = (fav: FavoriteItem) => {
    navigate(`/series/${fav.streamId}`);
  };

  const favToLiveStream = (fav: FavoriteItem): LiveStream => ({
    num: 0, name: fav.name, stream_type: 'live', stream_id: fav.streamId,
    stream_icon: fav.icon, epg_channel_id: '', added: '', category_id: fav.categoryId,
    custom_sid: '', tv_archive: 0, direct_source: '', tv_archive_duration: 0,
  });

  const favToVodStream = (fav: FavoriteItem): VodStream => ({
    num: 0, name: fav.name, stream_type: 'movie', stream_id: fav.streamId,
    stream_icon: fav.icon, rating: '', rating_5based: 0, added: '', category_id: fav.categoryId,
    container_extension: 'mp4', custom_sid: '', direct_source: '',
  });

  const favToSeries = (fav: FavoriteItem): Series => ({
    num: 0, name: fav.name, series_id: fav.streamId, cover: fav.icon,
    plot: '', cast: '', director: '', genre: '', releaseDate: '', last_modified: '',
    rating: '', rating_5based: 0, backdrop_path: [], youtube_trailer: '',
    episode_run_time: '', category_id: fav.categoryId,
  });

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="flex-none pt-4 px-6 pb-2 bg-gray-950/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-4">My Favorites</h1>
        
        <div className="flex space-x-2 overflow-x-auto scrollbar-hide pb-2">
          {(['all', 'live', 'vod', 'series'] as FilterType[]).map(t => {
            if (connectionType === 'm3u' && (t === 'vod' || t === 'series')) return null;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === t 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {t === 'all' ? 'All Favorites' : t === 'live' ? 'Live TV' : t === 'vod' ? 'Movies' : 'TV Series'}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        {filteredFavorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-gray-900 p-6 rounded-full mb-4">
              <Heart className="w-12 h-12 text-gray-700" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No favorites yet</h3>
            <p className="text-gray-400 max-w-sm">
              Mark channels, movies, and series as favorites to quickly access them here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-20">
            {filteredFavorites.map(fav => {
              if (fav.type === 'live') {
                return <ChannelCard key={`live-${fav.id}`} channel={favToLiveStream(fav)} onClick={() => handleLiveClick(fav)} />;
              }
              if (fav.type === 'vod') {
                return <MovieCard key={`vod-${fav.id}`} movie={favToVodStream(fav)} onClick={() => handleVodClick(fav)} />;
              }
              if (fav.type === 'series') {
                return <SeriesCard key={`series-${fav.id}`} series={favToSeries(fav)} onClick={() => handleSeriesClick(fav)} />;
              }
              return null;
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;
