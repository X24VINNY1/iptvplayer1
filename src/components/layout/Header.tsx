import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const userInfo = useAuthStore(state => state.userInfo);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Home';
    if (path.startsWith('/live')) return 'Live TV';
    if (path.startsWith('/movies')) return 'Movies';
    if (path.startsWith('/series')) return 'Series';
    if (path.startsWith('/favorites')) return 'Favorites';
    if (path.startsWith('/settings')) return 'Settings';
    if (path.startsWith('/search')) return 'Search Results';
    return '';
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const username = userInfo?.username || 'User';
  const initial = username.charAt(0).toUpperCase();

  return (
    <header className="h-16 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50 sticky top-0 z-40 px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 -ml-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/50 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-white hidden sm:block">{getPageTitle()}</h1>
      </div>

      <div className="flex-1 max-w-xl mx-4 flex justify-center">
        <form onSubmit={handleSearch} className="relative w-full max-w-sm lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full bg-gray-800/50 border border-gray-700/50 text-white rounded-full pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-gray-800 transition-all"
          />
        </form>
      </div>

      <div className="flex items-center">
        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium shadow-lg shadow-indigo-500/20 cursor-pointer">
          {initial}
        </div>
      </div>
    </header>
  );
}
