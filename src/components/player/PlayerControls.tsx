import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  ArrowLeft, PictureInPicture2, Subtitles
} from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';

interface PlayerControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isLive?: boolean;
  title?: string;
  onBack?: () => void;
}

export default function PlayerControls({ videoRef, isLive, title, onBack }: PlayerControlsProps) {
  const { 
    isPlaying, 
    currentTime, 
    duration, 
    volume, 
    isMuted, 
    isFullscreen,
    isPiP
  } = usePlayerStore();
  
  const [showVolume, setShowVolume] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) return '00:00';
    const h = Math.floor(timeInSeconds / 3600);
    const m = Math.floor((timeInSeconds % 3600) / 60);
    const s = Math.floor(timeInSeconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newVol = parseFloat(e.target.value);
    videoRef.current.volume = newVol;
    if (newVol > 0 && videoRef.current.muted) {
      videoRef.current.muted = false;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.closest('div')?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP error', err);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current || isLive) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * duration;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="absolute inset-0 flex flex-col justify-between">
      {/* Top Bar */}
      <div className="w-full bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center gap-4">
        {onBack && (
          <button 
            onClick={onBack}
            className="p-2 text-white hover:text-indigo-400 transition-colors bg-black/20 hover:bg-black/40 rounded-full"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}
        {title && (
          <h2 className="text-white text-lg font-medium truncate drop-shadow-md">
            {title}
          </h2>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="w-full bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-12 flex flex-col gap-3">
        {/* Seek Bar */}
        {!isLive && (
          <div 
            className="w-full h-1.5 hover:h-2.5 transition-all bg-gray-800 cursor-pointer rounded-full relative group"
            ref={progressRef}
            onClick={handleSeek}
          >
            <div 
              className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
            <div 
              className="absolute top-1/2 -translate-y-1/2 -ml-1.5 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow"
              style={{ left: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={handlePlayPause}
              className="text-white hover:text-indigo-400 transition-colors p-2"
            >
              {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current" />}
            </button>
            
            <div 
              className="flex items-center gap-2 relative"
              onMouseEnter={() => setShowVolume(true)}
              onMouseLeave={() => setShowVolume(false)}
            >
              <button 
                onClick={toggleMute}
                className="text-white hover:text-indigo-400 transition-colors p-2"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>
              
              <div className={`transition-all duration-300 overflow-hidden flex items-center ${showVolume ? 'w-24 opacity-100' : 'w-0 opacity-0'}`}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>

            <div className="text-white text-sm font-medium tracking-wide">
              {isLive ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  LIVE
                </span>
              ) : (
                <span className="text-gray-300 drop-shadow-sm">
                  {formatTime(currentTime)} <span className="text-gray-500 mx-1">/</span> {formatTime(duration)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="text-white hover:text-indigo-400 transition-colors p-2">
              <Subtitles className="w-5 h-5" />
            </button>
            
            {document.pictureInPictureEnabled && (
              <button 
                onClick={togglePiP}
                className={`transition-colors p-2 ${isPiP ? 'text-indigo-400' : 'text-white hover:text-indigo-400'}`}
              >
                <PictureInPicture2 className="w-5 h-5" />
              </button>
            )}
            
            <button 
              onClick={toggleFullscreen}
              className="text-white hover:text-indigo-400 transition-colors p-2"
            >
              {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
