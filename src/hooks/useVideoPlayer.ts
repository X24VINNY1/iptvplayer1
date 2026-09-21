import { useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
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
    setBufferLength,
    incrementLagRecovery
  } = usePlayerStore();

  const hlsRef = useRef<Hls | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecoveriesRef = useRef<number>(0);
  const attemptsRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const stallCounterRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
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

  // Robust HLS config tuned for IPTV streams (handles PTS gaps, non-standard audio, and bandwidth drops)
  const getHlsConfig = useCallback((mode: AntiLagMode): Partial<Hls['config']> => {
    const baseConfig = {
      enableWorker: true,
      capLevelToPlayerSize: true,
      // Audio codec fallback for IPTV streams broadcasting AC3/MP2 audio
      defaultAudioCodec: 'mp4a.40.2',
      // Tolerate timestamp gaps and segment duration drift
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

    // Video error handler with smart recovery
    video.onerror = () => {
      const err = video.error;
      console.warn('HTML5 Video Error code:', err?.code, err?.message);

      // If HLS is active, let HLS try to recover the media pipeline first
      if (hlsRef.current && mediaRecoveriesRef.current < 2) {
        mediaRecoveriesRef.current += 1;
        console.log(`[Anti-Lag] Recovering media error from video element (attempt ${mediaRecoveriesRef.current})...`);
        hlsRef.current.recoverMediaError();
        return;
      }

      // If persistent format error on Live TV or VOD, try alternate format (e.g. TS instead of M3U8)
      if (onFormatFallback && attemptsRef.current === 0) {
        attemptsRef.current += 1;
        console.log('[OnyxStream] Format error encountered. Auto-trying alternate stream format...');
        onFormatFallback();
        return;
      }

      setError(
        'Format Error: Stream format unsupported by current player. Use the "Switch Format" button above to try TS / alternate stream.'
      );
      setIsLoading(false);
    };

    // Proxy routing for HTTPS -> HTTP
    let effectiveSrc = src;
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      src.startsWith('http://') &&
      !window.location.hostname.includes('localhost')
    ) {
      effectiveSrc = `/proxy?url=${encodeURIComponent(src)}`;
    }

    const isHlsUrl = effectiveSrc.includes('.m3u8') || (type === 'live' && !effectiveSrc.endsWith('.ts'));

    if (isHlsUrl && Hls.isSupported()) {
      const hlsConfig = getHlsConfig(antiLagMode);
      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;

      hls.loadSource(effectiveSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        attemptsRef.current = 0;
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
                if (onFormatFallback) {
                  onFormatFallback();
                } else {
                  setError('Media format error: Decoder encountered unsupported stream codec.');
                }
              }
              break;

            default:
              console.warn('[Anti-Lag] Fatal HLS error:', data.details);
              if (onFormatFallback) {
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
      // Direct media playback (MP4, MKV, direct TS on supported platforms)
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
    attemptsRef.current = 0;
    initPlayer();
    return () => cleanup();
  }, [initPlayer, cleanup]);

  const flushAndResync = () => {
    attemptsRef.current = 0;
    initPlayer();
  };

  return { retry: initPlayer, flushAndResync };
}
