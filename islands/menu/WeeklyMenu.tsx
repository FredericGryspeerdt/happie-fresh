import { useSignal } from "@preact/signals";
import { useEffect, useMemo, useRef } from "preact/hooks";
import type {
  DishInterface,
  DishTagGroupInterface,
  ItemInterface,
  Weekday,
  WeeklyMenuInterface,
} from "@/models/index.ts";
import { WEEKDAY_ORDER } from "@/models/index.ts";
import { useWeeklyMenu } from "@/hooks/useWeeklyMenu.ts";
import { useMenuShopping } from "@/hooks/useMenuShopping.ts";
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
import { Card } from "@/components/md3/Card.tsx";
import { Chip } from "@/components/md3/Chip.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
import { ShoppingListPickerSheet } from "@/components/menu/ShoppingListPickerSheet.tsx";
import { IngredientPreviewSheet } from "@/components/menu/IngredientPreviewSheet.tsx";
import { navigateTo } from "@/utils/loading.ts";

interface Props {
  initialMenu: WeeklyMenuInterface;
  initialDishes: DishInterface[];
  initialTagGroups: DishTagGroupInterface[];
  initialItems: ItemInterface[];
}

interface Snack {
  msg: string;
  action?: string;
  onAction?: () => void;
}

export default function WeeklyMenu(
  { initialMenu, initialDishes, initialTagGroups, initialItems }: Props,
) {
  const {
    menu,
    sortedEntries,
    setDay,
    removeEntry,
    clear,
    restoreEntries,
    refresh,
  } = useMemo(() => useWeeklyMenu(initialMenu), []);

  // False positive: react-rules-of-hooks flags this call when the useMemo
  // result is kept as one object instead of destructured (see useWeeklyMenu
  // above, which lints clean only because it destructures). Naming the
  // initializer keeps the ignore comment attached to a stable, short line
  // that deno fmt won't rewrap.
  // deno-lint-ignore react-rules-of-hooks
  const initShopping = () => useMenuShopping(menu, initialDishes, initialItems);
  const shopping = useMemo(initShopping, []);

  const dishById = useMemo(() => {
    const m = new Map<string, DishInterface>();
    for (const d of initialDishes) m.set(d.id, d);
    return m;
  }, []);
  const tagLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of initialTagGroups) {
      for (const v of g.values) m.set(v.id, v.label);
    }
    return m;
  }, []);

  const dayPickEntryId = useSignal<string | null>(null);
  const snack = useSignal<Snack | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSnack = (msg: string, action?: string, onAction?: () => void) => {
    snack.value = { msg, action, onAction };
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => (snack.value = null), 4000);
  };
  useEffect(() => () => {
    if (snackTimer.current) clearTimeout(snackTimer.current);
  }, []);

  // Undo for Clear: re-add each dish, then re-apply its weekday pin. The snack
  // (and its Undo action) only appears once Clear has settled, so Undo can
  // never race an in-flight wipe.
  const onClear = () => {
    const prev = menu.value.entries;
    void clear().then((ok) =>
      ok
        ? showSnack(
          "Cleared this week",
          "Undo",
          () => void restoreEntries(prev),
        )
        : showSnack("Couldn't clear this week")
    );
  };

  // Pessimistic bulk write; the preview stays open on failure so nothing is
  // lost (patterns doc §1/§3).
  const onConfirmShopping = () => {
    void shopping.confirm().then((out) => {
      if (!out) return showSnack("Couldn't add to the list — try again");
      if (out.count === 0) {
        return showSnack("Everything was already on the list");
      }
      showSnack(
        `Added ${out.count} to ${out.list.name}`,
        "Open list",
        () => navigateTo(`/shopping/${out.list.id}`),
      );
    }).catch(() => showSnack("Couldn't add to the list — try again"));
  };

  const onStartShopping = () => {
    void shopping.start().then((ok) => {
      if (!ok) showSnack("Couldn't load your lists — try again");
    }).catch(() => showSnack("Couldn't load your lists — try again"));
  };

  const tagsFor = (dish?: DishInterface) =>
    dish
      ? dish.tagValueIds
        .map((id) => tagLabelById.get(id))
        .filter((l): l is string => !!l)
      : [];

  const pickDay = (day: Weekday | null) => {
    const id = dayPickEntryId.value;
    if (id) setDay(id, day);
    dayPickEntryId.value = null;
  };

  const entries = sortedEntries.value;
  const currentDay = entries.find((e) => e.id === dayPickEntryId.value)?.day ??
    null;

  return (
    <PullToRefresh onRefresh={refresh}>
      <div class="pb-[calc(96px+env(safe-area-inset-bottom))]">
        {/* header */}
        <div class="flex items-center justify-between px-4 pt-4">
          <div>
            <div class="md-title-medium text-on-surface">This week</div>
            <div class="md-body-small text-on-surface-variant">
              {entries.length === 0
                ? "Nothing planned yet"
                : `${entries.length} dish${
                  entries.length === 1 ? "" : "es"
                } planned`}
            </div>
          </div>
          {entries.length > 0 && (
            <Pressable
              onClick={onClear}
              class="md-label-large text-on-surface-variant px-2 py-1 rounded-[var(--md-shape-full)]"
            >
              Clear
            </Pressable>
          )}
        </div>

        {entries.length > 0 && (
          <div class="px-4 pt-3">
            <Button
              full
              icon="cart"
              loading={shopping.loading.value &&
                shopping.step.value === "idle"}
              onClick={onStartShopping}
            >
              Add to shopping list
            </Button>
          </div>
        )}

        {entries.length === 0
          ? (
            <div class="px-6 pt-10 flex flex-col items-center text-center gap-4">
              <div
                class="grid place-items-center rounded-[var(--md-shape-xl)] bg-primary-container text-on-primary-container"
                style={{ width: 80, height: 80 }}
              >
                <Icon name="plate" size={40} />
              </div>
              <div>
                <div class="md-title-medium text-on-surface">No dishes yet</div>
                <div class="md-body-medium text-on-surface-variant mt-1">
                  Pick dishes from your catalogue to plan the week.
                </div>
              </div>
              <Button
                variant="filled"
                icon="plus"
                onClick={() => navigateTo("/menu/dishes")}
              >
                Add dishes
              </Button>
            </div>
          )
          : (
            <div class="px-4 pt-3 flex flex-col gap-2.5">
              {entries.map((e) => {
                const dish = dishById.get(e.dishId);
                return (
                  <Card key={e.id} variant="filled" radius={16}>
                    <div class="flex items-center gap-3">
                      <Chip
                        selected={!!e.day}
                        leadingCheck={false}
                        icon={e.day ? undefined : "calendar"}
                        onClick={() => (dayPickEntryId.value = e.id)}
                      >
                        {e.day ?? "Any"}
                      </Chip>
                      <div class="flex-1 min-w-0">
                        <div class="md-title-small text-on-surface truncate">
                          {dish?.name ?? "Unknown dish"}
                        </div>
                        {tagsFor(dish).length > 0 && (
                          <div class="flex gap-1.5 flex-wrap mt-1.5">
                            {tagsFor(dish).map((t) => (
                              <span
                                key={t}
                                class="md-label-medium inline-flex items-center rounded-[var(--md-shape-full)] bg-surface-chighest text-on-surface-variant px-2.5 py-0.5"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <IconButton
                        name="x"
                        aria-label={`Remove ${
                          dish?.name ?? "dish"
                        } from this week`}
                        onClick={() => {
                          void removeEntry(e.id).then((ok) =>
                            ok
                              ? showSnack("Removed from this week")
                              : showSnack("Couldn't remove it")
                          );
                        }}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
      </div>

      {/* day picker */}
      <Sheet
        open={dayPickEntryId.value !== null}
        onClose={() => (dayPickEntryId.value = null)}
        title="Pin to a day"
      >
        <div class="flex flex-wrap gap-2 pb-2">
          <Chip selected={currentDay === null} onClick={() => pickDay(null)}>
            Any day
          </Chip>
          {WEEKDAY_ORDER.map((d) => (
            <Chip
              key={d}
              selected={currentDay === d}
              onClick={() => pickDay(d)}
            >
              {d}
            </Chip>
          ))}
        </div>
      </Sheet>

      <ShoppingListPickerSheet
        open={shopping.step.value === "pick"}
        lists={shopping.lists.value}
        rememberedListId={shopping.rememberedListId.value}
        busy={shopping.loading.value}
        onPick={(l) => void shopping.chooseList(l)}
        onCreate={(name) =>
          shopping.createList(name).then((ok) => {
            if (!ok) showSnack("Couldn't create the list — try again");
            return ok;
          }).catch(() => {
            showSnack("Couldn't create the list — try again");
            return false;
          })}
        onClose={shopping.cancel}
      />
      <IngredientPreviewSheet
        open={shopping.step.value === "preview"}
        listName={shopping.chosenList.value?.name ?? ""}
        rows={shopping.rows.value}
        isSelected={shopping.isSelected}
        emptyDishes={shopping.emptyDishes.value}
        selectedCount={shopping.selectedCount.value}
        adding={shopping.adding.value}
        onToggle={shopping.toggle}
        onConfirm={onConfirmShopping}
        onOpenDish={(d) => navigateTo(`/menu/${d.id}`)}
        onClose={shopping.cancel}
      />

      <Snackbar data={snack.value} />
    </PullToRefresh>
  );
}
