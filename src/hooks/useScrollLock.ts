import { useEffect } from 'react';

// Global counter to track how many modals are open
let modalCount = 0;

export function useScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (isOpen) {
      modalCount++;
      document.body.style.overflow = 'hidden';
    } else {
      modalCount = Math.max(0, modalCount - 1);
      // Only restore scroll if no modals are open
      if (modalCount === 0) {
        document.body.style.overflow = 'unset';
      }
    }

    // Cleanup on unmount
    return () => {
      if (isOpen) {
        modalCount = Math.max(0, modalCount - 1);
        if (modalCount === 0) {
          document.body.style.overflow = 'unset';
        }
      }
    };
  }, [isOpen]);
}