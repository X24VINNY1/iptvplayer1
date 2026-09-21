import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tv, KeyRound, Radio, CheckCircle, AlertCircle, Send, Sparkles, ShieldCheck } from 'lucide-react';

export default function ConnectPage() {
  const [searchParams] = useSearchParams();
  const [pin, setPin] = useState(searchParams.get('pin') || '');
  const [activeTab, setActiveTab] = useState<'xtream' | 'm3u'>('xtream');

  // Xtream fields
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // M3U fields
  const [m3uUrl, setM3uUrl] = useState('');
  const [m3uText, setM3uText] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const urlPin = searchParams.get('pin');
    if (urlPin) setPin(urlPin);
  }, [searchParams]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setM3uText(content);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanPin = pin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      setErrorMessage('Please enter the 4-digit PIN shown on your TV screen.');
      return;
    }

    let payload: any = { type: activeTab };
    if (activeTab === 'xtream') {
      if (!serverUrl || !username || !password) {
        setErrorMessage('Please fill in Server URL, Username, and Password.');
        return;
      }
      payload = {
        type: 'xtream',
        serverUrl: serverUrl.trim(),
        username: username.trim(),
        password: password.trim(),
      };
    } else {
      if (!m3uUrl && !m3uText) {
        setErrorMessage('Please provide an M3U URL or upload an M3U playlist file.');
        return;
      }
      payload = {
        type: 'm3u',
        m3uUrl: m3uUrl.trim(),
        m3uContent: m3uText,
      };
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/companion/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cleanPin, data: payload }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to transfer to TV');
      }

      setSuccessMessage('Successfully sent to your TV! Check your TV screen — it should now log in automatically.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Connection failed. Make sure your phone is on the same Wi-Fi as your TV.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-gray-900/90 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              TV Remote Setup
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                Companion
              </span>
            </h1>
            <p className="text-xs text-gray-400">Send playlist & credentials directly to your TV</p>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm flex items-start gap-3 animate-fade-in">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{successMessage}</p>
              <p className="text-xs text-emerald-400/80 mt-1">You can safely close this browser window.</p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <p>{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* PIN Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center justify-between">
              <span>TV 4-Digit PIN</span>
              <span className="text-[11px] text-indigo-400">Shown on TV screen</span>
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 7829"
                className="w-full text-center tracking-widest text-2xl font-mono font-bold bg-gray-950 border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 px-4 text-white placeholder-gray-600 outline-none transition-all"
                required
              />
              <KeyRound className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button
              type="button"
              onClick={() => setActiveTab('xtream')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'xtream'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Xtream Codes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('m3u')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'm3u'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              M3U Playlist
            </button>
          </div>

          {/* Xtream Panel */}
          {activeTab === 'xtream' ? (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Server URL</label>
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://example.com:8080"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-500 outline-none"
                  required={activeTab === 'xtream'}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-500 outline-none"
                    required={activeTab === 'xtream'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-500 outline-none"
                    required={activeTab === 'xtream'}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* M3U Panel */
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">M3U Playlist URL</label>
                <input
                  type="url"
                  value={m3uUrl}
                  onChange={(e) => setM3uUrl(e.target.value)}
                  placeholder="https://example.com/playlist.m3u"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-800"></div>
                <span className="flex-shrink mx-3 text-gray-500 text-[11px] uppercase">Or Upload File</span>
                <div className="flex-grow border-t border-gray-800"></div>
              </div>

              <div>
                <label className="block w-full border border-dashed border-gray-700 hover:border-indigo-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-gray-950/50">
                  <span className="text-xs text-indigo-400 font-medium">Choose .m3u / .m3u8 file</span>
                  <input type="file" accept=".m3u,.m3u8" onChange={handleFileUpload} className="hidden" />
                </label>
                {m3uText && (
                  <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> File loaded ({m3uText.length} bytes)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Sending to TV...</span>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send to TV</span>
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-gray-500 mt-6">
          Your credentials remain securely on your local network.
        </p>
      </div>
    </div>
  );
}
