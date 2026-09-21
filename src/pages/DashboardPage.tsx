import React, { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useContentStore } from '@/store/useContentStore';
import { useCategoryStore } from '@/store/useCategoryStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useXtreamAPI } from '@/hooks/useXtreamAPI';
import ChannelCard from '@/components/cards/ChannelCard';
import MovieCard from '@/components/cards/MovieCard';
import SeriesCard from '@/components/cards/SeriesCard';
import SyncLoadingScreen from '@/components/ui/SyncLoadingScreen';
import { Play } from 'lucide-react';
import { LiveStream, VodStream, Series } from '@/types';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { connectionType, m3uChannels } = useAuthStore();
  const { getContinueWatching, getHistory } = useHistoryStore();
  const api = useXtreamAPI();

  const {
    liveStreams,
    vodStreams,
    seriesList,
    liveCategories,
    vodCategories,
    seriesCategories,
    isLoaded,
    isSyncing,
    syncAll
  } = useContentStore();

  const { isCategoryHidden } = useCategoryStore();

  const continueWatching = getContinueWatching();
  const recentlyWatched = getHistory(20);

  // If user navigated or refreshed directly, ensure sync runs
  useEffect(() => {
    if (!isLoaded && !isSyncing) {
      syncAll(api, connectionType, m3uChannels).catch((err) => {
        console.error('Error auto-syncing dashboard:', err);
      });
    }
  }, [isLoaded, isSyncing, api, connectionType, m3uChannels, syncAll]);

  // Filter items from hidden categories
  const visibleLive = useMemo(() => {
    const hiddenSet = new Set(
      liveCategories.filter((c) => isCategoryHidden('live', c.category_id)).map((c) => c.category_id)
    );
    return liveStreams.filter((s) => !hiddenSet.has(s.category_id)).slice(0, 14);
  }, [liveStreams, liveCategories, isCategoryHidden]);

  const visibleMovies = useMemo(() => {
    const hiddenSet = new Set(
      vodCategories.filter((c) => isCategoryHidden('vod', c.category_id)).map((c) => c.category_id)
    );
    return vodStreams.filter((m) => !hiddenSet.has(m.category_id)).slice(0, 14);
  }, [vodStreams, vodCategories, isCategoryHidden]);

  const visibleSeries = useMemo(() => {
    const hiddenSet = new Set(
      seriesCategories.filter((c) => isCategoryHidden('series', c.category_id)).map((c) => c.category_id)
    );
    return seriesList.filter((s) => !hiddenSet.has(s.category_id)).slice(0, 14);
  }, [seriesList, seriesCategories, isCategoryHidden]);

  const handleLiveClick = (channel: LiveStream) => {
    if (connectionType === 'm3u' && channel.direct_source) {
      navigate(`/player/live/${channel.stream_id}?name=${encodeURIComponent(channel.name)}&directUrl=${encodeURIComponent(channel.direct_source)}`);
    } else {
      navigate(`/player/live/${channel.stream_id}?name=${encodeURIComponent(channel.name)}&icon=${encodeURIComponent(channel.stream_icon || '')}`);
    }
  };

  const handleMovieClick = (movie: VodStream) => {
    const ext = movie.container_extension || 'mp4';
    navigate(`/player/vod/${movie.stream_id}?ext=${encodeURIComponent(ext)}&name=${encodeURIComponent(movie.name)}&icon=${encodeURIComponent(movie.stream_icon || '')}`);
  };

  const handleSeriesClick = (seriesItem: Series) => {
    navigate(`/series/${seriesItem.series_id}`);
  };

  const renderHistoryItem = (item: any, isContinueWatching: boolean) => {
    const progressPercent = item.duration ? (item.progress / item.duration) * 100 : 0;
    
    return (
      <div 
        key={`${item.type}-${item.streamId || item.id}`} 
        className="flex-none w-64 mr-4 cursor-pointer group relative rounded-xl overflow-hidden bg-gray-900 border border-gray-800 hover:border-indigo-500/50 transition-colors"
        onClick={() => {
          let url = `/player/${item.type}/${item.streamId}?name=${encodeURIComponent(item.name)}`;
          if (item.containerExtension) url += `&ext=${item.containerExtension}`;
          if (item.icon) url += `&icon=${encodeURIComponent(item.icon)}`;
          if (item.seasonNum) url += `&season=${item.seasonNum}`;
          if (item.episodeNum) url += `&episode=${item.episodeNum}`;
          if (item.seriesId) url += `&seriesId=${item.seriesId}`;
          navigate(url);
        }}
      >
        <div className="aspect-video relative overflow-hidden bg-gray-800">
          {item.icon ? (
            <img 
              src={item.icon} 
              alt={item.name} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">No Image</div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <div className="bg-indigo-600 rounded-full p-3 shadow-lg shadow-indigo-600/30 text-white">
              <Play className="w-6 h-6 fill-current ml-1" />
            </div>
          </div>
        </div>
        {isContinueWatching && (
          <div className="h-1 bg-gray-700 w-full">
            <div className="h-full bg-indigo-500" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
        <div className="p-3">
          <h3 className="text-white font-medium truncate">{item.name}</h3>
          {item.seasonNum && item.episodeNum && (
            <p className="text-xs text-gray-400 mt-1">S{item.seasonNum} E{item.episodeNum}</p>
          )}
        </div>
      </div>
    );
  };

  if (!isLoaded && isSyncing) {
    return <SyncLoadingScreen onComplete={() => {}} />;
  }

  return (
    <div className="p-6 space-y-8 pb-24">
      {continueWatching.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 text-white">Continue Watching</h2>
          <div className="flex overflow-x-auto scrollbar-hide pb-4">
            {continueWatching.map(item => renderHistoryItem(item, true))}
          </div>
        </section>
      )}

      {recentlyWatched.length > 0 && continueWatching.length === 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 text-white">Recently Watched</h2>
          <div className="flex overflow-x-auto scrollbar-hide pb-4">
            {recentlyWatched.map(item => renderHistoryItem(item, false))}
          </div>
        </section>
      )}

      {visibleLive.length > 0 && (
        <section>
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Live TV Channels</h2>
              <p className="text-xs text-gray-400">Top channels from your active categories</p>
            </div>
            <Link to="/live" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">See All</Link>
          </div>
          <div className="flex overflow-x-auto scrollbar-hide pb-4 space-x-4">
            {visibleLive.map(channel => (
              <div key={channel.stream_id} className="flex-none w-48">
                <ChannelCard channel={channel} onClick={() => handleLiveClick(channel)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {visibleMovies.length > 0 && (
        <section>
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Movies / VOD</h2>
              <p className="text-xs text-gray-400">Featured titles from your active categories</p>
            </div>
            <Link to="/movies" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">See All</Link>
          </div>
          <div className="flex overflow-x-auto scrollbar-hide pb-4 space-x-4">
            {visibleMovies.map(movie => (
              <div key={movie.stream_id} className="flex-none w-40">
                <MovieCard movie={movie} onClick={() => handleMovieClick(movie)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {visibleSeries.length > 0 && (
        <section>
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">TV Series</h2>
              <p className="text-xs text-gray-400">Popular series from your active categories</p>
            </div>
            <Link to="/series" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">See All</Link>
          </div>
          <div className="flex overflow-x-auto scrollbar-hide pb-4 space-x-4">
            {visibleSeries.map(item => (
              <div key={item.series_id} className="flex-none w-40">
                <SeriesCard series={item} onClick={() => handleSeriesClick(item)} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default DashboardPage;
