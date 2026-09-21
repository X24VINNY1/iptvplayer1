import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useContentStore } from '@/store/useContentStore';
import { useCategoryStore } from '@/store/useCategoryStore';
import { useXtreamAPI } from '@/hooks/useXtreamAPI';
import CategoryFilter from '@/components/ui/CategoryFilter';
import ChannelCard from '@/components/cards/ChannelCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CategoryManagerModal from '@/components/ui/CategoryManagerModal';
import { LiveStream, Category } from '@/types';
import { SlidersHorizontal, Sparkles } from 'lucide-react';

const LiveTVPage: React.FC = () => {
  const navigate = useNavigate();
  const { connectionType, m3uChannels } = useAuthStore();
  const api = useXtreamAPI();
  const { liveCategories, liveStreams, isLoaded, syncAll, isSyncing } = useContentStore();
  const { getVisibleCategories, isCategoryHidden, filterUsOnly } = useCategoryStore();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // If content wasn't preloaded, trigger sync
  useEffect(() => {
    if (!isLoaded && !isSyncing) {
      setDataLoading(true);
      syncAll(api, connectionType, m3uChannels)
        .catch((err) => {
          console.error('Failed to load Live TV data:', err);
          setFetchError(err?.message || 'Failed to load channels');
        })
        .finally(() => {
          setDataLoading(false);
        });
    }
  }, [isLoaded, isSyncing, api, connectionType, m3uChannels, syncAll]);

  // Filter visible categories
  const visibleCategories = useMemo(() => {
    return getVisibleCategories('live', liveCategories);
  }, [liveCategories, getVisibleCategories]);

  // Filter streams: only show streams belonging to visible categories
  const filteredStreams = useMemo(() => {
    const hiddenSet = new Set(
      liveCategories.filter((c) => isCategoryHidden('live', c.category_id)).map((c) => c.category_id)
    );

    let streams = liveStreams.filter((s) => !hiddenSet.has(s.category_id));

    if (selectedCategory !== null) {
      streams = streams.filter((s) => s.category_id === selectedCategory);
    }

    return streams;
  }, [liveStreams, liveCategories, selectedCategory, isCategoryHidden]);

  const handleChannelClick = (channel: LiveStream) => {
    if (connectionType === 'm3u' && channel.direct_source) {
      navigate(`/player/live/${channel.stream_id}?name=${encodeURIComponent(channel.name)}&directUrl=${encodeURIComponent(channel.direct_source)}`);
    } else {
      navigate(`/player/live/${channel.stream_id}?name=${encodeURIComponent(channel.name)}&icon=${encodeURIComponent(channel.stream_icon || '')}`);
    }
  };

  const handleQuickUsFilter = () => {
    filterUsOnly('live', liveCategories);
  };

  if (dataLoading || isSyncing) {
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
      {/* Header & Filter Controls */}
      <div className="flex-none pt-4 px-6 pb-2 bg-gray-950/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Live TV</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Showing {filteredStreams.length} channels across {visibleCategories.length} categories
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleQuickUsFilter}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/20 transition-colors"
              title="Automatically hide foreign categories and keep only US / USA / EN"
            >
              <Sparkles className="w-3.5 h-3.5" />
              US / EN Only
            </button>

            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-medium border border-gray-700 transition-colors"
              title="Organize and hide unwanted categories"
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

      {/* Channel Grid */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        {filteredStreams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-center">
            <p className="text-base font-medium mb-2">No channels found in this view.</p>
            <p className="text-xs text-gray-500 max-w-sm mb-4">
              Categories may be hidden by your filter settings.
            </p>
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-indigo-400 rounded-lg text-xs font-semibold"
            >
              Open Category Manager
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-20">
            {filteredStreams.map((channel) => (
              <ChannelCard
                key={channel.stream_id}
                channel={channel}
                onClick={() => handleChannelClick(channel)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        type="live"
        categories={liveCategories}
      />
    </div>
  );
};

export default LiveTVPage;
