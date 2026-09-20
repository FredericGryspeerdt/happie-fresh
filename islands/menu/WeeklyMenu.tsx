import { useSignal } from "@preact/signals";
import { useMemo } from "preact/hooks";
import type {
  CategoryInterface,
  DishInterface,
  DishTagGroupInterface,
  ItemInterface,
  Weekday,
  WeeklyMenuInterface,
} from "@/models/index.ts";
import { WEEKDAY_ORDER } from "@/models/index.ts";
import { useWeeklyMenu as createWeeklyMenu } from "@/hooks/useWeeklyMenu.ts";
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
import { Card } from "@/components/md3/Card.tsx";
import { Chip } from "@/components/md3/Chip.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
import { useSnack } from "@/hooks/useSnack.ts";
import { useMenuShopping as createMenuShopping } from "@/hooks/useMenuShopping.ts";
import { ShoppingListPickerDialog } from "@/components/menu/ShoppingListPickerDialog.tsx";
import { IngredientPreviewDialog } from "@/components/menu/IngredientPreviewDialog.tsx";
import { ChooseShoppingDishesDialog } from "@/components/menu/ChooseShoppingDishesDialog.tsx";
import { navigateTo } from "@/utils/loading.ts";
import { DishPicker } from "@/components/menu/DishPicker.tsx";
import { DestructiveConfirmationDialog } from "@/components/md3/DestructiveConfirmationDialog.tsx";

interface Props {
  initialCategories?: CategoryInterface[];
  initialMenu: WeeklyMenuInterface;
  initialDishes: DishInterface[];
  initialTagGroups: DishTagGroupInterface[];
  initialItems: ItemInterface[];
}

