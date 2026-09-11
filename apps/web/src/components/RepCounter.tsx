/**
 * The repetition counter.
 *
 * Enormous, tabular, and it ticks once per good repetition. Nothing else on the
 * screen moves in far mode.
 */

import type { JSX } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface RepCounterProps {
  value: number;
  total?: number;
  /** Shown under the number, e.g. "set 2 of 3". */
  caption?: string;
  far?: boolean;
}

export function RepCounter({ value, total, caption, far = true }: RepCounterProps): JSX.Element {
  const reduced = useReducedMotion();
  return (
    <div className="flex flex-col items-center">
      <motion.div
        key={value}
        initial={reduced ? false : { scale: 0.88, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        className={far ? 'text-far font-semibold' : 'text-far-sm font-semibold'}
      >
        {value}
      </motion.div>
      {total !== undefined ? (
        <div className={far ? 'text-far-sm opacity-60' : 'text-2xl opacity-60'}>/ {total}</div>
      ) : null}
      {caption ? <div className="mt-2 text-xl opacity-70">{caption}</div> : null}
    </div>
  );
}
