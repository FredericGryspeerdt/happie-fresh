// components/md3/Scrim.tsx
interface ScrimProps {
  open: boolean;
  onClick?: () => void;
}

/** MD3 scrim: 32% black over content behind a modal surface. Positioned
 *  absolute — the parent overlay must establish the containing block. */
export function Scrim({ open, onClick }: ScrimProps) {
  return (
    <div
      onClick={onClick}
      aria-hidden="true"
      class="absolute inset-0"
      style={{
        background: "rgba(0,0,0,.32)",
        opacity: open ? 1 : 0,
        transition: "opacity .3s var(--md-emphasized)",
      }}
    />
  );
}
