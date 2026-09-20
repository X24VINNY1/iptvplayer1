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
  const { type, streamId } = useParams<{ type: string; streamId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { serverUrl, username, password } = useAuthStore();
  const api = useXtreamAPI();
  const { addToHistory, updateProgress } = useHistoryStore();
  const { currentTime, duration } = usePlayerStore();

  const [streamUrl, setStreamUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  const ext = searchParams.get('ext') || 'm3u8';
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
      setError('Invalid player parameters');
      return;
    }

    let url = '';
    
    if (directUrl) {
      url = directUrl;
    } else if (api) {
      if (type === 'live') {
        url = api.getLiveStreamUrl(parseInt(streamId), ext);
      } else if (type === 'vod') {
        url = api.getVodStreamUrl(parseInt(streamId), ext);
      } else if (type === 'series') {
        url = api.getSeriesStreamUrl(parseInt(streamId), ext);
      }
    } else if (serverUrl && username && password) {
      const streamType = type === 'vod' ? 'movie' : type as 'live' | 'movie' | 'series';
      url = buildStreamUrl(serverUrl, username, password, streamType, parseInt(streamId), ext);
    } else {
      setError('Cannot construct stream URL. Not authenticated.');
      return;
    }

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
      containerExtension: ext,
    });

  }, [type, streamId, api, directUrl, ext, serverUrl, username, password, title, icon, season, episode, seriesIdParam, addToHistory]);

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

  if (error) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center text-white p-6">
        <h2 className="text-2xl font-bold mb-4 text-red-500">Playback Error</h2>
        <p className="text-gray-300 mb-8">{error}</p>
        <button onClick={handleBack} className="bg-gray-800 hover:bg-gray-700 px-6 py-2 rounded-lg font-medium transition-colors">
          Go Back
        </button>
      </div>
    );
  }

  if (!streamUrl) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <LoadingSpinner message="Preparing stream..." />
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
    </div>
  );
};

export default PlayerPage;
