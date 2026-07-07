import type { ComponentChildren } from "preact";
import { Icon } from "@/components/md3/Icon.tsx";

interface TopAppBarProps {
  title: string;
  backUrl?: string;
  trailing?: ComponentChildren;
}

export default function TopAppBar(
  { title, backUrl, trailing }: TopAppBarProps,
) {
  return (
    <header
      class="bg-surface"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div class="flex items-center gap-1 px-1" style={{ height: 56 }}>
        {backUrl && (
          <a
            href={backUrl}
            aria-label="Back"
            class="md-press grid place-items-center text-on-surface-variant rounded-full"
            style={{ width: 40, height: 40 }}
          >
            <span class="md-state" />
            <Icon name="back" size={22} />
          </a>
        )}
        <div
          class={`flex-1 min-w-0 md-brand text-on-surface overflow-hidden text-ellipsis whitespace-nowrap ${
            backUrl ? "" : "ml-3"
          }`}
          style={{ fontSize: 22, lineHeight: "28px" }}
        >
          {title}
        </div>
        <div class="flex items-center gap-0.5">{trailing}</div>
      </div>
    </header>
  );
}
