import type { JSX } from 'react';
import type { Profile } from '../db/schema.js';

export function ProfileChip({ profile }: { profile: Profile }): JSX.Element {
  const initials = profile.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className="flex h-11 w-11 items-center justify-center rounded-full text-canvas font-semibold text-white"
      style={{ backgroundColor: profile.color }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
