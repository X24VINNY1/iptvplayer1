import React, { useRef, useEffect, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import PlayerControls from './PlayerControls';
import { Loader2, AlertCircle, RefreshCw, Play, ArrowLeft, Tv, Globe } from 'lucide-react';
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

  // Hook up video player engine & events
  const { retry, flushAndResync } = useVideoPlayer(videoRef, src, type, autoPlay);

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

  // Keyboard & D-Pad navigation for Android TV remotes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleUserActivity();
      if (!videoRef.current) return;

      switch (e.key) {
        case ' ':
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
          className="absolute top-4 left-4 z-50 p-3 rounded-full bg-black/70 hover:bg-black/90 text-white/90 hover:text-white backdrop-blur-md transition-all border border-white/10 shadow-lg opacity-80 hover:opacity-100"
          title="Go Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

      {/* Click to Play Overlay (fixes autoplay blocks and clarifies ready state) */}
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

      {/* Error Overlay with Native Player / VLC / MX Player 1-Click Launchers */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/95 z-40 p-6 text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold text-white mb-2">Playback Notice</h2>
          <p className="text-gray-300 mb-6 max-w-lg text-sm leading-relaxed">{error}</p>
          
          <div className="flex flex-wrap items-center justify-center gap-3 max-w-xl">
            {/* Native Hardware Player */}
            <button
              onClick={() => openInNativePlayer(src, title || 'OnyxStream', type === 'live')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-95"
            >
              <Tv className="w-4 h-4" />
              Play in Native Player
            </button>

            {/* VLC Player */}
            <button
              onClick={() => openInVlc(src, title || 'OnyxStream')}
              className="bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-orange-600/30 active:scale-95"
            >
              <span>🟧</span>
              Play in VLC
            </button>

            {/* MX Player */}
            <button
              onClick={() => openInMxPlayer(src, title || 'OnyxStream')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/30 active:scale-95"
            >
              <span>🟦</span>
              Play in MX Player
            </button>

            {/* Auto-Fix Format Switcher */}
            {onFormatFallback && (
              <button
                onClick={onFormatFallback}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Switch Format (MP4 / M3U8)
              </button>
            )}

            {/* Toggle Cloud Proxy */}
            <button
              onClick={() => {
                toggleProxy();
                retry();
              }}
              className="bg-gray-800 hover:bg-gray-700 text-amber-400 px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 shadow active:scale-95 border border-gray-700"
            >
              <Globe className="w-4 h-4" />
              {useProxy ? 'Turn Off Proxy' : 'Enable Cloud Proxy'}
            </button>

            {/* Retry */}
            <button
              onClick={retry}
              className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 shadow active:scale-95 border border-gray-700"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>

            {/* Go Back */}
            {onBack && (
              <button
                onClick={onBack}
                className="bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white px-5 py-2.5 rounded-xl font-medium transition-all active:scale-95"
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
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
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
