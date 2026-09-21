import { useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { usePlayerStore, AntiLagMode } from '@/store/usePlayerStore';

export function useVideoPlayer(
  videoRef: React.RefObject<HTMLVideoElement>,
  src: string | null,
  type: 'live' | 'vod' | 'series' = 'vod',
  autoPlay: boolean = true
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
  const attemptsRef = useRef(0);
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

  // Generate HLS buffer configuration based on chosen Anti-Lag mode
  const getHlsConfig = useCallback((mode: AntiLagMode): Partial<Hls['config']> => {
    const baseConfig = {
      enableWorker: true,
      capLevelToPlayerSize: true, // Optimizes bandwidth and drops lag
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
          maxLiveSyncPlaybackRate: 1.15, // Catch up smoothly without freezing
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

    // Apply audio levels
    video.volume = volume;
    video.muted = isMuted;

    // Attach standard HTML5 video event handlers
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

      // Measure current forward buffer health
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

    video.onerror = () => {
      const err = video.error;
      console.warn('HTML5 Video Error code:', err?.code, err?.message);

      if (attemptsRef.current < 3) {
        attemptsRef.current += 1;
        retryTimeoutRef.current = setTimeout(() => {
          initPlayer();
        }, 1500 * attemptsRef.current);
      } else {
        setError(
          err?.message ||
            'Stream playback failed. The stream may be offline or in an unsupported format.'
        );
        setIsLoading(false);
      }
    };

    // Determine HLS vs Direct
    const isHls =
      src.includes('.m3u8') ||
      type === 'live' ||
      src.includes('/live/');

    let effectiveSrc = src;
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      src.startsWith('http://') &&
      !window.location.hostname.includes('localhost')
    ) {
      effectiveSrc = `/proxy?url=${encodeURIComponent(src)}`;
    }

    if (isHls && Hls.isSupported()) {
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
          console.warn('[Anti-Lag] Buffer stalled! Priming decoder...');
          if (antiLagEnabled) {
            incrementLagRecovery();
            hls.startLoad();
          }
          return;
        }

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('[Anti-Lag] Network dropout, restarting HLS loader...');
              hls.startLoad();
              break;

            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('[Anti-Lag] Media decode error, recovering media...');
              hls.recoverMediaError();
              break;

            default:
              console.log('[Anti-Lag] Fatal error, falling back to direct video tag...');
              hls.destroy();
              hlsRef.current = null;
              video.src = effectiveSrc;
              video.load();
              if (autoPlay) video.play().catch(console.warn);
              break;
          }
        }
      });
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = effectiveSrc;
      video.load();
      if (autoPlay) video.play().catch(console.warn);
    } else {
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
    setIsLoading,
    setError,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setBufferLength,
    incrementLagRecovery
  ]);

  // Anti-Lag Watchdog: checks every second for frozen playheads
  useEffect(() => {
    if (!antiLagEnabled) return;

    const watchdog = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended || video.readyState < 2) {
        return;
      }

      // Check if currentTime is unchanged
      if (video.currentTime === lastTimeRef.current) {
        stallCounterRef.current += 1;

        // If stalled for 3+ consecutive seconds while playing
        if (stallCounterRef.current >= 3) {
          console.warn('[Anti-Lag Watchdog] Freeze detected! Bypassing stall...');
          incrementLagRecovery();

          // Strategy 1: If there is buffer ahead, jump 0.5s forward past corrupt packet
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

          // Strategy 2: If live, jump directly to newest live edge
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

  // Resync / Flush Buffer Method (User triggerable)
  const flushAndResync = () => {
    console.log('[Anti-Lag] Flushing buffer and resyncing...');
    attemptsRef.current = 0;
    initPlayer();
  };

  return { retry: initPlayer, flushAndResync };
}
