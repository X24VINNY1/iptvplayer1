import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface TVRemoteOptions {
  onBack?: () => void;
  onEnter?: () => void;
  enabled?: boolean;
}

// Global references to preserve focus memory across screen and modal lifecycles
let lastFocusedBeforeModal: HTMLElement | null = null;
let lastKnownFocusedElement: HTMLElement | null = null;

export function useTVRemote(options: TVRemoteOptions = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { onBack, onEnter, enabled = true } = options;

  // Auto-focus the most appropriate element on screen/route change
  useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(() => {
      const active = document.activeElement;
      // If nothing is focused or focus is on body, pick best initial target
      if (!active || active === document.body || !document.contains(active)) {
        const focusables = getFocusableElements();
        if (focusables.length > 0) {
          // Priority: 1. Primary content card, 2. Active nav link in sidebar, 3. First focusable
          const preferred = focusables.find(
            (el) => el.getAttribute('data-tv-section') === 'content'
          ) || focusables.find(
            (el) => el.getAttribute('aria-current') === 'page'
          ) || focusables[0];

          if (preferred) {
            focusElement(preferred);
          }
        }
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [location.pathname, enabled]);

  // Modal detection: automatically trap focus inside modal and save opener reference
  useEffect(() => {
    if (!enabled) return;

    const observer = new MutationObserver(() => {
      const activeModal = document.querySelector<HTMLElement>(
        '[role="dialog"], [data-modal="true"], .modal-overlay, .modal-content'
      );

      if (activeModal) {
        const currentActive = document.activeElement as HTMLElement | null;
        if (currentActive && !activeModal.contains(currentActive)) {
          lastFocusedBeforeModal = currentActive;
          const modalFocusables = getFocusableElements();
          const firstInModal = modalFocusables.find((el) => activeModal.contains(el));
          if (firstInModal) {
            focusElement(firstInModal);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled]);

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
        const modalCloseBtn = document.querySelector<HTMLElement>(
          '[data-modal-close="true"], .modal-overlay button, [role="dialog"] button'
        );
        if (modalCloseBtn) {
          modalCloseBtn.click();
          // Restore focus to element that triggered the modal
          if (lastFocusedBeforeModal && document.contains(lastFocusedBeforeModal)) {
            setTimeout(() => {
              if (lastFocusedBeforeModal) focusElement(lastFocusedBeforeModal);
            }, 100);
          }
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
        if (onEnter) {
          e.preventDefault();
          e.stopPropagation();
          onEnter();
          return;
        }

        // If target is an input and user presses OK on remote, trigger click to open on-screen keyboard
        if (isInput) {
          (target as HTMLElement).click();
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        // Click the currently focused active element
        if (document.activeElement && document.activeElement !== document.body) {
          (document.activeElement as HTMLElement).click();
        }
        return;
      }

      // Handle D-PAD ARROWS
      if (isUp || isDown || isLeft || isRight) {
        // If inside an input:
        // ArrowUp and ArrowDown ALWAYS move focus between inputs and buttons
        // ArrowLeft and ArrowRight only move caret if there is text and caret isn't at boundary
        if (isInput && (isLeft || isRight)) {
          const inputEl = target as HTMLInputElement;
          const valLen = inputEl.value ? inputEl.value.length : 0;
          const pos = inputEl.selectionStart ?? 0;
          if (isLeft && pos > 0) return;
          if (isRight && pos < valLen) return;
        }

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
  // Restrict spatial navigation strictly inside active modal if open
  const activeModal = document.querySelector<HTMLElement>(
    '[role="dialog"], [data-modal="true"], .modal-overlay, .modal-content'
  );
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

function getScrollParent(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null;
  let current: HTMLElement | null = node.parentElement;
  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    if (
      overflowY === 'auto' || overflowY === 'scroll' ||
      overflowX === 'auto' || overflowX === 'scroll'
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function focusElement(el: HTMLElement) {
  // Remove existing .tv-focused marks
  document.querySelectorAll('.tv-focused').forEach((prev) => prev.classList.remove('tv-focused'));
  
  el.classList.add('tv-focused');
  el.focus({ preventScroll: true });
  lastKnownFocusedElement = el;

  // Auto-scroll scrollable parent with safety margins so focused item is ALWAYS fully in view
  const scrollParent = getScrollParent(el);
  if (scrollParent) {
    const elRect = el.getBoundingClientRect();
    const parentRect = scrollParent.getBoundingClientRect();

    // Vertical boundary check with 70px safety buffer
    if (elRect.top < parentRect.top + 70) {
      scrollParent.scrollBy({ top: elRect.top - parentRect.top - 70, behavior: 'smooth' });
    } else if (elRect.bottom > parentRect.bottom - 70) {
      scrollParent.scrollBy({ top: elRect.bottom - parentRect.bottom + 70, behavior: 'smooth' });
    }

    // Horizontal boundary check with 60px safety buffer (for card rows & carousels)
    if (elRect.left < parentRect.left + 60) {
      scrollParent.scrollBy({ left: elRect.left - parentRect.left - 60, behavior: 'smooth' });
    } else if (elRect.right > parentRect.right - 60) {
      scrollParent.scrollBy({ left: elRect.right - parentRect.right + 60, behavior: 'smooth' });
    }
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
}

function navigateSpatialFocus(direction: 'up' | 'down' | 'left' | 'right') {
  const focusables = getFocusableElements();
  if (focusables.length === 0) return;

  let current = (document.activeElement && document.activeElement !== document.body)
    ? (document.activeElement as HTMLElement)
    : lastKnownFocusedElement;

  // Recovery: if current is not valid or not in document, pick the best visible element
  if (!current || !document.contains(current) || !focusables.includes(current)) {
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

  // 1. Section Transition: From Sidebar Right to Content Area
  if (currentSection === 'sidebar' && direction === 'right') {
    const mainTargets = focusables.filter((el) => {
      const sec = el.closest('[data-tv-section]')?.getAttribute('data-tv-section');
      return sec === 'content' || sec === 'categories' || sec === 'hero' || sec === 'preview';
    });
    if (mainTargets.length > 0) {
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

  // 2. Section Transition: From Content Left boundary to Sidebar
  if ((currentSection === 'content' || currentSection === 'categories') && direction === 'left') {
    const contentCards = focusables.filter((el) => {
      const sec = el.closest('[data-tv-section]')?.getAttribute('data-tv-section');
      return sec === 'content' || sec === 'categories';
    });
    const minLeft = Math.min(...contentCards.map((c) => c.getBoundingClientRect().left));

    // If at the leftmost column in content, navigate to active sidebar item
    if (currentRect.left <= minLeft + 30) {
      const activeSidebarItem = document.querySelector<HTMLElement>(
        '[data-tv-section="sidebar"] a[aria-current="page"], [data-tv-section="sidebar"] [data-tv-focusable="true"]'
      );
      if (activeSidebarItem) {
        focusElement(activeSidebarItem);
        return;
      }
    }
  }

  // 3. Mathematical Directional Spatial Candidate Scoring
  let bestElement: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of focusables) {
    if (el === current) continue;
    const rect = el.getBoundingClientRect();
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    let isCandidate = false;
    let score = Infinity;

    if (direction === 'down') {
      // Must be physically below current element
      if (rect.top >= currentRect.top + 2 && center.y > currentCenter.y + 2) {
        isCandidate = true;
        const dy = Math.max(0, rect.top - currentRect.bottom);
        const dx = Math.abs(center.x - currentCenter.x);
        // Horizontal column overlap check
        const horizontalOverlap = Math.max(0, Math.min(rect.right, currentRect.right) - Math.max(rect.left, currentRect.left));
        const columnAlignmentBonus = horizontalOverlap > (currentRect.width * 0.3) ? 0 : 400;
        // Heavy dx weight strictly preserves column position across rows
        score = (dy * 2.5) + (dx * 5.0) + columnAlignmentBonus;
      }
    } else if (direction === 'up') {
      // Must be physically above current element
      if (rect.bottom <= currentRect.bottom - 2 && center.y < currentCenter.y - 2) {
        isCandidate = true;
        const dy = Math.max(0, currentRect.top - rect.bottom);
        const dx = Math.abs(center.x - currentCenter.x);
        const horizontalOverlap = Math.max(0, Math.min(rect.right, currentRect.right) - Math.max(rect.left, currentRect.left));
        const columnAlignmentBonus = horizontalOverlap > (currentRect.width * 0.3) ? 0 : 400;
        // Heavy dx weight strictly preserves column position across rows
        score = (dy * 2.5) + (dx * 5.0) + columnAlignmentBonus;
      }
    } else if (direction === 'right') {
      // Must be physically to the right of current element
      if (rect.left >= currentRect.left + 2 && center.x > currentCenter.x + 2) {
        isCandidate = true;
        const dx = Math.max(0, rect.left - currentRect.right);
        const dy = Math.abs(center.y - currentCenter.y);
        // Vertical row overlap check
        const verticalOverlap = Math.max(0, Math.min(rect.bottom, currentRect.bottom) - Math.max(rect.top, currentRect.top));
        const rowAlignmentBonus = verticalOverlap > (currentRect.height * 0.3) ? 0 : 600;
        // Heavy dy weight prevents jumping rows when moving horizontally
        score = (dx * 2.0) + (dy * 6.0) + rowAlignmentBonus;
      }
    } else if (direction === 'left') {
      // Must be physically to the left of current element
      if (rect.right <= currentRect.right - 2 && center.x < currentCenter.x - 2) {
        isCandidate = true;
        const dx = Math.max(0, currentRect.left - rect.right);
        const dy = Math.abs(center.y - currentCenter.y);
        const verticalOverlap = Math.max(0, Math.min(rect.bottom, currentRect.bottom) - Math.max(rect.top, currentRect.top));
        const rowAlignmentBonus = verticalOverlap > (currentRect.height * 0.3) ? 0 : 600;
        score = (dx * 2.0) + (dy * 6.0) + rowAlignmentBonus;
      }
    }

    if (isCandidate && score < bestScore) {
      bestScore = score;
      bestElement = el;
    }
  }

  if (bestElement) {
    focusElement(bestElement);
  }
}

