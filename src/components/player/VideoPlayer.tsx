import React, { useRef, useEffect, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import PlayerControls from './PlayerControls';
import { Loader2, AlertCircle, RefreshCw, Play, ArrowLeft, RotateCcw, Zap } from 'lucide-react';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { LiveStream } from '@/types';

interface VideoPlayerProps {
  src: string;
  title?: string;
  type?: 'live' | 'vod' | 'series';
  currentFormat?: string;
  connectionMode?: 'proxy' | 'direct';
  onBack?: () => void;
  autoPlay?: boolean;
  onFormatFallback?: () => void;
  onToggleRoute?: () => void;
  onSelectChannel?: (channel: LiveStream) => void;
}

export default function VideoPlayer({
  src,
  title,
  type = 'vod',
  currentFormat = 'AUTO',
  connectionMode = 'direct',
  onBack,
  autoPlay = true,
  onFormatFallback,
  onToggleRoute,
  onSelectChannel
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(true);
  const [slowBufferHint, setSlowBufferHint] = useState(false);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Hook up video player engine & events with auto-healing format fallback
  const { retry, flushAndResync } = useVideoPlayer(videoRef, src, type, autoPlay, onFormatFallback);

  const {
    isPlaying,
    isLoading,
    error,
    reset,
    setIsFullscreen,
    setVolume,
    toggleMute
  } = usePlayerStore();

  useEffect(() => {
    reset();
    setSlowBufferHint(false);
    return () => reset();
  }, [src]);

  // If buffering takes more than 3.5 seconds, display the fast fallback switch option
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isLoading) {
      timer = setTimeout(() => {
        setSlowBufferHint(true);
      }, 3500);
    } else {
      setSlowBufferHint(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading]);

  const handleUserActivity = () => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    if (videoRef.current && !videoRef.current.paused && isPlaying && !isLoading && !error) {
      hideControlsTimeout.current = setTimeout(() => {
        if (videoRef.current && !videoRef.current.paused && isPlaying && !isLoading && !error) {
          setShowControls(false);
        }
      }, 4500);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [setIsFullscreen]);

  // Keyboard & D-Pad navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleUserActivity();
      if (!videoRef.current) return;

      const keyCode = e.keyCode || e.which;
      const key = e.key;

      const isSelect = key === ' ' || key === 'k' || key === 'K' || key === 'Enter' || key === 'Select' || keyCode === 13 || keyCode === 23 || keyCode === 66;
      const isRight = key === 'ArrowRight' || keyCode === 39 || keyCode === 22;
      const isLeft = key === 'ArrowLeft' || keyCode === 37 || keyCode === 21;
      const isUp = key === 'ArrowUp' || keyCode === 38 || keyCode === 19;
      const isDown = key === 'ArrowDown' || keyCode === 40 || keyCode === 20;
      const isBack = key === 'Escape' || key === 'Back' || key === 'BrowserBack' || key === 'GoBack' || keyCode === 27 || keyCode === 4;

      if (isSelect) {
        e.preventDefault();
        if (videoRef.current.paused) {
          videoRef.current.play().catch(console.warn);
        } else {
          videoRef.current.pause();
        }
        return;
      }

      if (key === 'f' || key === 'F') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      if (key === 'm' || key === 'M') {
        e.preventDefault();
        toggleMute();
        return;
      }

      if (isRight) {
        e.preventDefault();
        if (type !== 'live') {
          videoRef.current.currentTime = Math.min(
            videoRef.current.currentTime + 10,
            videoRef.current.duration || 0
          );
        }
        return;
      }

      if (isLeft) {
        e.preventDefault();
        if (type !== 'live') {
          videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
        }
        return;
      }

      if (isUp) {
        e.preventDefault();
        const newVol = Math.min(videoRef.current.volume + 0.1, 1);
        videoRef.current.volume = newVol;
        setVolume(newVol);
        return;
      }

      if (isDown) {
        e.preventDefault();
        const newVol = Math.max(videoRef.current.volume - 0.1, 0);
        videoRef.current.volume = newVol;
        setVolume(newVol);
        return;
      }

      if (isBack) {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else if (onBack) {
          onBack();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMute, setVolume, type, onBack, isPlaying, isLoading, error]);

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
      onMouseMove={handleUserActivity}
      onMouseLeave={() => {
        if (videoRef.current && !videoRef.current.paused && isPlaying && !isLoading && !error) {
          setShowControls(false);
        }
      }}
      onTouchStart={handleUserActivity}
      onClick={handleUserActivity}
      onDoubleClick={toggleFullscreen}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain cursor-pointer bg-black"
        playsInline
        preload="auto"
        onClick={() => {
          if (videoRef.current) {
            if (videoRef.current.paused) videoRef.current.play().catch(console.warn);
            else videoRef.current.pause();
          }
        }}
      />

      {/* Emergency Always-Visible Back Button if controls hide */}
      {onBack && !showControls && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBack();
          }}
          className="absolute top-4 left-4 z-50 p-2.5 rounded-xl bg-black/70 hover:bg-black/90 text-white/90 hover:text-white backdrop-blur-md transition-all border border-white/10 shadow-lg"
          title="Go Back (Esc)"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

      {/* Click to Start Playback Overlay */}
      {!isLoading && !error && (!isPlaying || (videoRef.current && videoRef.current.paused)) && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (videoRef.current) {
              videoRef.current.play().catch(console.warn);
              setShowControls(true);
            }
          }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-20 cursor-pointer backdrop-blur-[2px] transition-all group/play"
        >
          <div className="w-20 h-20 rounded-2xl bg-indigo-600/90 group-hover/play:bg-indigo-500 group-hover/play:scale-105 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/50 transition-all">
            <Play className="w-10 h-10 fill-current ml-1" />
          </div>
          <p className="text-white text-sm font-semibold mt-4 drop-shadow-md tracking-wide">
            Click to Start Playback
          </p>
        </div>
      )}

      {/* Loading Spinner Overlay with Fast Route Switcher */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10 pointer-events-auto">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-3" />
          <p className="text-gray-300 text-xs font-medium tracking-wide animate-pulse mb-3">
            Connecting & Buffering Stream...
          </p>

          {/* If buffering takes more than 3.5 seconds, give the user 1-click route swap */}
          {slowBufferHint && onToggleRoute && (
            <button
              onClick={onToggleRoute}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all active:scale-95 animate-fade-in"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>
                Buffering slow? Switch to {connectionMode === 'proxy' ? 'Direct Stream' : 'Proxy Route'}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Playback Error Overlay with In-App Healing Actions */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/95 z-40 p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-4 shadow-lg shadow-amber-500/20">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Stream Playback Notice</h2>
          <p className="text-gray-300 mb-6 max-w-md text-xs sm:text-sm leading-relaxed">{error}</p>
          
          <div className="flex flex-wrap items-center justify-center gap-3 max-w-md">
            {/* Toggle Route between Proxy and Direct */}
            {onToggleRoute && (
              <button
                onClick={onToggleRoute}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-95"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                Switch to {connectionMode === 'proxy' ? 'Direct Stream' : 'Proxy Stream'}
              </button>
            )}

            {/* Auto-Fix Format Switcher */}
            {onFormatFallback && (
              <button
                onClick={onFormatFallback}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow active:scale-95 border border-gray-700"
              >
                <RefreshCw className="w-4 h-4" />
                Switch Format (MP4 / HLS)
              </button>
            )}

            {/* Retry Stream */}
            <button
              onClick={retry}
              className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow active:scale-95 border border-gray-700"
            >
              <RotateCcw className="w-4 h-4" />
              Retry Connection
            </button>

            {/* Go Back */}
            {onBack && (
              <button
                onClick={onBack}
                className="bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all active:scale-95 border border-gray-800"
              >
                Go Back
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modern Player Controls Overlay */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } z-30`}
      >
        <PlayerControls
          videoRef={videoRef}
          src={src}
          isLive={type === 'live'}
          title={title}
          currentFormat={currentFormat}
          connectionMode={connectionMode}
          onBack={onBack}
          onFlushAndResync={flushAndResync}
          onToggleFormat={onFormatFallback}
          onToggleRoute={onToggleRoute}
          onSelectChannel={onSelectChannel}
        />
      </div>
    </div>
  );
}
