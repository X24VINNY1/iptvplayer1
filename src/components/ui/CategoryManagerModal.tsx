import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import { Category } from '@/types';
import { useCategoryStore, isUsOrEnCategory } from '@/store/useCategoryStore';
import { Eye, EyeOff, Search, Check, Sparkles, RotateCcw } from 'lucide-react';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'live' | 'vod' | 'series';
  categories: Category[];
  title?: string;
}

export default function CategoryManagerModal({
  isOpen,
  onClose,
  type,
  categories,
  title
}: CategoryManagerModalProps) {
  const [search, setSearch] = useState('');
  const {
    isCategoryHidden,
    toggleCategory,
    showAll,
    hideAll,
    filterUsOnly
  } = useCategoryStore();

  const typeLabels = {
    live: 'Live TV',
    vod: 'Movies',
    series: 'TV Series'
  };

  const modalTitle = title || `Organize ${typeLabels[type]} Categories`;

  const filteredList = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter((c) => c.category_name.toLowerCase().includes(q));
  }, [categories, search]);

  const hiddenCount = useMemo(() => {
    return categories.filter((c) => isCategoryHidden(type, c.category_id)).length;
  }, [categories, isCategoryHidden, type]);

  const visibleCount = categories.length - hiddenCount;

  const handleKeepUsOnly = () => {
    filterUsOnly(type, categories);
  };

  const handleShowAll = () => {
    showAll(type);
  };

  const handleHideAll = () => {
    hideAll(
      type,
      categories.map((c) => c.category_id)
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="lg">
      <div className="flex flex-col space-y-4">
        {/* Quick Action Bar */}
        <div className="p-4 bg-gray-800/60 rounded-xl border border-gray-700/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <span className="text-white font-semibold text-sm block">Quick Filtering</span>
            <span className="text-xs text-gray-400">
              Showing {visibleCount} of {categories.length} categories ({hiddenCount} hidden)
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={handleKeepUsOnly}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
              title="Automatically hide foreign categories and keep only US / USA / EN"
            >
              <Sparkles className="w-3.5 h-3.5" />
              US / USA / EN Only
            </button>

            <button
              onClick={handleShowAll}
              className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-xs font-medium transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Show All
            </button>

            <button
              onClick={handleHideAll}
              className="flex items-center gap-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-colors"
            >
              <EyeOff className="w-3 h-3" />
              Hide All
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories to show/hide..."
            className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
          />
        </div>

        {/* Category List */}
        <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1 divide-y divide-gray-800/40">
          {filteredList.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No categories matching "{search}"
            </div>
          ) : (
            filteredList.map((cat) => {
              const isHidden = isCategoryHidden(type, cat.category_id);
              const isUs = isUsOrEnCategory(cat.category_name);

              return (
                <div
                  key={cat.category_id}
                  onClick={() => toggleCategory(type, cat.category_id)}
                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                    isHidden
                      ? 'bg-gray-900/40 text-gray-500 hover:bg-gray-800/40 opacity-60'
                      : 'bg-gray-800/30 text-white hover:bg-gray-800/70'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <button
                      type="button"
                      className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                        !isHidden
                          ? 'bg-indigo-600 text-white'
                          : 'border border-gray-600 bg-gray-800'
                      }`}
                    >
                      {!isHidden && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-sm font-medium truncate">{cat.category_name}</span>
                    {isUs && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold tracking-wider">
                        US/EN
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {isHidden ? 'Hidden' : 'Visible'}
                    </span>
                    {isHidden ? (
                      <EyeOff className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-indigo-400" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Done button */}
        <div className="pt-3 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-indigo-600/20"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
