/**
 * Whether a professional has been through the numbers.
 *
 * The library's ranges are defaults and every screen that shows one says so.
 * This is the other half of that sentence: it says, wherever a routine is
 * shown, whether somebody qualified has replaced them.
 */

import type { JSX } from 'react';
import type { RoutineReview } from '../db/schema.js';
import { useTranslation } from '../i18n/useTranslation.js';
import { CheckIcon } from './icons.js';

export interface ReviewStampProps {
  review: RoutineReview | undefined;
  className?: string;
}

export function ReviewStamp({ review, className }: ReviewStampProps): JSX.Element {
  const { t, language } = useTranslation();
  if (!review) {
    return <p className={`text-sm text-muted ${className ?? ''}`}>{t('review.notReviewed')}</p>;
  }
  return (
    <p className={`flex items-center gap-1.5 text-sm text-band ${className ?? ''}`}>
      <CheckIcon size={16} />
      {t('review.signedBy', {
        name: review.by,
        date: new Date(review.at).toLocaleDateString(language, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      })}
    </p>
  );
}
