import React from 'react';
import { Heart } from 'lucide-react';
import { useFavoritesStore } from '@/store/useFavoritesStore';

interface FavoriteButtonProps {
  type: 'live' | 'vod' | 'series';
  streamId: number;
  name: string;
  icon: string;
  categoryId: string;
  className?: string;
}

export default function FavoriteButton({
  type,
  streamId,
  name,
  icon,
  categoryId,
  className = ''
}: FavoriteButtonProps) {
  const { toggleFavorite, isFavorite } = useFavoritesStore();
  const favorited = isFavorite(type, streamId);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite({
      id: `${type}-${streamId}`,
      type,
      streamId,
      name,
      icon,
      categoryId,
      addedAt: Date.now()
    });
  };

  return (
    <button
      onClick={handleClick}
      className={`p-1.5 rounded-full bg-black/40 hover:bg-black/60 transition-all hover:scale-110 focus:outline-none ${className}`}
    >
      <Heart
        className={`w-5 h-5 transition-colors ${
          favorited ? 'fill-red-500 text-red-500' : 'text-gray-300'
        }`}
      />
    </button>
  );
}
