import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useXtreamAPI } from '@/hooks/useXtreamAPI';
import { buildStreamUrl } from '@/utils/url';
import VideoPlayer from '@/components/player/VideoPlayer';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const PlayerPage: React.FC = () => {
  const { type, streamId } = useParams<{ type: 'live' | 'vod' | 'series'; streamId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { serverUrl, username, password } = useAuthStore();
  const api = useXtreamAPI();
  const { addToHistory, updateProgress } = useHistoryStore();
  const { currentTime, duration } = usePlayerStore();

  // Smart default extension based on stream type: Live defaults to m3u8, VOD/Series default to mp4
  const defaultExt = type === 'live' ? 'm3u8' : 'mp4';
  const requestedExt = searchParams.get('ext') || defaultExt;
  const [currentExt, setCurrentExt] = useState<string>(requestedExt);

  const [streamUrl, setStreamUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  const title = searchParams.get('name') || 'Unknown Stream';
  const icon = searchParams.get('icon') || '';
  const directUrl = searchParams.get('directUrl');
  const season = searchParams.get('season') ? parseInt(searchParams.get('season')!) : undefined;
  const episode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!) : undefined;
  const seriesIdParam = searchParams.get('seriesId') ? parseInt(searchParams.get('seriesId')!) : undefined;

  const currentProgressRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  // Track progress from player store
  useEffect(() => {
    currentProgressRef.current = currentTime;
    durationRef.current = duration;
  }, [currentTime, duration]);

  useEffect(() => {
    if (!type || !streamId) {
      setError('Invalid player parameters: missing stream type or id.');
      return;
    }

    let url = '';
    
    if (directUrl) {
      url = directUrl;
    } else if (api) {
      if (type === 'live') {
        url = api.getLiveStreamUrl(parseInt(streamId), currentExt);
      } else if (type === 'vod') {
        url = api.getVodStreamUrl(parseInt(streamId), currentExt);
      } else if (type === 'series') {
        url = api.getSeriesStreamUrl(parseInt(streamId), currentExt);
      }
    } else if (serverUrl && username && password) {
      const streamType = type === 'vod' ? 'movie' : (type as 'live' | 'movie' | 'series');
      url = buildStreamUrl(serverUrl, username, password, streamType, parseInt(streamId), currentExt);
    } else {
      setError('Cannot construct stream URL. Authentication missing.');
      return;
    }

    console.log(`[OnyxStream] Playing ${type} stream:`, url);
    setStreamUrl(url);

    // Add to history
    addToHistory({
      type: type as 'live' | 'vod' | 'series',
      streamId: parseInt(streamId),
      name: title,
      icon: icon,
      categoryId: '',
      progress: 0,
      duration: 0,
      seasonNum: season,
      episodeNum: episode,
      seriesId: seriesIdParam,
      containerExtension: currentExt,
    });

  }, [type, streamId, api, directUrl, currentExt, serverUrl, username, password, title, icon, season, episode, seriesIdParam, addToHistory]);

  // Handle unmount to save progress
  useEffect(() => {
    return () => {
      if ((type === 'vod' || type === 'series') && streamId && currentProgressRef.current > 0) {
        updateProgress(parseInt(streamId), currentProgressRef.current, durationRef.current);
      }
    };
  }, [type, streamId, updateProgress]);

  const handleBack = () => {
    navigate(-1);
  };

  const toggleStreamFormat = () => {
    if (type === 'live') {
      setCurrentExt(prev => (prev === 'm3u8' ? 'ts' : 'm3u8'));
    } else {
      setCurrentExt(prev => (prev === 'mp4' ? 'mkv' : 'mp4'));
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center text-white p-6 text-center">
        <h2 className="text-2xl font-bold mb-4 text-red-500">Playback Error</h2>
        <p className="text-gray-300 mb-8 max-w-md">{error}</p>
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="bg-gray-800 hover:bg-gray-700 px-6 py-2 rounded-lg font-medium transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!streamUrl) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <LoadingSpinner message="Connecting to stream..." />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-[100] overflow-hidden">
      <VideoPlayer 
        src={streamUrl} 
        title={title} 
        type={type as 'live' | 'vod' | 'series'} 
        onBack={handleBack}
      />

      {/* Stream format switcher pill for troubleshooting tricky IPTV feeds */}
      {type === 'live' && (
        <button
          onClick={toggleStreamFormat}
          className="absolute top-4 right-20 z-40 bg-black/50 hover:bg-black/80 text-gray-300 hover:text-white px-2.5 py-1 rounded text-xs border border-white/10 transition-colors"
          title="Toggle stream protocol between M3U8 (HLS) and TS (MPEG-TS)"
        >
          Format: {currentExt.toUpperCase()}
        </button>
      )}
    </div>
  );
};

export default PlayerPage;