export default function WeeklyMenu(
  {
    initialMenu,
    initialDishes,
    initialTagGroups,
    initialItems,
    initialCategories = [],
  }: Props,
) {
  const weeklyMenu = useMemo(() => createWeeklyMenu(initialMenu), []);
  const pickerOpen = useSignal(false);
  const {
    menu,
    sortedEntries,
    setDay,
    removeEntry,
    clear,
    restoreEntries,
    refresh,
  } = weeklyMenu;

  const shopping = useMemo(
    () => createMenuShopping(menu, initialDishes, initialItems),
    [],
  );

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
  const entryToRemove = useSignal<string | null>(null);
  const clearOpen = useSignal(false);
  const entryRemovalPending = useSignal(false);
  const clearWeekPending = useSignal(false);
  const { snack, showSnack: showWithMs } = useSnack();
  // Every snack here lives 4s, Undo affordances included. The per-call override
  // is load-bearing: `useSnack(4000)` alone would not pin them, because the
  // action leg ignores defaultMs and would stretch Undo snacks to 10s.
  const showSnack = (
    msg: string,
    action?: string,
    onAction?: () => void,
  ) => showWithMs(msg, action, onAction, 4000);

  // Undo for Clear: re-add each dish, then re-apply its weekday pin. The snack
  // (and its Undo action) only appears once Clear has settled, so Undo can
  // never race an in-flight wipe.
  const onClear = async () => {
    const prev = menu.value.entries;
    clearWeekPending.value = true;
    try {
      const ok = await clear();
      clearOpen.value = false;
      ok
        ? showSnack(
          "Cleared this week",
          "Undo",
          () => void restoreEntries(prev),
        )
        : showSnack("Couldn't clear this week");
    } finally {
      clearWeekPending.value = false;
    }
  };

  // Pessimistic bulk write; the preview stays open on failure so nothing is
  // lost (patterns doc §1/§3).
  const onConfirmShopping = () => {
    void shopping.confirm().then((out) => {
      if (!out) return; // The review shows the recoverable error beside Retry.
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
    if (pickerOpen.value || weeklyMenu.pendingCount.value > 0) return;
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
    <PullToRefresh
      onRefresh={refresh}
      disabled={pickerOpen.value || shopping.step.value !== "idle" ||
        shopping.loading.value}
    >
      <div class="pb-[calc(168px+env(safe-area-inset-bottom))]">
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
              onClick={() => (clearOpen.value = true)}
              disabled={shopping.loading.value ||
                weeklyMenu.pendingCount.value > 0}
              class="md-label-large text-on-surface-variant px-2 py-1 rounded-[var(--md-shape-full)]"
            >
              Clear
            </Pressable>
          )}
        </div>

        {entries.length > 0 && (
          <div class="px-4 pt-3">
            <Button
              variant="outlined"
              icon="plus"
              disabled={shopping.loading.value}
              onClick={() => (pickerOpen.value = true)}
            >
              Add dishes
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
                disabled={shopping.loading.value}
                onClick={() => (pickerOpen.value = true)}
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
                        onClick={() => (entryToRemove.value = e.id)}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
      </div>

      {entries.length > 0 && (
        <div class="fixed inset-x-0 z-20 bottom-[calc(80px+env(safe-area-inset-bottom))] bg-surface border-t border-outline-variant">
          <div class="max-w-md mx-auto px-4 py-3">
            <Button
              full
              icon="cart"
              disabled={weeklyMenu.pendingCount.value > 0}
              loading={shopping.loading.value && shopping.step.value === "idle"}
              onClick={onStartShopping}
              style={{
                minHeight: 48,
                height: "auto",
                whiteSpace: "normal",
                paddingTop: 8,
                paddingBottom: 8,
              }}
            >
              Add ingredients to a shopping list
            </Button>
          </div>
        </div>
      )}

      {pickerOpen.value && (
        <DishPicker
          dishes={initialDishes}
          menu={weeklyMenu}
          onClose={() => (pickerOpen.value = false)}
        />
      )}

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

      <ChooseShoppingDishesDialog
        open={shopping.step.value === "dishes"}
        dishes={shopping.plannedDishes.value}
        selected={shopping.selectedDishes.value}
        busy={shopping.loading.value}
        onToggle={shopping.toggleDish}
        onContinue={() =>
          void shopping.review().then((ok) => {
            if (!ok) showSnack("Couldn't load ingredients — try again");
          })}
        onClose={shopping.cancel}
      />
      <IngredientPreviewDialog
        open={shopping.reviewOpen.value}
        listName={shopping.chosenList.value?.name ?? ""}
        dishCount={shopping.selectedDishes.value.size}
        categories={initialCategories}
        items={initialItems}
        amounts={shopping.reviewAmounts.value}
        onAmount={shopping.setAmount}
        onBack={shopping.back}
        canChangeList
        onChangeList={shopping.changeList}
        rows={shopping.rows.value}
        isSelected={shopping.isSelected}
        emptyDishes={shopping.emptyDishes.value}
        selectedCount={shopping.selectedCount.value}
        adding={shopping.adding.value}
        draftLocked={shopping.draftLocked.value}
        retrying={shopping.retrying.value}
        message={shopping.submissionMessage.value ?? shopping.amountError.value}
        invalidAmount={!!shopping.amountError.value}
        onToggle={shopping.toggle}
        onConfirm={onConfirmShopping}
        onOpenDish={(d) => navigateTo(`/menu/${d.id}`)}
        onClose={shopping.cancel}
      />

      {/* Later in the DOM so the picker overlays the retained review. */}
      <ShoppingListPickerDialog
        open={shopping.step.value === "pick"}
        lists={shopping.lists.value}
        markedListId={shopping.chosenList.value?.id ??
          shopping.rememberedListId.value}
        markedLabel={shopping.chosenList.value
          ? "Current list"
          : "Used last time"}
        busy={shopping.loading.value}
        onPick={(l) =>
          void shopping.chooseList(l).then((ok) => {
            if (!ok) showSnack("Couldn't load ingredients — try again");
          })}
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

      <DestructiveConfirmationDialog
        open={entryToRemove.value !== null}
        headline="Remove from this week?"
        supportingText={`“${
          dishById.get(
            entries.find((entry) => entry.id === entryToRemove.value)?.dishId ??
              "",
          )?.name ?? "This dish"
        }” will stay in your dishes.`}
        confirmLabel="Remove dish"
        pending={entryRemovalPending.value}
        onClose={() => (entryToRemove.value = null)}
        onConfirm={async () => {
          const id = entryToRemove.value;
          if (!id) return;
          entryRemovalPending.value = true;
          try {
            const ok = await removeEntry(id);
            entryToRemove.value = null;
            showSnack(ok ? "Removed from this week" : "Couldn't remove it");
          } finally {
            entryRemovalPending.value = false;
          }
        }}
      />
      <DestructiveConfirmationDialog
        open={clearOpen.value}
        headline="Clear this week?"
        supportingText="Every planned dish will be removed. You can undo this afterwards."
        confirmLabel="Clear week"
        pending={clearWeekPending.value}
        onClose={() => (clearOpen.value = false)}
        onConfirm={onClear}
      />

      <Snackbar data={snack.value} />
    </PullToRefresh>
  );
}
