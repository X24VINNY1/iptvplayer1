import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import { useAuthStore } from '@/store/useAuthStore';
import { useContentStore } from '@/store/useContentStore';
import { useCategoryStore } from '@/store/useCategoryStore';
import { useXtreamAPI } from '@/hooks/useXtreamAPI';
import { useTVRemote } from '@/hooks/useTVRemote';
import { getProxiedStreamUrl } from '@/utils/url';
import CategoryFilter from '@/components/ui/CategoryFilter';
import ChannelCard from '@/components/cards/ChannelCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CategoryManagerModal from '@/components/ui/CategoryManagerModal';
import { LiveStream } from '@/types';
import {
  SlidersHorizontal,
  Sparkles,
  LayoutGrid,
  Tv,
  Grid,
  Volume2,
  VolumeX,
  Maximize2,
  Radio,
  Play,
  Search
} from 'lucide-react';

const LiveTVPage: React.FC = () => {
  const navigate = useNavigate();
  const { serverUrl, username, password, connectionType, m3uChannels } = useAuthStore();
  const api = useXtreamAPI();
  const { liveCategories, liveStreams, isLoaded, syncAll, isSyncing } = useContentStore();
  const { getVisibleCategories, isCategoryHidden, filterUsOnly } = useCategoryStore();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // OwnTV-inspired View Mode: 'preview' (split live player + list) vs 'grid'
  const [viewMode, setViewMode] = useState<'preview' | 'grid'>('preview');
  const [previewChannel, setPreviewChannel] = useState<LiveStream | null>(null);
  const [channelSearch, setChannelSearch] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useTVRemote();

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

    if (channelSearch.trim()) {
      const q = channelSearch.toLowerCase();
      streams = streams.filter((s) => s.name.toLowerCase().includes(q));
    }

    return streams;
  }, [liveStreams, liveCategories, selectedCategory, channelSearch, isCategoryHidden]);

  // Default preview channel to first item if null
  useEffect(() => {
    if (!previewChannel && filteredStreams.length > 0) {
      setPreviewChannel(filteredStreams[0]);
    }
  }, [filteredStreams, previewChannel]);

  // Preview Player HLS Lifecycle
  useEffect(() => {
    if (viewMode !== 'preview' || !previewChannel) return;

    const video = previewVideoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const rawUrl =
      connectionType === 'm3u' && previewChannel.direct_source
        ? previewChannel.direct_source
        : `${serverUrl}/live/${username}/${password}/${previewChannel.stream_id}.m3u8`;

    const proxiedUrl = getProxiedStreamUrl(rawUrl);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });

      hls.loadSource(proxiedUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = proxiedUrl;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [previewChannel, viewMode, serverUrl, username, password, connectionType]);

  const handleChannelClick = (channel: LiveStream) => {
    launchFullscreen(channel);
  };

  const launchFullscreen = (channel: LiveStream) => {
    if (connectionType === 'm3u' && channel.direct_source) {
      navigate(
        `/player/live/${channel.stream_id}?name=${encodeURIComponent(
          channel.name
        )}&directUrl=${encodeURIComponent(channel.direct_source)}`
      );
    } else {
      navigate(
        `/player/live/${channel.stream_id}?name=${encodeURIComponent(
          channel.name
        )}&icon=${encodeURIComponent(channel.stream_icon || '')}`
      );
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
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header & Controls */}
      <div className="flex-none pt-4 px-6 pb-3 bg-gray-950/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Live TV
              <span className="text-[11px] font-semibold uppercase px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                Live
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Showing {filteredStreams.length} channels across {visibleCategories.length} categories
            </p>
          </div>

          <div data-tv-section="categories" className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-0.5">
              <button
                data-tv-focusable="true"
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all outline-none focus:ring-2 focus:ring-indigo-400 ${
                  viewMode === 'preview'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Preview Split Mode (OwnTV style)"
              >
                <Tv className="w-3.5 h-3.5" />
                Preview Mode
              </button>
              <button
                data-tv-focusable="true"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all outline-none focus:ring-2 focus:ring-indigo-400 ${
                  viewMode === 'grid'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Classic Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Grid View
              </button>
            </div>

            {/* Multi-View button */}
            <button
              data-tv-focusable="true"
              onClick={() => navigate('/multiview')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-semibold shadow-sm transition-all outline-none focus:ring-2 focus:ring-indigo-400"
              title="Watch up to 4 channels simultaneously"
            >
              <Grid className="w-3.5 h-3.5 text-indigo-400" />
              Multi-View (4-Way)
            </button>

            {/* Quick US filter */}
            <button
              data-tv-focusable="true"
              onClick={handleQuickUsFilter}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-semibold border border-gray-700 transition-all outline-none focus:ring-2 focus:ring-indigo-400"
              title="Automatically hide foreign categories and keep only US / USA / EN"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              US / EN Only
            </button>

            {/* Organize */}
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

        {/* Categories Bar */}
        <CategoryFilter
          categories={visibleCategories}
          selectedId={selectedCategory}
          onSelect={setSelectedCategory}
        />
      </div>

      {/* Main Content Area */}
      {viewMode === 'preview' ? (
        /* OwnTV Signature Split Preview Mode */
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Column: Channel List */}
          <div className="w-full lg:w-[420px] flex-shrink-0 flex flex-col border-r border-gray-800/80 bg-gray-950/40">
            {/* Quick Search */}
            <div className="p-3 border-b border-gray-800/60">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="Filter channels..."
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Channels List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-800/40 scrollbar-thin">
              {filteredStreams.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-xs">No channels in this view.</div>
              ) : (
                filteredStreams.map((channel) => {
                  const isSelected = previewChannel?.stream_id === channel.stream_id;
                  return (
                    <div
                      key={channel.stream_id}
                      tabIndex={0}
                      role="button"
                      data-tv-focusable="true"
                      data-tv-section="content"
                      onFocus={() => setPreviewChannel(channel)}
                      onMouseEnter={() => setPreviewChannel(channel)}
                      onClick={() => handleChannelClick(channel)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Select' || e.keyCode === 13 || e.keyCode === 23) {
                          e.preventDefault();
                          handleChannelClick(channel);
                        }
                      }}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all outline-none ${
                        isSelected
                          ? 'bg-indigo-600/30 border-l-4 border-indigo-500 text-white shadow-inner ring-2 ring-indigo-500/50'
                          : 'hover:bg-gray-900/60 text-gray-300'
                      } focus:ring-4 focus:ring-indigo-500 focus:bg-indigo-600/40 focus:text-white focus:z-10`}
                    >
                      {channel.stream_icon ? (
                        <img
                          src={channel.stream_icon}
                          alt=""
                          className="w-9 h-9 rounded-lg object-contain bg-black/40 flex-shrink-0 p-0.5 border border-gray-800"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center flex-shrink-0">
                          <Radio className="w-4 h-4 text-gray-500" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate leading-snug">{channel.name}</p>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">
                          CH {channel.num || channel.stream_id}
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          launchFullscreen(channel);
                        }}
                        className="p-1.5 rounded-lg bg-gray-800/60 hover:bg-indigo-600 hover:text-white text-gray-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Play Fullscreen"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Instant Live Preview Player */}
          <div className="flex-1 flex flex-col bg-black overflow-hidden relative">
            {previewChannel ? (
              <div className="flex-1 flex flex-col h-full">
                {/* Video Window */}
                <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden group">
                  <video
                    ref={previewVideoRef}
                    className="w-full h-full object-contain"
                    autoPlay
                    playsInline
                    muted={isMuted}
                  />

                  {/* Top Bar on Hover */}
                  <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <div className="flex items-center gap-3">
                      {previewChannel.stream_icon && (
                        <img
                          src={previewChannel.stream_icon}
                          alt=""
                          className="w-7 h-7 rounded object-contain bg-black/50"
                        />
                      )}
                      <div>
                        <h3 className="text-sm font-bold text-white truncate max-w-sm">
                          {previewChannel.name}
                        </h3>
                        <span className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">
                          ● Streaming Live
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => launchFullscreen(previewChannel)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      Fullscreen
                    </button>
                  </div>

                  {/* Bottom Controls on Hover */}
                  <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="p-2 rounded-lg bg-gray-900/80 text-white hover:bg-indigo-600 transition-colors"
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>

                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setVolume(val);
                          setIsMuted(val === 0);
                          if (previewVideoRef.current) previewVideoRef.current.volume = val;
                        }}
                        className="w-20 accent-indigo-500 h-1"
                      />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                      <span className="px-2 py-0.5 bg-gray-900/80 rounded border border-gray-800">
                        1080p
                      </span>
                      <span className="px-2 py-0.5 bg-gray-900/80 rounded border border-gray-800">
                        AAC / H.264
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Channel Info Panel */}
                <div className="p-4 bg-gray-950 border-t border-gray-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {previewChannel.stream_icon ? (
                      <img
                        src={previewChannel.stream_icon}
                        alt=""
                        className="w-12 h-12 rounded-xl object-contain bg-black/60 p-1 border border-gray-800"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center">
                        <Radio className="w-6 h-6 text-indigo-400" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-base font-bold text-white">{previewChannel.name}</h2>
                      <p className="text-xs text-gray-400">
                        Click Fullscreen or press Enter to watch full screen
                      </p>
                    </div>
                  </div>

                  <button
                    data-tv-focusable="true"
                    data-tv-section="preview"
                    onClick={() => launchFullscreen(previewChannel)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all outline-none focus:ring-4 focus:ring-indigo-400 focus:scale-105"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Watch Fullscreen
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <Radio className="w-12 h-12 mb-3 text-gray-600" />
                <p className="text-sm">Select a channel to begin preview</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Classic Grid Mode */
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {filteredStreams.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-center">
              <p className="text-base font-medium mb-2">No channels found in this view.</p>
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
      )}

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
