import { useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { Capacitor } from '@capacitor/core';
import { usePlayerStore, AntiLagMode } from '@/store/usePlayerStore';

export function useVideoPlayer(
  videoRef: React.RefObject<HTMLVideoElement>,
  src: string | null,
  type: 'live' | 'vod' | 'series' = 'vod',
  autoPlay: boolean = true,
  onFormatFallback?: () => void
) {
  const {
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setIsLoading,
    setError,
    volume,
    isMuted,
    antiLagEnabled,
    antiLagMode,
    useProxy,
    setBufferLength,
    incrementLagRecovery
  } = usePlayerStore();

  const hlsRef = useRef<Hls | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecoveriesRef = useRef<number>(0);
  const fallbackCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const stallCounterRef = useRef<number>(0);
  const blobUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
  }, [videoRef]);

  // Robust HLS config tuned for IPTV streams
  const getHlsConfig = useCallback((mode: AntiLagMode): Partial<Hls['config']> => {
    const baseConfig = {
      enableWorker: true,
      capLevelToPlayerSize: true,
      defaultAudioCodec: 'mp4a.40.2',
      maxBufferHole: 0.8,
      maxSeekHole: 2,
      nudgeOffset: 0.2,
      nudgeMaxRetry: 8,
      maxFragLookUpTolerance: 0.3,
      fragLoadingTimeOut: 25000,
      manifestLoadingTimeOut: 25000,
      levelLoadingTimeOut: 25000,
      xhrSetup: (xhr: XMLHttpRequest) => {
        xhr.withCredentials = false;
      }
    };

    switch (mode) {
      case 'smooth':
        return {
          ...baseConfig,
          maxBufferLength: 45,
          maxMaxBufferLength: 90,
          maxBufferSize: 70 * 1000 * 1000,
          backBufferLength: 30,
          liveSyncDurationCount: 4,
          liveMaxLatencyDurationCount: 12,
          maxLiveSyncPlaybackRate: 1.15,
          lowLatencyMode: false
        };
      case 'balanced':
        return {
          ...baseConfig,
          maxBufferLength: 25,
          maxMaxBufferLength: 60,
          maxBufferSize: 40 * 1000 * 1000,
          backBufferLength: 20,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 8,
          maxLiveSyncPlaybackRate: 1.1,
          lowLatencyMode: true
        };
      case 'low-latency':
        return {
          ...baseConfig,
          maxBufferLength: 10,
          maxMaxBufferLength: 20,
          maxBufferSize: 20 * 1000 * 1000,
          backBufferLength: 10,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 5,
          lowLatencyMode: true
        };
    }
  }, []);

  const initPlayer = useCallback(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    cleanup();
    setIsLoading(true);
    setError(null);
    stallCounterRef.current = 0;
    lastTimeRef.current = 0;
    mediaRecoveriesRef.current = 0;

    video.volume = volume;
    video.muted = isMuted;

    // Standard HTML5 media event listeners
    video.onplay = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };

    video.onpause = () => {
      setIsPlaying(false);
    };

    video.onwaiting = () => {
      setIsLoading(true);
    };

    video.onplaying = () => {
      setIsLoading(false);
      stallCounterRef.current = 0;
    };

    video.oncanplay = () => {
      setIsLoading(false);
      fallbackCountRef.current = 0;
      if (autoPlay) {
        video.play().catch((e) => {
          console.warn('Autoplay prevented:', e.message);
        });
      }
    };

    video.ontimeupdate = () => {
      setCurrentTime(video.currentTime);

      if (video.buffered && video.buffered.length > 0) {
        const pos = video.currentTime;
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= pos && pos <= video.buffered.end(i)) {
            const ahead = video.buffered.end(i) - pos;
            setBufferLength(Math.round(ahead * 10) / 10);
            break;
          }
        }
      }
    };

    video.ondurationchange = () => {
      if (!isNaN(video.duration) && isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };

    video.onloadedmetadata = () => {
      if (!isNaN(video.duration) && isFinite(video.duration)) {
        setDuration(video.duration);
      }
      setIsLoading(false);
    };

    // Video error handler with smart multi-layer recovery
    video.onerror = () => {
      const err = video.error;
      console.warn('HTML5 Video Error:', err?.code, err?.message);

      // If HLS is active, let HLS recover the media pipeline first
      if (hlsRef.current && mediaRecoveriesRef.current < 2) {
        mediaRecoveriesRef.current += 1;
        console.log(`[Anti-Lag] Recovering media error from video element (attempt ${mediaRecoveriesRef.current})...`);
        hlsRef.current.recoverMediaError();
        return;
      }

      // If format fallback is available and hasn't exceeded 2 tries, automatically try it!
      if (onFormatFallback && fallbackCountRef.current < 2) {
        fallbackCountRef.current += 1;
        console.log(`[OnyxStream] Format error encountered. Auto-trying alternate stream format (attempt ${fallbackCountRef.current})...`);
        onFormatFallback();
        return;
      }

      setError(
        'Format Error: Stream format unsupported by browser decoder. Use "Auto-Fix Format" to toggle MP4 / M3U8, or enable Cloud Proxy.'
      );
      setIsLoading(false);
    };

    // Proxy routing: Only proxy HLS (.m3u8) streams where manifest/segment text is parsed by JS.
    // NEVER send direct multi-gigabyte VOD movie files (MP4/MKV) through public CORS proxies because of size limits!
    let effectiveSrc = src;
    const isNative = Capacitor.isNativePlatform();
    const isHttpsWeb = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isHttpStream = src.startsWith('http://');

    const isHlsUrl =
      src.includes('.m3u8') ||
      (type === 'live' && !src.endsWith('.mp4'));

    if (isHlsUrl && (useProxy || (!isNative && isHttpsWeb && isHttpStream))) {
      effectiveSrc = `https://corsproxy.io/?url=${encodeURIComponent(src)}`;
    }

    const isRawTs = effectiveSrc.endsWith('.ts') || effectiveSrc.includes('.ts?') || effectiveSrc.includes('/live/');

    if (isHlsUrl && Hls.isSupported()) {
      const hlsConfig = getHlsConfig(antiLagMode);
      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;

      // If the stream is raw TS (MPEG-TS without HLS manifest), wrap it into a virtual HLS manifest
      // so Hls.js's built-in WebWorker demuxer can convert the TS chunks into playable fMP4!
      if (effectiveSrc.endsWith('.ts') || (type === 'live' && !effectiveSrc.includes('.m3u8'))) {
        const virtualM3u8 = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:60\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:60.0,\n${effectiveSrc}\n`;
        const blob = new Blob([virtualM3u8], { type: 'application/vnd.apple.mpegurl' });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        hls.loadSource(blobUrl);
      } else {
        hls.loadSource(effectiveSrc);
      }

      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        fallbackCountRef.current = 0;
        if (autoPlay) {
          video.play().catch((err) => {
            console.warn('Autoplay prevented:', err.message);
          });
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
          if (antiLagEnabled) {
            incrementLagRecovery();
            hls.startLoad();
          }
          return;
        }

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('[Anti-Lag] Network error, restarting HLS loader...');
              hls.startLoad();
              break;

            case Hls.ErrorTypes.MEDIA_ERROR:
              if (mediaRecoveriesRef.current < 2) {
                mediaRecoveriesRef.current += 1;
                console.log(`[Anti-Lag] Recovering media error (attempt ${mediaRecoveriesRef.current})...`);
                hls.recoverMediaError();
              } else if (mediaRecoveriesRef.current === 2) {
                mediaRecoveriesRef.current += 1;
                console.log('[Anti-Lag] Swapping audio codec and recovering media...');
                hls.swapAudioCodec();
                hls.recoverMediaError();
              } else {
                console.warn('[Anti-Lag] Fatal media error unrecoverable. Attempting fallback...');
                if (onFormatFallback && fallbackCountRef.current < 2) {
                  fallbackCountRef.current += 1;
                  onFormatFallback();
                } else {
                  setError('Media format error: Decoder encountered unsupported stream codec.');
                }
              }
              break;

            default:
              console.warn('[Anti-Lag] Fatal HLS error:', data.details);
              if (onFormatFallback && fallbackCountRef.current < 2) {
                fallbackCountRef.current += 1;
                onFormatFallback();
              } else {
                setError(`Playback Error: ${data.details}`);
              }
              break;
          }
        }
      });
    } else if (isHlsUrl && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple Safari HLS
      video.src = effectiveSrc;
      video.load();
      if (autoPlay) video.play().catch(console.warn);
    } else {
      // Direct media playback (MP4, MKV, direct files)
      video.src = effectiveSrc;
      video.load();
      if (autoPlay) video.play().catch(console.warn);
    }
  }, [
    src,
    type,
    autoPlay,
    cleanup,
    volume,
    isMuted,
    antiLagMode,
    antiLagEnabled,
    useProxy,
    getHlsConfig,
    onFormatFallback,
    setIsLoading,
    setError,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setBufferLength,
    incrementLagRecovery
  ]);

  // Anti-Lag Watchdog for freeze prevention
  useEffect(() => {
    if (!antiLagEnabled) return;

    const watchdog = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended || video.readyState < 2) {
        return;
      }

      if (video.currentTime === lastTimeRef.current) {
        stallCounterRef.current += 1;

        if (stallCounterRef.current >= 3) {
          console.warn('[Anti-Lag Watchdog] Freeze detected! Skipping bad packet...');
          incrementLagRecovery();

          if (video.buffered && video.buffered.length > 0) {
            const pos = video.currentTime;
            for (let i = 0; i < video.buffered.length; i++) {
              if (video.buffered.start(i) <= pos && pos <= video.buffered.end(i)) {
                const end = video.buffered.end(i);
                if (end - pos > 1) {
                  video.currentTime = Math.min(pos + 0.6, end - 0.2);
                  video.play().catch(console.warn);
                  stallCounterRef.current = 0;
                  return;
                }
              }
            }
          }

          if (type === 'live' && video.buffered && video.buffered.length > 0) {
            const liveEdge = video.buffered.end(video.buffered.length - 1);
            video.currentTime = Math.max(0, liveEdge - 1);
            video.play().catch(console.warn);
          } else if (hlsRef.current) {
            hlsRef.current.startLoad();
          }

          stallCounterRef.current = 0;
        }
      } else {
        stallCounterRef.current = 0;
        lastTimeRef.current = video.currentTime;
      }
    }, 1000);

    return () => clearInterval(watchdog);
  }, [antiLagEnabled, type, incrementLagRecovery, videoRef]);

  useEffect(() => {
    initPlayer();
    return () => cleanup();
  }, [initPlayer, cleanup]);

  const flushAndResync = () => {
    fallbackCountRef.current = 0;
    initPlayer();
  };

  const retry = () => {
    fallbackCountRef.current = 0;
    initPlayer();
  };

  return { retry, flushAndResync };
}
