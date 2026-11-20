import type { SVGProps } from 'react'

const PATHS = {
  search: <><circle cx="11" cy="11" r="7.5" /><path d="m20.5 20.5-4.2-4.2" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  arrowRight: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  arrowLeft: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
  arrowUp: <><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></>,
  arrowDown: <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>,
  moon: <path d="M20.5 14.1A8.5 8.5 0 1 1 9.9 3.5a7 7 0 0 0 10.6 10.6Z" />,
  dice: <><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="8.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" /></>,
  table: <><rect x="2.5" y="4" width="4" height="4" rx="1" /><rect x="17.5" y="4" width="4" height="4" rx="1" /><rect x="2.5" y="10" width="4" height="4" rx="1" /><rect x="7.5" y="10" width="4" height="4" rx="1" /><rect x="12.5" y="10" width="4" height="4" rx="1" /><rect x="17.5" y="10" width="4" height="4" rx="1" /><path d="M5 18h14" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></>,
  book: <><path d="M2 4.5h6a4 4 0 0 1 4 4V21a3 3 0 0 0-3-3H2z" /><path d="M22 4.5h-6a4 4 0 0 0-4 4V21a3 3 0 0 1 3-3h7z" /></>,
  target: <><circle cx="12" cy="12" r="9.5" /><circle cx="12" cy="12" r="5.5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>,
  flask: <><path d="M9.5 2.5v6.6a2 2 0 0 1-.3 1L4.4 18.6A2 2 0 0 0 6.1 21.5h11.8a2 2 0 0 0 1.7-2.9l-4.8-8.5a2 2 0 0 1-.3-1V2.5" /><path d="M8 2.5h8" /><path d="M6.5 15.5h11" /></>,
  scale: <><path d="M12 3v18" /><path d="M7 21h10" /><path d="M4 7h16" /><path d="m4 7-2.5 6.5a3 3 0 0 0 5 0Z" /><path d="m20 7-2.5 6.5a3 3 0 0 0 5 0Z" /></>,
  star: <path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9Z" />,
  check: <path d="M20 6 9 17l-5-5" />,
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />,
  thermometer: <><path d="M14 4.5v10a4 4 0 1 1-4 0v-10a2 2 0 1 1 4 0Z" /><path d="M12 9v6.5" /></>,
  sparkles: <><path d="M10 14.5 8.5 19l-1.5-4.5L2.5 13 7 11.5 8.5 7l1.5 4.5 4.5 1.5Z" /><path d="M17.5 3v4M15.5 5h4M18.5 15v3M17 16.5h3" /></>,
  rotate: <><path d="M3 12a9 9 0 1 0 2.7-6.4L3 8.2" /><path d="M3 3v5.2h5.2" /></>,
  external: <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.5" /></>,
  bulb: <><path d="M15 14c.2-1 .7-1.7 1.5-2.5A6 6 0 1 0 7.5 11.5c.8.8 1.3 1.5 1.5 2.5" /><path d="M9 18h6M10 21.5h4" /></>,
  atom: <><circle cx="12" cy="12" r="1.6" fill="currentColor" /><ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" /></>,
  calculator: <><rect x="4.5" y="2.5" width="15" height="19" rx="2.5" /><path d="M8 6.5h8" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5v3.5M8.5 18h.01M12 18h.01" /></>,
  info: <><circle cx="12" cy="12" r="9.5" /><path d="M12 16v-4.5M12 8h.01" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  layers: <><path d="m12 2.5 9.5 5-9.5 5-9.5-5Z" /><path d="m2.5 12 9.5 5 9.5-5" /><path d="m2.5 16.5 9.5 5 9.5-5" /></>,
  trophy: <><path d="M7 4h10v5a5 5 0 0 1-10 0Z" /><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /><path d="M12 14v4M8 21h8M9.5 18h5" /></>,
  radiation: <g fill="currentColor" stroke="none"><circle cx="12" cy="12" r="2" />{[0, 120, 240].map(r => <path key={r} transform={`rotate(${r} 12 12)`} d="M10.25 8.97 7.25 3.77a9.5 9.5 0 0 1 9.5 0l-3 5.2a3.5 3.5 0 0 0-3.5 0Z" />)}</g>,
  swap: <><path d="m16 3 4 4-4 4" /><path d="M20 7H4" /><path d="m8 21-4-4 4-4" /><path d="M4 17h16" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  github: <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />,
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 18, strokeWidth = 1.9, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
