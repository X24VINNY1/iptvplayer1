import React, { useRef, useEffect, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import PlayerControls from './PlayerControls';
import { Loader2, AlertCircle, RefreshCw, Globe, Play, ArrowLeft, Tv } from 'lucide-react';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { openInNativePlayer, openInVlc, openInMxPlayer } from '@/utils/nativePlayer';

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
    isPlaying,
    isLoading,
    error,
    reset,
    setIsFullscreen,
    setVolume,
    toggleMute,
    useProxy,
    toggleProxy
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
    // Only schedule fade-out if the video is actually playing and not stalled/paused
    if (videoRef.current && !videoRef.current.paused && isPlaying && !isLoading) {
      hideControlsTimeout.current = setTimeout(() => {
        if (videoRef.current && !videoRef.current.paused && isPlaying && !isLoading) {
          setShowControls(false);
        }
      }, 4000);
    }
  };

  const handleMouseLeave = () => {
    if (videoRef.current && !videoRef.current.paused && isPlaying && !isLoading) {
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

      {/* Persistent Emergency Back Button - always accessible even if controls fade */}
      {onBack && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBack();
          }}
          className={`absolute top-4 left-4 z-50 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white backdrop-blur-md transition-all border border-white/10 shadow-lg ${
            showControls ? 'opacity-0 pointer-events-none' : 'opacity-70 hover:opacity-100'
          }`}
          title="Go Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

      {/* Click to Play Overlay (fixes browser autoplay blocking & gives clear visual feedback) */}
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
          <div className="w-20 h-20 rounded-full bg-indigo-600/90 group-hover/play:bg-indigo-500 group-hover/play:scale-110 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/50 transition-all">
            <Play className="w-10 h-10 fill-current ml-1" />
          </div>
          <p className="text-white text-sm font-semibold mt-4 drop-shadow-md tracking-wide">
            Click to Start Playback
          </p>
        </div>
      )}

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
            {/* Native & External Player fallbacks directly on error */}
            <button
              onClick={() => openInNativePlayer(src, title || 'OnyxStream', type === 'live')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-95"
              title="Launch in Android Hardware-Accelerated Native Player"
            >
              <Tv className="w-4 h-4" />
              Play in Native Player
            </button>
            <button
              onClick={() => openInVlc(src, title || 'OnyxStream')}
              className="bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-orange-600/30 active:scale-95"
              title="Open stream in VLC Player app"
            >
              <span>🟧</span>
              Play in VLC
            </button>
            <button
              onClick={() => openInMxPlayer(src, title || 'OnyxStream')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/30 active:scale-95"
              title="Open stream in MX Player"
            >
              <span>🟦</span>
              Play in MX Player
            </button>

            {onFormatFallback && (
              <button
                onClick={onFormatFallback}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Auto-Fix Format
              </button>
            )}
            <button
              onClick={retry}
              className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2 shadow-lg active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
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
          src={src}
          isLive={type === 'live'}
          title={title}
          onBack={onBack}
          onFlushAndResync={flushAndResync}
        />
      </div>
    </div>
  );
}
