import { useEffect, useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { CategoryInterface, ItemInterface } from "@/models/index.ts";
import { useCatalogue } from "@/hooks/useCatalogue.ts";
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
import { Segmented } from "@/components/md3/Segmented.tsx";
import { Chip } from "@/components/md3/Chip.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { FabMenu } from "@/components/md3/FabMenu.tsx";

const SEGMENTED_OPTIONS: [string, "cart" | "tag", string][] = [
  ["lists", "cart", "Lists"],
  ["catalogue", "tag", "Catalogue"],
];

const UNCAT = "__uncat__"; // sentinel for the uncategorized bucket

const fieldClass =
  "flex-1 min-w-0 md-body-large text-on-surface bg-surface-chighest rounded-t-[var(--md-shape-sm)] border-0 border-b-2 border-primary px-4 py-3 focus:outline-none";

interface CatalogueProps {
  initialItems: ItemInterface[];
  initialCategories: CategoryInterface[];
}

export default function Catalogue(
  { initialItems, initialCategories }: CatalogueProps,
) {
  // useMemo with [] ensures useCatalogue is called only once — its signals
  // are initialized from SSR props and must not be recreated on re-render.
  const {
    items,
    sortedCategories,
    itemNames,
    hasUncategorized,
    itemsForCategory,
    addItem,
    renameItem,
    moveItem,
    removeItem,
    createCategory,
    renameCategory,
    deleteCategory,
    refresh,
  } = useMemo(
    () => useCatalogue(initialItems, initialCategories),
    [], // intentionally empty — signals are initialized once from SSR data
  );

  // Computed once (empty deps) — only seeds `selected`'s initial value on mount.
  const firstAlpha = useMemo(
    () =>
      [...initialCategories].sort((a, b) =>
        a.label.toLowerCase().localeCompare(b.label.toLowerCase())
      )[0]?.id ?? UNCAT,
    [],
  );

  const query = useSignal("");
  const selected = useSignal<string>(firstAlpha);
  const editing = useSignal<ItemInterface | null>(null);
  const addOpen = useSignal(false);
  const pickerOpen = useSignal(false);
  const menuCat = useSignal<CategoryInterface | null>(null);
  // When true, the add sheet opens directly in "new category" mode (FAB action).
  const addNewCat = useSignal(false);

  // top-level signal reads → island subscribes to these
  const cats = sortedCategories.value;
  const names = itemNames.value;
  const showUncat = hasUncategorized.value;
  const q = query.value.trim().toLowerCase();
  const searching = q.length > 0;

  // Hide the FAB while any sheet is open — the sheet is then the active surface.
  const anySheetOpen = editing.value !== null || addOpen.value ||
    pickerOpen.value || menuCat.value !== null;

  const selectedIsUncat = selected.value === UNCAT;
  const selectedCatId = selectedIsUncat ? undefined : selected.value;
  const selectedLabel = selectedIsUncat
    ? "Uncategorized"
    : cats.find((c) => c.id === selected.value)?.label ?? "Uncategorized";
  const visibleItems = itemsForCategory(selectedCatId);

  const allMatches = searching
    ? items.value.filter((i) => i.name.toLowerCase().includes(q))
    : [];
  // group matches: alphabetical category labels, then Uncategorized
  const matchGroups: { label: string; items: ItemInterface[] }[] = [];
  for (const c of cats) {
    const its = allMatches.filter((i) => i.categoryId === c.id);
    if (its.length) matchGroups.push({ label: c.label, items: its });
  }
  const uncatMatches = allMatches.filter((i) =>
    !i.categoryId || !cats.some((c) => c.id === i.categoryId)
  );
  if (uncatMatches.length) {
    matchGroups.push({ label: "Uncategorized", items: uncatMatches });
  }

  const itemTile = (it: ItemInterface) => (
    <Pressable
      key={it.id}
      onClick={() => (editing.value = it)}
      class="flex items-center justify-between gap-2 bg-surface border border-outline-variant rounded-[var(--md-shape-md)] px-4 py-3.5 md-body-large text-on-surface text-left"
    >
      <span class="flex-1 min-w-0 truncate">{it.name}</span>
      <Icon name="edit" size={18} class="text-on-surface-variant shrink-0" />
    </Pressable>
  );

  return (
    <PullToRefresh onRefresh={refresh} disabled={anySheetOpen}>
      {/* Lists / Catalogue selector */}
      <div class="px-4 pt-4 pb-2">
        <Segmented
          options={SEGMENTED_OPTIONS}
          value="catalogue"
          onChange={(k) => {
            if (k === "lists") globalThis.location.href = "/shopping";
          }}
        />
      </div>

      <div class="px-4 pb-[calc(96px+env(safe-area-inset-bottom))] flex flex-col gap-4">
        {/* search */}
        <div class="flex items-center gap-2 bg-surface-chighest rounded-[var(--md-shape-full)] h-12 pl-4 pr-1.5">
          <Icon name="search" size={20} class="text-on-surface-variant" />
          <input
            value={query.value}
            onInput={(e) => (query.value = e.currentTarget.value)}
            placeholder="Search the catalogue"
            class="flex-1 min-w-0 bg-transparent border-0 outline-none md-body-large text-on-surface"
          />
          {searching && (
            <IconButton
              name="x"
              size={36}
              iconSize={18}
              aria-label="Clear search"
              onClick={() => (query.value = "")}
            />
          )}
        </div>

        {searching
          ? (
            matchGroups.length === 0
              ? (
                <div class="px-2 pt-2 text-center flex flex-col items-center gap-4">
                  <div class="md-title-medium text-on-surface">
                    No items match “{query.value.trim()}”
                  </div>
                  <Button
                    variant="tonal"
                    icon="plus"
                    onClick={() => {
                      addNewCat.value = false;
                      addOpen.value = true;
                    }}
                  >
                    Add to catalogue
                  </Button>
                </div>
              )
              : (
                matchGroups.map((g) => (
                  <div key={g.label} class="flex flex-col gap-2.5">
                    <div class="md-label-medium uppercase text-on-surface-variant sticky top-0 bg-background px-1 py-1">
                      {g.label}
                    </div>
                    <div class="grid grid-cols-2 gap-2.5">
                      {g.items.map(itemTile)}
                    </div>
                  </div>
                ))
              )
          )
          : (
            <>
              {/* category rail */}
              <div class="flex items-center gap-2">
                <Pressable
                  onClick={() => (pickerOpen.value = true)}
                  class="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--md-shape-sm)] border border-outline-variant text-on-surface-variant md-label-large"
                >
                  <Icon name="tune" size={16} /> All
                </Pressable>
                <div class="flex gap-2 overflow-x-auto flex-1 pr-1">
                  {cats.map((c) => (
                    <Chip
                      key={c.id}
                      selected={c.id === selected.value}
                      leadingCheck={false}
                      onClick={() => (selected.value = c.id)}
                    >
                      {c.label}
                    </Chip>
                  ))}
                  {showUncat && (
                    <Chip
                      selected={selectedIsUncat}
                      leadingCheck={false}
                      onClick={() => (selected.value = UNCAT)}
                    >
                      Uncategorized
                    </Chip>
                  )}
                </div>
              </div>

              {/* category header */}
              <div class="flex items-center justify-between gap-2 pl-1">
                <span class="md-body-medium text-on-surface-variant">
                  {visibleItems.length}{" "}
                  item{visibleItems.length === 1 ? "" : "s"} in {selectedLabel}
                </span>
                {!selectedIsUncat && selected.value && (
                  <IconButton
                    name="dots"
                    size={36}
                    iconSize={20}
                    aria-label="Category options"
                    onClick={() => {
                      menuCat.value = cats.find((c) =>
                        c.id === selected.value
                      ) ??
                        null;
                    }}
                  />
                )}
              </div>

              {/* item grid + add tile */}
              <div class="grid grid-cols-2 gap-2.5">
                {visibleItems.map(itemTile)}
                <Pressable
                  onClick={() => {
                    addNewCat.value = false;
                    addOpen.value = true;
                  }}
                  color="var(--md-primary)"
                  class={`flex items-center justify-center gap-2 border-[1.5px] border-dashed border-outline rounded-[var(--md-shape-md)] px-4 py-3.5 text-primary md-label-large min-h-[52px] ${
                    visibleItems.length === 0 ? "col-span-2" : ""
                  }`}
                >
                  <Icon name="plus" size={20} stroke={2.3} /> Add item
                </Pressable>
              </div>
            </>
          )}
      </div>

      {/* ── Edit item sheet ── */}
      <EditItemSheet
        item={editing.value}
        cats={cats}
        names={names}
        onClose={() => (editing.value = null)}
        onRename={(name) => {
          if (editing.value) renameItem(editing.value.id, name);
          editing.value = null;
        }}
        onMove={(categoryId) => {
          if (editing.value) moveItem(editing.value.id, categoryId);
          editing.value = null;
        }}
        onRemove={() => {
          if (editing.value) removeItem(editing.value.id);
          editing.value = null;
        }}
      />

      {/* ── Add-to-catalogue sheet ── */}
      <AddItemSheet
        open={addOpen.value}
        cats={cats}
        names={names}
        presetCat={selectedCatId}
        startNewCategory={addNewCat.value}
        onClose={() => (addOpen.value = false)}
        onAdd={(name, categoryId) => addItem(name, categoryId)}
        onCreateCategory={(label) => createCategory(label)}
      />

      {/* ── Category picker sheet ── */}
      <Sheet
        open={pickerOpen.value}
        onClose={() => (pickerOpen.value = false)}
        title="Categories"
      >
        <CategoryPicker
          cats={cats}
          counts={(id) => itemsForCategory(id).length}
          selected={selected.value}
          onPick={(id) => {
            selected.value = id;
            pickerOpen.value = false;
          }}
          onNew={async (label) => {
            const created = await createCategory(label);
            if (created) selected.value = created.id;
          }}
        />
      </Sheet>

      {/* ── Category rename / delete sheet ── */}
      <CategoryMenuSheet
        category={menuCat.value}
        itemCount={menuCat.value
          ? itemsForCategory(menuCat.value.id).length
          : 0}
        onClose={() => (menuCat.value = null)}
        onRename={(label) => {
          if (menuCat.value) renameCategory(menuCat.value.id, label);
          menuCat.value = null;
        }}
        onDelete={() => {
          if (menuCat.value) {
            if (selected.value === menuCat.value.id) selected.value = UNCAT;
            deleteCategory(menuCat.value.id);
          }
          menuCat.value = null;
        }}
      />

      {/* Context FAB — add an item or a new category (prototype md3-app.jsx) */}
      {!anySheetOpen && (
        <FabMenu
          label="Add item or category"
          actions={[
            {
              icon: "plus",
              label: "Add item",
              onClick: () => {
                addNewCat.value = false;
                addOpen.value = true;
              },
            },
            {
              icon: "tag",
              label: "New category",
              onClick: () => {
                addNewCat.value = true;
                addOpen.value = true;
              },
            },
          ]}
        />
      )}
    </PullToRefresh>
  );
}

/* ── Edit one catalogue item ── */
function EditItemSheet(
  { item, cats, names, onClose, onRename, onMove, onRemove }: {
    item: ItemInterface | null;
    cats: CategoryInterface[];
    names: Set<string>;
    onClose: () => void;
    onRename: (name: string) => void;
    onMove: (categoryId: string) => void;
    onRemove: () => void;
  },
) {
  const name = useSignal(item?.name ?? "");
  useEffect(() => {
    name.value = item?.name ?? "";
  }, [item?.id]);
  const v = name.value.trim();
  const dupe = !!v && item !== null &&
    v.toLowerCase() !== item.name.toLowerCase() && names.has(v.toLowerCase());
  return (
    <Sheet open={item !== null} onClose={onClose} title="Edit item">
      <div class="flex flex-col gap-5 pb-1">
        <div>
          <div class="md-label-medium uppercase text-on-surface-variant mb-2">
            Name
          </div>
          <div class="flex gap-2 items-center">
            <input
              value={name.value}
              onInput={(e) => (name.value = e.currentTarget.value)}
              class={fieldClass}
            />
            <Button
              variant="filled"
              disabled={!v || dupe || v === item?.name}
              onClick={() => onRename(v)}
            >
              Save
            </Button>
          </div>
          {dupe && (
            <div class="md-body-small text-error mt-2">
              “{v}” is already in your catalogue
            </div>
          )}
        </div>
        <div>
          <div class="md-label-medium uppercase text-on-surface-variant mb-2">
            Category
          </div>
          <div class="flex gap-2 flex-wrap">
            {cats.map((c) => (
              <Chip
                key={c.id}
                selected={c.id === item?.categoryId}
                leadingCheck={false}
                onClick={() => onMove(c.id)}
              >
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
        <Button variant="error" icon="trash" onClick={onRemove}>
          Remove from catalogue
        </Button>
      </div>
    </Sheet>
  );
}

/* ── Add items to the catalogue (rapid-fire) ── */
function AddItemSheet(
  {
    open,
    cats,
    names,
    presetCat,
    startNewCategory,
    onClose,
    onAdd,
    onCreateCategory,
  }: {
    open: boolean;
    cats: CategoryInterface[];
    names: Set<string>;
    presetCat?: string;
    startNewCategory?: boolean;
    onClose: () => void;
    onAdd: (name: string, categoryId?: string) => void;
    onCreateCategory: (label: string) => Promise<CategoryInterface | null>;
  },
) {
  const chosen = useSignal<string | undefined>(presetCat ?? cats[0]?.id);
  const name = useSignal("");
  const newOpen = useSignal(false);
  const newName = useSignal("");
  const added = useSignal<string[]>([]);
  useEffect(() => {
    if (open) {
      chosen.value = presetCat ?? cats[0]?.id;
      name.value = "";
      added.value = [];
      newOpen.value = !!startNewCategory;
      newName.value = "";
    }
  }, [open]);
  const n = name.value.trim();
  const dupe = !!n && names.has(n.toLowerCase());
  return (
    <Sheet open={open} onClose={onClose} title="Add to catalogue">
      <div class="flex flex-col gap-5 pb-1">
        <div>
          <div class="md-label-medium uppercase text-on-surface-variant mb-2">
            Category
          </div>
          <div class="flex gap-2 flex-wrap">
            {cats.map((c) => (
              <Chip
                key={c.id}
                selected={chosen.value === c.id}
                leadingCheck={false}
                onClick={() => (chosen.value = c.id)}
              >
                {c.label}
              </Chip>
            ))}
            {!newOpen.value && (
              <Chip
                icon="plus"
                leadingCheck={false}
                onClick={() => (newOpen.value = true)}
              >
                New
              </Chip>
            )}
          </div>
          {newOpen.value && (
            <div class="flex gap-2 items-center mt-3">
              <input
                value={newName.value}
                onInput={(e) => (newName.value = e.currentTarget.value)}
                placeholder="New category name"
                class={fieldClass}
              />
              <Button
                variant="filled"
                disabled={!newName.value.trim()}
                onClick={async () => {
                  const created = await onCreateCategory(newName.value.trim());
                  if (created) chosen.value = created.id;
                  newOpen.value = false;
                  newName.value = "";
                }}
              >
                Create
              </Button>
            </div>
          )}
        </div>
        <div>
          <div class="md-label-medium uppercase text-on-surface-variant mb-2">
            Item
          </div>
          <div class="flex gap-2 items-center">
            <input
              value={name.value}
              onInput={(e) => (name.value = e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && n && !dupe) {
                  onAdd(n, chosen.value);
                  added.value = [n, ...added.value].slice(0, 12);
                  name.value = "";
                }
              }}
              placeholder="Item name"
              class={fieldClass}
            />
            <Button
              variant="filled"
              disabled={!n || dupe}
              onClick={() => {
                onAdd(n, chosen.value);
                added.value = [n, ...added.value].slice(0, 12);
                name.value = "";
              }}
            >
              Add
            </Button>
          </div>
          <div
            class={`md-body-small mt-2 ${
              dupe ? "text-error" : "text-on-surface-variant"
            }`}
          >
            {dupe
              ? `“${n}” is already in your catalogue`
              : "Press enter to add and keep going"}
          </div>
        </div>
        {added.value.length > 0 && (
          <div>
            <div class="md-label-medium uppercase text-on-surface-variant mb-2">
              Added just now · {added.value.length}
            </div>
            <div class="flex flex-wrap gap-2">
              {added.value.map((a) => (
                <span
                  key={a}
                  class="inline-flex items-center gap-1.5 md-label-large bg-secondary-container text-on-secondary-container rounded-[var(--md-shape-full)] px-3 py-1.5"
                >
                  <Icon name="check" size={14} stroke={2.5} /> {a}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/* ── Category picker: pick, create, or jump to aisle order ── */
function CategoryPicker(
  { cats, counts, selected, onPick, onNew }: {
    cats: CategoryInterface[];
    counts: (id: string) => number;
    selected: string;
    onPick: (id: string) => void;
    onNew: (label: string) => void;
  },
) {
  const newOpen = useSignal(false);
  const newName = useSignal("");
  return (
    <div class="flex flex-col gap-1">
      <Pressable
        onClick={() => (newOpen.value = true)}
        color="var(--md-primary)"
        class="flex items-center gap-2.5 w-full text-left border-[1.5px] border-dashed border-outline rounded-[var(--md-shape-md)] px-4 py-3 text-primary md-label-large mb-1"
      >
        <Icon name="plus" size={20} stroke={2.3} /> New category
      </Pressable>
      {newOpen.value && (
        <div class="flex gap-2 items-center mb-2">
          <input
            value={newName.value}
            onInput={(e) => (newName.value = e.currentTarget.value)}
            placeholder="New category name"
            class={fieldClass}
          />
          <Button
            variant="filled"
            disabled={!newName.value.trim()}
            onClick={() => {
              onNew(newName.value.trim());
              newOpen.value = false;
              newName.value = "";
            }}
          >
            Create
          </Button>
        </div>
      )}
      <a
        href="/shopping/categories"
        class="md-press flex items-center gap-2.5 w-full text-left rounded-[var(--md-shape-md)] px-4 py-3 text-on-surface md-label-large"
      >
        <span class="md-state" />
        <Icon name="swap" size={20} /> Aisle order
      </a>
      <div class="max-h-[360px] overflow-y-auto -mx-1 mt-1">
        {cats.map((c) => (
          <ListItem
            key={c.id}
            onClick={() => onPick(c.id)}
            headline={c.label}
            supporting={`${counts(c.id)} item${counts(c.id) === 1 ? "" : "s"}`}
            trailing={c.id === selected
              ? (
                <Icon
                  name="check"
                  size={20}
                  stroke={2.4}
                  class="text-primary"
                />
              )
              : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Rename / delete a category ── */
function CategoryMenuSheet(
  { category, itemCount, onClose, onRename, onDelete }: {
    category: CategoryInterface | null;
    itemCount: number;
    onClose: () => void;
    onRename: (label: string) => void;
    onDelete: () => void;
  },
) {
  const label = useSignal(category?.label ?? "");
  useEffect(() => {
    label.value = category?.label ?? "";
  }, [category?.id]);
  const v = label.value.trim();
  return (
    <Sheet open={category !== null} onClose={onClose} title="Category">
      <div class="flex flex-col gap-5 pb-1">
        <div>
          <div class="md-label-medium uppercase text-on-surface-variant mb-2">
            Name
          </div>
          <div class="flex gap-2 items-center">
            <input
              value={label.value}
              onInput={(e) => (label.value = e.currentTarget.value)}
              class={fieldClass}
            />
            <Button
              variant="filled"
              disabled={!v || v === category?.label}
              onClick={() => onRename(v)}
            >
              Save
            </Button>
          </div>
        </div>
        <Button variant="error" icon="trash" onClick={onDelete}>
          Delete category{itemCount > 0
            ? ` · ${itemCount} item${
              itemCount === 1 ? "" : "s"
            } become uncategorized`
            : ""}
        </Button>
      </div>
    </Sheet>
  );
}
