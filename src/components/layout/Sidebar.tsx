import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Radio, Film, Tv, Heart, Settings, LogOut, Play } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const navItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Live TV', path: '/live', icon: Radio },
    { name: 'Movies', path: '/movies', icon: Film },
    { name: 'Series', path: '/series', icon: Tv },
    { name: 'Favorites', path: '/favorites', icon: Heart },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-gray-950 border-r border-gray-800/50 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
      <div className="flex items-center h-16 px-4 mb-6">
        <div className="flex items-center gap-3 text-indigo-500 font-bold text-xl overflow-hidden">
          <Play className="w-8 h-8 fill-indigo-500 flex-shrink-0" />
          {!collapsed && <span>OnyxStream</span>}
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400 border-l-2 border-indigo-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`
            }
            title={collapsed ? item.name : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.name}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-2 space-y-2 mb-4 border-t border-gray-800/50 pt-4">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-indigo-600/20 text-indigo-400 border-l-2 border-indigo-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`
          }
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors whitespace-nowrap"
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}
