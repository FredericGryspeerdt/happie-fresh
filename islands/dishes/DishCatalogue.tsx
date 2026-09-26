import { useMemo } from "preact/hooks";
import type {
  DishInterface,
  DishTagGroupInterface,
  WeeklyMenuInterface,
} from "@/models/index.ts";
import { useDishes } from "@/hooks/useDishes.ts";
import { useWeeklyMenu } from "@/hooks/useWeeklyMenu.ts";
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { Button } from "@/components/md3/Button.tsx";
import Fab from "@/islands/shell/Fab.tsx";
import { navigateTo } from "@/utils/loading.ts";
import { useSignal } from "@preact/signals";
import { DestructiveConfirmationDialog } from "@/components/md3/DestructiveConfirmationDialog.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
import { useSnack } from "@/hooks/useSnack.ts";

interface Props {
  initialDishes: DishInterface[];
  initialTagGroups: DishTagGroupInterface[];
  initialMenu?: WeeklyMenuInterface;
}

export async function confirmDishRemoval(
  dishId: string,
  removeDishFromPlan: (id: string) => Promise<boolean>,
  onSuccess: () => void,
  onFailure: (message: string) => void,
): Promise<void> {
  if (await removeDishFromPlan(dishId)) onSuccess();
  else onFailure("Het gerecht verwijderen is niet gelukt — probeer opnieuw");
}

export default function DishCatalogue(
  { initialDishes, initialTagGroups, initialMenu }: Props,
) {
  // useMemo([]) so the hook's signals are created once from SSR props.
  const {
    dishes,
    query,
    filtered,
    refresh,
  } = useMemo(() => useDishes(initialDishes, initialTagGroups), []);

  const { plannedDishIds, addDish, removeDishFromPlan } = useMemo(
    () => useWeeklyMenu(initialMenu ?? { householdId: "", entries: [] }),
    [],
  );
  const planned = plannedDishIds.value;
  const dishToRemove = useSignal<DishInterface | null>(null);
  const dishRemovalPending = useSignal(false);
  const { snack, showSnack } = useSnack();

  const list = filtered.value;

  return (
    <PullToRefresh onRefresh={refresh}>
      <div class="px-4 pt-4 pb-[calc(96px+env(safe-area-inset-bottom))] flex flex-col gap-4">
        {/* search */}
        <div class="flex items-center gap-2 bg-surface-chighest rounded-[var(--md-shape-full)] h-12 pl-4 pr-1.5">
          <Icon name="search" size={20} class="text-on-surface-variant" />
          <input
            value={query.value}
            onInput={(e) => (query.value = e.currentTarget.value)}
            placeholder="Gerechten zoeken"
            aria-label="Gerechten zoeken"
            class="flex-1 min-w-0 bg-transparent border-0 outline-none md-body-large text-on-surface"
          />
          {query.value && (
            <IconButton
              name="x"
              size={36}
              iconSize={18}
              aria-label="Zoekveld wissen"
              onClick={() => (query.value = "")}
            />
          )}
        </div>

        {/* count */}
        <div class="md-body-medium text-on-surface-variant px-1">
          {list.length} {list.length === 1 ? "gerecht" : "gerechten"}
        </div>

        {/* dish grid / empty state */}
        {list.length === 0
          ? (
            <div class="px-2 pt-2 text-center flex flex-col items-center gap-4">
              <div class="md-title-medium text-on-surface">
                {dishes.value.length === 0
                  ? "Nog geen gerechten"
                  : "Geen gerechten gevonden"}
              </div>
              <Button
                variant="tonal"
                icon="plus"
                onClick={() => navigateTo("/menu/new")}
              >
                Een gerecht toevoegen
              </Button>
            </div>
          )
          : (
            <div class="grid grid-cols-2 gap-2.5">
              {list.map((d) => (
                <div
                  key={d.id}
                  class="flex flex-col bg-surface border border-outline-variant rounded-[var(--md-shape-md)] overflow-hidden"
                >
                  <Pressable
                    as="div"
                    onClick={() => navigateTo(`/menu/${d.id}`)}
                    class="flex flex-col gap-1 px-4 py-3.5 text-left"
                  >
                    <span class="md-body-large text-on-surface truncate">
                      {d.name}
                    </span>
                    <span class="md-body-small text-on-surface-variant truncate">
                      {d.ingredientIds.length} {d.ingredientIds.length === 1
                        ? "ingrediënt"
                        : "ingrediënten"}
                    </span>
                  </Pressable>
                  <div class="px-4 pb-3">
                    {planned.has(d.id)
                      ? (
                        <Button
                          variant="tonal"
                          icon="check"
                          full
                          onClick={() => (dishToRemove.value = d)}
                        >
                          Toegevoegd
                        </Button>
                      )
                      : (
                        <Button
                          variant="outlined"
                          icon="plus"
                          full
                          onClick={() => addDish(d.id)}
                        >
                          Toevoegen
                        </Button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
      <DestructiveConfirmationDialog
        open={dishToRemove.value !== null}
        headline="Uit deze week verwijderen?"
        supportingText={`“${
          dishToRemove.value?.name ?? "Dit gerecht"
        }” blijft bij je gerechten staan.`}
        confirmLabel="Gerecht verwijderen"
        pending={dishRemovalPending.value}
        onClose={() => (dishToRemove.value = null)}
        onConfirm={async () => {
          const dish = dishToRemove.value;
          if (!dish) return;
          dishRemovalPending.value = true;
          try {
            await confirmDishRemoval(
              dish.id,
              removeDishFromPlan,
              () => (dishToRemove.value = null),
              showSnack,
            );
          } finally {
            dishRemovalPending.value = false;
          }
        }}
      />
      <Snackbar data={snack.value} />

      {/* Add-dish FAB — shared component, fixed below the nav chrome */}
      <div
        class="fixed right-4 z-30"
        style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
      >
        <Fab
          icon="plus"
          label="Gerecht toevoegen"
          aria-label="Gerecht toevoegen"
          onClick={() => navigateTo("/menu/new")}
        />
      </div>
    </PullToRefresh>
  );
}
