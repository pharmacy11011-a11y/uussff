import { useCallback } from 'react';

/**
 * Hook to enable keyboard navigation (Arrows + Enter) in forms.
 * Supports grid-like navigation if elements are arranged in rows/columns.
 */
export const useFormKeyboardNavigation = () => {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
      return;
    }

    const form = target.closest('form');
    if (!form) return;

    // Get all focusable elements in the form
    const elements = Array.from(
      form.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button[type="submit"]:not([disabled])')
    ) as HTMLElement[];

    const currentIndex = elements.indexOf(target);
    if (currentIndex === -1) return;

    const moveFocus = (nextIndex: number) => {
      if (nextIndex >= 0 && nextIndex < elements.length) {
        e.preventDefault();
        elements[nextIndex].focus();
        if (elements[nextIndex] instanceof HTMLInputElement) {
          (elements[nextIndex] as HTMLInputElement).select();
        }
      }
    };

    // Helper to find element above/below in a grid
    const moveGrid = (direction: 'up' | 'down') => {
      const currentRect = target.getBoundingClientRect();
      const currentCenterX = currentRect.left + currentRect.width / 2;
      
      let bestMatch: HTMLElement | null = null;
      let minDistance = Infinity;

      elements.forEach((el, index) => {
        if (index === currentIndex) return;
        if (el.offsetParent === null) return; // Skip hidden
        
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        
        const isCorrectDirection = direction === 'up' 
          ? rect.bottom <= currentRect.top + 10 // Buffer
          : rect.top >= currentRect.bottom - 10;

        if (isCorrectDirection) {
          const distance = Math.abs(centerX - currentCenterX);
          if (distance < minDistance) {
            minDistance = distance;
            bestMatch = el;
          }
        }
      });

      if (bestMatch) {
        e.preventDefault();
        (bestMatch as HTMLElement).focus();
        if (bestMatch instanceof HTMLInputElement) {
          (bestMatch as HTMLInputElement).select();
        }
      } else {
        // Fallback to sequential
        if (direction === 'down') moveFocus(currentIndex + 1);
        else moveFocus(currentIndex - 1);
      }
    };

    switch (e.key) {
      case 'ArrowRight':
        if (target instanceof HTMLInputElement) {
          if (target.selectionEnd !== (target.value?.length || 0)) return;
        }
        // Don't move focus to buttons with arrows
        if (currentIndex < elements.length - 1 && elements[currentIndex + 1].tagName !== 'BUTTON') {
          moveFocus(currentIndex + 1);
        }
        break;
      case 'ArrowLeft':
        if (target instanceof HTMLInputElement) {
          if (target.selectionStart !== 0) return;
        }
        if (currentIndex > 0 && elements[currentIndex - 1].tagName !== 'BUTTON') {
          moveFocus(currentIndex - 1);
        }
        break;
      case 'ArrowDown':
        if (target.tagName === 'SELECT') return;
        moveGrid('down');
        break;
      case 'ArrowUp':
        if (target.tagName === 'SELECT') return;
        moveGrid('up');
        break;
      case 'Enter':
        // Handle Textarea
        if (target.tagName === 'TEXTAREA' && !e.ctrlKey) {
          let lastInputIndex = -1;
          for (let i = elements.length - 1; i >= 0; i--) {
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(elements[i].tagName)) {
              lastInputIndex = i;
              break;
            }
          }
          if (currentIndex !== lastInputIndex) return;
        }

        e.preventDefault();
        let lastInputIndex = -1;
        for (let i = elements.length - 1; i >= 0; i--) {
          if (['INPUT', 'SELECT', 'TEXTAREA'].includes(elements[i].tagName)) {
            lastInputIndex = i;
            break;
          }
        }

        if (currentIndex < lastInputIndex) {
          moveFocus(currentIndex + 1);
        } else {
          // Trigger form submission on last input
          form.requestSubmit();
        }
        break;
    }
  }, []);

  return { handleKeyDown };
};
