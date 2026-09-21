import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { Loader2 } from 'lucide-react';

interface M3UImportProps {
  onSuccess?: () => void;
}

export default function M3UImport({ onSuccess }: M3UImportProps) {
  const [m3uUrl, setM3uUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  const loginM3U = useAuthStore(state => state.loginM3U);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await loginM3U(m3uUrl);
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load M3U playlist.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-tv-section="content">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">M3U Playlist URL</label>
        <input
          ref={inputRef}
          type="url"
          required
          tabIndex={0}
          data-tv-focusable="true"
          data-tv-section="content"
          value={m3uUrl}
          onChange={(e) => setM3uUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitBtnRef.current?.focus();
            }
          }}
          placeholder="http://example.com/playlist.m3u"
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        ref={submitBtnRef}
        type="submit"
        tabIndex={0}
        data-tv-focusable="true"
        data-tv-section="content"
        disabled={isLoading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:ring-4 focus:ring-indigo-500 outline-none shadow-lg shadow-indigo-600/30"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading Playlist...
          </>
        ) : (
          'Load Playlist'
        )}
      </button>
    </form>
  );
}
