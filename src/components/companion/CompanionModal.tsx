import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Smartphone, RefreshCw, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface CompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CompanionModal({ isOpen, onClose, onSuccess }: CompanionModalProps) {
  const { login, loginM3U } = useAuthStore();
  const [pin, setPin] = useState<string>('');
  const [status, setStatus] = useState<'waiting' | 'connecting' | 'success' | 'error'>('waiting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const isConnectingRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const cleanupListeners = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const handleCredentials = async (payload: any) => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;
    cleanupListeners();
    setStatus('connecting');

    try {
      if (payload.type === 'xtream') {
        if (!payload.serverUrl || !payload.username || !payload.password) {
          throw new Error('Incomplete Xtream credentials received');
        }
        await login(payload.serverUrl, payload.username, payload.password);
      } else if (payload.type === 'm3u') {
        if (!payload.m3uUrl) {
          throw new Error('Incomplete M3U URL received');
        }
        await loginM3U(payload.m3uUrl);
      } else {
        throw new Error('Unknown connection type');
      }

      setStatus('success');
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error('Companion authentication error:', err);
      isConnectingRef.current = false;
      setStatus('error');
      setErrorMessage(err.message || 'Failed to authenticate with received credentials');
    }
  };

  const startSession = () => {
    cleanupListeners();
    isConnectingRef.current = false;
    setStatus('waiting');
    setErrorMessage(null);

    // Generate local 4-digit PIN
    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(generatedPin);

    const topic = `onyxstream-${generatedPin}`;
    const ntfyBase = `https://ntfy.sh/${topic}`;

    // 1. Subscribe via Server-Sent Events (SSE)
    try {
      const es = new EventSource(`${ntfyBase}/sse`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (raw.event === 'message' && raw.message) {
            const innerPayload = JSON.parse(raw.message);
            handleCredentials(innerPayload);
          }
        } catch {
          try {
            const direct = JSON.parse(event.data);
            if (direct.serverUrl || direct.m3uUrl) {
              handleCredentials(direct);
            }
          } catch {}
        }
      };

      es.onerror = () => {
        // SSE may reconnect or fallback to poll
      };
    } catch (e) {
      console.warn('SSE subscription notice:', e);
    }

    // 2. Polling fallback every 1500ms
    pollTimerRef.current = setInterval(async () => {
      if (isConnectingRef.current) return;

      // Poll ntfy.sh relay
      try {
        const res = await fetch(`${ntfyBase}/json?poll=1`);
        if (res.ok) {
          const text = await res.text();
          const lines = text.trim().split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              if (msg.event === 'message' && msg.message) {
                const payload = JSON.parse(msg.message);
                if (payload.serverUrl || payload.m3uUrl) {
                  handleCredentials(payload);
                  return;
                }
              }
            } catch {}
          }
        }
      } catch (err) {
        console.warn('ntfy poll error', err);
      }

      // Also check local dev server endpoint if running in Vite dev
      try {
        const localRes = await fetch(`/api/companion/poll?pin=${generatedPin}`);
        if (localRes.ok) {
          const localData = await localRes.json();
          if (localData.status === 'completed' && localData.data) {
            handleCredentials(localData.data);
          }
        }
      } catch {}
    }, 1500);
  };

  useEffect(() => {
    if (isOpen) {
      startSession();
      setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 100);
    } else {
      cleanupListeners();
    }
    return () => {
      cleanupListeners();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const companionUrl = `https://x24vinny1.github.io/iptvplayer1/companion.html?pin=${pin}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(companionUrl)}`;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      data-modal="true"
    >
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative">
        <button
          ref={closeBtnRef}
          onClick={onClose}
          data-tv-focusable="true"
          data-modal-close="true"
          tabIndex={0}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-2 rounded-xl bg-gray-800/80 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Connect From Phone</h2>
            <p className="text-xs text-gray-400">Pair your phone to enter Xtream credentials easily</p>
          </div>
        </div>

        {status === 'error' && (
          <div className="py-8 text-center">
            <AlertTriangle className="w-10 h-10 mx-auto text-rose-400 mb-3" />
            <p className="text-sm text-rose-300 mb-4">{errorMessage}</p>
            <button
              onClick={startSession}
              data-tv-focusable="true"
              tabIndex={0}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              Generate New Code
            </button>
          </div>
        )}

        {status === 'connecting' && (
          <div className="py-12 text-center text-white">
            <RefreshCw className="w-10 h-10 animate-spin mx-auto text-indigo-400 mb-4" />
            <p className="text-base font-semibold">Credentials Received!</p>
            <p className="text-xs text-gray-400 mt-1">Authenticating and loading your IPTV channels...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-12 text-center text-white">
            <CheckCircle className="w-12 h-12 mx-auto text-emerald-400 mb-4 animate-bounce" />
            <p className="text-lg font-bold text-emerald-300">Successfully Connected!</p>
            <p className="text-xs text-gray-400 mt-1">Starting OnyxStream...</p>
          </div>
        )}

        {status === 'waiting' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-6 bg-gray-950 p-4 rounded-xl border border-gray-800">
              {/* QR Code */}
              <div className="p-2 bg-white rounded-xl shadow-lg flex-shrink-0">
                <img
                  src={qrUrl}
                  alt="Scan to connect"
                  className="w-36 h-36 rounded-lg object-contain"
                />
              </div>

              {/* Instructions */}
              <div className="flex-1 text-center sm:text-left space-y-3">
                <div>
                  <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Step 1: Scan QR or Open Link</span>
                  <p className="text-[11px] text-gray-300 font-mono break-all mt-0.5 select-all bg-gray-900 px-2 py-1.5 rounded border border-gray-800">
                    {companionUrl}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Step 2: TV PIN Code</span>
                  <div className="text-3xl font-mono font-extrabold text-white tracking-widest bg-indigo-950/40 border border-indigo-500/40 px-3 py-1.5 rounded-lg inline-block mt-0.5 shadow-inner">
                    {pin}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                Waiting for phone submission...
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={startSession}
                  data-tv-focusable="true"
                  tabIndex={0}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg flex items-center gap-1.5 transition-colors focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>New PIN</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  data-tv-focusable="true"
                  tabIndex={0}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
