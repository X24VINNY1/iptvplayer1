import React, { useState, useRef } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  ArrowLeft, PictureInPicture2, Subtitles, ShieldCheck, Zap, RefreshCw, ChevronDown, Globe, Tv, ExternalLink
} from 'lucide-react';
import { usePlayerStore, AntiLagMode } from '@/store/usePlayerStore';
import { openInVlc, openInMxPlayer, openInNativePlayer, openInSystemChooser } from '@/utils/nativePlayer';

interface PlayerControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  src?: string;
  isLive?: boolean;
  title?: string;
  onBack?: () => void;
  onFlushAndResync?: () => void;
}

export default function PlayerControls({
  videoRef,
  src,
  isLive,
  title,
  onBack,
  onFlushAndResync
}: PlayerControlsProps) {
  const { 
    isPlaying, 
    currentTime, 
    duration, 
    volume, 
    isMuted, 
    isFullscreen,
    isPiP,
    antiLagEnabled,
    antiLagMode,
    bufferLength,
    lagRecoveries,
    useProxy,
    toggleProxy,
    setAntiLagEnabled,
    setAntiLagMode
  } = usePlayerStore();
  
  const [showVolume, setShowVolume] = useState(false);
  const [showAntiLagMenu, setShowAntiLagMenu] = useState(false);
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
      videoRef.current.play().catch(console.warn);
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
    <div className="absolute inset-0 flex flex-col justify-between select-none">
      {/* Top Bar */}
      <div className="w-full bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
        <div className="flex items-center gap-4 truncate">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 text-white hover:text-indigo-400 transition-colors bg-black/40 hover:bg-black/60 rounded-full shrink-0"
              title="Back (Esc)"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          {title && (
            <h2 className="text-white text-lg font-semibold truncate drop-shadow-md">
              {title}
            </h2>
          )}
        </div>

        {/* Top Right Quick Badges */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Native & External Player Launchers */}
          {src && (
            <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-full border border-white/10 backdrop-blur-md">
              <button
                onClick={() => {
                  if (videoRef.current) videoRef.current.pause();
                  openInNativePlayer(src, title || 'OnyxStream', isLive);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-600/30 hover:bg-indigo-600/60 transition-colors active:scale-95"
                title="Open in Internal Native Hardware Player (ExoPlayer)"
              >
                <Tv className="w-3.5 h-3.5 text-indigo-400" />
                <span>Native Player</span>
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) videoRef.current.pause();
                  openInVlc(src, title || 'OnyxStream');
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-orange-300 hover:text-white bg-orange-600/30 hover:bg-orange-600/60 transition-colors active:scale-95"
                title="Open in VLC Player (Android TV / PC)"
              >
                <span>🟧</span>
                <span>VLC</span>
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) videoRef.current.pause();
                  openInMxPlayer(src, title || 'OnyxStream');
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-blue-300 hover:text-white bg-blue-600/30 hover:bg-blue-600/60 transition-colors active:scale-95"
                title="Open in MX Player"
              >
                <span>🟦</span>
                <span>MX</span>
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) videoRef.current.pause();
                  openInSystemChooser(src, title || 'OnyxStream');
                }}
                className="p-1.5 rounded-full text-xs font-semibold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors"
                title="Open in other external player (Just Player, Kodi, etc.)"
              >
                <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          )}

          {/* Stream Proxy Toggle */}
          <button
            onClick={toggleProxy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md ${
              useProxy
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 shadow-amber-500/10'
                : 'bg-gray-800/80 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
            title="Toggles high-speed Cloud Proxy to bypass browser CORS / SSL blocks on HTTP streams"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>Proxy: {useProxy ? 'ON' : 'OFF'}</span>
          </button>

          {/* Anti-Lag Shield Toggle Button */}
          <div className="relative">
            <button
              onClick={() => setShowAntiLagMenu(!showAntiLagMenu)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md ${
                antiLagEnabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 shadow-emerald-500/10'
                  : 'bg-gray-800/80 text-gray-400 border border-gray-700 hover:bg-gray-700'
              }`}
              title="Anti-Lag & Buffer Health Engine"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Anti-Lag: {antiLagEnabled ? 'ON' : 'OFF'}</span>
              {bufferLength > 0 && (
                <span className="ml-1 text-[10px] opacity-80 font-normal">
                  ({bufferLength}s)
                </span>
              )}
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {/* Anti-Lag Flyout Popover */}
            {showAntiLagMenu && (
              <div 
                className="absolute right-0 top-10 w-72 bg-gray-900/95 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 shadow-2xl z-50 text-white flex flex-col gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold">Anti-Lag Engine</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={antiLagEnabled} 
                      onChange={(e) => setAntiLagEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Buffer Mode Selector */}
                <div>
                  <span className="text-xs text-gray-400 block mb-1.5 font-medium">Stream Buffer Profile:</span>
                  <div className="grid grid-cols-3 gap-1 bg-gray-800/60 p-1 rounded-xl">
                    {(['smooth', 'balanced', 'low-latency'] as AntiLagMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setAntiLagMode(mode)}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                          antiLagMode === mode
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {mode === 'smooth' ? 'Smooth' : mode === 'balanced' ? 'Balanced' : 'Realtime'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {antiLagMode === 'smooth' && 'Deep 45s buffer to completely stop freezing on fluctuating Wi-Fi.'}
                    {antiLagMode === 'balanced' && 'Standard buffer balancing live delay and smooth playback.'}
                    {antiLagMode === 'low-latency' && 'Pushes close to real-time live edge (requires fast internet).'}
                  </p>
                </div>

                {/* Live Stats */}
                <div className="bg-gray-800/40 p-2.5 rounded-xl border border-gray-700/40 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Buffer Ahead</span>
                    <span className="font-bold text-emerald-400">{bufferLength} seconds</span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 block text-[10px]">Lags Bypassed</span>
                    <span className="font-bold text-indigo-400">{lagRecoveries} auto-fixed</span>
                  </div>
                </div>

                {/* Resync Action Button */}
                {onFlushAndResync && (
                  <button
                    onClick={() => {
                      onFlushAndResync();
                      setShowAntiLagMenu(false);
                    }}
                    className="w-full py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Flush Buffer & Resync Stream
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="w-full bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 pt-12 flex flex-col gap-3">
        {/* Seek Bar (for VOD/Series) */}
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
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
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
                title="Mute (M)"
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
                <span className="flex items-center gap-2 bg-red-600/20 px-2.5 py-1 rounded-full border border-red-500/40 text-xs font-bold text-red-400">
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
                title="Picture in Picture"
              >
                <PictureInPicture2 className="w-5 h-5" />
              </button>
            )}
            
            <button 
              onClick={toggleFullscreen}
              className="text-white hover:text-indigo-400 transition-colors p-2"
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
