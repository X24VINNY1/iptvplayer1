import React, { useRef, useEffect, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import PlayerControls from './PlayerControls';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';

interface VideoPlayerProps {
  src: string;
  title?: string;
  type?: 'live' | 'vod' | 'series';
  onBack?: () => void;
  autoPlay?: boolean;
  onFormatFallback?: () => void;
}

export default function VideoPlayer({
  src,
  title,
  type = 'vod',
  onBack,
  autoPlay = true,
  onFormatFallback
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Hook up video player engine & events with Anti-Lag and auto-format fallback
  const { retry, flushAndResync } = useVideoPlayer(videoRef, src, type, autoPlay, onFormatFallback);

  const {
    isLoading,
    error,
    reset,
    setIsFullscreen,
    setVolume,
    toggleMute
  } = usePlayerStore();

  useEffect(() => {
    reset();
    return () => reset();
  }, [src, reset]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3500);
  };

  const handleMouseLeave = () => {
    if (videoRef.current && !videoRef.current.paused) {
      setShowControls(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [setIsFullscreen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          if (videoRef.current.paused) {
            videoRef.current.play().catch(console.warn);
          } else {
            videoRef.current.pause();
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (type !== 'live') {
            videoRef.current.currentTime = Math.min(
              videoRef.current.currentTime + 10,
              videoRef.current.duration || 0
            );
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (type !== 'live') {
            videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          {
            const newVol = Math.min(videoRef.current.volume + 0.1, 1);
            videoRef.current.volume = newVol;
            setVolume(newVol);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          {
            const newVol = Math.max(videoRef.current.volume - 0.1, 0);
            videoRef.current.volume = newVol;
            setVolume(newVol);
          }
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else if (onBack) {
            onBack();
          }
          break;
      }
      handleMouseMove();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMute, setVolume, type, onBack]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black relative group overflow-hidden flex flex-col select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseMove}
      onDoubleClick={toggleFullscreen}
    >
      {/* Video Element - no crossOrigin to allow unheadered IPTV streams */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
        preload="auto"
        onClick={() => {
          if (videoRef.current) {
            if (videoRef.current.paused) videoRef.current.play().catch(console.warn);
            else videoRef.current.pause();
          }
        }}
      />

      {/* Loading Spinner Overlay */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10 pointer-events-none">
          <Loader2 className="w-14 h-14 text-indigo-500 animate-spin mb-3" />
          <p className="text-gray-300 text-sm font-medium animate-pulse">Buffering stream...</p>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 p-6 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold text-white mb-2">Playback Error</h2>
          <p className="text-gray-300 mb-6 max-w-md text-sm">{error}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {onFormatFallback && (
              <button
                onClick={onFormatFallback}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Auto-Fix Format (Switch TS / M3U8)
              </button>
            )}
            <button
              onClick={retry}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Playback
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-2.5 rounded-xl font-medium transition-colors"
              >
                Go Back
              </button>
            )}
          </div>
        </div>
      )}

      {/* Player Controls Overlay */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          showControls && !error ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } z-30`}
      >
        <PlayerControls
          videoRef={videoRef}
          isLive={type === 'live'}
          title={title}
          onBack={onBack}
          onFlushAndResync={flushAndResync}
        />
      </div>
    </div>
  );
}
