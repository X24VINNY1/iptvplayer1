import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useXtreamAPI } from '@/hooks/useXtreamAPI';
import { buildStreamUrl, getStreamPlaybackUrl } from '@/utils/url';
import VideoPlayer from '@/components/player/VideoPlayer';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { LiveStream } from '@/types';
import { ArrowLeft } from 'lucide-react';

const PlayerPage: React.FC = () => {
  const { type, streamId } = useParams<{ type: 'live' | 'vod' | 'series'; streamId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { serverUrl, username, password } = useAuthStore();
  const api = useXtreamAPI();
  const { addToHistory, updateProgress } = useHistoryStore();
  const { currentTime, duration } = usePlayerStore();

  // Smart default format extension
  const defaultExt = type === 'live' ? 'm3u8' : 'mp4';
  const paramExt = searchParams.get('ext');
  const validExt = (paramExt && paramExt !== 'undefined' && paramExt !== 'null' && paramExt.trim() !== '') ? paramExt : defaultExt;
  // Normalize mkv/avi to mp4 for universal HTML5 browser decoder support
  const normalizedExt = (type !== 'live' && (validExt === 'mkv' || validExt === 'avi')) ? 'mp4' : validExt;
  const [currentExt, setCurrentExt] = useState<string>(normalizedExt);

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

    let rawUrl = '';
    
    if (directUrl) {
      rawUrl = directUrl;
    } else if (api) {
      if (type === 'live') {
        rawUrl = api.getLiveStreamUrl(parseInt(streamId), currentExt);
      } else if (type === 'vod') {
        rawUrl = api.getVodStreamUrl(parseInt(streamId), currentExt);
      } else if (type === 'series') {
        rawUrl = api.getSeriesStreamUrl(parseInt(streamId), currentExt);
      }
    } else if (serverUrl && username && password) {
      const streamType = type === 'vod' ? 'movie' : (type as 'live' | 'movie' | 'series');
      rawUrl = buildStreamUrl(serverUrl, username, password, streamType, parseInt(streamId), currentExt);
    } else {
      setError('Cannot construct stream URL. Authentication credentials missing.');
      return;
    }

    // Convert to optimal playback URL (routes through streaming proxy on Web to bypass Mixed Content & CORS)
    const effectivePlaybackUrl = getStreamPlaybackUrl(rawUrl);
    console.log(`[OnyxStream] Playing ${type} stream via web proxy:`, effectivePlaybackUrl);
    setStreamUrl(effectivePlaybackUrl);

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
      setCurrentExt(prev => (prev === 'mp4' ? 'm3u8' : 'mp4'));
    }
  };

  const handleSelectChannel = (channel: LiveStream) => {
    if (channel.direct_source) {
      navigate(`/player/live/${channel.stream_id}?name=${encodeURIComponent(channel.name)}&directUrl=${encodeURIComponent(channel.direct_source)}`, { replace: true });
    } else {
      navigate(`/player/live/${channel.stream_id}?name=${encodeURIComponent(channel.name)}&icon=${encodeURIComponent(channel.stream_icon || '')}`, { replace: true });
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col items-center justify-center text-white p-6 text-center">
        <h2 className="text-2xl font-bold mb-3 text-red-500">Playback Error</h2>
        <p className="text-gray-300 mb-8 max-w-md text-sm">{error}</p>
        <button 
          onClick={handleBack} 
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    );
  }

  if (!streamUrl) {
    return (
      <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col items-center justify-center">
        <LoadingSpinner message="Connecting to stream..." />
        <button 
          onClick={handleBack} 
          className="mt-6 flex items-center gap-2 text-xs text-gray-400 hover:text-white px-4 py-2 rounded-lg bg-gray-900 border border-gray-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Cancel & Go Back
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="fixed inset-0 bg-black z-[100] overflow-hidden select-none">
        <VideoPlayer 
          src={streamUrl} 
          title={title} 
          type={type as 'live' | 'vod' | 'series'} 
          currentFormat={currentExt}
          onBack={handleBack}
          onFormatFallback={toggleStreamFormat}
          onSelectChannel={handleSelectChannel}
        />
      </div>
    </ErrorBoundary>
  );
};

export default PlayerPage;
