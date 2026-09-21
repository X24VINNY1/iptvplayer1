import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LiveStream } from '@/types';
import { Radio } from 'lucide-react';

interface EPGEntry {
  title: string;
  start: Date;
  end: Date;
  description?: string;
}

interface EPGGuideProps {
  channels: LiveStream[];
  onSelectChannel: (channel: LiveStream) => void;
  focusedChannelId?: number | null;
}

const ChannelRow = React.memo(({ 
  channel, 
  isFocused, 
  onSelect,
  onFocus,
  currentTime,
  startDate,
}: { 
  channel: LiveStream; 
  isFocused: boolean; 
  onSelect: () => void;
  onFocus: () => void;
  currentTime: Date;
  startDate: Date;
}) => {
  // Generate fake EPG entries
  const entries: EPGEntry[] = useMemo(() => {
    const p1Start = new Date(currentTime.getTime() - 30 * 60000);
    const p1End = new Date(currentTime.getTime() + 60 * 60000);
    const p2Start = p1End;
    const p2End = new Date(p2Start.getTime() + 120 * 60000);
    
    return [
      {
        title: `${channel.name} (Live)`,
        start: p1Start,
        end: p1End,
      },
      {
        title: 'Upcoming Program',
        start: p2Start,
        end: p2End,
      }
    ];
  }, [channel.name, currentTime]);

  return (
    <div 
      className={`flex border-b border-gray-800 outline-none transition-colors ${isFocused ? 'bg-indigo-600/20 ring-4 ring-indigo-500 z-10 relative' : 'hover:bg-gray-900/50'}`}
      data-tv-focusable="true"
      data-tv-section="content"
      tabIndex={0}
      onFocus={onFocus}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Select') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Left fixed column */}
      <div className="w-56 shrink-0 p-2 flex items-center gap-3 border-r border-gray-800 bg-gray-950/80 sticky left-0 z-20">
        {channel.stream_icon ? (
          <img src={channel.stream_icon} alt="" className="w-10 h-10 rounded-lg object-contain bg-black/60 shrink-0" onError={(e) => (e.currentTarget.style.display = 'none')} />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 text-gray-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{channel.name}</p>
        </div>
      </div>

      {/* Right scrollable area rows */}
      <div className="flex-1 flex relative">
        {entries.length > 0 ? entries.map((entry, idx) => {
          const startOffsetMinutes = Math.max(0, (entry.start.getTime() - startDate.getTime()) / 60000);
          const durationMinutes = (entry.end.getTime() - entry.start.getTime()) / 60000;
          
          const leftPct = (startOffsetMinutes / 180) * 100;
          const widthPct = (durationMinutes / 180) * 100;
          
          if (leftPct >= 100 || leftPct + widthPct <= 0) return null;
          
          const isNow = currentTime >= entry.start && currentTime < entry.end;
          
          return (
            <div 
              key={idx}
              className={`absolute top-0 bottom-0 p-1`}
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
            >
              <div className={`w-full h-full rounded-lg px-3 py-2 border overflow-hidden flex flex-col justify-center ${isNow ? 'bg-indigo-600/20 border-indigo-500/40' : 'bg-gray-900/80 border-gray-800'}`}>
                <p className="text-xs font-semibold text-white truncate">{entry.title}</p>
                <p className="text-[10px] text-gray-400 truncate">
                  {entry.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {entry.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
            </div>
          );
        }) : (
          <div className="w-full flex items-center justify-center">
            <span className="text-gray-500 text-sm">No Program Info</span>
          </div>
        )}
      </div>
    </div>
  );
});
ChannelRow.displayName = 'ChannelRow';

const EPGGuide: React.FC<EPGGuideProps> = ({ channels, onSelectChannel, focusedChannelId }) => {
  const [visibleCount, setVisibleCount] = useState(50);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Render 3 hours timeline starting from current half hour
  const startDate = useMemo(() => {
    const d = new Date(currentTime);
    d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
    return d;
  }, [currentTime]);

  const timelineSlots = useMemo(() => {
    const slots = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(startDate.getTime() + i * 30 * 60000);
      slots.push(d);
    }
    return slots;
  }, [startDate]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const displayedChannels = useMemo(() => {
    return channels.slice(0, visibleCount);
  }, [channels, visibleCount]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 350 && visibleCount < channels.length) {
      setVisibleCount(prev => Math.min(prev + 50, channels.length));
    }
  }, [visibleCount, channels.length]);

  const handleChannelFocus = useCallback((index: number) => {
    if (index >= displayedChannels.length - 12 && visibleCount < channels.length) {
      setVisibleCount(prev => Math.min(prev + 50, channels.length));
    }
  }, [displayedChannels.length, visibleCount, channels.length]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-950 overflow-hidden">
      {/* Time Header */}
      <div className="flex border-b border-gray-800 bg-gray-950 sticky top-0 z-30 shadow-md">
        <div className="w-56 shrink-0 border-r border-gray-800 p-3 bg-gray-950/90 flex items-center">
          <span className="text-xs text-gray-400 font-mono font-semibold">CHANNELS</span>
        </div>
        <div className="flex-1 flex relative overflow-hidden bg-gray-900/50">
          {timelineSlots.map((slot, i) => (
            <div key={i} className="flex-1 p-2 border-l border-gray-800/50 first:border-l-0">
              <span className="text-xs text-gray-400 font-mono">
                {slot.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          ))}
          {/* Current time indicator */}
          {(() => {
            const minutesFromStart = (currentTime.getTime() - startDate.getTime()) / 60000;
            const pct = (minutesFromStart / 180) * 100;
            if (pct >= 0 && pct <= 100) {
              return (
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                  style={{ left: `${pct}%` }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500" />
                </div>
              );
            }
            return null;
          })()}
        </div>
      </div>

      {/* Grid Body */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin pb-20 relative"
        onScroll={handleScroll}
      >
        {displayedChannels.map((channel, index) => (
          <ChannelRow 
            key={channel.stream_id}
            channel={channel}
            isFocused={focusedChannelId === channel.stream_id}
            onSelect={() => onSelectChannel(channel)}
            onFocus={() => handleChannelFocus(index)}
            currentTime={currentTime}
            startDate={startDate}
          />
        ))}
      </div>
    </div>
  );
};

export default EPGGuide;
