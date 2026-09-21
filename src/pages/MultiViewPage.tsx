import React, { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import { useContentStore } from '@/store/useContentStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getProxiedStreamUrl } from '@/utils/url';
import { LiveStream } from '@/types';
import { Grid, Volume2, VolumeX, Maximize2, Plus, X, Radio, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SlotData {
  id: number;
  channel: LiveStream | null;
}

export default function MultiViewPage() {
  const navigate = useNavigate();
  const { liveStreams } = useContentStore();
  const { serverUrl, username, password, connectionType } = useAuthStore();

  const [layout, setLayout] = useState<'4' | '2' | '1'>('4');
  const [slots, setSlots] = useState<SlotData[]>([
    { id: 0, channel: null },
    { id: 1, channel: null },
    { id: 2, channel: null },
    { id: 3, channel: null },
  ]);
  const [activeAudioSlot, setActiveAudioSlot] = useState<number | null>(null);
  const [pickerSlotId, setPickerSlotId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Pre-populate slot 0 with the first channel if available
  useEffect(() => {
    if (liveStreams.length > 0 && slots[0].channel === null) {
      setSlots((prev) => [
        { id: 0, channel: liveStreams[0] },
        { id: 1, channel: liveStreams[1] || null },
        { id: 2, channel: liveStreams[2] || null },
        { id: 3, channel: liveStreams[3] || null },
      ]);
      setActiveAudioSlot(0);
    }
  }, [liveStreams]);

  const handleSelectChannel = (channel: LiveStream) => {
    if (pickerSlotId === null) return;
    setSlots((prev) =>
      prev.map((s) => (s.id === pickerSlotId ? { ...s, channel } : s))
    );
    if (activeAudioSlot === null) {
      setActiveAudioSlot(pickerSlotId);
    }
    setPickerSlotId(null);
    setSearchQuery('');
  };

  const handleRemoveChannel = (slotId: number) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, channel: null } : s))
    );
    if (activeAudioSlot === slotId) {
      setActiveAudioSlot(null);
    }
  };

  const filteredChannels = liveStreams.filter((ch) =>
    ch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeSlotCount = layout === '1' ? 1 : layout === '2' ? 2 : 4;

  return (
    <div className="h-full flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Top Controls Bar */}
      <div className="flex-none px-6 py-3 bg-gray-900/90 backdrop-blur-md border-b border-gray-800/80 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button
            data-tv-focusable="true"
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 outline-none focus:ring-4 focus:ring-indigo-400"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Grid className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Multi-View 4-Screen Matrix</h1>
          </div>
        </div>

        {/* Layout Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium mr-2 hidden sm:inline">Layout:</span>
          <button
            data-tv-focusable="true"
            onClick={() => setLayout('1')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all outline-none focus:ring-4 focus:ring-indigo-400 ${
              layout === '1' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Single
          </button>
          <button
            data-tv-focusable="true"
            onClick={() => setLayout('2')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all outline-none focus:ring-4 focus:ring-indigo-400 ${
              layout === '2' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Dual (1x2)
          </button>
          <button
            data-tv-focusable="true"
            onClick={() => setLayout('4')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all outline-none focus:ring-4 focus:ring-indigo-400 ${
              layout === '4' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Quad (2x2)
          </button>
        </div>
      </div>

      {/* Grid Display */}
      <div
        className={`flex-1 min-h-0 p-3 sm:p-4 gap-3 sm:gap-4 grid ${
          layout === '1'
            ? 'grid-cols-1 max-w-5xl mx-auto w-full my-auto'
            : layout === '2'
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-2 grid-rows-2'
        }`}
      >

        {slots.slice(0, activeSlotCount).map((slot) => (
          <MultiViewSlot
            key={slot.id}
            slot={slot}
            hasAudio={activeAudioSlot === slot.id}
            onToggleAudio={() =>
              setActiveAudioSlot((prev) => (prev === slot.id ? null : slot.id))
            }
            onPickChannel={() => setPickerSlotId(slot.id)}
            onRemoveChannel={() => handleRemoveChannel(slot.id)}
            serverUrl={serverUrl}
            username={username}
            password={password}
            connectionType={connectionType}
          />
        ))}
      </div>

      {/* Channel Picker Modal */}
      {pickerSlotId !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl h-[75vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-indigo-400" />
                Select Channel for Slot {pickerSlotId + 1}
              </h2>
              <button
                onClick={() => setPickerSlotId(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search live channels..."
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 outline-none"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
              {filteredChannels.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm">No channels found</div>
              ) : (
                filteredChannels.slice(0, 150).map((ch) => (
                  <button
                    key={ch.stream_id}
                    onClick={() => handleSelectChannel(ch)}
                    className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-800/80 transition-colors group"
                  >
                    {ch.stream_icon ? (
                      <img
                        src={ch.stream_icon}
                        alt=""
                        className="w-8 h-8 rounded-lg object-contain bg-black/40 flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <Radio className="w-4 h-4 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate group-hover:text-indigo-400 transition-colors">
                        {ch.name}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MultiViewSlot({
  slot,
  hasAudio,
  onToggleAudio,
  onPickChannel,
  onRemoveChannel,
  serverUrl,
  username,
  password,
  connectionType,
}: {
  slot: SlotData;
  hasAudio: boolean;
  onToggleAudio: () => void;
  onPickChannel: () => void;
  onRemoveChannel: () => void;
  serverUrl: string;
  username: string;
  password: string;
  connectionType: 'xtream' | 'm3u';
}) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const streamUrl = slot.channel
    ? getProxiedStreamUrl(
        connectionType === 'm3u' && slot.channel.direct_source
          ? slot.channel.direct_source
          : `${serverUrl}/live/${username}/${password}/${slot.channel.stream_id}.m3u8`
      )
    : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false,
        enableSoftwareAES: true,
        lowLatencyMode: false,
        backBufferLength: 20,
        maxBufferSize: 25 * 1000 * 1000,
        xhrSetup: (xhr: XMLHttpRequest) => {
          xhr.withCredentials = false;
        }
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hlsRef.current = hls;

      return () => {
        try {
          hls.stopLoad();
          hls.detachMedia();
          hls.destroy();
        } catch {}
        hlsRef.current = null;
        if (video) {
          try {
            video.pause();
            video.removeAttribute('src');
            video.load();
          } catch {}
        }
      };
    } else {
      video.src = streamUrl;
      video.play().catch(() => {});
      return () => {
        if (video) {
          try {
            video.pause();
            video.removeAttribute('src');
            video.load();
          } catch {}
        }
      };
    }
  }, [streamUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !hasAudio;
    }
  }, [hasAudio]);

  if (!slot.channel) {
    return (
      <div
        onClick={onPickChannel}
        className="h-full bg-gray-900/60 border border-dashed border-gray-800 hover:border-indigo-500 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all hover:bg-gray-900 group"
      >
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Plus className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-gray-400 group-hover:text-white transition-colors">
          Add Live Channel (Slot {slot.id + 1})
        </p>
      </div>
    );
  }

  return (
    <div
      onClick={onToggleAudio}
      className={`relative h-full bg-black rounded-2xl overflow-hidden border-2 transition-all group ${
        hasAudio ? 'border-indigo-500 shadow-xl shadow-indigo-500/20' : 'border-gray-800/80 hover:border-gray-700'
      }`}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain bg-black"
        style={{
          backgroundColor: '#000',
          transform: 'translate3d(0, 0, 0)',
          WebkitTransform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
        autoPlay
        playsInline
        muted={!hasAudio}
      />

      {/* Overlay header */}
      <div className="absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="flex items-center gap-2 max-w-[65%]">
          {slot.channel.stream_icon && (
            <img
              src={slot.channel.stream_icon}
              alt=""
              className="w-6 h-6 rounded object-contain bg-black/40"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          )}
          <span className="text-xs font-semibold text-white truncate">{slot.channel.name}</span>
        </div>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onToggleAudio}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
              hasAudio ? 'bg-indigo-600 text-white' : 'bg-black/60 text-gray-400 hover:text-white'
            }`}
            title={hasAudio ? 'Mute' : 'Listen'}
          >
            {hasAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={() =>
              navigate(
                `/player/live/${slot.channel?.stream_id}?name=${encodeURIComponent(
                  slot.channel?.name || ''
                )}`
              )
            }
            className="p-1.5 rounded-lg bg-black/60 text-gray-400 hover:text-white"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onPickChannel}
            className="p-1.5 rounded-lg bg-black/60 text-gray-400 hover:text-white text-xs"
            title="Switch Channel"
          >
            Change
          </button>
          <button
            onClick={onRemoveChannel}
            className="p-1.5 rounded-lg bg-black/60 text-rose-400 hover:text-rose-300"
            title="Remove"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Audio badge */}
      {hasAudio && (
        <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-indigo-600/90 text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 shadow-lg backdrop-blur-sm pointer-events-none">
          <Volume2 className="w-3.5 h-3.5" />
          AUDIO ACTIVE
        </div>
      )}
    </div>
  );
}
