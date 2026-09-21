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
    <header data-tv-section="header" className="h-16 flex-none bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/80 px-6 flex items-center justify-between z-30">
      <div className="flex items-center gap-4">
        <button
          data-tv-focusable="true"
          onClick={onToggleSidebar}
          className="p-2 -ml-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800/60 transition-colors outline-none focus:ring-4 focus:ring-indigo-400 focus:text-white"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-white tracking-tight hidden sm:block">{getPageTitle()}</h1>
      </div>

      <div className="flex-1 max-w-xl mx-4 flex justify-center">
        <form onSubmit={handleSearch} className="relative w-full max-w-sm lg:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            data-tv-focusable="true"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels, movies, shows..."
            className="w-full bg-gray-900/80 border border-gray-800 text-white rounded-full pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-4 focus:ring-indigo-400 focus:border-indigo-500 transition-all placeholder-gray-500"
          />
        </form>
      </div>

      <div className="flex items-center">
        <div 
          data-tv-focusable="true"
          onClick={() => navigate('/settings')}
          className="w-9 h-9 rounded-full bg-indigo-600 border border-indigo-400/40 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/20 cursor-pointer outline-none focus:ring-4 focus:ring-indigo-400"
          title={`User: ${username}`}
        >
          {initial}
        </div>
      </div>
    </header>
  );

}
