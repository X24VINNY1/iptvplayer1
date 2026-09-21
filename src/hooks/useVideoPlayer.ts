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
  const mediaRecoveriesRef = useRef<number>(0);
  const networkErrorRetriesRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const stallCounterRef = useRef<number>(0);
  const blobUrlRef = useRef<string | null>(null);
  const bufferingWatchdogRef = useRef<NodeJS.Timeout | null>(null);

  const clearBufferingWatchdog = useCallback(() => {
    if (bufferingWatchdogRef.current) {
      clearTimeout(bufferingWatchdogRef.current);
      bufferingWatchdogRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    clearBufferingWatchdog();

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch (e) {
        console.warn('Error destroying HLS:', e);
      }
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.removeAttribute('src');
      try {
        videoRef.current.load();
      } catch (e) {
        console.warn('Error loading video after cleanup:', e);
      }
    }
  }, [videoRef, clearBufferingWatchdog]);

  // Fast-reacting HLS config tuned for low latency & fast initial buffer
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
      // Aggressive fast timeouts so we never hang indefinitely on dead streams
      fragLoadingTimeOut: 10000,
      manifestLoadingTimeOut: 8000,
      levelLoadingTimeOut: 8000,
      xhrSetup: (xhr: XMLHttpRequest) => {
        xhr.withCredentials = false;
      }
    };

    switch (mode) {
      case 'smooth':
        return {
          ...baseConfig,
          maxBufferLength: 40,
          maxMaxBufferLength: 80,
          maxBufferSize: 60 * 1000 * 1000,
          backBufferLength: 20,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10,
          maxLiveSyncPlaybackRate: 1.15,
          lowLatencyMode: false
        };
      case 'balanced':
        return {
          ...baseConfig,
          maxBufferLength: 20,
          maxMaxBufferLength: 45,
          maxBufferSize: 30 * 1000 * 1000,
          backBufferLength: 15,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 7,
          maxLiveSyncPlaybackRate: 1.1,
          lowLatencyMode: true
        };
      case 'low-latency':
        return {
          ...baseConfig,
          maxBufferLength: 10,
          maxMaxBufferLength: 20,
          maxBufferSize: 15 * 1000 * 1000,
          backBufferLength: 10,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 4,
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
    networkErrorRetriesRef.current = 0;

    video.volume = volume;
    video.muted = isMuted;

    // Buffering Watchdog: if stream doesn't produce playback within 8s, stop the infinite spinning
    clearBufferingWatchdog();
    bufferingWatchdogRef.current = setTimeout(() => {
      if (video && video.paused && video.readyState < 2) {
        console.warn('[OnyxStream Watchdog] Initial stream buffering taking longer than expected.');
        if (hlsRef.current) {
          hlsRef.current.startLoad(0);
        }
        // Give 4 more seconds, then show helpful action buttons instead of hanging
        setTimeout(() => {
          if (video && video.paused && video.readyState < 2) {
            setIsLoading(false);
            setError(
              'Stream connection is taking longer than usual. Use "Switch Route" or "Switch Format" below to reconnect.'
            );
          }
        }, 4000);
      }
    }, 8000);

    const onPlaybackStarted = () => {
      clearBufferingWatchdog();
      setIsLoading(false);
      setError(null);
    };

    // Standard HTML5 media event listeners
    video.onplay = () => {
      setIsPlaying(true);
      onPlaybackStarted();
    };

    video.onpause = () => {
      setIsPlaying(false);
    };

    video.onwaiting = () => {
      setIsLoading(true);
    };

    video.onplaying = () => {
      onPlaybackStarted();
      stallCounterRef.current = 0;
    };

    video.oncanplay = () => {
      onPlaybackStarted();
      if (autoPlay) {
        video.play().catch((e) => {
          console.warn('[OnyxStream] Autoplay waiting for user interaction:', e.message);
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
      onPlaybackStarted();
    };

    // Video element error handler
    video.onerror = () => {
      clearBufferingWatchdog();
      const err = video.error;
      console.warn('[OnyxStream] Video error:', err?.code, err?.message);

      if (hlsRef.current && mediaRecoveriesRef.current < 2) {
        mediaRecoveriesRef.current += 1;
        hlsRef.current.recoverMediaError();
        return;
      }

      let errorMsg = 'Playback Error: Stream format unsupported by browser decoder. Try switching format or connection route.';
      if (err?.code === 2) {
        errorMsg = 'Network Error: Stream connection was interrupted or server is unreachable.';
      } else if (err?.code === 4) {
        errorMsg = 'Format Error: Audio/Video codec not supported by browser. Try switching format.';
      }

      setError(errorMsg);
      setIsLoading(false);
    };

    const isHlsUrl =
      src.includes('.m3u8') ||
      src.includes('m3u8') ||
      (type === 'live' && !src.endsWith('.mp4'));

    if (isHlsUrl && Hls.isSupported()) {
      const hlsConfig = getHlsConfig(antiLagMode);
      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;

      // Handle raw TS stream on HLS engine by wrapping into a virtual manifest
      if (src.endsWith('.ts') || (type === 'live' && !src.includes('.m3u8'))) {
        const virtualM3u8 = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:60\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:60.0,\n${src}\n`;
        const blob = new Blob([virtualM3u8], { type: 'application/vnd.apple.mpegurl' });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        hls.loadSource(blobUrl);
      } else {
        hls.loadSource(src);
      }

      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        onPlaybackStarted();
        networkErrorRetriesRef.current = 0;
        if (autoPlay) {
          video.play().catch((err) => {
            console.warn('[OnyxStream] Autoplay prevented:', err.message);
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
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
              networkErrorRetriesRef.current += 1;
              if (networkErrorRetriesRef.current <= 2) {
                console.log(`[Anti-Lag] Network hiccup, reloading HLS (${networkErrorRetriesRef.current}/2)...`);
                hls.startLoad();
              } else {
                clearBufferingWatchdog();
                setError('Network Error: Stream server did not respond. Tap "Switch Route" or "Retry".');
                setIsLoading(false);
              }
              break;

            case Hls.ErrorTypes.MEDIA_ERROR:
              if (mediaRecoveriesRef.current < 2) {
                mediaRecoveriesRef.current += 1;
                console.log(`[Anti-Lag] Recovering media error (${mediaRecoveriesRef.current})...`);
                hls.recoverMediaError();
              } else if (mediaRecoveriesRef.current === 2) {
                mediaRecoveriesRef.current += 1;
                console.log('[Anti-Lag] Swapping audio codec and recovering media...');
                hls.swapAudioCodec();
                hls.recoverMediaError();
              } else {
                clearBufferingWatchdog();
                setError('Codec Error: Unsupported stream format. Try switching format.');
                setIsLoading(false);
              }
              break;

            default:
              console.warn('[Anti-Lag] Fatal HLS error:', data.details);
              clearBufferingWatchdog();
              setError(`Playback notice: ${data.details}. Try switching connection route.`);
              setIsLoading(false);
              break;
          }
        }
      });
    } else if (isHlsUrl && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple Safari HLS
      video.src = src;
      video.load();
      if (autoPlay) video.play().catch(console.warn);
    } else {
      // Direct media playback (MP4, MKV, direct files)
      video.src = src;
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
    clearBufferingWatchdog,
    getHlsConfig,
    setIsLoading,
    setError,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setBufferLength,
    incrementLagRecovery
  ]);

  // Anti-Lag Watchdog for freeze prevention during active playback
  useEffect(() => {
    if (!antiLagEnabled) return;

    const watchdog = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended || video.readyState < 2) {
        return;
      }

      if (video.currentTime === lastTimeRef.current) {
        stallCounterRef.current += 1;

        if (stallCounterRef.current >= 4) {
          console.warn('[Anti-Lag Watchdog] Freeze detected, nudging stream...');
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
    initPlayer();
  };

  const retry = () => {
    initPlayer();
  };

  return { retry, flushAndResync };
}
