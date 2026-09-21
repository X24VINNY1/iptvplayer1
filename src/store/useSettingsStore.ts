import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Capacitor } from '@capacitor/core';

export type VideoPlayerEngine = 'builtin' | 'native' | 'vlc' | 'mx' | 'chooser';

interface SettingsState {
  preferredPlayer: VideoPlayerEngine;
  setPreferredPlayer: (player: VideoPlayerEngine) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Default to native hardware player on Android TV APK, and builtin web player on browser
      preferredPlayer: Capacitor.isNativePlatform() ? 'native' : 'builtin',
      setPreferredPlayer: (preferredPlayer) => set({ preferredPlayer }),
    }),
    {
      name: 'onyxstream-settings-v1',
    }
  )
);
