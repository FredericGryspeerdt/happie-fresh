// components/md3/ListItem.tsx
import type { ComponentChildren } from "preact";
import { Pressable } from "./Pressable.tsx";
import { cn } from "./tokens.ts";

interface ListItemProps {
  leading?: ComponentChildren;
  headline: ComponentChildren;
  supporting?: ComponentChildren;
  trailing?: ComponentChildren;
  onClick?: (e: Event) => void;
  class?: string;
}

export function ListItem(
  { leading, headline, supporting, trailing, onClick, class: cls }:
    ListItemProps,
) {
  const body = (
    <div class="flex items-center gap-4 px-4 py-2.5 min-h-14 relative">
      {leading && (
        <div class="shrink-0 grid place-items-center text-on-surface-variant">
          {leading}
        </div>
      )}
      <div class="flex-1 min-w-0">
        <div class="md-body-large text-on-surface overflow-hidden text-ellipsis whitespace-nowrap">
          {headline}
        </div>
        {supporting && (
          <div class="md-body-medium text-on-surface-variant overflow-hidden text-ellipsis whitespace-nowrap">
            {supporting}
          </div>
        )}
      </div>
      {trailing && (
        <div class="shrink-0 text-on-surface-variant">{trailing}</div>
      )}
    </div>
  );
  if (onClick) {
    return (
      <Pressable
        as="div"
        onClick={onClick}
        class={cn("block w-full text-left text-on-surface", cls)}
      >
        {body}
      </Pressable>
    );
  }
  return <div class={cls}>{body}</div>;
}
