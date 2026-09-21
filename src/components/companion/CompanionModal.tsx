import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Smartphone, QrCode, RefreshCw, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface CompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CompanionModal({ isOpen, onClose, onSuccess }: CompanionModalProps) {
  const { login, loginM3U } = useAuthStore();
  const [pin, setPin] = useState<string | null>(null);
  const [ip, setIp] = useState<string>('localhost');
  const [port, setPort] = useState<number>(3000);
  const [status, setStatus] = useState<'loading' | 'waiting' | 'connecting' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startSession = async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      // 1. Get network info
      const infoRes = await fetch('/api/companion/info');
      const infoData = await infoRes.json();
      setIp(infoData.ip || window.location.hostname);
      setPort(infoData.port || 3000);

      // 2. Get PIN
      const pinRes = await fetch('/api/companion/new');
      const pinData = await pinRes.json();
      setPin(pinData.pin);
      setStatus('waiting');
    } catch (err: any) {
      console.error('Failed to start companion session:', err);
      setStatus('error');
      setErrorMessage('Could not initialize pairing server. Check server connection.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      startSession();
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen]);

  // Polling loop
  useEffect(() => {
    if (status !== 'waiting' || !pin) return;

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/companion/poll?pin=${pin}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'completed' && data.data) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setStatus('connecting');
          const payload = data.data;

          if (payload.type === 'xtream') {
            await login(payload.serverUrl, payload.username, payload.password);
          } else if (payload.type === 'm3u') {
            await loginM3U(payload.m3uUrl);
          }

          setStatus('success');
          setTimeout(() => {
            onClose();
            if (onSuccess) onSuccess();
          }, 1500);
        }
      } catch (err: any) {
        console.warn('Companion polling poll error:', err);
      }
    }, 2000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [status, pin, login, loginM3U, onClose, onSuccess]);

  if (!isOpen) return null;

  const currentHost = ip === 'localhost' || ip === '127.0.0.1' ? window.location.hostname : ip;
  const companionUrl = `http://${currentHost}:${port}/connect?pin=${pin || ''}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(companionUrl)}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg bg-gray-800/60"
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
            <p className="text-xs text-gray-400">Add Xtream login or M3U playlist without remote typing</p>
          </div>
        </div>

        {status === 'loading' && (
          <div className="py-12 text-center text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
            <p className="text-sm">Generating companion pairing code...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="py-8 text-center">
            <AlertTriangle className="w-10 h-10 mx-auto text-rose-400 mb-3" />
            <p className="text-sm text-rose-300 mb-4">{errorMessage}</p>
            <button
              onClick={startSession}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {status === 'connecting' && (
          <div className="py-12 text-center text-white">
            <RefreshCw className="w-10 h-10 animate-spin mx-auto text-indigo-400 mb-4" />
            <p className="text-base font-semibold">Credentials Received!</p>
            <p className="text-xs text-gray-400 mt-1">Authenticating and loading your channels...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-12 text-center text-white">
            <CheckCircle className="w-12 h-12 mx-auto text-emerald-400 mb-4 animate-bounce" />
            <p className="text-lg font-bold text-emerald-300">Successfully Connected!</p>
            <p className="text-xs text-gray-400 mt-1">Welcome to your streaming dashboard.</p>
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
                  <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Step 1: Scan QR or Open</span>
                  <p className="text-xs text-gray-300 font-mono break-all mt-0.5 select-all bg-gray-900 px-2 py-1 rounded border border-gray-800">
                    {companionUrl}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Step 2: Enter PIN Code</span>
                  <div className="text-3xl font-mono font-extrabold text-white tracking-widest bg-indigo-950/40 border border-indigo-500/40 px-3 py-1.5 rounded-lg inline-block mt-0.5 shadow-inner">
                    {pin}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Waiting for phone submission...
              </span>
              <button
                onClick={startSession}
                className="flex items-center gap-1 hover:text-indigo-400 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> New PIN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
