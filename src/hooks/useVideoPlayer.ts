import { useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { usePlayerStore, AntiLagMode } from '@/store/usePlayerStore';

export function useVideoPlayer(
  videoRef: React.RefObject<HTMLVideoElement>,
  src: string | null,
  type: 'live' | 'vod' | 'series' = 'vod',
  autoPlay: boolean = true,
  onAutoFallbackFormat?: () => void
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
  const mpegtsPlayerRef = useRef<mpegts.Player | null>(null);
  const mediaRecoveriesRef = useRef<number>(0);
  const networkErrorRetriesRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const stallCounterRef = useRef<number>(0);
  const blobUrlRef = useRef<string | null>(null);
  const bufferingWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const autoFallbackTriggeredRef = useRef<boolean>(false);

  // Keep references to dynamic props to keep initPlayer stable
  const onAutoFallbackFormatRef = useRef(onAutoFallbackFormat);
  useEffect(() => {
    onAutoFallbackFormatRef.current = onAutoFallbackFormat;
  }, [onAutoFallbackFormat]);

  const antiLagModeRef = useRef(antiLagMode);
  useEffect(() => {
    antiLagModeRef.current = antiLagMode;
  }, [antiLagMode]);

  const antiLagEnabledRef = useRef(antiLagEnabled);
  useEffect(() => {
    antiLagEnabledRef.current = antiLagEnabled;
  }, [antiLagEnabled]);

  // Reset auto-fallback latch whenever source changes
  useEffect(() => {
    autoFallbackTriggeredRef.current = false;
  }, [src]);

  // Synchronize volume and mute without tearing down or reinitializing the player
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted, videoRef]);

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
    if (mpegtsPlayerRef.current) {
      try {
        mpegtsPlayerRef.current.pause();
        mpegtsPlayerRef.current.unload();
        mpegtsPlayerRef.current.detachMediaElement();
        mpegtsPlayerRef.current.destroy();
      } catch (e) {
        console.warn('Error destroying mpegts player:', e);
      }
      mpegtsPlayerRef.current = null;
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

  // Fast-reacting HLS config tuned for universal codec detection & zero lag
  const getHlsConfig = useCallback((mode: AntiLagMode): Partial<Hls['config']> => {
    const baseConfig: Partial<Hls['config']> = {
      enableWorker: true,
      capLevelToPlayerSize: true,
      // No hardcoded defaultAudioCodec to allow AAC, AC3, EAC3, and MP3 auto-detection
      maxBufferHole: 0.8,
      nudgeOffset: 0.2,
      nudgeMaxRetry: 8,
      maxFragLookUpTolerance: 0.3,
      fragLoadingTimeOut: 12000,
      manifestLoadingTimeOut: 10000,
      levelLoadingTimeOut: 10000,
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
    video.crossOrigin = 'anonymous';
    video.playsInline = true;

    // Buffering Watchdog: kicks decoder if idle, provides seamless fallback
    clearBufferingWatchdog();
    bufferingWatchdogRef.current = setTimeout(() => {
      if (video && video.paused && video.readyState < 2) {
        console.warn('[OnyxStream Watchdog] Initial stream buffering taking longer than expected. Kicking loader...');
        if (hlsRef.current) {
          hlsRef.current.startLoad(0);
        } else if (mpegtsPlayerRef.current) {
          mpegtsPlayerRef.current.load();
        }
        if (autoPlay) {
          video.play().catch(console.warn);
        }

        setTimeout(() => {
          if (video && video.paused && video.readyState < 2) {
            if (!autoFallbackTriggeredRef.current && onAutoFallbackFormatRef.current) {
              autoFallbackTriggeredRef.current = true;
              console.log('[OnyxStream Auto-Healing] Stream buffering timeout, auto-switching format...');
              onAutoFallbackFormatRef.current();
              return;
            }
            setIsLoading(false);
            setError(
              'Stream connection is taking longer than usual. Use "Switch Route" or "Switch Format" below to reconnect.'
            );
          }
        }, 4500);
      }
    }, 6000);

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
        video.play().catch(() => {
          console.warn('[OnyxStream] Autoplay blocked, falling back to muted play...');
          video.muted = true;
          video.play().catch((e2) => console.warn('[OnyxStream] Play error:', e2.message));
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

    // Forward declaration of engine starters for clean multi-engine fallback
    let startHlsEngine: (streamUrl: string) => boolean;
    let startMpegtsEngine: (streamUrl: string) => boolean;
    let startDirectEngine: (streamUrl: string) => void;

    // Video element error handler with automatic multi-tier fallback
    video.onerror = () => {
      clearBufferingWatchdog();
      const err = video.error;
      console.warn('[OnyxStream] Video error:', err?.code, err?.message);

      // 1. Try HLS media error recovery if active
      if (hlsRef.current && mediaRecoveriesRef.current < 2) {
        mediaRecoveriesRef.current += 1;
        hlsRef.current.recoverMediaError();
        return;
      }

      // 2. Automatic format auto-healing before giving up
      if (err?.code === 4 && !autoFallbackTriggeredRef.current && onAutoFallbackFormatRef.current) {
        autoFallbackTriggeredRef.current = true;
        console.log('[OnyxStream Auto-Healing] Codec error code 4, auto-switching format...');
        onAutoFallbackFormatRef.current();
        return;
      }

      // 3. For live streams, try swapping to mpegts if hls failed, or vice versa
      if (type === 'live') {
        if (hlsRef.current && typeof window !== 'undefined' && mpegts.isSupported()) {
          console.log('[OnyxStream Multi-Engine] HLS failed on live stream, falling back to mpegts.js...');
          cleanup();
          startMpegtsEngine(src);
          return;
        }
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

    startMpegtsEngine = (streamUrl: string): boolean => {
      if (typeof window === 'undefined' || !mpegts.isSupported()) return false;
      try {
        console.log('[OnyxStream Engine] Booting mpegts.js player for:', streamUrl);
        const player = mpegts.createPlayer(
          {
            type: 'mpegts',
            isLive: type === 'live',
            url: streamUrl,
          },
          {
            enableWorker: true,
            lazyLoad: false,
            liveBufferLatencyChasing: true,
            liveBufferLatencyMaxLatency: 3.0,
            liveBufferLatencyMinRemain: 0.8,
          }
        );

        mpegtsPlayerRef.current = player;
        player.attachMediaElement(video);
        player.load();

        player.on(mpegts.Events.ERROR, (errType: string, errDetail: string) => {
          console.warn('[mpegts error]', errType, errDetail);
          if (type === 'live' && Hls.isSupported()) {
            console.log('[OnyxStream Multi-Engine] mpegts failed, falling back to HLS...');
            cleanup();
            startHlsEngine(streamUrl);
            return;
          }
          if (errType === mpegts.ErrorTypes.NETWORK_ERROR) {
            setError('Network Error: Stream server dropped connection. Tap "Switch Route" to retry.');
            setIsLoading(false);
          }
        });

        if (autoPlay) {
          player.play()?.catch((err: any) => console.warn('[mpegts autoplay wait]', err.message));
        }
        return true;
      } catch (err: any) {
        console.warn('[mpegts boot failed]:', err.message);
        return false;
      }
    };

    startHlsEngine = (streamUrl: string): boolean => {
      if (!Hls.isSupported()) return false;
      try {
        console.log('[OnyxStream Engine] Booting Hls.js player for:', streamUrl);
        const hlsConfig = getHlsConfig(antiLagMode);
        const hls = new Hls(hlsConfig);
        hlsRef.current = hls;

        hls.loadSource(streamUrl);
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
                  // If live and HLS network keeps failing, try mpegts before erroring
                  if (type === 'live' && typeof window !== 'undefined' && mpegts.isSupported()) {
                    console.log('[OnyxStream Multi-Engine] HLS network failed, switching to mpegts...');
                    cleanup();
                    startMpegtsEngine(streamUrl);
                    return;
                  }
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
                // If live and manifest parse fails, provider might be streaming raw MPEG-TS!
                if (type === 'live' && typeof window !== 'undefined' && mpegts.isSupported()) {
                  console.log('[OnyxStream Multi-Engine] HLS manifest error, trying mpegts demuxer...');
                  cleanup();
                  startMpegtsEngine(streamUrl);
                  return;
                }
                clearBufferingWatchdog();
                setError(`Playback notice: ${data.details}. Try switching connection route.`);
                setIsLoading(false);
                break;
            }
          }
        });

        return true;
      } catch (err: any) {
        console.warn('[Hls boot failed]:', err.message);
        return false;
      }
    };

    startDirectEngine = (streamUrl: string) => {
      console.log('[OnyxStream Engine] Booting HTML5 direct player for:', streamUrl);
      video.src = streamUrl;
      video.load();
      if (autoPlay) {
        video.play().catch(() => {
          console.warn('[OnyxStream] Direct autoplay blocked, playing muted...');
          video.muted = true;
          video.play().catch(console.warn);
        });
      }
    };

    const isExplicitM3u8 = src.includes('.m3u8') || src.includes('m3u8');
    const isRawTsStream = src.endsWith('.ts') || src.includes('.ts?') || (type === 'live' && !isExplicitM3u8);

    // Engine Selection Matrix:
    // 1. Raw MPEG-TS Live Stream -> mpegts.js demuxer
    if (isRawTsStream && mpegts.isSupported()) {
      const ok = startMpegtsEngine(src);
      if (ok) return;
    }

    // 2. HLS Stream (.m3u8) -> Hls.js
    if (isExplicitM3u8 && Hls.isSupported()) {
      const ok = startHlsEngine(src);
      if (ok) return;
    } else if (isExplicitM3u8 && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple Safari HLS
      startDirectEngine(src);
      return;
    }

    // 3. Direct HTML5 Media Playback (MP4, MKV, VOD files)
    startDirectEngine(src);

  }, [
    src,
    type,
    autoPlay,
    cleanup,
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

  // Player lifecycle: runs strictly when stream source or type changes, never in a loop
  useEffect(() => {
    initPlayer();
    return () => {
      cleanup();
    };
  }, [src, type, autoPlay]);

  const flushAndResync = () => {
    initPlayer();
  };

  const retry = () => {
    initPlayer();
  };

  return { retry, flushAndResync };
}
