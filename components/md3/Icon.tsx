// components/md3/Icon.tsx
export type IconName =
  | "home"
  | "cart"
  | "check"
  | "checklist"
  | "plate"
  | "card"
  | "plus"
  | "minus"
  | "bell"
  | "chevron"
  | "back"
  | "search"
  | "dots"
  | "tune"
  | "people"
  | "bolt"
  | "sparkle"
  | "edit"
  | "user"
  | "swap"
  | "cog"
  | "x"
  | "trash"
  | "share"
  | "calendar"
  | "leaf"
  | "flame"
  | "tag"
  | "expand";

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  class?: string;
}

export function Icon({ name, size = 24, stroke = 2, class: cls }: IconProps) {
  const p = {
    fill: "none",
    stroke: "currentColor",
    "stroke-width": stroke,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  } as const;
  const paths: Record<IconName, preact.JSX.Element> = {
    home: (
      <>
        <path d="M4 11.5 12 4l8 7.5" {...p} />
        <path d="M6 10v9.5h12V10" {...p} />
        <path d="M10 19.5V14h4v5.5" {...p} />
      </>
    ),
    cart: (
      <>
        <circle cx="9.5" cy="20" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" />
        <path d="M3 4h2.2l2 11.5h11l1.8-8H6.4" {...p} />
      </>
    ),
    check: (
      <>
        <path d="M5 13l4.5 4.5L19 6.5" {...p} />
      </>
    ),
    checklist: (
      <>
        <path d="M4 7l1.5 1.5L8.5 5" {...p} />
        <path d="M4 16l1.5 1.5L8.5 13.5" {...p} />
        <path d="M12 7h8M12 16h8" {...p} />
      </>
    ),
    plate: (
      <>
        <circle cx="12" cy="12" r="8.2" {...p} />
        <circle cx="12" cy="12" r="3.6" {...p} />
      </>
    ),
    card: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2.4" {...p} />
        <path d="M3 10h18M7 14.5h4" {...p} />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" {...p} />
      </>
    ),
    minus: (
      <>
        <path d="M5 12h14" {...p} />
      </>
    ),
    bell: (
      <>
        <path d="M6 10a6 6 0 0 1 12 0c0 5 1.5 6 1.5 6h-15S6 15 6 10Z" {...p} />
        <path d="M10.2 20a2 2 0 0 0 3.6 0" {...p} />
      </>
    ),
    chevron: (
      <>
        <path d="M9 5l7 7-7 7" {...p} />
      </>
    ),
    back: (
      <>
        <path d="M19 12H5M11 18l-6-6 6-6" {...p} />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6.4" {...p} />
        <path d="m20 20-3.6-3.6" {...p} />
      </>
    ),
    dots: (
      <>
        <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
      </>
    ),
    tune: (
      <>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" {...p} />
        <circle cx="16" cy="7" r="2.2" {...p} />
        <circle cx="8" cy="17" r="2.2" {...p} />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="9" r="3.2" {...p} />
        <path d="M3.5 19c.6-3 2.9-4.5 5.5-4.5S13.9 16 14.5 19" {...p} />
        <path d="M16 6.2A3 3 0 0 1 18 12M17.5 14.6c2 .5 3.4 2 3.9 4.4" {...p} />
      </>
    ),
    bolt: (
      <>
        <path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" {...p} />
      </>
    ),
    sparkle: (
      <>
        <path
          d="M12 4.5 13.5 10 19 11.5 13.5 13 12 18.5 10.5 13 5 11.5 10.5 10Z"
          {...p}
        />
      </>
    ),
    edit: (
      <>
        <path d="M5 19h3l9-9-3-3-9 9Z" {...p} />
        <path d="m14 7 3 3" {...p} />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8.5" r="3.6" {...p} />
        <path d="M5 19.5c1-3.4 3.8-5 7-5s6 1.6 7 5" {...p} />
      </>
    ),
    swap: (
      <>
        <path d="M4 8h13l-3-3M20 16H7l3 3" {...p} />
      </>
    ),
    cog: (
      <>
        <circle cx="12" cy="12" r="3.2" {...p} />
        <path
          d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6 16.6 7.4M7.4 16.6 5.6 18.4M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6"
          {...p}
        />
      </>
    ),
    x: (
      <>
        <path d="M6 6l12 12M18 6 6 18" {...p} />
      </>
    ),
    trash: (
      <>
        <path d="M5 7h14M10 7V5h4v2M6.5 7l1 12.5h9l1-12.5" {...p} />
        <path d="M10 11v5.5M14 11v5.5" {...p} />
      </>
    ),
    share: (
      <>
        <circle cx="6.5" cy="12" r="2.3" {...p} />
        <circle cx="17" cy="6.5" r="2.3" {...p} />
        <circle cx="17" cy="17.5" r="2.3" {...p} />
        <path d="m8.5 10.8 6-3.1M8.5 13.2l6 3.1" {...p} />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5.5" width="16" height="15" rx="2.4" {...p} />
        <path d="M4 9.5h16M8 3.5v4M16 3.5v4" {...p} />
      </>
    ),
    leaf: (
      <>
        <path d="M5 19c0-8 6-13 14-13 0 8-5 14-14 13Z" {...p} />
        <path d="M9 15c2-3 4-4 7-5" {...p} />
      </>
    ),
    flame: (
      <>
        <path
          d="M12 3c4 4 5 7 3 10a3 3 0 1 1-6-1c-2 1-3-2-1-5 1 2 2 1 2-1 0-1 .5-2 2-3Z"
          {...p}
        />
      </>
    ),
    tag: (
      <>
        <path d="M3 11V4h7l11 11-7 7L3 11Z" {...p} />
        <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
      </>
    ),
    expand: (
      <>
        <path
          d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"
          {...p}
        />
      </>
    ),
  } as Record<IconName, preact.JSX.Element>;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      class={cls}
      style={{ display: "block" }}
    >
      {paths[name] ?? null}
    </svg>
  );
}
