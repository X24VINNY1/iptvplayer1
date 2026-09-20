import { useEffect, useState, useRef } from 'react';
import Hls from 'hls.js';
import { usePlayerStore } from '@/store/usePlayerStore';

export function useVideoPlayer(
  videoRef: React.RefObject<HTMLVideoElement>,
  src: string | null
) {
  const [isReady, setIsReady] = useState(false);
  const { error, setError, incrementReconnect, reconnectAttempts, resetReconnect, setIsLoading } = usePlayerStore();
  const hlsRef = useRef<Hls | null>(null);
  
  const retry = () => {
    resetReconnect();
    setError(null);
    setIsLoading(true);
    initPlayer();
  };

  const initPlayer = () => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = src.endsWith('.m3u8') || src.includes('/live/');

    const handleVideoEvents = () => {
      video.oncanplay = () => {
        setIsReady(true);
        setIsLoading(false);
      };
      video.onwaiting = () => setIsLoading(true);
      video.onplaying = () => setIsLoading(false);
      video.onerror = () => {
        handleError('Video element encountered an error');
      };
    };

    const handleError = (msg: string) => {
      if (reconnectAttempts < 5) {
        incrementReconnect();
        const timeout = Math.pow(2, reconnectAttempts) * 1000;
        setTimeout(() => {
          initPlayer();
        }, timeout);
      } else {
        setError(msg);
        setIsLoading(false);
      }
    };

    handleVideoEvents();

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 30,
        enableWorker: true
      });
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsReady(true);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              handleError('Network error while loading video');
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              handleError('Fatal HLS error encountered');
              break;
          }
        }
      });
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = src;
    } else {
      // Direct stream
      video.src = src;
    }
  };

  useEffect(() => {
    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  return { isReady, error, retry };
}
