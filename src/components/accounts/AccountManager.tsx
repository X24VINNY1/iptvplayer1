import React, { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import ProfileCard from './ProfileCard';
import LoginForm from './LoginForm';
import M3UImport from './M3UImport';
import { Plus, X } from 'lucide-react';

interface AccountManagerProps {
  onConnect?: (profileId: string) => void;
}

export default function AccountManager({ onConnect }: AccountManagerProps) {
  const { profiles, activeProfileId, switchProfile, deleteProfile } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'xtream' | 'm3u'>('xtream');

  const handleConnect = async (profileId: string) => {
    if (activeProfileId !== profileId) {
      await switchProfile(profileId);
    }
    if (onConnect) {
      onConnect(profileId);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this account?')) {
      deleteProfile(id);
    }
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Saved Accounts</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-xl">
          <p className="text-gray-400">No accounts saved yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isActive={profile.id === activeProfileId}
              onConnect={() => handleConnect(profile.id)}
              onEdit={() => {}} // Could be implemented later
              onDelete={() => handleDelete(profile.id)}
            />
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="p-6">
              <h3 className="text-2xl font-bold text-white mb-6">Add Account</h3>
              
              <div className="flex gap-2 mb-6 p-1 bg-gray-950 rounded-lg">
                <button
                  onClick={() => setActiveTab('xtream')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'xtream' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Xtream Codes
                </button>
                <button
                  onClick={() => setActiveTab('m3u')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'm3u' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  M3U Playlist
                </button>
              </div>

              {activeTab === 'xtream' ? (
                <LoginForm onSuccess={handleSuccess} />
              ) : (
                <M3UImport onSuccess={handleSuccess} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
