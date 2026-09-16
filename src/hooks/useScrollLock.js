import { useEffect } from 'react';

export function useScrollLock(modalClass = 'modal-box') {
  useEffect(() => {
    const prevent = e => {
      if (!e.target.closest(`.${modalClass}`)) e.preventDefault();
    };
    // passive: false necesario para poder llamar preventDefault en iOS
    document.addEventListener('touchmove', prevent, { passive: false });
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('touchmove', prevent);
      document.body.style.overflow = '';
    };
  }, [modalClass]);
}
