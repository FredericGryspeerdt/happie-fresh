import { useEffect, useMemo } from "preact/hooks";
import { useComputed, useSignal } from "@preact/signals";
import { For } from "@preact/signals/utils";
import {
  CategoryInterface,
  ItemInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import { useSearchBox, useShoppingList } from "@/hooks/index.ts";
import { Icon } from "@/components/md3/Icon.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { Chip } from "@/components/md3/Chip.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { CategoryPickerList } from "@/components/md3/CategoryPickerList.tsx";
import { CatalogueAddRow } from "@/components/md3/CatalogueAddRow.tsx";

interface AddItemsProps {
  listId: string;
  listName: string;
  items: Required<ItemInterface>[];
  shoppingList: ShoppingListItemInterface[];
  categories: CategoryInterface[];
  initialQuery: string;
}

export default function AddItems(
  {
    listId,
    listName,
    items: catalog,
    shoppingList,
    categories: initialCategories,
    initialQuery,
  }: AddItemsProps,
) {
  // Instantiate the signal()-based hook exactly once (see CLAUDE.md).
  const {
    addToList,
    addToCatalog,
    listItemsMap,
    categories,
    items,
    selectedCategoryId,
  } = useMemo(
    () => useShoppingList(listId, catalog, shoppingList, initialCategories),
    [],
  );

  const filterFn = (searchString: string, item: ItemInterface) => {
    if (searchString.trim() === "") return false;
    return !!item?.name?.toLowerCase().includes(searchString.toLowerCase());
  };
  const { query, results, inputRef } = useSearchBox(
    catalog,
    filterFn,
    initialQuery,
  );

  // null = no chip filter; "" = the Uncategorized chip; else a category id.
  const filterCatId = useSignal<string | null>(null);
  const addedCount = useSignal(0);
  // Category-picker sub-view (mirrors the sheet's proven pattern, with room).
  const catPicking = useSignal(false);

  // Autofocus the search field on mount for a quick type-to-search flow.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const handleAdd = async (itemId: string) => {
    const id = await addToList(itemId);
    if (id) addedCount.value++;
  };

  const handleCreate = async (name: string) => {
    const id = await addToCatalog(name, selectedCategoryId.value || undefined);
    if (id) addedCount.value++;
    selectedCategoryId.value = "";
    query.value = "";
    inputRef.current?.focus();
  };

  const q = query.value.trim();
  const selectedCatLabel =
    categories.value.find((c) => c.id === selectedCategoryId.value)?.label ??
      "Uncategorized";

  // Memoized so the large-catalogue hot path (every row, every render) does a
  // Map lookup instead of an O(n) `.find` scan over all categories.
  const catLabelById = useComputed(() =>
    new Map(categories.value.map((c) => [c.id, c.label ?? ""]))
  );

  const chipCats = useComputed(() =>
    [...categories.value].sort((a, b) =>
      (a.label ?? "").toLowerCase().localeCompare(
        (b.label ?? "").toLowerCase(),
      )
    )
  );

  const row = (item: ItemInterface) => (
    <CatalogueAddRow
      key={item.id}
      name={item.name ?? ""}
      categoryLabel={catLabelById.value.get(item.categoryId ?? "") ?? ""}
      added={listItemsMap.value.has(item.id ?? "")}
      onAdd={() => item.id && handleAdd(item.id)}
    />
  );

  const chipRow = (
    <div
      class="flex gap-2 overflow-x-auto px-1 pb-1"
      style={{ scrollbarWidth: "none" }}
    >
      {chipCats.value.map((c) => (
        <Chip
          key={c.id}
          selected={filterCatId.value === c.id}
          onClick={() => {
            filterCatId.value = filterCatId.value === c.id
              ? null
              : (c.id ?? null);
          }}
        >
          {c.label}
        </Chip>
      ))}
      <Chip
        selected={filterCatId.value === ""}
        onClick={() => {
          filterCatId.value = filterCatId.value === "" ? null : "";
        }}
      >
        Uncategorized
      </Chip>
    </div>
  );

  // ── Category-picker sub-view (replaces the body while choosing) ──
  if (catPicking.value) {
    return (
      <div class="flex flex-col gap-2 pb-24">
        <div class="md-title-medium text-on-surface px-1">Choose category</div>
        <CategoryPickerList
          categories={categories.value}
          selectedId={selectedCategoryId.value}
          onSelect={(id) => {
            selectedCategoryId.value = id;
            catPicking.value = false;
          }}
        />
      </div>
    );
  }

  return (
    <div class="flex flex-col gap-3 pb-24">
      {/* Search field */}
      <div class="relative">
        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
          <Icon name="search" size={20} />
        </span>
        <input
          ref={inputRef}
          value={query.value}
          onInput={(e) => {
            query.value = (e.target as HTMLInputElement).value;
            filterCatId.value = null; // typing overrides the chip filter
          }}
          placeholder="Search or add an item…"
          class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-full)] py-3.5 pl-11 pr-4 outline-none"
        />
      </div>

      {/* Running count sub-header */}
      <div class="md-label-medium text-on-surface-variant px-1">
        Adding to {listName}
        {addedCount.value > 0 ? ` · ${addedCount.value} added` : ""}
      </div>

      {(() => {
        // Typing → text search across the whole catalogue.
        if (q) {
          // Intentionally two different predicates: the create card gates on
          // an EXACT (case-insensitive) match, while `results` below comes
          // from useSearchBox's SUBSTRING filter — so both can legitimately
          // show at once (e.g. "Milk" exact-matches while "Milkshake" still
          // shows as a substring result). Do not unify these.
          const exact = items.value.some((i) =>
            i.name?.toLowerCase() === q.toLowerCase()
          );
          return (
            <>
              {!exact && (
                <div class="bg-primary-container text-on-primary-container rounded-[var(--md-shape-lg)] p-3.5 mb-1 flex flex-col gap-3">
                  <div class="flex items-center gap-3.5">
                    <span class="w-9 h-9 rounded-full bg-on-primary-container text-primary-container grid place-items-center shrink-0">
                      <Icon name="plus" size={20} />
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="md-body-large">Create "{q}"</div>
                      <div class="md-body-small opacity-80">
                        New item — pick a category
                      </div>
                    </div>
                  </div>
                  <Pressable
                    onClick={() => {
                      catPicking.value = true;
                    }}
                    color="var(--md-on-primary-container)"
                    class="flex items-center justify-between gap-2 w-full rounded-[var(--md-shape-md)] border border-on-primary-container/40 px-3.5 py-2.5"
                  >
                    <span class="md-body-medium opacity-80">Category</span>
                    <span class="inline-flex items-center gap-1 md-label-large">
                      {selectedCatLabel} <Icon name="chevron" size={18} />
                    </span>
                  </Pressable>
                  <Button
                    variant="filled"
                    full
                    onClick={() => handleCreate(q)}
                    style={{
                      background: "var(--md-on-primary-container)",
                      color: "var(--md-primary-container)",
                    }}
                  >
                    Add to {selectedCatLabel}
                  </Button>
                </div>
              )}
              <div class="flex flex-col">
                <For each={results}>{(item) => row(item)}</For>
              </div>
            </>
          );
        }

        // Chip selected → that category's catalogue items.
        if (filterCatId.value !== null) {
          const catId = filterCatId.value;
          const inCat = items.value.filter((i) =>
            catId === "" ? !i.categoryId : i.categoryId === catId
          );
          return (
            <>
              {chipRow}
              <div class="flex flex-col">
                {inCat.map((item) => row(item))}
              </div>
              {inCat.length === 0 && (
                <p class="md-body-medium text-on-surface-variant px-1 py-3.5">
                  Nothing in this category yet.
                </p>
              )}
            </>
          );
        }

        // Idle → chips only.
        return chipRow;
      })()}
    </div>
  );
}
