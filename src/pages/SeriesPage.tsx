import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useXtreamAPI } from '@/hooks/useXtreamAPI';
import CategoryFilter from '@/components/ui/CategoryFilter';
import SeriesCard from '@/components/cards/SeriesCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Info } from 'lucide-react';
import { Series, Category } from '@/types';

const SeriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { connectionType } = useAuthStore();
  const api = useXtreamAPI();

  const [categories, setCategories] = useState<Category[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (connectionType === 'm3u') return;

    const fetchData = async () => {
      setDataLoading(true);
      setFetchError(null);
      try {
        if (api) {
          const [cats, allSeries] = await Promise.all([
            api.getSeriesCategories(),
            api.getSeries()
          ]);
          setCategories(cats);
          setSeries(allSeries);
        }
      } catch (err: any) {
        console.error('Failed to load Series data:', err);
        setFetchError(err?.message || 'Failed to load series');
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [api, connectionType]);

  const filteredSeries = useMemo(() => {
    if (selectedCategory === null) return series;
    return series.filter(s => s.category_id === selectedCategory);
  }, [series, selectedCategory]);

  const handleSeriesClick = (item: Series) => {
    navigate(`/series/${item.series_id}`);
  };

  if (connectionType === 'm3u') {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col items-center justify-center p-6 text-center">
        <Info className="w-16 h-16 text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Series Not Available</h2>
        <p className="text-gray-400 max-w-md">Your current connection is via M3U playlist. TV Series are only fully supported with Xtream Codes connections.</p>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading TV Series..." />
      </div>
    );
  }

  if (fetchError) {
    return <ErrorMessage message={fetchError} className="m-6" />;
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="flex-none pt-4 px-6 pb-2 bg-gray-950/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-4">TV Series</h1>
        <CategoryFilter
          categories={categories}
          selectedId={selectedCategory}
          onSelect={setSelectedCategory}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        {filteredSeries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            No series found in this category.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 pb-20">
            {filteredSeries.map(item => (
              <SeriesCard
                key={item.series_id}
                series={item}
                onClick={() => handleSeriesClick(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SeriesPage;
