import { Pressable } from "@/components/md3/Pressable.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { formatDueAt, isOverdue } from "@/utils/todo-due.ts";

interface Props {
  dueAt: string | null;
  /** Passed in rather than read here so SSR and the island agree on one clock. */
  now: Date;
  onClick: () => void;
}

/**
 * A to-do's due moment, and the control for changing it.
 *
 * Overdue is marked with error colour on text and outline — never a filled
 * badge. `bg-error` is this codebase's destructive-action colour (the Delete
 * buttons), so filling a chip with it would both dilute that meaning and turn a
 * screen of overdue to-dos into a wall of red. The section header does the
 * structural shouting; the chip only has to be unmistakable once you look at it.
 */
export default function DueChip({ dueAt, now, onClick }: Props) {
  const overdue = isOverdue(dueAt, now);
  const textTone = overdue ? "text-error" : "text-on-surface-variant";
  const borderTone = overdue ? "border-error" : "border-outline-variant";

  return (
    <Pressable
      onClick={onClick}
      aria-label={dueAt ? "Change due date" : "Add a due date"}
      // The visible pill (the inner span below) stays exactly its previous
      // size — the padding here is invisible: no border, no background, just
      // room around it. It only grows the *tap target* to a real ≥44px
      // effective height; it sits beside a checkbox and a full-row tap
      // target, so 26px of visible chip alone would be an easy mis-tap.
      class={`inline-flex items-center self-start rounded-[var(--md-shape-full)] py-2.5 ${textTone}`}
    >
      <span
        class={`inline-flex items-center gap-1 border rounded-[var(--md-shape-full)] py-1 px-2 md-label-medium ${textTone} ${borderTone}`}
      >
        {dueAt
          ? (
            <>
              <Icon name="calendar" size={13} />
              {formatDueAt(dueAt, now)}
            </>
          )
          : (
            <>
              <Icon name="plus" size={13} />
              due
            </>
          )}
      </span>
    </Pressable>
  );
}
