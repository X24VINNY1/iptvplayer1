import React from 'react';
import { Category } from '@/types';

interface CategoryFilterProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

export default function CategoryFilter({
  categories,
  selectedId,
  onSelect,
  className = ''
}: CategoryFilterProps) {
  return (
    <div className={`flex items-center overflow-x-auto gap-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${className}`}>
      <button
        onClick={() => onSelect(null)}
        className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          selectedId === null
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category.category_id}
          onClick={() => onSelect(category.category_id)}
          className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            selectedId === category.category_id
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {category.category_name}
        </button>
      ))}
    </div>
  );
}
