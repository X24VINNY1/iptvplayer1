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
  const triedEnginesRef = useRef<Set<string>>(new Set());
  const activeEngineRef = useRef<string | null>(null);
  const playbackSessionIdRef = useRef<number>(0);

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

  // Teardown currently active decoder instances without resetting the session history of tried engines
  const cleanupActiveEngine = useCallback(() => {
    clearBufferingWatchdog();

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (hlsRef.current) {
      try {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
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
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.srcObject = null;
        videoRef.current.load();
      } catch (e) {
        console.warn('Error resetting video element:', e);
      }
    }
    activeEngineRef.current = null;
  }, [videoRef, clearBufferingWatchdog]);

  // Full cleanup (invoked when changing channels or unmounting)
  const cleanup = useCallback(() => {
    // Invalidate any active playback session to immediately drop pending callbacks
    playbackSessionIdRef.current += 1;
    cleanupActiveEngine();
    triedEnginesRef.current.clear();
  }, [cleanupActiveEngine]);

  // Bulletproof HLS configuration tuned for zero green screens, zero frame corruption, and smooth buffering
  const getHlsConfig = useCallback((mode: AntiLagMode): Partial<Hls['config']> => {
    const baseConfig: Partial<Hls['config']> = {
      // CRITICAL: enableWorker: false cures green screens and corrupted macroblocks on Android TV chipsets.
      // Transferable ArrayBuffers between worker and main thread often corrupt YUV chroma slices under low-memory TV environments.
      enableWorker: false,
      enableSoftwareAES: true,
      capLevelToPlayerSize: true,
      maxBufferHole: 0.5,
      nudgeOffset: 0.1,
      nudgeMaxRetry: 10,
      maxFragLookUpTolerance: 0.25,
      maxAudioFramesDrift: 1,
      fragLoadingTimeOut: 15000,
      manifestLoadingTimeOut: 12000,
      levelLoadingTimeOut: 12000,
      xhrSetup: (xhr: XMLHttpRequest) => {
        xhr.withCredentials = false;
      }
    };

    switch (mode) {
      case 'smooth':
        return {
          ...baseConfig,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxBufferSize: 50 * 1000 * 1000,
          backBufferLength: 15,
          liveSyncDurationCount: 4,
          liveMaxLatencyDurationCount: 8,
          maxLiveSyncPlaybackRate: 1.05,
          lowLatencyMode: false
        };
      case 'balanced':
        return {
          ...baseConfig,
          maxBufferLength: 20,
          maxMaxBufferLength: 40,
          maxBufferSize: 30 * 1000 * 1000,
          backBufferLength: 10,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 7,
          maxLiveSyncPlaybackRate: 1.05,
          lowLatencyMode: false
        };
      case 'low-latency':
        return {
          ...baseConfig,
          maxBufferLength: 10,
          maxMaxBufferLength: 20,
          maxBufferSize: 15 * 1000 * 1000,
          backBufferLength: 5,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 5,
          lowLatencyMode: false
        };
    }
  }, []);

  const initPlayer = useCallback(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Increment session ID to discard all pending callbacks from prior channel
    const currentSession = ++playbackSessionIdRef.current;

    cleanupActiveEngine();
    triedEnginesRef.current.clear();
    setIsLoading(true);
    setError(null);
    stallCounterRef.current = 0;
    lastTimeRef.current = 0;
    mediaRecoveriesRef.current = 0;
    networkErrorRetriesRef.current = 0;

    video.volume = volume;
    video.muted = isMuted;
    video.playsInline = true;
    // NOTE: NEVER set video.crossOrigin = 'anonymous'!
    // IPTV streams rarely provide Access-Control-Allow-Origin headers; setting crossOrigin
    // forces the browser to abort playback with MEDIA_ERR_SRC_NOT_SUPPORTED.

    // Buffering Watchdog: kicks decoder if idle, provides seamless fallback
    clearBufferingWatchdog();
    bufferingWatchdogRef.current = setTimeout(() => {
      if (currentSession !== playbackSessionIdRef.current) return;

      if (video && video.paused && video.readyState < 2) {
        console.warn('[OnyxStream Watchdog] Initial stream buffering taking longer than expected. Nudging loader...');
        if (hlsRef.current) {
          hlsRef.current.startLoad(0);
        } else if (mpegtsPlayerRef.current) {
          mpegtsPlayerRef.current.load();
        }
        if (autoPlay) {
          video.play().catch(() => {
            video.muted = true;
            video.play().catch(console.warn);
          });
        }

        setTimeout(() => {
          if (currentSession !== playbackSessionIdRef.current) return;

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
        }, 5000);
      }
    }, 4000);

    const onPlaybackStarted = () => {
      if (currentSession !== playbackSessionIdRef.current) return;
      clearBufferingWatchdog();
      setIsLoading(false);
      setError(null);
    };

    // Standard HTML5 media event listeners
    video.onplay = () => {
      if (currentSession !== playbackSessionIdRef.current) return;
      setIsPlaying(true);
      onPlaybackStarted();
    };

    video.onpause = () => {
      if (currentSession !== playbackSessionIdRef.current) return;
      setIsPlaying(false);
    };

    video.onwaiting = () => {
      if (currentSession !== playbackSessionIdRef.current) return;
      setIsLoading(true);
    };

    video.onplaying = () => {
      if (currentSession !== playbackSessionIdRef.current) return;
      onPlaybackStarted();
      stallCounterRef.current = 0;
    };

    video.oncanplay = () => {
      if (currentSession !== playbackSessionIdRef.current) return;
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
      if (currentSession !== playbackSessionIdRef.current) return;
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
      if (currentSession !== playbackSessionIdRef.current) return;
      if (!isNaN(video.duration) && isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };

    video.onloadedmetadata = () => {
      if (currentSession !== playbackSessionIdRef.current) return;
      if (!isNaN(video.duration) && isFinite(video.duration)) {
        setDuration(video.duration);
      }
      onPlaybackStarted();
    };

    // Robust, zero-loop engine fallback dispatcher
    const fallbackToNextEngine = (failedEngine: string, streamUrl: string, reason?: string) => {
      if (currentSession !== playbackSessionIdRef.current) return;

      triedEnginesRef.current.add(failedEngine);
      console.warn(`[OnyxStream Fallback] Engine "${failedEngine}" failed (${reason || 'unknown'}). Checking alternative decoders...`);

      const isM3u8 = streamUrl.includes('.m3u8') || streamUrl.includes('m3u8');
      const isRawTs = streamUrl.endsWith('.ts') || streamUrl.includes('.ts?') || (type === 'live' && !isM3u8);

      let candidates: string[] = [];
      if (type === 'live') {
        if (isRawTs) {
          candidates = ['mpegts', 'hls', 'direct'];
        } else {
          candidates = ['hls', 'direct', 'mpegts'];
        }
      } else {
        candidates = ['direct', 'hls'];
      }

      // Pick the next engine that hasn't been attempted yet
      const nextEngine = candidates.find((eng) => !triedEnginesRef.current.has(eng));

      if (nextEngine) {
        console.log(`[OnyxStream Fallback] Switching from ${failedEngine} to next engine: ${nextEngine}`);
        cleanupActiveEngine();
        bootEngine(nextEngine, streamUrl);
      } else {
        clearBufferingWatchdog();
        setIsLoading(false);
        setError('Playback Error: Stream format unsupported by browser decoder. Try switching format or connection route.');
      }
    };

    // Engine bootloader
    const bootEngine = (engine: string, streamUrl: string) => {
      if (currentSession !== playbackSessionIdRef.current) return;

      const vid = videoRef.current;
      if (!vid) return;

      activeEngineRef.current = engine;
      triedEnginesRef.current.add(engine);

      if (engine === 'hls') {
        if (!Hls.isSupported()) {
          fallbackToNextEngine('hls', streamUrl, 'Hls.isSupported() is false');
          return;
        }
        try {
          console.log('[OnyxStream Engine] Booting Hls.js player for:', streamUrl);
          const hlsConfig = getHlsConfig(antiLagModeRef.current);
          const hls = new Hls(hlsConfig);
          hlsRef.current = hls;

          hls.loadSource(streamUrl);
          hls.attachMedia(vid);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (currentSession !== playbackSessionIdRef.current) return;
            onPlaybackStarted();
            networkErrorRetriesRef.current = 0;
            if (autoPlay) {
              vid.play().catch((err) => {
                console.warn('[OnyxStream] Autoplay prevented, trying muted:', err.message);
                vid.muted = true;
                vid.play().catch(console.warn);
              });
            }
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (currentSession !== playbackSessionIdRef.current) return;

            if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
              if (antiLagEnabledRef.current) {
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
                    fallbackToNextEngine('hls', streamUrl, 'HLS network error (exhausted retries)');
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
                    fallbackToNextEngine('hls', streamUrl, 'HLS media error (codec recovery failed)');
                  }
                  break;

                default:
                  console.warn('[Anti-Lag] Fatal HLS error:', data.details);
                  fallbackToNextEngine('hls', streamUrl, `Fatal HLS: ${data.details}`);
                  break;
              }
            }
          });
        } catch (err: any) {
          fallbackToNextEngine('hls', streamUrl, `Exception: ${err?.message}`);
        }
      } else if (engine === 'mpegts') {
        if (typeof window === 'undefined' || !mpegts.isSupported()) {
          fallbackToNextEngine('mpegts', streamUrl, 'mpegts.isSupported() is false');
          return;
        }
        try {
          console.log('[OnyxStream Engine] Booting mpegts.js player for:', streamUrl);
          const player = mpegts.createPlayer(
            {
              type: 'mpegts',
              isLive: type === 'live',
              url: streamUrl,
            },
            {
              enableWorker: false, // Prevents thread serialization corruption on TV WebViews
              lazyLoad: false,
              liveBufferLatencyChasing: true,
              liveBufferLatencyMaxLatency: 3.0,
              liveBufferLatencyMinRemain: 0.8,
            }
          );

          mpegtsPlayerRef.current = player;
          player.attachMediaElement(vid);
          player.load();

          player.on(mpegts.Events.ERROR, (errType: string, errDetail: string) => {
            if (currentSession !== playbackSessionIdRef.current) return;
            console.warn('[mpegts error]', errType, errDetail);
            fallbackToNextEngine('mpegts', streamUrl, `${errType}: ${errDetail}`);
          });

          if (autoPlay) {
            player.play()?.catch(() => {
              vid.muted = true;
              player.play()?.catch(console.warn);
            });
          }
        } catch (err: any) {
          fallbackToNextEngine('mpegts', streamUrl, `Exception: ${err?.message}`);
        }
      } else if (engine === 'direct') {
        console.log('[OnyxStream Engine] Booting HTML5 Direct Native for:', streamUrl);
        vid.src = streamUrl;
        vid.load();
        if (autoPlay) {
          vid.play().catch(() => {
            console.warn('[OnyxStream] Direct autoplay blocked, playing muted...');
            vid.muted = true;
            vid.play().catch(console.warn);
          });
        }
      }
    };

    // Video element error handler with automatic multi-tier fallback
    video.onerror = () => {
      if (currentSession !== playbackSessionIdRef.current) return;
      clearBufferingWatchdog();
      const err = video.error;
      console.warn('[OnyxStream] Video element error:', err?.code, err?.message);

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

      // 3. Fall back to next engine in chain
      const currentEngine = activeEngineRef.current || 'direct';
      fallbackToNextEngine(currentEngine, src, `video.onerror code ${err?.code}: ${err?.message}`);
    };

    const isExplicitM3u8 = src.includes('.m3u8') || src.includes('m3u8');
    const isRawTsStream = src.endsWith('.ts') || src.includes('.ts?') || (type === 'live' && !isExplicitM3u8);

    // Initial Engine Selection:
    if (type === 'live') {
      if (isRawTsStream && mpegts.isSupported()) {
        bootEngine('mpegts', src);
      } else if (Hls.isSupported()) {
        bootEngine('hls', src);
      } else {
        bootEngine('direct', src);
      }
    } else {
      if (isExplicitM3u8 && Hls.isSupported()) {
        bootEngine('hls', src);
      } else {
        bootEngine('direct', src);
      }
    }
  }, [
    src,
    type,
    autoPlay,
    cleanupActiveEngine,
    clearBufferingWatchdog,
    getHlsConfig,
    setIsLoading,
    setError,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setBufferLength,
    incrementLagRecovery,
    volume,
    isMuted,
    videoRef
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
  }, [src, type, autoPlay, initPlayer, cleanup]);

  const flushAndResync = () => {
    initPlayer();
  };

  const retry = () => {
    initPlayer();
  };

  return { retry, flushAndResync };
}
