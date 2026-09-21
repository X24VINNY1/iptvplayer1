import { registerPlugin, Capacitor } from '@capacitor/core';

export interface NativePlayerPluginInterface {
  playInNativePlayer(options: { url: string; title: string; isLive?: boolean }): Promise<{ success: boolean; player: string }>;
  playInVlc(options: { url: string; title: string }): Promise<{ success: boolean; player: string }>;
  playInMxPlayer(options: { url: string; title: string }): Promise<{ success: boolean; player: string }>;
  playInChooser(options: { url: string; title: string }): Promise<{ success: boolean; player: string }>;
}

const NativePlayer = registerPlugin<NativePlayerPluginInterface>('NativePlayer');

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform();
}

export async function openInNativePlayer(url: string, title: string, isLive: boolean = false): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativePlayer.playInNativePlayer({ url, title, isLive });
      return true;
    } catch (err) {
      console.warn('Native player launch failed:', err);
    }
  }
  return false;
}

export async function openInVlc(url: string, title: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativePlayer.playInVlc({ url, title });
      return true;
    } catch (err) {
      console.warn('VLC launch failed:', err);
    }
  } else {
    // Desktop / Web browser: trigger vlc:// URI scheme or download m3u
    const cleanUrl = url.replace(/^https?:\/\//, '');
    window.location.href = `vlc://${cleanUrl}`;
    return true;
  }
  return false;
}

export async function openInMxPlayer(url: string, title: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativePlayer.playInMxPlayer({ url, title });
      return true;
    } catch (err) {
      console.warn('MX Player launch failed:', err);
    }
  } else {
    window.open(url, '_blank');
    return true;
  }
  return false;
}

export async function openInSystemChooser(url: string, title: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativePlayer.playInChooser({ url, title });
      return true;
    } catch (err) {
      console.warn('System chooser launch failed:', err);
    }
  } else {
    window.open(url, '_blank');
    return true;
  }
  return false;
}
