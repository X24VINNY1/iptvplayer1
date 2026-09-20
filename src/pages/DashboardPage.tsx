import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useXtreamAPI } from '@/hooks/useXtreamAPI';
import { m3uChannelsToLiveStreams } from '@/api/m3u-parser';
import ChannelCard from '@/components/cards/ChannelCard';
import MovieCard from '@/components/cards/MovieCard';
import SeriesCard from '@/components/cards/SeriesCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Play } from 'lucide-react';
import { LiveStream, VodStream, Series } from '@/types';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { connectionType, m3uChannels } = useAuthStore();
  const { getContinueWatching, getHistory } = useHistoryStore();
  const api = useXtreamAPI();

  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [movies, setMovies] = useState<VodStream[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const continueWatching = getContinueWatching();
  const recentlyWatched = getHistory(20);

  useEffect(() => {
    const fetchData = async () => {
      setDataLoading(true);
      setFetchError(null);
      try {
        if (connectionType === 'm3u') {
          const streams = m3uChannelsToLiveStreams(m3uChannels);
          setLiveStreams(streams.slice(0, 12));
        } else if (api) {
          const [live, vod, tvSeries] = await Promise.all([
            api.getLiveStreams(),
            api.getVodStreams(),
            api.getSeries()
          ]);
          setLiveStreams(live.slice(0, 12));
          setMovies(vod.slice(0, 12));
          setSeries(tvSeries.slice(0, 12));
        }
      } catch (err: any) {
        console.error('Error fetching dashboard data:', err);
        setFetchError(err?.message || 'Failed to load dashboard data');
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [api, connectionType, m3uChannels]);

  const handleLiveClick = (channel: LiveStream) => {
    if (connectionType === 'm3u' && channel.direct_source) {
      navigate(`/player/live/${channel.stream_id}?name=${encodeURIComponent(channel.name)}&directUrl=${encodeURIComponent(channel.direct_source)}`);
    } else {
      navigate(`/player/live/${channel.stream_id}?name=${encodeURIComponent(channel.name)}&icon=${encodeURIComponent(channel.stream_icon || '')}`);
    }
  };

  const handleMovieClick = (movie: VodStream) => {
    navigate(`/player/vod/${movie.stream_id}?ext=${movie.container_extension}&name=${encodeURIComponent(movie.name)}&icon=${encodeURIComponent(movie.stream_icon || '')}`);
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
            <img src={item.icon} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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

  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading Dashboard..." />
      </div>
    );
  }

  if (fetchError && connectionType !== 'm3u') {
    return <ErrorMessage message={fetchError} className="m-6" />;
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

      {liveStreams.length > 0 && (
        <section>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-semibold text-white">Live TV</h2>
            <Link to="/live" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">See All</Link>
          </div>
          <div className="flex overflow-x-auto scrollbar-hide pb-4 space-x-4">
            {liveStreams.map(channel => (
              <div key={channel.stream_id} className="flex-none w-48">
                <ChannelCard channel={channel} onClick={() => handleLiveClick(channel)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {movies.length > 0 && (
        <section>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-semibold text-white">Movies</h2>
            <Link to="/movies" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">See All</Link>
          </div>
          <div className="flex overflow-x-auto scrollbar-hide pb-4 space-x-4">
            {movies.map(movie => (
              <div key={movie.stream_id} className="flex-none w-40">
                <MovieCard movie={movie} onClick={() => handleMovieClick(movie)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {series.length > 0 && (
        <section>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-semibold text-white">TV Series</h2>
            <Link to="/series" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">See All</Link>
          </div>
          <div className="flex overflow-x-auto scrollbar-hide pb-4 space-x-4">
            {series.map(item => (
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
