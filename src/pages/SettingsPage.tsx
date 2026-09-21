import React, { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useContentStore } from '@/store/useContentStore';
import { useCategoryStore } from '@/store/useCategoryStore';
import AccountManager from '@/components/accounts/AccountManager';
import CategoryManagerModal from '@/components/ui/CategoryManagerModal';
import { formatDate } from '@/utils/format';
import { Server, User, Clock, Activity, Shield, Tv, Info, Globe, SlidersHorizontal, Sparkles, Film, Radio, Smartphone, Wifi } from 'lucide-react';
import CompanionModal from '@/components/companion/CompanionModal';

import { useSettingsStore, VideoPlayerEngine } from '@/store/useSettingsStore';

const SettingsPage: React.FC = () => {
  const { userInfo, serverInfo, connectionType, serverUrl, username } = useAuthStore();
  const { liveCategories, vodCategories, seriesCategories } = useContentStore();
  const { filterUsOnly, showAll } = useCategoryStore();
  const { preferredPlayer, setPreferredPlayer } = useSettingsStore();

  const [activeModalType, setActiveModalType] = useState<'live' | 'vod' | 'series' | null>(null);
  const [isCompanionOpen, setIsCompanionOpen] = useState(false);
  const [dnsMode, setDnsMode] = useState<'cloudflare' | 'quad9' | 'default'>('cloudflare');

  const isXtream = connectionType === 'xtream';

  const InfoRow = ({ label, value, icon: Icon }: { label: string; value: string | number | undefined; icon: any }) => (
    <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-800/50">
      <div className="flex items-center text-gray-400">
        <Icon className="w-5 h-5 mr-3 text-indigo-400" />
        <span className="font-medium">{label}</span>
      </div>
      <div className="text-white font-medium text-right break-all ml-4">
        {value !== undefined && value !== null && value !== '' ? value : 'N/A'}
      </div>
    </div>
  );

  const handleQuickFilterAll = () => {
    filterUsOnly('live', liveCategories);
    if (isXtream) {
      filterUsOnly('vod', vodCategories);
      filterUsOnly('series', seriesCategories);
    }
  };

  const handleResetAll = () => {
    showAll('live');
    showAll('vod');
    showAll('series');
  };

  return (
    <div className="w-full h-full overflow-y-auto scrollbar-hide px-6 py-8 md:px-12 max-w-5xl mx-auto space-y-12 pb-32">

      
      {/* Video Player Engine Section */}
      <section>
        <div className="mb-6 border-b border-gray-800 pb-4">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Tv className="w-6 h-6 mr-2 text-indigo-500" />
            Preferred Video Player Engine
          </h2>
          <p className="text-gray-400 mt-1 text-sm">
            Choose which player engine opens when you click any Live TV channel, movie, or TV show.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Native Player (ExoPlayer) */}
          <div 
            onClick={() => setPreferredPlayer('native')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              preferredPlayer === 'native'
                ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500'
                : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
                🚀
              </div>
              {preferredPlayer === 'native' && (
                <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Active
                </span>
              )}
            </div>
            <h3 className="text-white font-semibold text-base mb-1">Native Android Player</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Internal hardware-accelerated player engine. Perfect for TV remotes with zero lag.
            </p>
          </div>

          {/* VLC Player */}
          <div 
            onClick={() => setPreferredPlayer('vlc')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              preferredPlayer === 'vlc'
                ? 'bg-orange-600/20 border-orange-500 shadow-lg shadow-orange-500/20 ring-1 ring-orange-500'
                : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-600/30 flex items-center justify-center text-orange-400 font-bold text-lg">
                🟧
              </div>
              {preferredPlayer === 'vlc' && (
                <span className="bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Active
                </span>
              )}
            </div>
            <h3 className="text-white font-semibold text-base mb-1">VLC Player (External)</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Launches VLC for Android with full codec support, AC3/EAC3 audio, and hardware decoding.
            </p>
          </div>

          {/* MX Player */}
          <div 
            onClick={() => setPreferredPlayer('mx')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              preferredPlayer === 'mx'
                ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20 ring-1 ring-blue-500'
                : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 flex items-center justify-center text-blue-400 font-bold text-lg">
                🟦
              </div>
              {preferredPlayer === 'mx' && (
                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Active
                </span>
              )}
            </div>
            <h3 className="text-white font-semibold text-base mb-1">MX Player (HW+)</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Launches MX Player with HW+ decoder enabled for high-bitrate 4K and HEVC streams.
            </p>
          </div>

          {/* Built-in Web Player */}
          <div 
            onClick={() => setPreferredPlayer('builtin')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              preferredPlayer === 'builtin'
                ? 'bg-emerald-600/20 border-emerald-500 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500'
                : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
                🛡️
              </div>
              {preferredPlayer === 'builtin' && (
                <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Active
                </span>
              )}
            </div>
            <h3 className="text-white font-semibold text-base mb-1">Onyx Web Player</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              In-app web player featuring the built-in Anti-Lag Engine and adaptive buffering.
            </p>
          </div>

          {/* System Chooser */}
          <div 
            onClick={() => setPreferredPlayer('chooser')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              preferredPlayer === 'chooser'
                ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-500/20 ring-1 ring-purple-500'
                : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600/30 flex items-center justify-center text-purple-400 font-bold text-lg">
                🌐
              </div>
              {preferredPlayer === 'chooser' && (
                <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Active
                </span>
              )}
            </div>
            <h3 className="text-white font-semibold text-base mb-1">System Chooser</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Prompts Android TV app chooser every time so you can pick any installed video player.
            </p>
          </div>
        </div>
      </section>

      {/* Category Management Section */}
      <section>
        <div className="mb-6 border-b border-gray-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center">
              <SlidersHorizontal className="w-6 h-6 mr-2 text-indigo-500" />
              Category & Language Filters
            </h2>
            <p className="text-gray-400 mt-1 text-sm">
              Hide unwanted international categories or keep only US, USA, and English content.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleQuickFilterAll}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Set All to US / EN Only
            </button>
            <button
              onClick={handleResetAll}
              className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium border border-gray-700 transition-colors"
            >
              Show All Categories
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Live TV Categories */}
          <div className="p-5 bg-gray-900/60 rounded-2xl border border-gray-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Radio className="w-5 h-5 text-indigo-400" />
                <h3 className="text-white font-semibold text-base">Live TV</h3>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                {liveCategories.length} categories available
              </p>
            </div>
            <button
              onClick={() => setActiveModalType('live')}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-indigo-300 text-xs font-semibold rounded-lg transition-colors"
            >
              Organize Channels ({liveCategories.length})
            </button>
          </div>

          {/* VOD Movies Categories */}
          {isXtream && (
            <div className="p-5 bg-gray-900/60 rounded-2xl border border-gray-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Film className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-white font-semibold text-base">Movies (VOD)</h3>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  {vodCategories.length} categories available
                </p>
              </div>
              <button
                onClick={() => setActiveModalType('vod')}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-indigo-300 text-xs font-semibold rounded-lg transition-colors"
              >
                Organize Movies ({vodCategories.length})
              </button>
            </div>
          )}

          {/* TV Series Categories */}
          {isXtream && (
            <div className="p-5 bg-gray-900/60 rounded-2xl border border-gray-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Tv className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-white font-semibold text-base">TV Series</h3>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  {seriesCategories.length} categories available
                </p>
              </div>
              <button
                onClick={() => setActiveModalType('series')}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-indigo-300 text-xs font-semibold rounded-lg transition-colors"
              >
                Organize Shows ({seriesCategories.length})
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Account Info */}
      {isXtream && userInfo && serverInfo && (
        <section>
          <div className="mb-6 border-b border-gray-800 pb-4">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <User className="w-6 h-6 mr-2 text-indigo-500" />
              Account Information
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow label="Username" value={userInfo.username || username} icon={User} />
            <InfoRow 
              label="Status" 
              value={userInfo.status} 
              icon={Activity} 
            />
            <InfoRow 
              label="Expiration Date" 
              value={userInfo.exp_date ? formatDate(parseInt(userInfo.exp_date) * 1000) : 'Unlimited'} 
              icon={Clock} 
            />
            <InfoRow 
              label="Connections" 
              value={`${userInfo.active_cons || 0} / ${userInfo.max_connections || 'Unlimited'}`} 
              icon={Tv} 
            />
            <InfoRow label="Created At" value={userInfo.created_at ? formatDate(parseInt(userInfo.created_at) * 1000) : undefined} icon={Clock} />
            <InfoRow label="Is Trial" value={userInfo.is_trial === '1' ? 'Yes' : 'No'} icon={Info} />
            <InfoRow label="Allowed Formats" value={userInfo.allowed_output_formats?.join(', ')} icon={Shield} />
          </div>
        </section>
      )}

      {/* Server Info */}
      {isXtream && serverInfo && (
        <section>
          <div className="mb-6 border-b border-gray-800 pb-4">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <Server className="w-6 h-6 mr-2 text-indigo-500" />
              Server Information
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow label="Server URL" value={serverInfo.url || serverUrl} icon={Globe} />
            <InfoRow label="Timezone" value={serverInfo.timezone} icon={Clock} />
            <InfoRow label="Protocol" value={serverInfo.server_protocol} icon={Server} />
          </div>
        </section>
      )}

      {/* Profiles */}
      <section>
        <div className="mb-6 border-b border-gray-800 pb-4">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <User className="w-6 h-6 mr-2 text-indigo-500" />
            Server Profiles
          </h2>
          <p className="text-gray-400 mt-2 text-sm">Manage your saved Xtream Codes and M3U playlists.</p>
        </div>
        
        <AccountManager />
      </section>

      {/* TV Companion & Phone Pairing */}
      <section>
        <div className="mb-6 border-b border-gray-800 pb-4">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Smartphone className="w-6 h-6 mr-2 text-indigo-500" />
            TV Remote Companion (Wi-Fi Pairing)
          </h2>
          <p className="text-gray-400 mt-2 text-sm">
            Control or transfer playlists from your phone to this TV device over local Wi-Fi.
          </p>
        </div>

        <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">Connect Smartphone</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-md">
              Generates a temporary 4-digit PIN and QR code. Open on your mobile phone to easily type IPTV credentials or upload M3U files without typing on the TV remote.
            </p>
          </div>
          <button
            onClick={() => setIsCompanionOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all flex-shrink-0"
          >
            <Smartphone className="w-4 h-4" />
            Launch Phone Pairing
          </button>
        </div>
      </section>

      {/* Custom DNS-over-HTTPS (DoH) Bypass */}
      <section>
        <div className="mb-6 border-b border-gray-800 pb-4">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Wifi className="w-6 h-6 mr-2 text-indigo-500" />
            Custom DNS-over-HTTPS (ISP Censorship Bypass)
          </h2>
          <p className="text-gray-400 mt-2 text-sm">
            Route streaming DNS queries through encrypted DoH resolvers to circumvent ISP blocks and regional throttling.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => setDnsMode('cloudflare')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              dnsMode === 'cloudflare'
                ? 'bg-indigo-600/20 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-white">Cloudflare DoH</span>
              {dnsMode === 'cloudflare' && (
                <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold uppercase">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">1.1.1.1 encrypted DNS. Ultra-fast lookup, zero logs.</p>
          </div>

          <div
            onClick={() => setDnsMode('quad9')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              dnsMode === 'quad9'
                ? 'bg-indigo-600/20 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-white">Quad9 DoH</span>
              {dnsMode === 'quad9' && (
                <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold uppercase">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">9.9.9.9 privacy-first encrypted DNS with threat protection.</p>
          </div>

          <div
            onClick={() => setDnsMode('default')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              dnsMode === 'default'
                ? 'bg-indigo-600/20 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-white">System Default</span>
              {dnsMode === 'default' && (
                <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold uppercase">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">Standard operating system DNS configuration.</p>
          </div>
        </div>
      </section>

      {/* About */}
      <section>
        <div className="mb-6 border-b border-gray-800 pb-4">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Info className="w-6 h-6 mr-2 text-indigo-500" />
            About
          </h2>
        </div>
        
        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800 text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Tv className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">OnyxStream</h3>
          <p className="text-gray-400 mb-4">Version 1.0.0</p>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            A modern, feature-rich IPTV client built with React and Tailwind CSS. 
            Supports Xtream Codes API and M3U playlists.
          </p>
        </div>
      </section>

      {/* Modals */}
      {activeModalType === 'live' && (
        <CategoryManagerModal
          isOpen={true}
          onClose={() => setActiveModalType(null)}
          type="live"
          categories={liveCategories}
        />
      )}
      {activeModalType === 'vod' && (
        <CategoryManagerModal
          isOpen={true}
          onClose={() => setActiveModalType(null)}
          type="vod"
          categories={vodCategories}
        />
      )}
      {activeModalType === 'series' && (
        <CategoryManagerModal
          isOpen={true}
          onClose={() => setActiveModalType(null)}
          type="series"
          categories={seriesCategories}
        />
      )}

      <CompanionModal
        isOpen={isCompanionOpen}
        onClose={() => setIsCompanionOpen(false)}
      />
    </div>
  );
};

export default SettingsPage;
