import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  ArrowLeft, PictureInPicture2, RotateCcw, RotateCw, 
  ShieldCheck, Zap, RefreshCw, ChevronDown, List, X, Search, Gauge
} from 'lucide-react';
import { usePlayerStore, AntiLagMode } from '@/store/usePlayerStore';
import { useContentStore } from '@/store/useContentStore';
import { LiveStream } from '@/types';

interface PlayerControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  src?: string;
  isLive?: boolean;
  title?: string;
  currentFormat?: string;
  connectionMode?: 'proxy' | 'direct';
  onBack?: () => void;
  onFlushAndResync?: () => void;
  onToggleFormat?: () => void;
  onToggleRoute?: () => void;
  onSelectChannel?: (channel: LiveStream) => void;
}

export default function PlayerControls({
  videoRef,
  src,
  isLive,
  title,
  currentFormat = 'AUTO',
  connectionMode = 'direct',
  onBack,
  onFlushAndResync,
  onToggleFormat,
  onToggleRoute,
  onSelectChannel
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
    setAntiLagEnabled,
    setAntiLagMode
  } = usePlayerStore();

  const { liveStreams } = useContentStore();
  
  const [showVolume, setShowVolume] = useState(false);
  const [showAntiLagMenu, setShowAntiLagMenu] = useState(false);
  const [showChannelDrawer, setShowChannelDrawer] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
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

  const handleSeekDelta = (seconds: number) => {
    if (!videoRef.current || isLive) return;
    videoRef.current.currentTime = Math.max(
      0,
      Math.min(videoRef.current.currentTime + seconds, videoRef.current.duration || 0)
    );
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

  const handleSpeedChange = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowSpeedMenu(false);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Filter channels for quick side-drawer - ONLY compute when drawer is open and capped to 50
  const filteredChannels = useMemo(() => {
    if (!showChannelDrawer) return [];
    const q = channelSearch.trim().toLowerCase();
    if (!q) return liveStreams.slice(0, 50);
    return liveStreams.filter((ch) => ch.name.toLowerCase().includes(q)).slice(0, 50);
  }, [showChannelDrawer, channelSearch, liveStreams]);

  return (
    <div className="absolute inset-0 flex flex-col justify-between select-none pointer-events-none">
      {/* Top Bar */}
      <div className="w-full bg-gradient-to-b from-black/90 via-black/60 to-transparent p-4 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3 truncate max-w-[60%]">
          {onBack && (
            <button 
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 text-white hover:text-indigo-400 transition-all bg-black/50 hover:bg-black/80 rounded-xl border border-white/10 shrink-0 active:scale-95 shadow-lg"
              title="Go Back (Esc)"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs font-semibold hidden sm:inline">Back</span>
            </button>
          )}

          <div className="flex items-center gap-2 truncate">
            {isLive && (
              <span className="flex items-center gap-1.5 bg-red-600/90 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-md shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                LIVE
              </span>
            )}
            {!isLive && (
              <span className="bg-indigo-600/80 text-indigo-100 text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0">
                VOD HD
              </span>
            )}
            <h2 className="text-white text-base sm:text-lg font-semibold truncate drop-shadow-md">
              {title || 'Playing Stream'}
            </h2>
          </div>
        </div>

        {/* Top Right Action Tools */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Channel Drawer Toggle (Live TV) */}
          {isLive && liveStreams.length > 0 && onSelectChannel && (
            <button
              onClick={() => setShowChannelDrawer(!showChannelDrawer)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-600/80 hover:bg-indigo-600 text-white shadow-lg transition-all active:scale-95 border border-indigo-400/30"
              title="Quick Channels List"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Channels ({liveStreams.length})</span>
            </button>
          )}

          {/* Stream Format Switcher */}
          {onToggleFormat && (
            <button
              onClick={onToggleFormat}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-black/60 hover:bg-black/90 text-gray-200 hover:text-white border border-white/20 shadow-lg transition-all active:scale-95"
              title="Click to toggle stream container format (MP4, HLS, TS)"
            >
              Format: <span className="text-indigo-400">{currentFormat.toUpperCase()}</span>
            </button>
          )}

          {/* Connection Route Switcher (Proxy vs Direct) */}
          {onToggleRoute && (
            <button
              onClick={onToggleRoute}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border shadow-lg transition-all active:scale-95 flex items-center gap-1.5 ${
                connectionMode === 'proxy'
                  ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 hover:bg-indigo-600/50'
                  : 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50 hover:bg-emerald-600/50'
              }`}
              title="Toggle stream connection route between Proxy (for HTTPS web) and Direct"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{connectionMode === 'proxy' ? 'Proxy Route' : 'Direct Stream'}</span>
            </button>
          )}

          {/* Anti-Lag & Buffer Health Indicator */}
          <div className="relative">
            <button
              onClick={() => setShowAntiLagMenu(!showAntiLagMenu)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md ${
                antiLagEnabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 shadow-emerald-500/10'
                  : 'bg-gray-800/80 text-gray-400 border border-gray-700 hover:bg-gray-700'
              }`}
              title="Anti-Lag Stream Shield"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Anti-Lag</span>
              {bufferLength > 0 && (
                <span className="ml-0.5 text-[10px] text-emerald-300 font-mono">
                  {bufferLength}s
                </span>
              )}
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {/* Anti-Lag Popover */}
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
                    <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div>
                  <span className="text-xs text-gray-400 block mb-1.5 font-medium">Buffer Profile:</span>
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
                </div>

                <div className="bg-gray-800/40 p-2.5 rounded-xl border border-gray-700/40 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Buffer Ahead</span>
                    <span className="font-bold text-emerald-400">{bufferLength}s</span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 block text-[10px]">Lags Avoided</span>
                    <span className="font-bold text-indigo-400">{lagRecoveries} auto-fixed</span>
                  </div>
                </div>

                {onFlushAndResync && (
                  <button
                    onClick={() => {
                      onFlushAndResync();
                      setShowAntiLagMenu(false);
                    }}
                    className="w-full py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Flush Buffer & Resync
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Channels Side Drawer (Live TV) */}
      {showChannelDrawer && isLive && onSelectChannel && (
        <div 
          className="absolute right-0 top-0 bottom-0 w-80 sm:w-96 bg-gray-950/95 backdrop-blur-2xl border-l border-gray-800 z-50 flex flex-col pointer-events-auto shadow-2xl transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <List className="w-4 h-4 text-indigo-400" />
              Live Channels
            </h3>
            <button 
              onClick={() => setShowChannelDrawer(false)}
              className="p-1 text-gray-400 hover:text-white rounded-lg bg-gray-800/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 border-b border-gray-800/60">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
                placeholder="Search live channels..."
                className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 divide-y divide-gray-900">
            {filteredChannels.slice(0, 100).map((channel) => (
              <div
                key={channel.stream_id}
                onClick={() => {
                  onSelectChannel(channel);
                  setShowChannelDrawer(false);
                }}
                className="p-2.5 flex items-center gap-3 hover:bg-indigo-600/20 rounded-xl cursor-pointer transition-colors group"
              >
                {channel.stream_icon ? (
                  <img
                    src={channel.stream_icon}
                    alt=""
                    className="w-10 h-10 object-contain rounded-lg bg-gray-900 p-0.5 shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400 shrink-0">
                    TV
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold truncate group-hover:text-indigo-300">
                    {channel.name}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">Channel #{channel.num || channel.stream_id}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div className="w-full bg-gradient-to-t from-black/95 via-black/75 to-transparent p-4 pt-10 flex flex-col gap-3 pointer-events-auto">
        {/* Seek Bar (for VOD/Series) */}
        {!isLive && (
          <div 
            className="w-full h-2 hover:h-3 transition-all bg-gray-800/80 cursor-pointer rounded-full relative group"
            ref={progressRef}
            onClick={handleSeek}
          >
            <div 
              className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
            <div 
              className="absolute top-1/2 -translate-y-1/2 -ml-2 w-4 h-4 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg ring-2 ring-indigo-500"
              style={{ left: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause Button */}
            <button 
              onClick={handlePlayPause}
              className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            {/* Seek Back 10s */}
            {!isLive && (
              <button
                onClick={() => handleSeekDelta(-10)}
                className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                title="Rewind 10 seconds (←)"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}

            {/* Seek Forward 10s */}
            {!isLive && (
              <button
                onClick={() => handleSeekDelta(10)}
                className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                title="Forward 10 seconds (→)"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            )}
            
            {/* Volume Control */}
            <div 
              className="flex items-center gap-2 relative"
              onMouseEnter={() => setShowVolume(true)}
              onMouseLeave={() => setShowVolume(false)}
            >
              <button 
                onClick={toggleMute}
                className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                title="Mute / Unmute (M)"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
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

            {/* Time / Live Display */}
            <div className="text-white text-xs font-mono font-medium tracking-wide ml-2">
              {isLive ? (
                <span className="flex items-center gap-1.5 text-red-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  LIVE STREAM
                </span>
              ) : (
                <span className="text-gray-300 drop-shadow-sm">
                  {formatTime(currentTime)} <span className="text-gray-500 mx-1">/</span> {formatTime(duration)}
                </span>
              )}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Playback Speed Selector (VOD) */}
            {!isLive && (
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="flex items-center gap-1 text-xs font-bold text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title="Playback Speed"
                >
                  <Gauge className="w-4 h-4" />
                  <span>{playbackSpeed}x</span>
                </button>

                {showSpeedMenu && (
                  <div className="absolute bottom-10 right-0 bg-gray-900 border border-gray-800 rounded-xl p-1 shadow-2xl z-50 flex flex-col gap-1 min-w-[70px]">
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSpeedChange(s)}
                        className={`text-xs px-3 py-1 rounded-lg text-left font-semibold ${
                          playbackSpeed === s ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Picture in Picture */}
            {document.pictureInPictureEnabled && (
              <button 
                onClick={togglePiP}
                className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${isPiP ? 'text-indigo-400' : 'text-gray-300 hover:text-white'}`}
                title="Picture in Picture"
              >
                <PictureInPicture2 className="w-5 h-5" />
              </button>
            )}
            
            {/* Fullscreen Toggle */}
            <button 
              onClick={toggleFullscreen}
              className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
