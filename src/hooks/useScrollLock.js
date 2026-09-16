import { useEffect } from 'react';

let lockCount = 0;

export function useScrollLock(modalClass = 'modal-box') {
  useEffect(() => {
    const prevent = e => {
      if (!e.target.closest(`.${modalClass}`)) e.preventDefault();
    };
    document.addEventListener('touchmove', prevent, { passive: false });
    lockCount++;
    if (lockCount === 1) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('touchmove', prevent);
      lockCount--;
      if (lockCount === 0) document.body.style.overflow = '';
    };
  }, [modalClass]);
}
