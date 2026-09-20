import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useXtreamAPI } from '@/hooks/useXtreamAPI';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import FavoriteButton from '@/components/ui/FavoriteButton';
import EpisodeCard from '@/components/cards/EpisodeCard';
import { Star, Calendar, ArrowLeft } from 'lucide-react';
import { SeriesInfo, Episode } from '@/types';

const SeriesDetailPage: React.FC = () => {
  const { seriesId } = useParams<{ seriesId: string }>();
  const navigate = useNavigate();
  const api = useXtreamAPI();

  const [seriesInfo, setSeriesInfo] = useState<SeriesInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSeason, setActiveSeason] = useState<number>(1);

  useEffect(() => {
    const fetchSeriesInfo = async () => {
      if (!api || !seriesId) return;
      
      setLoading(true);
      setError(null);
      try {
        const data = await api.getSeriesInfo(parseInt(seriesId));
        setSeriesInfo(data);
        if (data.seasons && data.seasons.length > 0) {
          const firstSeason = data.seasons[0].season_number;
          if (firstSeason !== undefined) {
            setActiveSeason(firstSeason);
          } else {
             const keys = Object.keys(data.episodes || {});
             if(keys.length > 0) setActiveSeason(parseInt(keys[0]));
          }
        }
      } catch (err) {
        console.error('Error fetching series info:', err);
        setError('Failed to load series details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSeriesInfo();
  }, [api, seriesId]);

  const episodesForSeason = useMemo(() => {
    if (!seriesInfo || !seriesInfo.episodes) return [];
    return seriesInfo.episodes[activeSeason] || [];
  }, [seriesInfo, activeSeason]);

  const handleEpisodeClick = (episode: Episode) => {
    if (!seriesInfo) return;
    navigate(`/player/series/${episode.id}?ext=${episode.container_extension}&name=${encodeURIComponent(episode.title)}&icon=${encodeURIComponent(episode.info?.movie_image || '')}&season=${episode.season}&episode=${episode.episode_num}&seriesId=${seriesId}`);
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading Series Details..." />
      </div>
    );
  }

  if (error || !seriesInfo) {
    return (
      <div className="p-6">
        <button onClick={() => navigate(-1)} className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back
        </button>
        <ErrorMessage message={error || 'Series not found.'} />
      </div>
    );
  }

  const { info } = seriesInfo;
  const backdropImage = info?.backdrop_path?.[0] || info?.cover;

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] pb-20">
      {/* Hero Section */}
      <div className="relative w-full h-[50vh] min-h-[400px] flex-shrink-0">
        <div className="absolute inset-0">
          {backdropImage ? (
             <img src={backdropImage} alt={info?.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-800" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/60 to-transparent" />
        </div>

        <div className="absolute inset-0 p-8 flex flex-col justify-end">
          <button onClick={() => navigate(-1)} className="absolute top-6 left-6 flex items-center text-gray-300 hover:text-white transition-colors bg-black/40 px-3 py-1.5 rounded-lg backdrop-blur-sm">
            <ArrowLeft className="w-5 h-5 mr-2" /> Back
          </button>

          <div className="max-w-4xl flex gap-8 items-end">
            <div className="hidden md:block w-48 flex-shrink-0 rounded-xl overflow-hidden shadow-2xl border border-gray-800">
              {info?.cover ? (
                <img src={info.cover} alt={info.name} className="w-full h-auto aspect-[2/3] object-cover" />
              ) : (
                <div className="w-full aspect-[2/3] bg-gray-800" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">{info?.name}</h1>
                <FavoriteButton 
                  type="series" 
                  streamId={parseInt(seriesId!)} 
                  name={info?.name || ''} 
                  icon={info?.cover || ''} 
                  categoryId={info?.category_id || ''} 
                />
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-300 mb-4 font-medium">
                {info?.rating && (
                  <div className="flex items-center text-yellow-500 bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
                    <Star className="w-4 h-4 mr-1 fill-current" />
                    <span>{info.rating}</span>
                  </div>
                )}
                {info?.releaseDate && (
                  <div className="flex items-center bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
                    <Calendar className="w-4 h-4 mr-1" />
                    <span>{new Date(info.releaseDate).getFullYear() || info.releaseDate}</span>
                  </div>
                )}
                {info?.genre && (
                  <div className="bg-indigo-600/80 px-2 py-1 rounded text-white backdrop-blur-sm">
                    {info.genre}
                  </div>
                )}
              </div>

              <p className="text-gray-300 line-clamp-3 md:line-clamp-none max-w-3xl drop-shadow-md text-sm md:text-base bg-black/20 p-4 rounded-xl backdrop-blur-sm border border-white/5">
                {info?.plot || 'No plot description available.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="px-6 md:px-8 py-8 flex-1">
        {/* Seasons Tabs */}
        {seriesInfo.seasons && seriesInfo.seasons.length > 0 && (
          <div className="flex overflow-x-auto scrollbar-hide space-x-2 mb-8 border-b border-gray-800 pb-2">
            {seriesInfo.seasons.map((season) => (
              <button
                key={season.season_number}
                onClick={() => setActiveSeason(season.season_number)}
                className={`whitespace-nowrap px-6 py-3 rounded-t-lg font-medium transition-colors ${
                  activeSeason === season.season_number
                    ? 'text-indigo-400 border-b-2 border-indigo-500 bg-gray-900/50'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                Season {season.season_number}
              </button>
            ))}
          </div>
        )}

        {/* Episodes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {episodesForSeason.length > 0 ? (
            episodesForSeason.map((episode) => (
              <EpisodeCard
                key={episode.id}
                episode={episode}
                episodeNumber={episode.episode_num}
                onClick={() => handleEpisodeClick(episode)}
              />
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-gray-500">
              No episodes available for this season.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SeriesDetailPage;
