import React, { useState } from 'react';
import { VodStream } from '@/types';
import { Film } from 'lucide-react';
import FavoriteButton from '../ui/FavoriteButton';

interface MovieCardProps {
  movie: VodStream;
  onClick: () => void;
}

const MovieCard = React.memo(function MovieCard({ movie, onClick }: MovieCardProps) {
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
      className="relative rounded-xl overflow-hidden aspect-[2/3] cursor-pointer group bg-gray-900 transition-all duration-150 hover:scale-[1.03] hover:shadow-xl outline-none focus:ring-4 focus:ring-indigo-500 focus:scale-[1.07] focus:z-30 focus:shadow-2xl focus:shadow-indigo-500/30"
    >
      {!imgError && movie.stream_icon ? (
        <img 
          src={movie.stream_icon} 
          alt={movie.name}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <Film className="w-12 h-12 text-gray-600" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />

      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-white font-medium line-clamp-2 leading-tight">{movie.name}</h3>
      </div>

      {movie.rating && parseFloat(movie.rating) > 0 && (
        <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded shadow">
          {movie.rating}
        </div>
      )}

      <div className="absolute top-2 left-2 z-10">
        <FavoriteButton 
          type="vod"
          streamId={movie.stream_id}
          name={movie.name}
          icon={movie.stream_icon || ''}
          categoryId={movie.category_id}
        />
      </div>
    </div>
  );
});

export default MovieCard;
