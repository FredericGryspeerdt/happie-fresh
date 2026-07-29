import { useMemo } from "preact/hooks";
import type { DishInterface, DishTagGroupInterface } from "@/models/index.ts";
import { useDishes } from "@/hooks/useDishes.ts";
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
import { Chip } from "@/components/md3/Chip.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { Button } from "@/components/md3/Button.tsx";
import Fab from "@/islands/shell/Fab.tsx";
import { navigateTo } from "@/utils/loading.ts";

interface Props {
  initialDishes: DishInterface[];
  initialTagGroups: DishTagGroupInterface[];
}

export default function DishCatalogue(
  { initialDishes, initialTagGroups }: Props,
) {
  // useMemo([]) so the hook's signals are created once from SSR props.
  const {
    dishes,
    tagGroups,
    query,
    selectedTagValueIds,
    filtered,
    toggleTagValue,
    clearFilters,
    refresh,
  } = useMemo(() => useDishes(initialDishes, initialTagGroups), []);

  const groups = tagGroups.value;
  const selected = selectedTagValueIds.value;
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
            placeholder="Search dishes"
            aria-label="Search dishes"
            class="flex-1 min-w-0 bg-transparent border-0 outline-none md-body-large text-on-surface"
          />
          {query.value && (
            <IconButton
              name="x"
              size={36}
              iconSize={18}
              aria-label="Clear search"
              onClick={() => (query.value = "")}
            />
          )}
        </div>

        {/* tag filter rail — one row of chips per dimension */}
        {groups.map((g) => (
          <div key={g.id} class="flex flex-col gap-1.5">
            <div class="md-label-medium uppercase text-on-surface-variant px-1">
              {g.label}
            </div>
            <div class="flex gap-2 overflow-x-auto pr-1">
              {g.values.map((v) => (
                <Chip
                  key={v.id}
                  selected={selected.has(v.id)}
                  leadingCheck={false}
                  onClick={() => toggleTagValue(v.id)}
                >
                  {v.label}
                </Chip>
              ))}
            </div>
          </div>
        ))}
        {selected.size > 0 && (
          <Pressable
            onClick={clearFilters}
            class="self-start md-label-large text-primary px-1"
          >
            Clear filters
          </Pressable>
        )}

        {/* count */}
        <div class="md-body-medium text-on-surface-variant px-1">
          {list.length} dish{list.length === 1 ? "" : "es"}
        </div>

        {/* dish grid / empty state */}
        {list.length === 0
          ? (
            <div class="px-2 pt-2 text-center flex flex-col items-center gap-4">
              <div class="md-title-medium text-on-surface">
                {dishes.value.length === 0
                  ? "No dishes yet"
                  : "No dishes match your filters"}
              </div>
              <Button
                variant="tonal"
                icon="plus"
                onClick={() => navigateTo("/menu/new")}
              >
                Add a dish
              </Button>
            </div>
          )
          : (
            <div class="grid grid-cols-2 gap-2.5">
              {list.map((d) => (
                <Pressable
                  key={d.id}
                  onClick={() => navigateTo(`/menu/${d.id}`)}
                  class="flex flex-col gap-1 bg-surface border border-outline-variant rounded-[var(--md-shape-md)] px-4 py-3.5 text-left"
                >
                  <span class="md-body-large text-on-surface truncate">
                    {d.name}
                  </span>
                  <span class="md-body-small text-on-surface-variant truncate">
                    {d.ingredientIds.length}{" "}
                    ingredient{d.ingredientIds.length ===
                        1
                      ? ""
                      : "s"}
                  </span>
                </Pressable>
              ))}
            </div>
          )}
      </div>

      {/* Add-dish FAB — shared component, fixed below the nav chrome */}
      <div
        class="fixed right-4 z-30"
        style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
      >
        <Fab
          icon="plus"
          label="Add dish"
          aria-label="Add dish"
          onClick={() => navigateTo("/menu/new")}
        />
      </div>
    </PullToRefresh>
  );
}
