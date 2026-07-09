import { Icon, type IconName } from "./Icon.tsx";

interface ComingSoonProps {
  icon: IconName;
  title: string;
  blurb: string;
}

export function ComingSoon({ icon, title, blurb }: ComingSoonProps) {
  return (
    <div
      class="flex flex-col items-center text-center gap-4"
      style={{ padding: "48px 28px" }}
    >
      <div
        class="grid place-items-center bg-primary-container text-on-primary-container"
        style={{
          width: 88,
          height: 88,
          borderRadius: "var(--md-shape-xl)",
        }}
      >
        <Icon name={icon} size={44} />
      </div>
      <div class="md-headline-small text-on-surface">{title}</div>
      <div
        class="md-body-medium text-on-surface-variant"
        style={{ maxWidth: 280 }}
      >
        {blurb}
      </div>
      <span
        class="md-label-large text-on-tertiary-container bg-tertiary-container rounded-[var(--md-shape-full)]"
        style={{ padding: "8px 16px", marginTop: 4 }}
      >
        Coming soon
      </span>
    </div>
  );
}
