/** React binding for the dictionaries. */

import { useCallback } from 'react';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { translate, type Language } from './index.js';

export interface Translation {
  t: (key: string, params?: Record<string, string | number>) => string;
  language: Language;
}

export function useTranslation(): Translation {
  const language = useSettingsStore((state) => state.language);
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(language, key, params),
    [language],
  );
  return { t, language };
}
