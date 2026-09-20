import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useXtreamAPI } from '@/hooks/useXtreamAPI';
import { useDebounce } from '@/hooks/useDebounce';
import { m3uChannelsToLiveStreams } from '@/api/m3u-parser';
import SearchBar from '@/components/ui/SearchBar';
import ChannelCard from '@/components/cards/ChannelCard';
import MovieCard from '@/components/cards/MovieCard';
import SeriesCard from '@/components/cards/SeriesCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Search } from 'lucide-react';
import { LiveStream, VodStream, Series } from '@/types';

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const navigate = useNavigate();
  
  const { connectionType, m3uChannels } = useAuthStore();
  const api = useXtreamAPI();

  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 300);
  
  const [allLive, setAllLive] = useState<LiveStream[]>([]);
  const [allVod, setAllVod] = useState<VodStream[]>([]);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      setDataLoading(true);
      try {
        if (connectionType === 'm3u') {
          setAllLive(m3uChannelsToLiveStreams(m3uChannels));
        } else if (api) {
          const [live, vod, series] = await Promise.all([
            api.getLiveStreams(),
            api.getVodStreams(),
            api.getSeries()
          ]);
          setAllLive(live);
          setAllVod(vod);
          setAllSeries(series);
        }
      } catch (err) {
        console.error('Error fetching data for search:', err);
      } finally {
        setDataLoading(false);
      }
    };

    fetchAllData();
  }, [api, connectionType, m3uChannels]);

  useEffect(() => {
    if (debouncedQuery !== searchParams.get('q')) {
      if (debouncedQuery) {
        setSearchParams({ q: debouncedQuery }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }
  }, [debouncedQuery, setSearchParams, searchParams]);

  const results = React.useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      return { live: [], vod: [], series: [] };
    }
    
    const lowerQuery = debouncedQuery.toLowerCase();
    
    return {
      live: allLive.filter(item => item.name?.toLowerCase().includes(lowerQuery)).slice(0, 50),
      vod: allVod.filter(item => item.name?.toLowerCase().includes(lowerQuery)).slice(0, 50),
      series: allSeries.filter(item => item.name?.toLowerCase().includes(lowerQuery)).slice(0, 50)
    };
  }, [debouncedQuery, allLive, allVod, allSeries]);

  const hasResults = results.live.length > 0 || results.vod.length > 0 || results.series.length > 0;
  const isSearching = debouncedQuery.length >= 2;

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

  const handleSeriesClick = (item: Series) => {
    navigate(`/series/${item.series_id}`);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col p-6">
      <div className="max-w-2xl mx-auto w-full mb-8">
        <SearchBar 
          value={query} 
          onChange={setQuery} 
          placeholder="Search for channels, movies, or series..." 
        />
      </div>

      {dataLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="Preparing search data..." />
        </div>
      ) : !isSearching ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
          <Search className="w-16 h-16 text-gray-500 mb-4" />
          <h2 className="text-xl font-semibold text-white">Search OnyxStream</h2>
          <p className="text-gray-400 mt-2">Type at least 2 characters to start searching</p>
        </div>
      ) : !hasResults ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-xl text-gray-400">No results found for "{debouncedQuery}"</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-10 pb-20">
          {results.live.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4 border-b border-gray-800 pb-2">Live TV ({results.live.length})</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {results.live.map(channel => (
                  <ChannelCard key={channel.stream_id} channel={channel} onClick={() => handleLiveClick(channel)} />
                ))}
              </div>
            </section>
          )}

          {results.vod.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4 border-b border-gray-800 pb-2">Movies ({results.vod.length})</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {results.vod.map(movie => (
                  <MovieCard key={movie.stream_id} movie={movie} onClick={() => handleMovieClick(movie)} />
                ))}
              </div>
            </section>
          )}

          {results.series.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4 border-b border-gray-800 pb-2">TV Series ({results.series.length})</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {results.series.map(series => (
                  <SeriesCard key={series.series_id} series={series} onClick={() => handleSeriesClick(series)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPage;
