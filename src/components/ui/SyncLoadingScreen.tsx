import React from 'react';
import { useContentStore } from '@/store/useContentStore';
import { Tv, Film, Radio, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

interface SyncLoadingScreenProps {
  onComplete?: () => void;
}

export default function SyncLoadingScreen({ onComplete }: SyncLoadingScreenProps) {
  const { syncStep, syncProgress, syncCounts, isLoaded, syncError } = useContentStore();

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6 text-white overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none -top-20 -left-20 animate-pulse" />
      <div className="absolute w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20 animate-pulse" />

      <div className="relative z-10 max-w-md w-full flex flex-col items-center text-center">
        {/* App Logo */}
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-indigo-600/40 relative group">
          <Tv className="w-10 h-10 text-white" />
          <div className="absolute inset-0 rounded-3xl border-2 border-indigo-400/40 animate-ping" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Syncing Your Library</h1>
        <p className="text-gray-400 text-sm mb-8">
          Loading all live channels, movies, and TV series into memory so your streaming is instant.
        </p>

        {/* Progress Bar Container */}
        <div className="w-full bg-gray-900 rounded-2xl p-6 border border-gray-800/80 shadow-xl space-y-6">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold mb-2">
              <span className="text-indigo-400 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {syncStep || 'Loading...'}
              </span>
              <span className="text-gray-400">{Math.round(syncProgress)}%</span>
            </div>
            <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.max(5, syncProgress))}%` }}
              />
            </div>
          </div>

          {/* Counts Checklist */}
          <div className="space-y-3 text-left">
            {/* Live TV Item */}
            <div className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl border border-gray-700/40">
              <div className="flex items-center gap-3">
                <Radio className="w-5 h-5 text-indigo-400" />
                <span className="text-sm font-medium text-gray-200">Live TV Channels</span>
              </div>
              <div className="flex items-center gap-2">
                {syncCounts.live > 0 ? (
                  <>
                    <span className="text-xs font-bold text-indigo-400">
                      {syncCounts.live.toLocaleString()} loaded
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </>
                ) : (
                  <span className="text-xs text-gray-500">Waiting...</span>
                )}
              </div>
            </div>

            {/* Movies Item */}
            <div className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl border border-gray-700/40">
              <div className="flex items-center gap-3">
                <Film className="w-5 h-5 text-indigo-400" />
                <span className="text-sm font-medium text-gray-200">VOD Movies</span>
              </div>
              <div className="flex items-center gap-2">
                {syncCounts.vod > 0 ? (
                  <>
                    <span className="text-xs font-bold text-indigo-400">
                      {syncCounts.vod.toLocaleString()} loaded
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </>
                ) : (
                  <span className="text-xs text-gray-500">Waiting...</span>
                )}
              </div>
            </div>

            {/* TV Series Item */}
            <div className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl border border-gray-700/40">
              <div className="flex items-center gap-3">
                <Tv className="w-5 h-5 text-indigo-400" />
                <span className="text-sm font-medium text-gray-200">TV Series</span>
              </div>
              <div className="flex items-center gap-2">
                {syncCounts.series > 0 ? (
                  <>
                    <span className="text-xs font-bold text-indigo-400">
                      {syncCounts.series.toLocaleString()} loaded
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </>
                ) : (
                  <span className="text-xs text-gray-500">Waiting...</span>
                )}
              </div>
            </div>
          </div>

          {/* Action button when done */}
          {isLoaded && onComplete && (
            <button
              onClick={onComplete}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              Enter OnyxStream
            </button>
          )}

          {syncError && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-xl text-red-300 text-xs">
              Error syncing content: {syncError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
