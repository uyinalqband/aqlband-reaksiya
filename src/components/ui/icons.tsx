import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 4.5v15l13-7.5-13-7.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="M8.3 10.7 15.7 6.6M8.3 13.3l7.4 4.1" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2.06 2.06 0 1 1-2.92 2.92l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56v.17a2.06 2.06 0 1 1-4.12 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2.06 2.06 0 1 1-2.92-2.92l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03h-.17a2.06 2.06 0 1 1 0-4.12h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2.06 2.06 0 1 1 2.92-2.92l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1.03-1.56v-.17a2.06 2.06 0 1 1 4.12 0v.09a1.7 1.7 0 0 0 1.03 1.56h.08a1.7 1.7 0 0 0 1.87-.34l.06-.06a2.06 2.06 0 1 1 2.92 2.92l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.03h.17a2.06 2.06 0 1 1 0 4.12h-.09a1.7 1.7 0 0 0-1.56 1.03Z" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5" />
      <path d="M12 13v3M9 20h6M10 17h4v3h-4v-3Z" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12.5 3 5 13.5h5.5L11 21l7.5-10.5H13L12.5 3Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function RotateIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4v5h5" />
      <path d="M4.6 13.5A8 8 0 1 0 7 6.3L4 9" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12.5 9.5 17 19 7" />
    </svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.4 3.8 8.5s-1.3 6.1-3.8 8.5c-2.5-2.4-3.8-5.4-3.8-8.5s1.3-6.1 3.8-8.5Z" />
    </svg>
  );
}

export function VolumeIcon({ muted, ...props }: IconProps & { muted?: boolean }) {
  return (
    <svg {...base} {...props}>
      <path d="M4 10v4h3.5L12 17.5v-11L7.5 10H4Z" fill="currentColor" stroke="none" />
      {!muted ? (
        <path d="M15.5 9a4.2 4.2 0 0 1 0 6M17.8 6.7a7.8 7.8 0 0 1 0 10.6" />
      ) : (
        <path d="M15.5 9.5 19.5 14.5M19.5 9.5l-4 5" />
      )}
    </svg>
  );
}

export function VibrateIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="8" y="4" width="8" height="16" rx="1.5" />
      <path d="M3 9v6M21 9v6" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12a8 8 0 1 0 2.6-5.9" />
      <path d="M3 4.5V9h4.5" />
      <path d="M12 8v4.5l3 2" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7h12Z" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19c.6-3.2 3.1-5 6.2-5s5.6 1.8 6.2 5" />
      <circle cx="17" cy="8.5" r="2.6" />
      <path d="M15.5 4.2c1.4-.4 2.9.2 3.6 1.5.7 1.3.4 2.9-.7 3.9" />
      <path d="M16.5 14.2c2.4.4 4.1 2 4.6 4.6" />
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2.2" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M5.3 16c.5-1.6 1.7-2.5 3.2-2.5s2.7.9 3.2 2.5" />
      <path d="M14 10h4M14 13.5h4" />
    </svg>
  );
}
