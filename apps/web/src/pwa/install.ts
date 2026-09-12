/**
 * Offering to install the app.
 *
 * Kinetrace is a complete progressive web app — service worker, manifest,
 * icons, works offline — that never proposed installing itself. Installed it
 * opens full screen, without a browser bar taking thirty pixels from exactly
 * where the big numbers go, and it starts from an icon instead of a tab
 * somebody has to find again.
 *
 * It is asked once, after a session has been finished, because that is when a
 * person knows whether this is for them. The answer is remembered either way.
 */

export type InstallOutcome = 'accepted' | 'dismissed';

/** The event Chromium fires, narrowed to what is used here. */
export interface InstallPrompt {
  preventDefault: () => void;
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallOutcome }>;
}

/** True when the app is already running from the home screen. */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  // Safari on iOS does not implement display-mode and has its own flag.
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || ios;
}

/**
 * Whether to put the offer in front of somebody. Kept separate from the browser
 * so the rule can be read and tested on its own.
 */
export function shouldOfferInstall(state: {
  installed: boolean;
  /** True once they have answered, whichever way. */
  alreadyAsked: boolean;
  /** False until the browser has said installing is possible. */
  available: boolean;
}): boolean {
  return state.available && !state.installed && !state.alreadyAsked;
}

/**
 * Catch the browser's offer and keep it. Chromium fires this once, early, and
 * withdraws its own banner as soon as the default is prevented — so it has to be
 * held until there is a good moment to use it.
 */
export function watchInstallPrompt(onAvailable: (prompt: InstallPrompt) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event): void => {
    const prompt = event as unknown as InstallPrompt;
    prompt.preventDefault();
    onAvailable(prompt);
  };
  window.addEventListener('beforeinstallprompt', handler);
  return () => window.removeEventListener('beforeinstallprompt', handler);
}
