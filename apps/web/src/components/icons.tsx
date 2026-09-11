/**
 * Icon set.
 *
 * Inline SVG on a 24 px grid with a consistent 1.8 stroke, so icons scale and
 * recolour with the text around them. Text glyphs and emoji are not icons: they
 * arrive at whatever weight and baseline the system font feels like.
 */

import type { JSX, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number; active?: boolean };

function Svg({
  size = 24,
  active = false,
  children,
  ...rest
}: IconProps & { children: JSX.Element }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.1 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V20h13V9.5" />
      </>
    </Svg>
  );
}

/** A figure mid-movement: the library is exercises, not a list. */
export function ExercisesIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <>
        <circle cx="12" cy="4.5" r="2" />
        <path d="M12 7v6" />
        <path d="m12 8.5-4 2.5M12 8.5l4 2.5" />
        <path d="m12 13-3 6M12 13l3 6" />
      </>
    </Svg>
  );
}

export function ProgressIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <>
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M22 19H2" />
      </>
    </Svg>
  );
}

export function SettingsIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
      </>
    </Svg>
  );
}

export function PlayIcon({
  size = 24,
  ...rest
}: SVGProps<SVGSVGElement> & { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

export function PauseIcon({
  size = 24,
  ...rest
}: SVGProps<SVGSVGElement> & { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...rest}
    >
      <>
        <rect x="7" y="5" width="3.4" height="14" rx="1.2" />
        <rect x="13.6" y="5" width="3.4" height="14" rx="1.2" />
      </>
    </svg>
  );
}

export function CheckIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="m15 18-6-6 6-6" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function CameraIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <>
        <rect x="3" y="7" width="18" height="12" rx="3" />
        <circle cx="12" cy="13" r="3.2" />
        <path d="M8 7l1.4-2.2h5.2L16 7" />
      </>
    </Svg>
  );
}

export function CameraOffIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <>
        <rect x="3" y="7" width="18" height="12" rx="3" />
        <path d="m4 5 16 15" />
      </>
    </Svg>
  );
}

export function EyeOffIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <path d="m4 4 16 16" />
      </>
    </Svg>
  );
}

export function StopIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="14" height="14" rx="3" />
    </Svg>
  );
}

export function ArrowUpIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <>
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </>
    </Svg>
  );
}

export function DragIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M4 8h16M4 16h16" />
    </Svg>
  );
}
