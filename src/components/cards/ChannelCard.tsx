import React, { useState } from 'react';
import { LiveStream } from '@/types';
import FavoriteButton from '../ui/FavoriteButton';

interface ChannelCardProps {
  channel: LiveStream;
  epgTitle?: string;
  onClick: () => void;
}

const ChannelCard = React.memo(function ChannelCard({ channel, epgTitle, onClick }: ChannelCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div 
      tabIndex={0}
      role="button"
      data-tv-focusable="true"
      data-tv-section="content"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Select' || e.keyCode === 13 || e.keyCode === 23) {
          e.preventDefault();
          onClick();
        }
      }}
      className="relative bg-gray-900 rounded-xl p-3 hover:bg-gray-800 cursor-pointer transition-all duration-150 hover:scale-[1.02] hover:shadow-lg flex items-center gap-4 group outline-none focus:ring-4 focus:ring-indigo-500 focus:scale-[1.05] focus:bg-gray-800 focus:z-20"
    >
      <div className="relative shrink-0">
        {!imgError && channel.stream_icon ? (
          <img 
            src={channel.stream_icon} 
            alt={channel.name}
            onError={() => setImgError(true)}
            className="w-12 h-12 rounded-lg object-contain bg-gray-800"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-indigo-900/50 flex items-center justify-center text-indigo-300 font-bold text-xl uppercase">
            {channel.name.charAt(0)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 pr-8">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-white font-medium truncate">{channel.name}</h3>
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        </div>
        {epgTitle && (
          <p className="text-gray-400 text-sm truncate">{epgTitle}</p>
        )}
      </div>

      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100">
        <FavoriteButton 
          type="live"
          streamId={channel.stream_id}
          name={channel.name}
          icon={channel.stream_icon || ''}
          categoryId={channel.category_id}
        />
      </div>
    </div>
  );
});

export default ChannelCard;
