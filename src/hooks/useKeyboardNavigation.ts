import { useCallback } from 'react';

export const useKeyboardNavigation = () => {
  const handleFormKeyDown = useCallback((e: React.KeyboardEvent, onSave?: () => void) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA') return;

    const form = target.closest('form');
    if (!form) return;

    // Get all focusable elements within the form
    const focusableElements = Array.from(
      form.querySelectorAll(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button[type="submit"]:not([disabled])'
      )
    ) as HTMLElement[];

    const currentIndex = focusableElements.indexOf(target);
    if (currentIndex === -1) return;

    // Helper to move focus in a grid-like manner for Up/Down arrows
    const moveGrid = (direction: 'up' | 'down') => {
      const currentRect = target.getBoundingClientRect();
      const threshold = 15; // Pixels to consider elements in the same row/column

      let bestMatch: HTMLElement | null = null;
      let minDistance = Infinity;

      focusableElements.forEach((el, index) => {
        if (index === currentIndex) return;
        // Skip hidden or disabled elements
        if (el.offsetParent === null) return;

        const rect = el.getBoundingClientRect();

        if (direction === 'down' && rect.top > currentRect.top + threshold) {
          const distance = Math.abs(rect.left - currentRect.left);
          if (distance < minDistance) {
            minDistance = distance;
            bestMatch = el;
          }
        } else if (direction === 'up' && rect.bottom < currentRect.bottom - threshold) {
          const distance = Math.abs(rect.left - currentRect.left);
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
          bestMatch.select();
        }
      } else {
        // Fallback to sequential if no grid match found
        if (direction === 'down' && currentIndex < focusableElements.length - 1) {
          e.preventDefault();
          focusableElements[currentIndex + 1].focus();
        } else if (direction === 'up' && currentIndex > 0) {
          e.preventDefault();
          focusableElements[currentIndex - 1].focus();
        }
      }
    };

    if (e.key === 'Enter') {
      // Handle Textarea Enter key
      if (target.tagName === 'TEXTAREA' && !e.ctrlKey) {
        // Find the last input/textarea before the submit button
        let lastInputIndex = -1;
        for (let i = focusableElements.length - 1; i >= 0; i--) {
          if (['INPUT', 'SELECT', 'TEXTAREA'].includes(focusableElements[i].tagName)) {
            lastInputIndex = i;
            break;
          }
        }
        // If it's not the last input, allow new line
        if (currentIndex !== lastInputIndex) return;
      }

      e.preventDefault();
      
      let lastInputIndex = -1;
      for (let i = focusableElements.length - 1; i >= 0; i--) {
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(focusableElements[i].tagName)) {
          lastInputIndex = i;
          break;
        }
      }

      if (currentIndex < lastInputIndex) {
        const nextElement = focusableElements[currentIndex + 1];
        nextElement.focus();
        if (nextElement instanceof HTMLInputElement) {
          nextElement.select();
        }
      } else {
        // It's the last input field, trigger save/submit
        if (onSave) {
          onSave();
        } else {
          form.requestSubmit();
        }
      }
    } else if (e.key === 'ArrowDown') {
      if (target.tagName === 'SELECT') return; // Let select handle its own arrows
      moveGrid('down');
    } else if (e.key === 'ArrowUp') {
      if (target.tagName === 'SELECT') return;
      moveGrid('up');
    } else if (e.key === 'ArrowRight') {
      const input = target as HTMLInputElement;
      if (input.selectionEnd === (input.value?.length || 0)) {
        if (currentIndex < focusableElements.length - 1) {
          const next = focusableElements[currentIndex + 1];
          if (next.tagName !== 'BUTTON') {
            e.preventDefault();
            next.focus();
            if (next instanceof HTMLInputElement) next.select();
          }
        }
      }
    } else if (e.key === 'ArrowLeft') {
      const input = target as HTMLInputElement;
      if (input.selectionStart === 0) {
        if (currentIndex > 0) {
          const prev = focusableElements[currentIndex - 1];
          if (prev.tagName !== 'BUTTON') {
            e.preventDefault();
            prev.focus();
            if (prev instanceof HTMLInputElement) prev.select();
          }
        }
      }
    }
  }, []);

  const handleTableKeyDown = useCallback((e: React.KeyboardEvent, onNewRow?: () => void) => {
    const target = e.target as HTMLElement;
    const cell = target.closest('td, th');
    const row = target.closest('tr');
    if (!cell || !row) return;

    const table = row.closest('table');
    if (!table) return;

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const rowIndex = rows.indexOf(row);
    const cells = Array.from(row.querySelectorAll('td, th'));
    const cellIndex = cells.indexOf(cell as HTMLTableCellElement);

    const focusCell = (rIdx: number, cIdx: number) => {
      const targetRow = rows[rIdx];
      if (!targetRow) {
        if (rIdx === rows.length && onNewRow) {
          onNewRow();
        }
        return;
      }
      const targetCell = targetRow.querySelectorAll('td, th')[cIdx];
      if (!targetCell) return;

      const focusable = targetCell.querySelector('input, select, textarea, button') as HTMLElement;
      if (focusable) {
        e.preventDefault();
        focusable.focus();
        if (focusable instanceof HTMLInputElement) {
          focusable.select();
        }
      }
    };

    if (e.key === 'ArrowDown') {
      focusCell(rowIndex + 1, cellIndex);
    } else if (e.key === 'ArrowUp') {
      focusCell(rowIndex - 1, cellIndex);
    } else if (e.key === 'ArrowRight') {
      const input = target as HTMLInputElement;
      if (input.selectionEnd === (input.value?.length || 0)) {
        focusCell(rowIndex, cellIndex + 1);
      }
    } else if (e.key === 'ArrowLeft') {
      const input = target as HTMLInputElement;
      if (input.selectionStart === 0) {
        focusCell(rowIndex, cellIndex - 1);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (cellIndex < cells.length - 1) {
        focusCell(rowIndex, cellIndex + 1);
      } else {
        focusCell(rowIndex + 1, 0);
      }
    }
  }, []);

  return { handleFormKeyDown, handleTableKeyDown };
};
