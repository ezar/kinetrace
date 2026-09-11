/**
 * The angle gauge.
 *
 * The key data visualisation of the session screen: whether you are inside the
 * physiotherapist's range has to be readable from across the room, so the band
 * is a thick arc, the marker is heavy, and the dial fills the moment the value
 * lands inside. Colour alone never carries it — the marker's position does too,
 * and the number beside the gauge repeats it.
 */

import type { JSX } from 'react';
import type { TargetBand } from '@kinetrace/engine';
import { useTranslation } from '../i18n/useTranslation.js';

export interface AngleGaugeProps {
  /** Current value of the tracked metric, in degrees. */
  value: number;
  band: TargetBand;
  /** Range the gauge spans, in degrees. */
  min: number;
  max: number;
  /** Safety range; outside it the gauge turns to the safety colour. */
  safety?: TargetBand;
  /** Far mode uses the lightened palette and heavier strokes. */
  far?: boolean;
  /** Print the value inside the dial. Off when it is shown beside the gauge. */
  showValue?: boolean;
  className?: string;
  label?: string;
}

const START_ANGLE = 150;
const SWEEP = 240;

const PALETTE = {
  normal: {
    track: '#e3ded6',
    band: '#2c7a58',
    bandFill: '#e0f0e8',
    safetyFill: '#fbe6e3',
    marker: '#1b1a18',
    inBand: '#2c7a58',
    unsafe: '#b3352a',
    markerRing: '#ffffff',
  },
  far: {
    track: '#3a3733',
    band: '#58cf9a',
    bandFill: '#17402f',
    safetyFill: '#4a1a15',
    marker: '#f7f5f2',
    inBand: '#58cf9a',
    unsafe: '#ff6b5c',
    markerRing: '#121110',
  },
} as const;

function polar(cx: number, cy: number, radius: number, degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
}

function arcPath(cx: number, cy: number, radius: number, from: number, to: number): string {
  const [x1, y1] = polar(cx, cy, radius, from);
  const [x2, y2] = polar(cx, cy, radius, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function AngleGauge({
  value,
  band,
  min,
  max,
  safety,
  far = false,
  showValue = false,
  className,
  label,
}: AngleGaugeProps): JSX.Element {
  const { t } = useTranslation();
  const colours = far ? PALETTE.far : PALETTE.normal;
  const span = Math.max(max - min, 1);
  const toAngle = (input: number): number =>
    START_ANGLE + (Math.min(max, Math.max(min, input)) - min) * (SWEEP / span);

  const hasValue = Number.isFinite(value);
  const inBand = hasValue && value >= band.min && value <= band.max;
  const unsafe = hasValue && safety ? value < safety.min || value > safety.max : false;
  const markerColour = unsafe ? colours.unsafe : inBand ? colours.inBand : colours.marker;

  const cx = 50;
  const cy = 50;
  const radius = 38;
  const track = far ? 13 : 10;

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`${label ?? t('a11y.angle')}: ${hasValue ? Math.round(value) : '—'}`}
    >
      {/* The dial fills when the value is where it should be: the change is
          visible before the marker's position can be read. */}
      {unsafe || inBand ? (
        <circle
          cx={cx}
          cy={cy}
          r={radius - track / 2 - 1}
          fill={unsafe ? colours.safetyFill : colours.bandFill}
        />
      ) : null}

      <path
        d={arcPath(cx, cy, radius, START_ANGLE, START_ANGLE + SWEEP)}
        fill="none"
        stroke={colours.track}
        strokeWidth={track}
        strokeLinecap="round"
      />
      <path
        d={arcPath(cx, cy, radius, toAngle(band.min), toAngle(band.max))}
        fill="none"
        stroke={colours.band}
        strokeWidth={track}
      />

      {/* The marker sits on top of the band it is being judged against, so it
          carries a ring in the dial's own background to stay visible. */}
      {hasValue ? (
        <circle
          {...(() => {
            const [x, y] = polar(cx, cy, radius, toAngle(value));
            return { cx: x, cy: y };
          })()}
          r={far ? 8 : 6}
          fill={markerColour}
          stroke={colours.markerRing}
          strokeWidth={far ? 3 : 2.5}
        />
      ) : null}

      {showValue ? (
        <text
          x={cx}
          y={cy + (far ? 9 : 8)}
          textAnchor="middle"
          fontSize={far ? 26 : 24}
          fontWeight="800"
          fill={markerColour}
        >
          {hasValue ? `${Math.round(value)}°` : '—'}
        </text>
      ) : null}
    </svg>
  );
}
