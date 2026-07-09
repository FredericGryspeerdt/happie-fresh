import { signal } from "@preact/signals";
import type { IconName } from "@/components/md3/Icon.tsx";

/**
 * A page-provided trailing action for the shell's TopAppBar (e.g. the list-detail
 * "list options" overflow). The active page's island sets this on mount and clears
 * it on unmount; the shell (AppChrome) renders it next to the title.
 *
 * This is a module-scope signal — a single instance shared across islands via the
 * client runtime — which is the intended cross-island state pattern (safe at module
 * scope; never call `signal()` inside a component body).
 */
export const appBarAction = signal<
  { icon: IconName; label: string; onClick: () => void } | null
>(null);
