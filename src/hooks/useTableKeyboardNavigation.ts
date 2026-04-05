import { useCallback } from 'react';

export const useTableKeyboardNavigation = (tableContainerRef: React.RefObject<HTMLElement>, addRow?: () => void) => {
  const handleKeyDown = useCallback((e: React.KeyboardEvent, rowIndex: number) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA';
    const isCell = target.tagName === 'TD' || target.tagName === 'TH';
    
    if (!isInput && !isCell) return;

    const rows = tableContainerRef.current?.querySelectorAll('tbody tr');
    const currentRow = rows ? rows[rowIndex] as HTMLElement : null;
    if (!currentRow) return;

    // Helper to find focusable elements in a row, excluding tabIndex="-1"
    const getFocusables = (row: HTMLElement | null | undefined) => {
      if (!row) return [];
      return Array.from(row.querySelectorAll('input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), td[tabindex]:not([tabindex="-1"]), th[tabindex]:not([tabindex="-1"])')) as HTMLElement[];
    };

    const focusables = getFocusables(currentRow);
    const currentIndex = focusables.indexOf(target);

    const focusElement = (el: HTMLElement) => {
      el.focus();
      if (el instanceof HTMLInputElement) {
        el.select();
      }
    };

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (isInput && target instanceof HTMLInputElement) {
        const isAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
        const isAtEnd = target.selectionStart === (target.value?.length || 0) && target.selectionEnd === (target.value?.length || 0);
        
        if (e.key === 'ArrowRight' && !isAtEnd) return;
        if (e.key === 'ArrowLeft' && !isAtStart) return;
      }

      if (e.key === 'ArrowRight') {
        if (currentIndex < focusables.length - 1) {
          e.preventDefault();
          focusElement(focusables[currentIndex + 1]);
        } else if (rowIndex < (rows?.length || 0) - 1) {
          const nextRow = rows ? rows[rowIndex + 1] as HTMLElement : null;
          const nextFocusables = getFocusables(nextRow);
          if (nextFocusables.length > 0) {
            e.preventDefault();
            focusElement(nextFocusables[0]);
          }
        } else if (addRow) {
          e.preventDefault();
          addRow();
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentIndex > 0) {
          e.preventDefault();
          focusElement(focusables[currentIndex - 1]);
        } else if (rowIndex > 0) {
          const prevRow = rows ? rows[rowIndex - 1] as HTMLElement : null;
          const prevFocusables = getFocusables(prevRow);
          if (prevFocusables.length > 0) {
            e.preventDefault();
            focusElement(prevFocusables[prevFocusables.length - 1]);
          }
        }
      }
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (target.tagName === 'SELECT') return;
      e.preventDefault();
      const nextRow = (e.key === 'ArrowDown' 
        ? (rows ? rows[rowIndex + 1] : null) 
        : (rows ? rows[rowIndex - 1] : null)) as HTMLElement;
      
      if (nextRow) {
        const nextFocusables = getFocusables(nextRow);
        if (nextFocusables.length > 0) {
          const targetIndex = Math.min(currentIndex, nextFocusables.length - 1);
          focusElement(nextFocusables[targetIndex]);
        }
      } else if (e.key === 'ArrowDown' && addRow) {
        addRow();
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentIndex < focusables.length - 1) {
        focusElement(focusables[currentIndex + 1]);
      } else {
        const nextRow = rows ? rows[rowIndex + 1] as HTMLElement : null;
        if (nextRow) {
          const nextFocusables = getFocusables(nextRow);
          if (nextFocusables.length > 0) focusElement(nextFocusables[0]);
        } else if (addRow) {
          addRow();
        }
      }
    }
  }, [tableContainerRef, addRow]);

  return { handleKeyDown };
};
