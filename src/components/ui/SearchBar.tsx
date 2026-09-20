import React, { KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  className?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  onSubmit,
  className = ''
}: SearchBarProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      onSubmit();
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-500" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="block w-full pl-10 pr-10 py-2.5 bg-gray-800 border-none rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"
      />
      {value && (
        <button
          onClick={() => {
            onChange('');
            if (onSubmit) onSubmit();
          }}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 focus:outline-none"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
