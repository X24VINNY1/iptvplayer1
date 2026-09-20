import React from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import AccountManager from '@/components/accounts/AccountManager';
import { formatDate } from '@/utils/format';
import { Server, User, Clock, Activity, Shield, Tv, Info, Globe } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const { userInfo, serverInfo, connectionType, serverUrl, username } = useAuthStore();

  const isXtream = connectionType === 'xtream';

  const InfoRow = ({ label, value, icon: Icon }: { label: string, value: string | number | undefined, icon: any }) => (
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

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-12 pb-24 h-[calc(100vh-64px)] overflow-y-auto scrollbar-hide">
      
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
            <InfoRow label="Created At" value={userInfo.created_at ? formatDate(parseInt(userInfo.created_at) * 1000) : undefined} icon={CalendarIcon} />
            <InfoRow label="Is Trial" value={userInfo.is_trial === '1' ? 'Yes' : 'No'} icon={Info} />
            <InfoRow label="Allowed Formats" value={userInfo.allowed_output_formats?.join(', ')} icon={Shield} />
          </div>
        </section>
      )}

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

    </div>
  );
};

// Helper component for calendar icon since it's not imported at top level to avoid clutter
const CalendarIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

export default SettingsPage;
