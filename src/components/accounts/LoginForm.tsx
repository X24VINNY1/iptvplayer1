import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlInputRef = useRef<HTMLInputElement>(null);
  const userInputRef = useRef<HTMLInputElement>(null);
  const passInputRef = useRef<HTMLInputElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  const login = useAuthStore(state => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(serverUrl, username, password);
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-tv-section="content">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Server URL</label>
        <input
          ref={urlInputRef}
          type="url"
          required
          tabIndex={0}
          data-tv-focusable="true"
          data-tv-section="content"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              userInputRef.current?.focus();
            }
          }}
          placeholder="http://example.com:8080"
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
        <input
          ref={userInputRef}
          type="text"
          required
          tabIndex={0}
          data-tv-focusable="true"
          data-tv-section="content"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              passInputRef.current?.focus();
            }
          }}
          placeholder="Username"
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
        <div className="relative">
          <input
            ref={passInputRef}
            type={showPassword ? 'text' : 'password'}
            required
            tabIndex={0}
            data-tv-focusable="true"
            data-tv-section="content"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitBtnRef.current?.focus();
              }
            }}
            placeholder="Password"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:border-indigo-500 pr-12 transition-all"
          />
          <button
            type="button"
            tabIndex={0}
            data-tv-focusable="true"
            data-tv-section="content"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            aria-label="Toggle password visibility"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
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
            Connecting...
          </>
        ) : (
          'Connect'
        )}
      </button>
    </form>
  );
}
