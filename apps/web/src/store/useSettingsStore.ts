/**
 * Application settings.
 *
 * Zustand holds the live copy; Dexie is the source of truth across reloads.
 */

import { create } from 'zustand';
import { getSettings, pruneTracks, saveSettings } from '../db/repositories.js';
import { DEFAULT_SETTINGS, type AppSettings } from '../db/schema.js';
import { detectLanguage, type Language } from '../i18n/index.js';
import { suggestVariant } from '../pose/models.js';

interface SettingsState extends AppSettings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  /** Pick up a settings row written outside the store. */
  refresh: () => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
  setActiveProfile: (profileId: number | undefined) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const stored = await getSettings();
    const first = stored.key === undefined;
    const settings: AppSettings = first
      ? { ...DEFAULT_SETTINGS, language: detectLanguage(), poseModel: suggestVariant() }
      : stored;
    if (first) await saveSettings(settings);
    set({ ...settings, loaded: true });
    if (settings.keepTracks) await pruneTracks(settings.trackRetentionDays);
    else await pruneTracks(0);
  },

  update: async (patch) => {
    const next = await saveSettings(patch);
    set(next);
  },

  setLanguage: async (language) => {
    await get().update({ language });
  },

  setActiveProfile: async (activeProfileId) => {
    await get().update({ activeProfileId });
  },

  /**
   * Re-read the settings row without the first-run side effects.
   *
   * `createProfile` writes `activeProfileId` straight to the database, so the
   * store's copy is stale until the next full load — and a screen that decides
   * anything from it then decides it wrongly. Anything that writes settings
   * behind the store's back calls this.
   */
  refresh: async () => {
    set(await getSettings());
  },
}));
