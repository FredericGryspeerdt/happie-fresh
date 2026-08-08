// components/md3/TextField.tsx
import type { ComponentChildren } from "preact";
import { Icon, type IconName } from "./Icon.tsx";
import { cn } from "./tokens.ts";

interface TextFieldProps {
  label?: string;
  value: string;
  onInput: (value: string) => void;
  type?: string;
  name?: string;
  id?: string;
  placeholder?: string;
  /** Helper line under the field; replaced by `error` when set. */
  supporting?: string;
  /** Error message; presence switches the field to its error state. */
  error?: string;
  icon?: IconName;
  trailing?: ComponentChildren;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  inputMode?:
    | "text"
    | "numeric"
    | "decimal"
    | "tel"
    | "email"
    | "url"
    | "search";
  class?: string;
}

/** House-style filled text field: static always-visible label above the
 *  container (kid-friendly — no MD3 floating label), MD3 states otherwise. */
export function TextField(
  {
    label,
    value,
    onInput,
    type = "text",
    name,
    id,
    placeholder,
    supporting,
    error,
    icon,
    trailing,
    disabled,
    multiline,
    rows = 3,
    inputMode,
    class: cls,
  }: TextFieldProps,
) {
  const invalid = Boolean(error);
  const helpId = id && (error || supporting) ? `${id}-help` : undefined;
  const handle = (e: Event) =>
    onInput((e.currentTarget as HTMLInputElement).value);
  const inputCls = cn(
    "flex-1 min-w-0 bg-transparent border-0 outline-none md-body-large",
    disabled
      ? "text-[color-mix(in_srgb,var(--md-on-surface)_38%,transparent)]"
      : "text-on-surface",
  );
  return (
    <div class={cn("flex flex-col", cls)}>
      {label && (
        <label
          for={id}
          class="md-label-medium uppercase tracking-wide text-on-surface-variant px-1 mb-1"
        >
          {label}
        </label>
      )}
      <div
        class={cn(
          "flex items-center gap-2 rounded-[var(--md-shape-sm)] px-4",
          multiline ? "py-3" : "h-12",
          disabled
            ? "bg-[color-mix(in_srgb,var(--md-on-surface)_4%,transparent)]"
            : "bg-surface-chighest",
          invalid
            ? "outline outline-2 -outline-offset-2 outline-[var(--md-error)]"
            : "focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-[var(--md-primary)]",
        )}
      >
        {icon && (
          <span class="shrink-0 text-on-surface-variant">
            <Icon name={icon} size={20} />
          </span>
        )}
        {multiline
          ? (
            <textarea
              id={id}
              name={name}
              rows={rows}
              value={value}
              placeholder={placeholder}
              disabled={disabled}
              aria-invalid={invalid ? "true" : undefined}
              aria-describedby={helpId}
              class={cn(inputCls, "resize-none")}
              onInput={handle}
            />
          )
          : (
            <input
              id={id}
              name={name}
              type={type}
              value={value}
              placeholder={placeholder}
              disabled={disabled}
              inputMode={inputMode}
              aria-invalid={invalid ? "true" : undefined}
              aria-describedby={helpId}
              class={inputCls}
              onInput={handle}
            />
          )}
        {trailing}
      </div>
      {(error || supporting) && (
        <span
          id={helpId}
          class={cn(
            "md-body-small px-1 mt-1",
            error ? "text-error" : "text-on-surface-variant",
          )}
        >
          {error ?? supporting}
        </span>
      )}
    </div>
  );
}
