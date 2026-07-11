import { useState, useEffect } from 'react';

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null);

  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !window.navigator.standalone;

  useEffect(() => {
    const handler = e => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    setPrompt(null);
  }

  return { canInstall: !!prompt, install, isIos, isStandalone };
}
