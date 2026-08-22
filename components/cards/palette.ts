/**
 * Preset accent colours for loyalty-card tiles. Cards store the `key`; the tile
 * and present view read `bg`/`fg` from here. Decorative only — deliberately not
 * tied to the MD3 token scheme so cards stay visually distinct from app chrome.
 */
export interface CardColor {
  key: string;
  bg: string;
  fg: string;
}

export const CARD_COLORS: CardColor[] = [
  { key: "teal", bg: "#0F766E", fg: "#FFFFFF" },
  { key: "indigo", bg: "#4338CA", fg: "#FFFFFF" },
  { key: "rose", bg: "#BE123C", fg: "#FFFFFF" },
  { key: "amber", bg: "#B45309", fg: "#FFFFFF" },
  { key: "green", bg: "#15803D", fg: "#FFFFFF" },
  { key: "slate", bg: "#334155", fg: "#FFFFFF" },
];

export const DEFAULT_CARD_COLOR = CARD_COLORS[0].key;

/** Resolve a stored colour key to its swatch, falling back to the default. */
export function resolveColor(key?: string): CardColor {
  return CARD_COLORS.find((c) => c.key === key) ?? CARD_COLORS[0];
}

/** Pick a rotating default so a fresh card differs from the previous one. */
export function nextColor(index: number): string {
  return CARD_COLORS[index % CARD_COLORS.length].key;
}
