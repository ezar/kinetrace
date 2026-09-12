/** React binding for the install offer. */

import { useCallback, useEffect, useState } from 'react';
import {
  isInstalled,
  shouldOfferInstall,
  watchInstallPrompt,
  type InstallOutcome,
  type InstallPrompt,
} from './install.js';
import { useSettingsStore } from '../store/useSettingsStore.js';

export interface InstallOffer {
  /** True when the offer should be shown right now. */
  offer: boolean;
  /** Ask the browser. Resolves once the person has answered. */
  install: () => Promise<InstallOutcome | null>;
  /** They said not now; do not ask again. */
  dismiss: () => void;
}

export function useInstallOffer(): InstallOffer {
  const settings = useSettingsStore();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => watchInstallPrompt(setPrompt), []);

  const install = useCallback(async (): Promise<InstallOutcome | null> => {
    if (!prompt) return null;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // Asked and answered, whichever way it went.
    await settings.update({ installOffered: true });
    setPrompt(null);
    return outcome;
  }, [prompt, settings]);

  const dismiss = useCallback((): void => {
    void settings.update({ installOffered: true });
    setPrompt(null);
  }, [settings]);

  return {
    offer: shouldOfferInstall({
      installed: isInstalled(),
      alreadyAsked: settings.installOffered,
      available: prompt !== null,
    }),
    install,
    dismiss,
  };
}
