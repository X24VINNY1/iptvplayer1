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
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // Key normalization for Android TV / Fire TV remotes
      const keyCode = e.keyCode || e.which;
      const key = e.key;

      const isUp = key === 'ArrowUp' || keyCode === 38 || keyCode === 19;
      const isDown = key === 'ArrowDown' || keyCode === 40 || keyCode === 20;
      const isLeft = key === 'ArrowLeft' || keyCode === 37 || keyCode === 21;
      const isRight = key === 'ArrowRight' || keyCode === 39 || keyCode === 22;
      const isSelect = key === 'Enter' || key === 'Select' || keyCode === 13 || keyCode === 23 || keyCode === 66;
      const isBack = key === 'Escape' || key === 'BrowserBack' || key === 'GoBack' || keyCode === 27 || keyCode === 4;

      // Handle BACK
      if (isBack) {
        e.preventDefault();
        e.stopPropagation();

        // 1. Check if a modal is currently open
        const modalCloseBtn = document.querySelector<HTMLElement>('[data-modal-close="true"], .modal-overlay button');
        if (modalCloseBtn) {
          modalCloseBtn.click();
          return;
        }

        // 2. Custom onBack handler if specified
        if (onBack) {
          onBack();
          return;
        }

        // 3. If focused in main content, jump back to active item in Sidebar (standard TV UX)
        const currentSection = target?.closest('[data-tv-section]')?.getAttribute('data-tv-section');
        if (currentSection && currentSection !== 'sidebar') {
          const activeSidebarItem = document.querySelector<HTMLElement>(
            '[data-tv-section="sidebar"] .active, [data-tv-section="sidebar"] a[aria-current="page"], [data-tv-section="sidebar"] [data-tv-focusable="true"]'
          );
          if (activeSidebarItem) {
            focusElement(activeSidebarItem);
            return;
          }
        }

        // 4. Default back navigation
        if (!isInput) {
          navigate(-1);
        }
        return;
      }

      // Handle SELECT / ENTER / OK
      if (isSelect) {
        if (isInput) return; // let text field handle enter naturally

        e.preventDefault();
        e.stopPropagation();

        if (onEnter) {
          onEnter();
          return;
        }

        // Click the currently focused active element
        if (document.activeElement && document.activeElement !== document.body) {
          (document.activeElement as HTMLElement).click();
        }
        return;
      }

      // Handle D-PAD ARROWS
      if (isUp || isDown || isLeft || isRight) {
        if (isInput) return;

        e.preventDefault();
        e.stopPropagation();

        let direction: 'up' | 'down' | 'left' | 'right' = 'down';
        if (isUp) direction = 'up';
        if (isDown) direction = 'down';
        if (isLeft) direction = 'left';
        if (isRight) direction = 'right';

        navigateSpatialFocus(direction);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [enabled, onBack, onEnter, navigate]);
}

function getFocusableElements(): HTMLElement[] {
  // Check if a modal is open, restricting focus trap to inside modal
  const activeModal = document.querySelector<HTMLElement>('[role="dialog"], [data-modal="true"], .modal-content');
  const root = activeModal || document;

  const selector = [
    'button:not([disabled]):not([tabindex="-1"])',
    'a[href]:not([tabindex="-1"])',
    'input:not([disabled]):not([tabindex="-1"])',
    '[data-tv-focusable="true"]:not([disabled]):not([tabindex="-1"])',
    '[tabindex="0"]:not([disabled])'
  ].join(', ');

  const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));

  return elements.filter((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return false;
    return true;
  });
}

