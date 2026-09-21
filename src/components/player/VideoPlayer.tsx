import React, { useRef, useEffect, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import PlayerControls from './PlayerControls';
import { Loader2, AlertCircle, RefreshCw, Play, ArrowLeft, RotateCcw } from 'lucide-react';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { LiveStream } from '@/types';

interface VideoPlayerProps {
  src: string;
  title?: string;
  type?: 'live' | 'vod' | 'series';
  currentFormat?: string;
  onBack?: () => void;
  autoPlay?: boolean;
  onFormatFallback?: () => void;
  onSelectChannel?: (channel: LiveStream) => void;
}

export default function VideoPlayer({
  src,
  title,
  type = 'vod',
  currentFormat = 'AUTO',
  onBack,
  autoPlay = true,
  onFormatFallback,
  onSelectChannel
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Hook up video player engine & events
  const { retry, flushAndResync } = useVideoPlayer(videoRef, src, type, autoPlay);

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
    return () => reset();
  }, [src]);

  const handleUserActivity = () => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    // Only auto-hide if playing smoothly without loading or error
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

  // Keyboard & D-Pad navigation for Android TV remotes & web shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleUserActivity();
      if (!videoRef.current) return;

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
        case 'Enter':
        case 'Select':
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
        case 'Back':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else if (onBack) {
            onBack();
          }
          break;
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

      {/* Click to Start Playback Overlay (Bypasses Browser Autoplay Restrictions) */}
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

      {/* Loading Spinner Overlay */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10 pointer-events-none">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-3" />
          <p className="text-gray-300 text-xs font-medium tracking-wide animate-pulse">
            Connecting & Buffering Stream...
          </p>
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
            {/* Auto-Fix Format Switcher */}
            {onFormatFallback && (
              <button
                onClick={onFormatFallback}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-95"
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
          onBack={onBack}
          onFlushAndResync={flushAndResync}
          onToggleFormat={onFormatFallback}
          onSelectChannel={onSelectChannel}
        />
      </div>
    </div>
  );
}
