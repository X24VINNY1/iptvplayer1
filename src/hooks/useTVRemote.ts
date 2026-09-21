import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface TVRemoteOptions {
  onBack?: () => void;
  onEnter?: () => void;
  enabled?: boolean;
}

export function useTVRemote(options: TVRemoteOptions = {}) {
  const navigate = useNavigate();
  const { onBack, onEnter, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing in inputs or textareas
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      switch (e.key) {
        case 'Escape':
        case 'BrowserBack':
        case 'GoBack':
          if (onBack) {
            e.preventDefault();
            onBack();
          } else if (!isInput) {
            e.preventDefault();
            navigate(-1);
          }
          break;

        case 'Enter':
          if (onEnter && !isInput) {
            e.preventDefault();
            onEnter();
          }
          break;

        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          if (isInput) return;
          // Spatial TV focus movement
          navigateSpatialFocus(e.key);
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onBack, onEnter, navigate]);
}

function navigateSpatialFocus(direction: string) {
  const focusables = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]:not([disabled])'
    )
  ).filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
  });

  if (focusables.length === 0) return;

  const current = document.activeElement as HTMLElement;
  const currentIndex = focusables.indexOf(current);

  if (currentIndex === -1) {
    focusables[0].focus();
    return;
  }

  const currentRect = current.getBoundingClientRect();
  const currentCenter = {
    x: currentRect.left + currentRect.width / 2,
    y: currentRect.top + currentRect.height / 2,
  };

  let bestElement: HTMLElement | null = null;
  let bestDistance = Infinity;

  for (const el of focusables) {
    if (el === current) continue;
    const rect = el.getBoundingClientRect();
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    const dx = center.x - currentCenter.x;
    const dy = center.y - currentCenter.y;

    let isCandidate = false;
    let distance = Infinity;

    if (direction === 'ArrowRight' && dx > 10) {
      isCandidate = true;
      distance = Math.sqrt(dx * dx + dy * dy * 4); // penalize vertical drift
    } else if (direction === 'ArrowLeft' && dx < -10) {
      isCandidate = true;
      distance = Math.sqrt(dx * dx + dy * dy * 4);
    } else if (direction === 'ArrowDown' && dy > 10) {
      isCandidate = true;
      distance = Math.sqrt(dx * dx * 4 + dy * dy); // penalize horizontal drift
    } else if (direction === 'ArrowUp' && dy < -10) {
      isCandidate = true;
      distance = Math.sqrt(dx * dx * 4 + dy * dy);
    }

    if (isCandidate && distance < bestDistance) {
      bestDistance = distance;
      bestElement = el;
    }
  }

  if (bestElement) {
    bestElement.focus();
    bestElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
}
