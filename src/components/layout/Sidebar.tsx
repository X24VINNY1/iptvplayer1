import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Radio, Film, Tv, Heart, Settings, LogOut, Play, Grid } from 'lucide-react';
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
    { name: 'Multi-View', path: '/multiview', icon: Grid },
    { name: 'Movies', path: '/movies', icon: Film },
    { name: 'Series', path: '/series', icon: Tv },
    { name: 'Favorites', path: '/favorites', icon: Heart },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div 
      data-tv-section="sidebar"
      className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-gray-950/95 backdrop-blur-xl border-r border-gray-800/80 transition-all duration-300 ${collapsed ? 'w-20' : 'w-60'}`}
    >
      <div className={`flex items-center h-16 mb-2 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        <div className="flex items-center gap-2.5 text-indigo-500 font-bold text-lg overflow-hidden tracking-wide">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/10">
            <Play className="w-5 h-5 fill-indigo-500 text-indigo-500 ml-0.5" />
          </div>
          {!collapsed && <span className="truncate bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent font-extrabold text-base">OnyxStream</span>}
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden px-2 scrollbar-hide py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            data-tv-focusable="true"
            className={({ isActive }) =>
              `rounded-xl transition-all outline-none focus:ring-4 focus:ring-indigo-400 focus:bg-indigo-600 focus:text-white focus:scale-105 ${
                collapsed 
                  ? 'flex flex-col items-center justify-center py-2 px-1 text-center' 
                  : 'flex items-center gap-3.5 px-3.5 py-2.5'
              } ${
                isActive
                  ? 'bg-indigo-600/25 text-indigo-400 font-semibold border border-indigo-500/40 shadow-inner'
                  : 'text-gray-400 hover:text-white hover:bg-gray-850'
              }`
            }
            title={item.name}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className={collapsed ? 'text-[10px] font-medium tracking-tight mt-1 truncate max-w-full' : 'text-sm font-medium truncate'}>
              {item.name}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="p-2 space-y-1.5 mb-3 border-t border-gray-850 pt-3">
        <NavLink
          to="/settings"
          data-tv-focusable="true"
          className={({ isActive }) =>
            `rounded-xl transition-all outline-none focus:ring-4 focus:ring-indigo-400 focus:bg-indigo-600 focus:text-white focus:scale-105 ${
              collapsed 
                ? 'flex flex-col items-center justify-center py-2 px-1 text-center' 
                : 'flex items-center gap-3.5 px-3.5 py-2.5'
            } ${
              isActive
                ? 'bg-indigo-600/25 text-indigo-400 font-semibold border border-indigo-500/40 shadow-inner'
                : 'text-gray-400 hover:text-white hover:bg-gray-850'
            }`
          }
          title="Settings"
        >
          <Settings className="w-5 h-5 shrink-0" />
          <span className={collapsed ? 'text-[10px] font-medium tracking-tight mt-1 truncate max-w-full' : 'text-sm font-medium truncate'}>
            Settings
          </span>
        </NavLink>
        <button
          onClick={handleLogout}
          data-tv-focusable="true"
          className={`w-full rounded-xl transition-all outline-none focus:ring-4 focus:ring-red-400 focus:bg-red-600 focus:text-white focus:scale-105 text-gray-400 hover:text-red-400 hover:bg-red-500/10 ${
            collapsed 
              ? 'flex flex-col items-center justify-center py-2 px-1 text-center' 
              : 'flex items-center gap-3.5 px-3.5 py-2.5'
          }`}
          title="Logout"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className={collapsed ? 'text-[10px] font-medium tracking-tight mt-1 truncate max-w-full' : 'text-sm font-medium truncate'}>
            Logout
          </span>
        </button>
      </div>
    </div>

  );
}
