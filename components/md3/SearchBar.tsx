// components/md3/SearchBar.tsx
import type { ComponentChildren } from "preact";
import { Pressable } from "./Pressable.tsx";
import { Icon } from "./Icon.tsx";
interface SearchBarProps {
  placeholder: string;
  onClick?: (e: Event) => void;
  trailing?: ComponentChildren;
}
export function SearchBar({ placeholder, onClick, trailing }: SearchBarProps) {
  return (
    <Pressable
      as="div"
      onClick={onClick}
      class="flex items-center gap-3.5 h-13 px-4 bg-surface-chigh rounded-[var(--md-shape-full)] w-full text-left"
      style={{ height: 52 }}
    >
      <span class="text-on-surface-variant">
        <Icon name="search" size={22} />
      </span>
      <span class="md-body-large text-on-surface-variant flex-1">
        {placeholder}
      </span>
      {trailing}
    </Pressable>
  );
}
