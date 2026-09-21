import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useContentStore } from '@/store/useContentStore';
import { XtreamAPI } from '@/api/xtream';
import LoginForm from '@/components/accounts/LoginForm';
import M3UImport from '@/components/accounts/M3UImport';
import AccountManager from '@/components/accounts/AccountManager';
import SyncLoadingScreen from '@/components/ui/SyncLoadingScreen';
import { MonitorPlay } from 'lucide-react';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, serverUrl, username, password, connectionType, m3uChannels } = useAuthStore();
  const { isLoaded, isSyncing, syncAll } = useContentStore();
  const [activeTab, setActiveTab] = useState<'xtream' | 'm3u'>('xtream');

  // Trigger library sync when authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoaded && !isSyncing) {
      let api: XtreamAPI | null = null;
      if (connectionType === 'xtream' && serverUrl && username && password) {
        api = new XtreamAPI(serverUrl, username, password);
      }
      syncAll(api, connectionType, m3uChannels).catch((err) => {
        console.error('Auto sync error:', err);
      });
    }
  }, [isAuthenticated, isLoaded, isSyncing, connectionType, serverUrl, username, password, m3uChannels, syncAll]);

  // Once fully loaded, transition to dashboard
  useEffect(() => {
    if (isAuthenticated && isLoaded) {
      const timer = setTimeout(() => {
        navigate('/');
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoaded, navigate]);

  // Show full loading sync screen while fetching all movies, shows, and channels
  if (isAuthenticated && (isSyncing || !isLoaded)) {
    return <SyncLoadingScreen onComplete={() => navigate('/')} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-indigo-950/30 p-4">
      <div className="w-full max-w-md bg-gray-900/80 backdrop-blur-xl rounded-2xl p-8 border border-gray-800 shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/20">
            <MonitorPlay className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">OnyxStream</h1>
          <p className="text-gray-400 mt-2 text-center">Your premium IPTV experience</p>
        </div>

        <div className="flex bg-gray-800/50 p-1 rounded-lg mb-6 border border-gray-700/50">
          <button
            onClick={() => setActiveTab('xtream')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'xtream'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            Xtream Codes
          </button>
          <button
            onClick={() => setActiveTab('m3u')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'm3u'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            M3U Playlist
          </button>
        </div>

        <div className="mb-8">
          {activeTab === 'xtream' ? <LoginForm /> : <M3UImport />}
        </div>
      </div>
      
      <div className="w-full max-w-4xl mt-8">
        <AccountManager />
      </div>
    </div>
  );
};

export default LoginPage;
