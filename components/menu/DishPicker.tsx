import { useSignal } from "@preact/signals";
import { useMemo } from "preact/hooks";
import type { DishInterface } from "@/models/index.ts";
import type { useWeeklyMenu } from "@/hooks/useWeeklyMenu.ts";
import { useSearchBox } from "@/hooks/useSearchBox.ts";
import { FullScreenDialog } from "@/components/md3/FullScreenDialog.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
import { useSnack } from "@/hooks/useSnack.ts";
import { cn } from "@/components/md3/tokens.ts";
import { DestructiveConfirmationDialog } from "@/components/md3/DestructiveConfirmationDialog.tsx";

type Menu = ReturnType<typeof useWeeklyMenu>;

interface Props {
  dishes: DishInterface[];
  menu: Menu;
  onClose: () => void;
}

export function DishPicker({ dishes, menu, onClose }: Props) {
  const sorted = useMemo(
    () => [...dishes].sort((a, b) => a.name.localeCompare(b.name)),
    [dishes],
  );
  const search = useSearchBox(
    sorted,
    (q, dish) => dish.name.toLowerCase().includes(q.toLowerCase()),
  );
  const showPlanned = useSignal(false);
  const error = useSignal<string | null>(null);
  const dishToRemove = useSignal<DishInterface | null>(null);
  const { snack, showSnack, hideSnack } = useSnack(4000);
  const planned = sorted.filter((dish) =>
    menu.plannedDishIds.value.has(dish.id)
  );
  const visible = showPlanned.value ? planned : search.results.value;
  const busy = menu.pendingCount.value > 0;
  const close = () => {
    if (!menu.pendingCount.value) onClose();
  };
  const add = async (dish: DishInterface) => {
    // The menu API returns the whole plan; serialize toggles so an older
    // response cannot overwrite a newer choice (including rapid double taps).
    if (menu.pendingCount.value) return;
    error.value = null;
    hideSnack();
    const ok = await menu.addDish(dish.id);
    if (!ok) {
      error.value = "Couldn't update this week. Try again.";
      showSnack(error.value);
    }
  };

  return (
    <>
      <FullScreenDialog
        open
        title="Choose dishes"
        subtitle="For this week"
        closeIcon="back"
        onClose={close}
        contentClass="px-4 pb-4"
        footer={
          <div>
            <div class="flex items-center justify-between gap-2">
              <p class="md-title-large text-on-surface" aria-live="polite">
                {planned.length} dish{planned.length === 1 ? "" : "es"} planned
              </p>
              {planned.length > 0 && (
                <Button
                  variant="text"
                  onClick={() => (showPlanned.value = !showPlanned.value)}
                >
                  {showPlanned.value ? "Back to results" : "View all"}
                </Button>
              )}
            </div>
            <p
              class="md-body-large text-on-surface-variant line-clamp-2 break-words max-w-[32ch]"
              data-testid="planned-summary"
            >
              {planned.length
                ? planned.slice(0, 4).map((dish) => dish.name).join(" · ")
                : "Choose dishes to plan your week."}
            </p>
            {planned.length > 4 && (
              <p class="md-body-small text-on-surface-variant">
                +{planned.length - 4} more
              </p>
            )}
            <p
              role="status"
              class={cn(
                "md-body-small mt-3 mb-2",
                error.value ? "text-error" : "text-on-surface-variant",
              )}
            >
              {busy
                ? "Saving…"
                : error.value
                ? "Change not saved"
                : "Changes saved"}
            </p>
            <Button full disabled={busy} onClick={close} style={{ height: 48 }}>
              Back to this week
            </Button>
          </div>
        }
      >
        <div class="sticky top-0 bg-surface pt-2 pb-4 z-10">
          {showPlanned.value
            ? (
              <p class="md-title-small py-3 text-on-surface">
                All planned dishes
              </p>
            )
            : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  search.inputRef.current?.blur();
                }}
                class="flex items-center gap-2 bg-surface-chighest rounded-[var(--md-shape-full)] h-12 pl-4 pr-1"
              >
                <Icon name="search" size={22} class="text-on-surface-variant" />
                <input
                  ref={search.inputRef}
                  type="search"
                  enterKeyHint="search"
                  aria-label="Search dishes"
                  placeholder="Search dishes"
                  value={search.query.value}
                  onInput={(e) => (search.query.value = e.currentTarget.value)}
                  class="flex-1 min-w-0 bg-transparent border-0 outline-none md-body-large text-on-surface [&::-webkit-search-cancel-button]:hidden"
                />
                {search.query.value && (
                  <IconButton
                    name="x"
                    aria-label="Clear search"
                    onClick={search.reset}
                    size={48}
                  />
                )}
              </form>
            )}
        </div>
        {search.hasSearchQuery.value && !showPlanned.value && (
          <p
            class="md-body-medium text-on-surface-variant mb-3"
            aria-live="polite"
          >
            {visible.length} dish{visible.length === 1 ? "" : "es"} found
          </p>
        )}
        <div
          class="flex flex-col gap-2"
          aria-label={showPlanned.value ? "Planned dishes" : "Dishes"}
        >
          {visible.map((dish) => {
            const checked = menu.plannedDishIds.value.has(dish.id);
            return (
              <label
                key={dish.id}
                class={cn(
                  "relative flex items-center gap-4 min-h-16 px-4 py-3 rounded-[var(--md-shape-md)] border focus-within:outline-2 focus-within:outline-primary focus-within:outline-offset-2",
                  checked
                    ? "bg-secondary-container border-transparent"
                    : "bg-surface border-outline-variant",
                  busy ? "cursor-wait" : "cursor-pointer",
                )}
              >
                <span class="flex-1 min-w-0 text-on-surface">
                  <span class="md-title-medium break-words">{dish.name}</span>
                  {checked && (
                    <span class="block md-body-medium text-primary">
                      Planned
                    </span>
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  aria-disabled={busy}
                  onChange={(e) => {
                    if (menu.pendingCount.value) {
                      e.currentTarget.checked = menu.plannedDishIds.value.has(
                        dish.id,
                      );
                      return;
                    }
                    if (checked) {
                      e.currentTarget.checked = true;
                      dishToRemove.value = dish;
                    } else void add(dish);
                  }}
                  aria-label={`${dish.name}, planned this week`}
                  class="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  class={cn(
                    "w-7 h-7 shrink-0 rounded-[var(--md-shape-xs)] grid place-items-center",
                    checked
                      ? "bg-primary text-on-primary"
                      : "border-2 border-outline",
                  )}
                >
                  {checked && <Icon name="check" size={22} />}
                </span>
              </label>
            );
          })}
          {visible.length === 0 && (
            <p class="md-body-large text-on-surface-variant py-6 text-center">
              {showPlanned.value
                ? "No dishes planned yet"
                : dishes.length === 0
                ? "Your catalogue has no dishes yet."
                : "No dishes match your search"}
            </p>
          )}
        </div>
        {/* The summary toggle remains available after removing the last dish. */}
        {showPlanned.value && planned.length === 0 && (
          <Button variant="text" onClick={() => (showPlanned.value = false)}>
            Back to results
          </Button>
        )}
        <Snackbar data={snack.value} />
      </FullScreenDialog>
      <DestructiveConfirmationDialog
        open={dishToRemove.value !== null}
        headline="Remove from this week?"
        supportingText={`“${
          dishToRemove.value?.name ?? "This dish"
        }” will stay in your dishes.`}
        confirmLabel="Remove dish"
        pending={busy}
        onClose={() => (dishToRemove.value = null)}
        onConfirm={async () => {
          const dish = dishToRemove.value;
          if (!dish || menu.pendingCount.value) return;
          error.value = null;
          hideSnack();
          const ok = await menu.removeDishFromPlan(dish.id);
          dishToRemove.value = null;
          if (!ok) {
            error.value = "Couldn't update this week. Try again.";
            showSnack(error.value);
          }
        }}
      />
    </>
  );
}
