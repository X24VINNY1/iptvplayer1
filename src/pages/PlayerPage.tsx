import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useXtreamAPI } from '@/hooks/useXtreamAPI';
import { buildStreamUrl, getStreamPlaybackUrl } from '@/utils/url';
import { useSettingsStore } from '@/store/useSettingsStore';
import { openInNativePlayer, openInVlc, openInMxPlayer, openInSystemChooser, isNativeAndroid } from '@/utils/nativePlayer';
import VideoPlayer from '@/components/player/VideoPlayer';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { LiveStream } from '@/types';
import { ArrowLeft } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

const PlayerPage: React.FC = () => {
  const { type, streamId } = useParams<{ type: 'live' | 'vod' | 'series'; streamId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { serverUrl, username, password } = useAuthStore();
  const api = useXtreamAPI();
  const { addToHistory, updateProgress } = useHistoryStore();

  const { preferredPlayer } = useSettingsStore();
  const [nativePlayerAttempted, setNativePlayerAttempted] = useState(false);

  // Smart default format extension: m3u8 for live (HLS standard), mp4 for vod
  const defaultExt = type === 'live' ? 'm3u8' : 'mp4';
  const paramExt = searchParams.get('ext');
  const validExt = (paramExt && paramExt !== 'undefined' && paramExt !== 'null' && paramExt.trim() !== '') 
    ? paramExt.toLowerCase() 
    : defaultExt;
  const [currentExt, setCurrentExt] = useState<string>(validExt);

  // Connection mode: Proxy by default on web so the server fetches the Xtream URL and streams to the website
  const initialMode: 'proxy' | 'direct' = Capacitor.isNativePlatform() ? 'direct' : 'proxy';
  const [connectionMode, setConnectionMode] = useState<'proxy' | 'direct'>(initialMode);

  const [streamUrl, setStreamUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  const title = searchParams.get('name') || 'Unknown Stream';
  const icon = searchParams.get('icon') || '';
  const directUrl = searchParams.get('directUrl');
  const season = searchParams.get('season') ? parseInt(searchParams.get('season')!) : undefined;
  const episode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!) : undefined;
  const seriesIdParam = searchParams.get('seriesId') ? parseInt(searchParams.get('seriesId')!) : undefined;

  useEffect(() => {
    setNativePlayerAttempted(false);
  }, [type, streamId, currentExt, connectionMode]);

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

    // Resolve playback URL based on current connectionMode
    const effectivePlaybackUrl = getStreamPlaybackUrl(rawUrl, connectionMode);
    console.log(`[OnyxStream] Playing ${type} stream [mode: ${connectionMode}]:`, effectivePlaybackUrl);
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

  }, [type, streamId, api, directUrl, currentExt, connectionMode, serverUrl, username, password, title, icon, season, episode, seriesIdParam, addToHistory]);

  // On Android TV: attempt to launch preferred native player
  useEffect(() => {
    if (!isNativeAndroid() || preferredPlayer === 'builtin' || nativePlayerAttempted || !streamUrl) return;
    
    setNativePlayerAttempted(true);
    
    // Build the raw direct URL (no proxy) for native player
    const rawUrl = directUrl || (api 
      ? (type === 'live' ? api.getLiveStreamUrl(parseInt(streamId!), currentExt)
         : type === 'vod' ? api.getVodStreamUrl(parseInt(streamId!), currentExt)
         : api.getSeriesStreamUrl(parseInt(streamId!), currentExt))
      : buildStreamUrl(serverUrl, username, password, type === 'vod' ? 'movie' : (type as any), parseInt(streamId!), currentExt));
    
    const launch = async () => {
      let success = false;
      try {
        if (preferredPlayer === 'vlc') {
          success = await openInVlc(rawUrl, title);
        } else if (preferredPlayer === 'mx') {
          success = await openInMxPlayer(rawUrl, title);
        } else if (preferredPlayer === 'chooser') {
          success = await openInSystemChooser(rawUrl, title);
        } else {
          success = await openInNativePlayer(rawUrl, title, type === 'live');
        }
      } catch (err) {
        console.warn('Native player launch failed, falling back to builtin:', err);
      }
      // If native player launched, we don't navigate back — the native activity overlays the WebView
      // If it failed, the builtin WebView player continues as fallback
    };
    
    launch();
  }, [streamUrl, preferredPlayer, nativePlayerAttempted, type, streamId, currentExt, directUrl, api, serverUrl, username, password, title]);

  // Unmount hook: save progress directly from Zustand state to avoid subscribing and re-rendering on every timeupdate
  useEffect(() => {
    return () => {
      const { currentTime, duration } = usePlayerStore.getState();
      if ((type === 'vod' || type === 'series') && streamId && currentTime > 0) {
        updateProgress(parseInt(streamId), currentTime, duration);
      }
    };
  }, [type, streamId, updateProgress]);

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const toggleStreamFormat = useCallback(() => {
    if (type === 'live') {
      setCurrentExt(prev => (prev === 'm3u8' ? 'ts' : 'm3u8'));
    } else {
      setCurrentExt(prev => {
        if (prev === 'mkv') return 'mp4';
        if (prev === 'mp4') return 'm3u8';
        return 'mp4';
      });
    }
  }, [type]);

  const toggleConnectionRoute = useCallback(() => {
    setConnectionMode(prev => (prev === 'proxy' ? 'direct' : 'proxy'));
  }, []);

  const handleSelectChannel = useCallback((channel: LiveStream) => {
    if (channel.direct_source) {
      navigate(`/player/live/${channel.stream_id}?name=${encodeURIComponent(channel.name)}&directUrl=${encodeURIComponent(channel.direct_source)}`, { replace: true });
    } else {
      navigate(`/player/live/${channel.stream_id}?name=${encodeURIComponent(channel.name)}&icon=${encodeURIComponent(channel.stream_icon || '')}`, { replace: true });
    }
  }, [navigate]);

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
          connectionMode={connectionMode}
          onBack={handleBack}
          onFormatFallback={toggleStreamFormat}
          onToggleRoute={toggleConnectionRoute}
          onSelectChannel={handleSelectChannel}
        />
      </div>
    </ErrorBoundary>
  );
};

export default PlayerPage;
