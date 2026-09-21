import { useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { usePlayerStore } from '@/store/usePlayerStore';

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
    isMuted
  } = usePlayerStore();

  const hlsRef = useRef<Hls | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const attemptsRef = useRef(0);

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

  const initPlayer = useCallback(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    cleanup();
    setIsLoading(true);
    setError(null);

    // Sync volume & mute
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
      
      // If error code is MEDIA_ERR_SRC_NOT_SUPPORTED or NETWORK, try retry
      if (attemptsRef.current < 3) {
        attemptsRef.current += 1;
        console.log(`Retrying playback (attempt ${attemptsRef.current})...`);
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

    // Determine if HLS should be used
    const isHls =
      src.includes('.m3u8') ||
      type === 'live' ||
      src.includes('/live/');

    // Route through local proxy if hosted on HTTPS and stream is plain HTTP (to bypass browser Mixed Content)
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
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        maxMaxBufferLength: 30,
        // Disable withCredentials to prevent CORS wildcard block on IPTV servers
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        }
      });
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
        console.warn('HLS Event Error:', data.type, data.details, data.fatal);

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('HLS Network error, attempting startLoad recovery...');
              hls.startLoad();
              break;

            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('HLS Media error, attempting recoverMediaError...');
              hls.recoverMediaError();
              break;

            default:
              console.log('Fatal HLS error, falling back directly to HTML5 video src...');
              hls.destroy();
              hlsRef.current = null;
              // Fallback to native video element
              video.src = effectiveSrc;
              video.load();
              if (autoPlay) {
                video.play().catch(console.warn);
              }
              break;
          }
        }
      });
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari HLS
      video.src = effectiveSrc;
      video.load();
      if (autoPlay) {
        video.play().catch(console.warn);
      }
    } else {
      // Direct video streams (MP4, MKV, TS)
      video.src = effectiveSrc;
      video.load();
      if (autoPlay) {
        video.play().catch(console.warn);
      }
    }
  }, [src, type, autoPlay, cleanup, volume, isMuted, setIsLoading, setError, setIsPlaying, setCurrentTime, setDuration]);

  useEffect(() => {
    attemptsRef.current = 0;
    initPlayer();
    return () => cleanup();
  }, [initPlayer, cleanup]);

  const retry = () => {
    attemptsRef.current = 0;
    initPlayer();
  };

  return { retry };
}
