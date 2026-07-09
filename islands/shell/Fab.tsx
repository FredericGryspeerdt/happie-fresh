import { Pressable } from "@/components/md3/Pressable.tsx";
import { Icon, type IconName } from "@/components/md3/Icon.tsx";

interface FabProps {
  icon?: IconName;
  label?: string;
  onClick?: () => void;
  "aria-label": string;
}

export default function Fab({
  icon = "plus",
  label,
  onClick,
  ...rest
}: FabProps) {
  return (
    <Pressable
      onClick={onClick}
      aria-label={rest["aria-label"]}
      class="inline-flex items-center justify-center gap-3 bg-primary-container text-on-primary-container md-elevation-3"
      style={{
        height: 56,
        minWidth: 56,
        borderRadius: "var(--md-shape-lg)",
        padding: label ? "0 20px" : 0,
      }}
    >
      <Icon name={icon} size={24} />
      {label && (
        <span class="md-label-large" style={{ fontSize: 15 }}>
          {label}
        </span>
      )}
    </Pressable>
  );
}
