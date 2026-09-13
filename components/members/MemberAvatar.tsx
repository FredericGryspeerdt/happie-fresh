import { resolveAvatarColor } from "@/models/index.ts";

interface MemberAvatarProps {
  color?: string;
  emoji: string;
  size?: number;
}

/** A member's face in the UI: preset colour circle + emoji. Decorative —
 *  always pair it with the member's name for screen readers. */
export function MemberAvatar(
  { color, emoji, size = 40 }: MemberAvatarProps,
) {
  const swatch = resolveAvatarColor(color);
  return (
    <span
      aria-hidden="true"
      class="grid place-items-center rounded-full select-none shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: swatch.bg,
        fontSize: Math.round(size * 0.55),
        lineHeight: 1,
      }}
    >
      {emoji}
    </span>
  );
}
