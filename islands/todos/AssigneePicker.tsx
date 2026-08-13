import type { MemberInterface } from "@/models/index.ts";
import { MemberAvatar } from "@/components/members/MemberAvatar.tsx";
import { cn } from "@/components/md3/tokens.ts";

interface AssigneePickerProps {
  members: MemberInterface[];
  value: string | null;
  onChange: (memberId: string | null) => void;
}

/**
 * Inline "who's doing it" radio row for the to-do dialogs — deliberately
 * never a nested overlay (spec: no overlay stacks on a dialog). Same
 * plain-button radio-row pattern as the members screen's colour/emoji
 * pickers.
 */
export default function AssigneePicker(
  { members, value, onChange }: AssigneePickerProps,
) {
  const chip = (selected: boolean) =>
    cn(
      "inline-flex items-center gap-2 h-10 rounded-[var(--md-shape-full)] md-label-large border",
      selected
        ? "bg-primary-container text-on-primary-container border-transparent"
        : "text-on-surface border-outline",
    );
  return (
    <div class="flex flex-col gap-2">
      <div class="md-label-medium uppercase text-on-surface-variant px-1">
        Assigned to
      </div>
      <div
        class="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label="Assigned to"
      >
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          onClick={() => onChange(null)}
          class={`px-4 ${chip(value === null)}`}
        >
          No one
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={value === m.id}
            onClick={() => onChange(m.id)}
            class={`pl-1.5 pr-3 ${chip(value === m.id)}`}
          >
            <MemberAvatar color={m.color} emoji={m.emoji} size={28} />
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}
