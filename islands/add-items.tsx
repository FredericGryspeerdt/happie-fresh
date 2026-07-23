import { useEffect, useMemo } from "preact/hooks";
import { useComputed, useSignal } from "@preact/signals";
import {
  CategoryInterface,
  ItemInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import { useSearchBox, useShoppingList } from "@/hooks/index.ts";
import { Icon } from "@/components/md3/Icon.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Stepper } from "@/components/md3/Stepper.tsx";
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
    updateListItem,
    flushListItem,
    removeListItem,
    getItemName,
    listItemsMap,
    list,
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

  // List-item ids added during this visit — the "Added (N)" building cart.
  const addedThisVisit = useSignal<string[]>([]);
  // Create-flow category picker sub-screen.
  const catPicking = useSignal(false);
  // Compact editor sheet — holds the list-item id being edited (qty + note).
  const editingId = useSignal<string | null>(null);
  // "Added (N)" section collapse state (collapsed by default).
  const addedOpen = useSignal(false);
  // Create-new affordance: a slim row while matches exist; tapping it expands to
  // the full category-picker card (which also shows outright when nothing matches).
  const createExpanded = useSignal(false);

  // Autofocus the search field on mount for a quick type-to-search flow.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const trackAdded = (liId: string | null) => {
    if (liId) addedThisVisit.value = [...addedThisVisit.value, liId];
  };

  const handleAdd = async (itemId: string) => {
    trackAdded(await addToList(itemId));
  };

  const handleCreate = async (name: string) => {
    trackAdded(await addToCatalog(name, selectedCategoryId.value || undefined));
    selectedCategoryId.value = "";
    query.value = "";
    createExpanded.value = false;
    inputRef.current?.focus();
  };

  const handleRemove = async (liId: string) => {
    addedThisVisit.value = addedThisVisit.value.filter((id) => id !== liId);
    if (editingId.value === liId) editingId.value = null;
    await removeListItem(liId);
  };

  const closeEditor = () => {
    const id = editingId.value;
    if (id) flushListItem(id);
    editingId.value = null;
  };

  const q = query.value.trim();
  const selectedCatLabel =
    categories.value.find((c) => c.id === selectedCategoryId.value)?.label ??
      "Uncategorized";

  // Memoized so each row does a Map lookup, not an O(n) find over categories.
  const catLabelById = useComputed(() =>
    new Map(categories.value.map((c) => [c.id, c.label ?? ""]))
  );

  // Render a catalogue item as a row: un-added → Add; added → inline stepper +
  // tap-to-edit. `withRemove` adds a remove control (Added section only).
  const catalogueRow = (item: ItemInterface, withRemove: boolean) => {
    const li = listItemsMap.value.get(item.id ?? "");
    return (
      <CatalogueAddRow
        key={item.id}
        name={item.name ?? ""}
        categoryLabel={catLabelById.value.get(item.categoryId ?? "") ?? ""}
        added={!!li}
        onAdd={() => {
          if (item.id) handleAdd(item.id);
        }}
        quantity={li?.quantity ?? 1}
        onQtyChange={(v) => {
          if (li?.id) updateListItem(li.id, { quantity: v });
        }}
        onEdit={() => {
          if (li?.id) editingId.value = li.id;
        }}
        onRemove={withRemove && li?.id ? () => handleRemove(li.id!) : undefined}
      />
    );
  };

  // ── Create-flow category picker sub-screen (replaces the body) ──────────
  if (catPicking.value) {
    return (
      <div class="flex flex-col">
        <header
          class="bg-surface sticky top-0 z-20"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div class="flex items-center gap-1 px-1" style={{ height: 56 }}>
            <Pressable
              onClick={() => (catPicking.value = false)}
              aria-label="Back to search"
              class="grid place-items-center text-on-surface-variant rounded-full shrink-0"
              style={{ width: 40, height: 40 }}
            >
              <Icon name="back" size={22} />
            </Pressable>
            <div class="md-title-large text-on-surface">Choose category</div>
          </div>
        </header>
        <div class="px-4 pt-1 pb-28">
          <CategoryPickerList
            categories={categories.value}
            selectedId={selectedCategoryId.value}
            onSelect={(id) => {
              selectedCategoryId.value = id;
              catPicking.value = false;
            }}
          />
        </div>
      </div>
    );
  }

  // ── "Added (N)" building-cart rows (newest first) ───────────────────────
  const addedRows = addedThisVisit.value
    .map((liId) => list.value.find((li) => li.id === liId))
    .filter((li): li is ShoppingListItemInterface => !!li)
    .reverse();

  const editingLi = editingId.value
    ? list.value.find((li) => li.id === editingId.value) ?? null
    : null;

  return (
    <div class="flex flex-col">
      {/* Sticky search top bar — this island owns the top region */}
      <header
        class="bg-surface sticky top-0 z-20"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div class="flex items-center gap-1 px-1" style={{ height: 56 }}>
          <a
            href={`/shopping/${listId}`}
            aria-label="Back"
            class="md-press grid place-items-center text-on-surface-variant rounded-full shrink-0"
            style={{ width: 40, height: 40 }}
          >
            <span class="md-state" />
            <Icon name="back" size={22} />
          </a>
          <div class="relative flex-1">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              <Icon name="search" size={20} />
            </span>
            <input
              ref={inputRef}
              value={query.value}
              onInput={(e) => {
                query.value = (e.target as HTMLInputElement).value;
                createExpanded.value = false; // typing re-collapses the create row
              }}
              placeholder="Search or add an item…"
              class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-full)] py-2.5 pl-10 pr-10 outline-none"
            />
            {q && (
              <Pressable
                onClick={() => {
                  query.value = "";
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                class="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center text-on-surface-variant rounded-full"
                style={{ width: 32, height: 32 }}
              >
                <Icon name="x" size={18} />
              </Pressable>
            )}
          </div>
        </div>
      </header>

      <div class="px-4 pt-2 pb-28 flex flex-col gap-2">
        {/* Context line */}
        <div class="md-label-medium text-on-surface-variant px-1">
          Adding to {listName}
        </div>

        {/* Added (N) — the building cart, collapsed by default */}
        {addedRows.length > 0 && (
          <div class="rounded-[var(--md-shape-lg)] bg-surface-chigh overflow-hidden">
            <Pressable
              as="div"
              onClick={() => (addedOpen.value = !addedOpen.value)}
              class="flex items-center gap-2 px-4 py-3"
            >
              <Icon name="check" size={18} class="text-primary" />
              <span class="md-title-small text-on-surface flex-1">
                Added · {addedRows.length}
              </span>
              <span
                class="text-on-surface-variant"
                style={{
                  transform: addedOpen.value ? "rotate(90deg)" : "rotate(0)",
                  transition: "transform .15s",
                  display: "inline-flex",
                }}
              >
                <Icon name="chevron" size={18} />
              </span>
            </Pressable>
            {addedOpen.value && (
              <div class="flex flex-col pb-1">
                {addedRows.map((li) => {
                  const item = items.value.find((i) => i.id === li.itemId);
                  return item ? catalogueRow(item, true) : null;
                })}
              </div>
            )}
          </div>
        )}

        {/* Main content: idle hint, or live results + create-new fallback */}
        {q
          ? (() => {
            // Two intentional predicates: the create card gates on an EXACT
            // (case-insensitive) match, while `results` is useSearchBox's
            // SUBSTRING filter — both can legitimately show at once. Do not
            // unify these.
            const exact = items.value.some((i) =>
              i.name?.toLowerCase() === q.toLowerCase()
            );
            return (
              <>
                <div class="flex flex-col">
                  {results.value.map((item) => catalogueRow(item, false))}
                </div>
                {
                  /* Create-new action stays BELOW the results. It's a slim row
                    when there are matches (de-emphasized), and upgrades to the
                    full category-picker card when there are no matches — or when
                    the user taps the slim row to engage. */
                }
                {!exact &&
                  (results.value.length > 0 && !createExpanded.value
                    ? (
                      <Pressable
                        onClick={() => (createExpanded.value = true)}
                        class="flex items-center gap-2 w-full text-left rounded-[var(--md-shape-md)] px-3 py-3 mt-1 text-primary md-label-large"
                      >
                        <Icon name="plus" size={20} /> Create "{q}"
                      </Pressable>
                    )
                    : (
                      <div class="bg-primary-container text-on-primary-container rounded-[var(--md-shape-lg)] p-3.5 mt-1 flex flex-col gap-3">
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
                          onClick={() => (catPicking.value = true)}
                          color="var(--md-on-primary-container)"
                          class="flex items-center justify-between gap-2 w-full rounded-[var(--md-shape-md)] border border-on-primary-container/40 px-3.5 py-2.5"
                        >
                          <span class="md-body-medium opacity-80">
                            Category
                          </span>
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
                    ))}
              </>
            );
          })()
          : (
            <div class="flex flex-col items-center text-center gap-1 px-6 py-16 text-on-surface-variant">
              <Icon name="search" size={30} />
              <div class="md-body-large text-on-surface mt-2">
                Search your catalogue
              </div>
              <div class="md-body-medium opacity-80">
                Find an item to add, or create a new one.
              </div>
            </div>
          )}
      </div>

      {/* Compact editor sheet — quantity + note */}
      <Sheet
        open={editingId.value !== null}
        onClose={closeEditor}
        title={editingLi ? getItemName(editingLi.itemId) : ""}
      >
        {editingLi && (
          <div class="flex flex-col gap-1.5 pb-1">
            <div class="flex items-center justify-between px-1 py-1.5">
              <span class="md-body-large text-on-surface">Quantity</span>
              <Stepper
                value={editingLi.quantity ?? 1}
                onChange={(v) => updateListItem(editingLi.id!, { quantity: v })}
              />
            </div>
            <div class="h-px bg-surface-chigh mx-1" />
            <div class="px-1 py-1.5">
              <div class="md-body-large text-on-surface mb-2">Note</div>
              <textarea
                value={editingLi.note ?? ""}
                onInput={(e) =>
                  updateListItem(editingLi.id!, {
                    note: (e.target as HTMLTextAreaElement).value,
                  })}
                rows={2}
                placeholder="e.g. the red ones, big pack, any brand…"
                class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none resize-none"
              />
            </div>
            <Button variant="filled" full onClick={closeEditor} class="mt-2.5">
              Done
            </Button>
            <Button
              variant="error"
              full
              onClick={() => handleRemove(editingLi.id!)}
              class="mt-2"
            >
              Remove from list
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
