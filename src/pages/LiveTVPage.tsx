import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useXtreamAPI } from '@/hooks/useXtreamAPI';
import { m3uChannelsToLiveStreams, m3uChannelsToCategories } from '@/api/m3u-parser';
import CategoryFilter from '@/components/ui/CategoryFilter';
import ChannelCard from '@/components/cards/ChannelCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { LiveStream, Category } from '@/types';

const LiveTVPage: React.FC = () => {
  const navigate = useNavigate();
  const { connectionType, m3uChannels } = useAuthStore();
  const api = useXtreamAPI();

  const [categories, setCategories] = useState<Category[]>([]);
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setDataLoading(true);
      setFetchError(null);
      try {
        if (connectionType === 'm3u') {
          setCategories(m3uChannelsToCategories(m3uChannels));
          setStreams(m3uChannelsToLiveStreams(m3uChannels));
        } else if (api) {
          const [cats, allStreams] = await Promise.all([
            api.getLiveCategories(),
            api.getLiveStreams()
          ]);
          setCategories(cats);
          setStreams(allStreams);
        }
      } catch (err: any) {
        console.error('Failed to load Live TV data:', err);
        setFetchError(err?.message || 'Failed to load channels');
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [api, connectionType, m3uChannels]);

  const filteredStreams = useMemo(() => {
    if (selectedCategory === null) return streams;
    return streams.filter(s => s.category_id === selectedCategory);
  }, [streams, selectedCategory]);

  const handleChannelClick = (channel: LiveStream) => {
    if (connectionType === 'm3u' && channel.direct_source) {
      navigate(`/player/live/${channel.stream_id}?name=${encodeURIComponent(channel.name)}&directUrl=${encodeURIComponent(channel.direct_source)}`);
    } else {
      navigate(`/player/live/${channel.stream_id}?name=${encodeURIComponent(channel.name)}&icon=${encodeURIComponent(channel.stream_icon || '')}`);
    }
  };

  if (dataLoading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading Live TV..." />
      </div>
    );
  }

  if (fetchError && connectionType !== 'm3u') {
    return <ErrorMessage message={fetchError} className="m-6" />;
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="flex-none pt-4 px-6 pb-2 bg-gray-950/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-4">Live TV</h1>
        <CategoryFilter
          categories={categories}
          selectedId={selectedCategory}
          onSelect={setSelectedCategory}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        {filteredStreams.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            No channels found in this category.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-20">
            {filteredStreams.map(channel => (
              <ChannelCard
                key={channel.stream_id}
                channel={channel}
                onClick={() => handleChannelClick(channel)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTVPage;
