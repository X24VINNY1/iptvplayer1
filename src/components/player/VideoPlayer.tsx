import React, { useRef, useEffect, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import PlayerControls from './PlayerControls';
import { Loader2, AlertCircle } from 'lucide-react';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';

interface VideoPlayerProps {
  src: string;
  title?: string;
  type?: 'live' | 'vod' | 'series';
  onBack?: () => void;
  autoPlay?: boolean;
}

export default function VideoPlayer({ src, title, type = 'vod', onBack, autoPlay = true }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(true);
  let hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Assumes useVideoPlayer hooks up video events to the store
  useVideoPlayer(videoRef, src);
  
  const { 
    isLoading, 
    error,
    reset,
    setIsPlaying,
    setIsFullscreen,
    setCurrentTime,
    setVolume,
    toggleMute,
    volume,
    isMuted
  } = usePlayerStore();

  useEffect(() => {
    reset();
    if (autoPlay && videoRef.current) {
      videoRef.current.play().catch(e => console.warn('Autoplay prevented', e));
    }
    return () => reset();
  }, [src, reset, autoPlay]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3000);
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
          e.preventDefault();
          if (videoRef.current.paused) videoRef.current.play();
          else videoRef.current.pause();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
          break;
        case 'ArrowRight':
          e.preventDefault();
          videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, videoRef.current.duration);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
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
      }
      handleMouseMove();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMute, setVolume]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleDoubleClick = () => {
    toggleFullscreen();
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-black relative group overflow-hidden flex flex-col"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseMove}
      onDoubleClick={handleDoubleClick}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay={autoPlay}
        crossOrigin="anonymous"
        playsInline
      />

      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 pointer-events-none">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Playback Error</h2>
          <p className="text-gray-300 mb-6 text-center max-w-md">{error}</p>
          <button 
            onClick={() => {
              reset();
              if (videoRef.current) {
                videoRef.current.load();
                if (autoPlay) videoRef.current.play();
              }
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className={`absolute inset-0 transition-opacity duration-300 ${showControls && !error ? 'opacity-100' : 'opacity-0 pointer-events-none'} z-30`}>
        <PlayerControls 
          videoRef={videoRef} 
          isLive={type === 'live'} 
          title={title} 
          onBack={onBack} 
        />
      </div>
    </div>
  );
}