function focusElement(el: HTMLElement) {
  // Remove existing .tv-focused marks
  document.querySelectorAll('.tv-focused').forEach((prev) => prev.classList.remove('tv-focused'));
  
  el.classList.add('tv-focused');
  el.focus();
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

function navigateSpatialFocus(direction: 'up' | 'down' | 'left' | 'right') {
  const focusables = getFocusableElements();
  if (focusables.length === 0) return;

  const current = (document.activeElement && document.activeElement !== document.body)
    ? (document.activeElement as HTMLElement)
    : null;

  // Initial focus if nothing is currently selected
  if (!current || !focusables.includes(current)) {
    // Prefer the first visible card in content, or the active sidebar item
    const preferred = focusables.find(
      (el) => el.getAttribute('data-tv-section') === 'content' || el.getAttribute('aria-current') === 'page'
    ) || focusables[0];

    focusElement(preferred);
    return;
  }

  const currentRect = current.getBoundingClientRect();
  const currentCenter = {
    x: currentRect.left + currentRect.width / 2,
    y: currentRect.top + currentRect.height / 2,
  };

  const currentSection = current.closest('[data-tv-section]')?.getAttribute('data-tv-section');

  // Smart Section Jump: From Sidebar Right to Content/Categories
  if (currentSection === 'sidebar' && direction === 'right') {
    const mainTargets = focusables.filter((el) => {
      const sec = el.closest('[data-tv-section]')?.getAttribute('data-tv-section');
      return sec === 'content' || sec === 'categories' || sec === 'hero';
    });
    if (mainTargets.length > 0) {
      // Find the one closest in vertical alignment
      let best = mainTargets[0];
      let minDy = Infinity;
      for (const t of mainTargets) {
        const r = t.getBoundingClientRect();
        const dy = Math.abs((r.top + r.height / 2) - currentCenter.y);
        if (dy < minDy) {
          minDy = dy;
          best = t;
        }
      }
      focusElement(best);
      return;
    }
  }

  // Smart Section Jump: From Content Left to Sidebar
  if (currentSection === 'content' && direction === 'left') {
    // Check if we are already near the leftmost side of the content area
    const contentCards = focusables.filter(el => el.closest('[data-tv-section]')?.getAttribute('data-tv-section') === 'content');
    const minLeft = Math.min(...contentCards.map(c => c.getBoundingClientRect().left));
    
    if (currentRect.left <= minLeft + 20) {
      const activeSidebarItem = document.querySelector<HTMLElement>(
        '[data-tv-section="sidebar"] a[aria-current="page"], [data-tv-section="sidebar"] [data-tv-focusable="true"]'
      );
      if (activeSidebarItem) {
        focusElement(activeSidebarItem);
        return;
      }
    }
  }

  // Standard Spatial Candidate Search
  let bestElement: HTMLElement | null = null;
  let bestScore = Infinity;

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
    let primaryDist = 0;
    let secondaryOverlapPenalty = 0;

    if (direction === 'right') {
      if (rect.left >= currentRect.left + 5 && center.x > currentCenter.x + 5) {
        isCandidate = true;
        primaryDist = Math.max(0, rect.left - currentRect.right);
        // Vertical overlap check
        const overlap = Math.max(0, Math.min(rect.bottom, currentRect.bottom) - Math.max(rect.top, currentRect.top));
        secondaryOverlapPenalty = overlap > 0 ? 0 : Math.min(Math.abs(rect.top - currentRect.bottom), Math.abs(currentRect.top - rect.bottom));
      }
    } else if (direction === 'left') {
      if (rect.right <= currentRect.right - 5 && center.x < currentCenter.x - 5) {
        isCandidate = true;
        primaryDist = Math.max(0, currentRect.left - rect.right);
        const overlap = Math.max(0, Math.min(rect.bottom, currentRect.bottom) - Math.max(rect.top, currentRect.top));
        secondaryOverlapPenalty = overlap > 0 ? 0 : Math.min(Math.abs(rect.top - currentRect.bottom), Math.abs(currentRect.top - rect.bottom));
      }
    } else if (direction === 'down') {
      if (rect.top >= currentRect.top + 5 && center.y > currentCenter.y + 5) {
        isCandidate = true;
        primaryDist = Math.max(0, rect.top - currentRect.bottom);
        // Horizontal overlap check
        const overlap = Math.max(0, Math.min(rect.right, currentRect.right) - Math.max(rect.left, currentRect.left));
        secondaryOverlapPenalty = overlap > 0 ? 0 : Math.min(Math.abs(rect.left - currentRect.right), Math.abs(currentRect.left - rect.right));
      }
    } else if (direction === 'up') {
      if (rect.bottom <= currentRect.bottom - 5 && center.y < currentCenter.y - 5) {
        isCandidate = true;
        primaryDist = Math.max(0, currentRect.top - rect.bottom);
        const overlap = Math.max(0, Math.min(rect.right, currentRect.right) - Math.max(rect.left, currentRect.left));
        secondaryOverlapPenalty = overlap > 0 ? 0 : Math.min(Math.abs(rect.left - currentRect.right), Math.abs(currentRect.left - rect.right));
      }
    }

    if (isCandidate) {
      // Prioritize elements in the same visual group/row with heavy overlap weighting
      const score = primaryDist + secondaryOverlapPenalty * 2.2;
      if (score < bestScore) {
        bestScore = score;
        bestElement = el;
      }
    }
  }

  if (bestElement) {
    focusElement(bestElement);
  }
}
