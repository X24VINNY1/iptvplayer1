import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ServerProfile, XtreamAuth, M3UChannel } from '@/types';
import { encrypt, decrypt } from '@/utils/crypto';
import { XtreamAPI } from '@/api/xtream';
import { fetchAndParseM3U } from '@/api/m3u-parser';

interface AuthState {
  serverUrl: string;
  username: string;
  password: string;
  userInfo: XtreamAuth['user_info'] | null;
  serverInfo: XtreamAuth['server_info'] | null;
  isAuthenticated: boolean;
  profiles: ServerProfile[];
  activeProfileId: string | null;
  connectionType: 'xtream' | 'm3u';
  m3uChannels: M3UChannel[];

  login: (serverUrl: string, username: string, password: string) => Promise<void>;
  loginM3U: (m3uUrl: string) => Promise<void>;
  logout: () => void;
  addProfile: (profile: Omit<ServerProfile, 'id' | 'createdAt'>) => void;
  updateProfile: (id: string, data: Partial<ServerProfile>) => void;
  deleteProfile: (id: string) => void;
  switchProfile: (id: string) => Promise<void>;
  loadProfiles: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      serverUrl: '',
      username: '',
      password: '',
      userInfo: null,
      serverInfo: null,
      isAuthenticated: false,
      profiles: [],
      activeProfileId: null,
      connectionType: 'xtream',
      m3uChannels: [],

      login: async (serverUrl, username, password) => {
        const api = new XtreamAPI(serverUrl, username, password);
        const authData = await api.authenticate();

        const { profiles, updateProfile } = get();
        const existingProfile = profiles.find(
          p => p.serverUrl === serverUrl && p.username === username && p.type === 'xtream'
        );

        if (existingProfile) {
          updateProfile(existingProfile.id, { lastUsed: Date.now() });
          set({ activeProfileId: existingProfile.id });
        }

        set({
          serverUrl,
          username,
          password,
          userInfo: authData.user_info,
          serverInfo: authData.server_info,
          isAuthenticated: true,
          connectionType: 'xtream',
          m3uChannels: []
        });
      },

      loginM3U: async (m3uUrl) => {
        const channels = await fetchAndParseM3U(m3uUrl);
        
        const { profiles, updateProfile } = get();
        const existingProfile = profiles.find(
          p => p.m3uUrl === m3uUrl && p.type === 'm3u'
        );

        if (existingProfile) {
          updateProfile(existingProfile.id, { lastUsed: Date.now() });
          set({ activeProfileId: existingProfile.id });
        }

        set({
          serverUrl: m3uUrl,
          username: '',
          password: '',
          userInfo: null,
          serverInfo: null,
          isAuthenticated: true,
          connectionType: 'm3u',
          m3uChannels: channels
        });
      },

      logout: () => {
        set({
          serverUrl: '',
          username: '',
          password: '',
          userInfo: null,
          serverInfo: null,
          isAuthenticated: false,
          activeProfileId: null,
          m3uChannels: []
        });
      },

      addProfile: (profile) => {
        const id = crypto.randomUUID();
        const newProfile: ServerProfile = {
          ...profile,
          id,
          createdAt: Date.now(),
          password: profile.password ? encrypt(profile.password) : ''
        };
        
        set((state) => ({
          profiles: [...state.profiles, newProfile]
        }));
      },

      updateProfile: (id, data) => {
        set((state) => {
          const updatedProfiles = state.profiles.map(p => {
            if (p.id === id) {
              const updated = { ...p, ...data };
              if (data.password) {
                updated.password = encrypt(data.password);
              }
              return updated;
            }
            return p;
          });
          return { profiles: updatedProfiles };
        });
      },

      deleteProfile: (id) => {
        set((state) => ({
          profiles: state.profiles.filter(p => p.id !== id)
        }));
      },

      switchProfile: async (id) => {
        const profile = get().profiles.find(p => p.id === id);
        if (!profile) throw new Error('Profile not found');

        get().logout();

        if (profile.type === 'xtream') {
          const decPassword = decrypt(profile.password);
          await get().login(profile.serverUrl, profile.username, decPassword);
        } else if (profile.type === 'm3u' && profile.m3uUrl) {
          await get().loginM3U(profile.m3uUrl);
        }
        set({ activeProfileId: id });
      },

      loadProfiles: () => {
        // Handled inherently by persist, but we can do extra logic if needed
      }
    }),
    {
      name: 'onyxstream-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
        serverUrl: state.serverUrl,
        username: state.username,
        password: state.password,
        userInfo: state.userInfo,
        serverInfo: state.serverInfo,
        isAuthenticated: state.isAuthenticated,
        connectionType: state.connectionType,
      })
    }
  )
);
