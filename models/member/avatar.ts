/**
 * Preset avatars for members: a colour + an emoji, no uploads. Deliberately
 * data-light and kid-friendly; deliberately not tied to MD3 tokens so members
 * stay visually distinct from app chrome.
 */
export interface AvatarColor {
  key: string;
  bg: string;
  fg: string;
}

export const AVATAR_COLORS: AvatarColor[] = [
  { key: "coral", bg: "#E76F51", fg: "#FFFFFF" },
  { key: "sunshine", bg: "#F2B705", fg: "#5C4500" },
  { key: "meadow", bg: "#2A9D8F", fg: "#FFFFFF" },
  { key: "sky", bg: "#3D7DD8", fg: "#FFFFFF" },
  { key: "lavender", bg: "#8367C7", fg: "#FFFFFF" },
  { key: "flamingo", bg: "#E05780", fg: "#FFFFFF" },
  { key: "mint", bg: "#7BC950", fg: "#1F3D0C" },
  { key: "slate", bg: "#52616B", fg: "#FFFFFF" },
];

export const DEFAULT_AVATAR_COLOR = "sky";

export const AVATAR_EMOJIS = [
  "🙂",
  "🦊",
  "🐸",
  "🐼",
  "🦄",
  "🐙",
  "🦖",
  "🐝",
  "🌻",
  "⭐",
  "🍀",
  "🚀",
  "⚽",
  "🎨",
  "🎸",
  "🧢",
];

export const DEFAULT_AVATAR_EMOJI = "🙂";

/** Resolve a stored colour key to its swatch, falling back to the default. */
export function resolveAvatarColor(key?: string): AvatarColor {
  return AVATAR_COLORS.find((c) => c.key === key) ??
    AVATAR_COLORS.find((c) => c.key === DEFAULT_AVATAR_COLOR)!;
}

/** True when `key` names a preset colour (server-side validation). */
export function isAvatarColor(key: unknown): key is string {
  return typeof key === "string" && AVATAR_COLORS.some((c) => c.key === key);
}
