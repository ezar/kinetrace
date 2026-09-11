/**
 * The cue banner.
 *
 * One line, one cue at a time. Corrections are calm blue, praise is the warm
 * accent, safety stops are red and stay put until the body is safe again.
 */

import type { JSX } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type CueTone = 'praise' | 'correction' | 'safety' | 'info';

export interface CueBannerProps {
  text: string | null;
  tone?: CueTone;
  far?: boolean;
}

const TONE_CLASSES: Record<CueTone, string> = {
  praise: 'bg-accent text-white',
  correction: 'bg-correct text-white',
  safety: 'bg-safety text-white',
  info: 'bg-surface text-ink border border-line',
};

export function CueBanner({ text, tone = 'correction', far = true }: CueBannerProps): JSX.Element {
  return (
    <AnimatePresence mode="wait">
      {text ? (
        <motion.p
          key={text}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="status"
          aria-live="polite"
          className={`${TONE_CLASSES[tone]} ${
            far ? 'text-far-cue px-8 py-5' : 'text-xl px-5 py-3'
          } rounded-xl2 text-center font-medium`}
        >
          {text}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}
