import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useContentStore } from '@/store/useContentStore';
import { XtreamAPI } from '@/api/xtream';
import LoginForm from '@/components/accounts/LoginForm';
import M3UImport from '@/components/accounts/M3UImport';
import AccountManager from '@/components/accounts/AccountManager';
import SyncLoadingScreen from '@/components/ui/SyncLoadingScreen';
import CompanionModal from '@/components/companion/CompanionModal';
import { MonitorPlay, Smartphone } from 'lucide-react';
import { useTVRemote } from '@/hooks/useTVRemote';

const LoginPage: React.FC = () => {
  // Activate global spatial navigation for Android TV remote D-pad
  useTVRemote();

  const navigate = useNavigate();
  const { isAuthenticated, serverUrl, username, password, connectionType, m3uChannels } = useAuthStore();
  const { isLoaded, isSyncing, syncAll } = useContentStore();
  const [activeTab, setActiveTab] = useState<'xtream' | 'm3u'>('xtream');
  const [isCompanionOpen, setIsCompanionOpen] = useState(false);

  // Automatically focus the primary input on mount or tab change so the remote is immediately ready
  useEffect(() => {
    const timer = setTimeout(() => {
      const primaryInput = document.querySelector<HTMLElement>(
        'input[data-tv-focusable="true"], [data-tv-section="content"] input'
      );
      if (primaryInput) {
        primaryInput.focus();
        primaryInput.classList.add('tv-focused');
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [activeTab]);

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

        <div className="flex bg-gray-800/50 p-1 rounded-lg mb-6 border border-gray-700/50" data-tv-section="categories">
          <button
            type="button"
            data-tv-focusable="true"
            tabIndex={0}
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
            type="button"
            data-tv-focusable="true"
            tabIndex={0}
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

        <div className="mb-6">
          {activeTab === 'xtream' ? <LoginForm /> : <M3UImport />}
        </div>

        {/* TV Companion Connect from Phone Button */}
        <div className="pt-4 border-t border-gray-800/80">
          <button
            type="button"
            onClick={() => setIsCompanionOpen(true)}
            data-tv-focusable="true"
            data-tv-section="content"
            tabIndex={0}
            className="w-full py-2.5 px-4 bg-indigo-950/60 hover:bg-indigo-900/70 border border-indigo-500/40 rounded-xl text-indigo-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md focus:ring-4 focus:ring-indigo-500 outline-none"
          >
            <Smartphone className="w-4 h-4 text-indigo-400" />
            Connect from Phone (QR / 4-Digit PIN)
          </button>
          <p className="text-center text-[10px] text-gray-500 mt-2">
            No remote typing needed. Setup from your smartphone on Wi-Fi.
          </p>
        </div>
      </div>

      <CompanionModal
        isOpen={isCompanionOpen}
        onClose={() => setIsCompanionOpen(false)}
      />
      
      <div className="w-full max-w-4xl mt-8">
        <AccountManager />
      </div>
    </div>
  );
};

export default LoginPage;
