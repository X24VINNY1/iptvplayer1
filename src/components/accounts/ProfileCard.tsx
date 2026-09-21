import React from 'react';
import { Pencil, Trash2, Globe, Radio } from 'lucide-react';
import { ServerProfile } from '@/types';

interface ProfileCardProps {
  profile: ServerProfile;
  isActive?: boolean;
  onConnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ProfileCard({ profile, isActive, onConnect, onEdit, onDelete }: ProfileCardProps) {
  const formatTime = (time?: number) => {
    if (!time) return 'Never';
    return new Date(time).toLocaleDateString();
  };

  return (
    <div className={`bg-gray-900 rounded-xl p-4 border transition-all ${isActive ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : 'border-gray-800 hover:border-gray-700'}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white truncate pr-2">
            {profile.name}
          </h3>
          <p className="text-sm text-gray-400 truncate flex items-center gap-1 mt-1">
            <Globe className="w-3 h-3" />
            {profile.type === 'xtream' ? profile.serverUrl : (profile.m3uUrl ? new URL(profile.m3uUrl).hostname : 'M3U Link')}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${profile.type === 'xtream' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
          {profile.type === 'xtream' ? 'Xtream' : 'M3U'}
        </span>
      </div>

      {profile.type === 'xtream' && profile.username && (
        <div className="text-sm text-gray-300 mb-4 bg-gray-950/50 p-2 rounded-lg">
          <span className="text-gray-500">User: </span>
          <span className="font-mono">{profile.username}</span>
        </div>
      )}

      <div className="text-xs text-gray-500 mb-4 flex justify-between">
        <span>Last used: {formatTime(profile.lastUsed)}</span>
        <span>Added: {formatTime(profile.createdAt)}</span>
      </div>

      <div className="flex items-center gap-2 mt-auto" data-tv-section="accounts">
        <button
          onClick={onConnect}
          tabIndex={0}
          data-tv-focusable="true"
          data-tv-section="accounts"
          className={`flex-1 py-2 rounded-lg font-medium transition-colors focus:ring-4 focus:ring-indigo-500 outline-none ${isActive ? 'bg-indigo-600/20 text-indigo-400 cursor-default' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
          disabled={isActive}
        >
          {isActive ? 'Connected' : 'Connect'}
        </button>
        <button
          onClick={onEdit}
          tabIndex={0}
          data-tv-focusable="true"
          data-tv-section="accounts"
          className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 outline-none"
          title="Edit"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          tabIndex={0}
          data-tv-focusable="true"
          data-tv-section="accounts"
          className="p-2 bg-gray-800 hover:bg-red-500/20 hover:text-red-400 text-gray-300 rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 outline-none"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
