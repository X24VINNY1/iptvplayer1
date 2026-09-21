import React, { useState } from 'react';
import { Episode } from '@/types';
import { Play } from 'lucide-react';

interface EpisodeCardProps {
  episode: Episode;
  episodeNumber: number;
  onClick: () => void;
}

const EpisodeCard = React.memo(function EpisodeCard({ episode, episodeNumber, onClick }: EpisodeCardProps) {
  const [imgError, setImgError] = useState(false);
  const title = episode.title || episode.info?.name || `Episode ${episodeNumber}`;
  const image = episode.info?.movie_image;
  const duration = episode.info?.duration;

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
      className="flex flex-col sm:flex-row gap-4 bg-gray-900/50 rounded-xl p-3 hover:bg-gray-800 cursor-pointer transition-all duration-150 group outline-none focus:ring-4 focus:ring-indigo-500 focus:scale-[1.03] focus:bg-gray-800 focus:z-20"
    >
      <div className="relative w-full sm:w-40 shrink-0 aspect-video rounded-lg overflow-hidden bg-gray-800">
        {!imgError && image ? (
          <img 
            src={image} 
            alt={title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <Play className="w-8 h-8 opacity-20" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-indigo-600/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300 shadow-lg">
            <Play className="w-5 h-5 ml-1" />
          </div>
        </div>
        {duration && (
          <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-medium text-white">
            {duration}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 py-1">
        <h4 className="text-white font-medium mb-1 truncate">
          {episodeNumber}. {title}
        </h4>
        {episode.info?.plot && (
          <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed">
            {episode.info.plot}
          </p>
        )}
      </div>
    </div>
  );
});

export default EpisodeCard;
