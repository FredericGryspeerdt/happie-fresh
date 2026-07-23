import { useEffect, useMemo, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { For } from "@preact/signals/utils";
import {
  CategoryInterface,
  ItemInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import { useShoppingList } from "@/hooks/index.ts";
import { api } from "@/services/api.ts";
import { Segmented } from "@/components/md3/Segmented.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Spinner } from "@/components/md3/Spinner.tsx";
import { CategoryPickerList } from "@/components/md3/CategoryPickerList.tsx";
import { Card } from "@/components/md3/Card.tsx";
import { Stepper } from "@/components/md3/Stepper.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { appBarAction } from "@/utils/app-bar.ts";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { Progress } from "@/components/md3/Progress.tsx";
import { RoundCheck } from "@/components/md3/RoundCheck.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
import Fab from "@/islands/shell/Fab.tsx";
import AddItems from "@/islands/add-items.tsx";
import { navigateTo, reloadPage } from "@/utils/loading.ts";

interface ItemsProps {
  listId: string;
  listName: string;
  items: Required<ItemInterface>[];
  shoppingList: ShoppingListItemInterface[];
  categories: CategoryInterface[];
}

export default function Items(
  {
    listId,
    listName,
    items: catalog,
    shoppingList,
    categories: initialCategories,
  }: ItemsProps,
) {
  // useMemo with [] ensures useShoppingList is called only once.
  // useShoppingList uses plain signal() (not useSignal), so calling it on every
  // re-render would recreate all signals from SSR props, discarding local state.
  const {
    updateListItem,
    removeListItem,
    checkItem,
    uncheckItem,
    refresh,
    getItemName,
    groupedList,
    list,
    checkedItems,
    categories,
    items,
    lastSaved,
    savingIds,
    flushListItem,
  } = useMemo(
    () => useShoppingList(listId, catalog, shoppingList, initialCategories),
    [], // intentionally empty — signals are initialized once from SSR data
  );

  // ── mode toggle ──────────────────────────────────────────────────────────
  const mode = useSignal<"plan" | "shop">("plan");

  // ── add-items overlay ────────────────────────────────────────────────────
  // The add surface is rendered here as a full-screen in-page overlay rather
  // than navigated to as a separate route. This is what makes mobile autofocus
  // work: opening from the FAB focuses `primerRef` *within the tap*, which is the
  // only moment browsers allow the soft keyboard to open. Focus then transfers to
  // the overlay's search field (keeping the keyboard up). A cross-document route
  // navigation loses the tap's user-activation, so the keyboard never appears.
  const addOpen = useSignal(false);
  const primerRef = useRef<HTMLInputElement>(null);

  const openAdd = () => {
    primerRef.current?.focus();
    addOpen.value = true;
  };

  const closeAdd = () => {
    addOpen.value = false;
    // The overlay runs its own useShoppingList instance, so pull the list back in
    // to reflect anything added while it was open.
    refresh();
  };

  // ── shop mode: pending check items (optimistic UI) ───────────────────────
  const pendingItemIds = useSignal<Set<string>>(new Set());

  // ── shop mode: check item wrapper ────────────────────────────────────────
  const handleCheckItem = async (id: string) => {
    pendingItemIds.value = new Set([...pendingItemIds.value, id]);
    try {
      await checkItem(id);
    } finally {
      const next = new Set(pendingItemIds.value);
      next.delete(id);
      pendingItemIds.value = next;
    }
  };

  // ── shop mode: "In cart" collapsible ─────────────────────────────────────
  const showDone = useSignal(false);

  // ── list management sheet ────────────────────────────────────────────────
  const mgmtOpen = useSignal(false);
  const renameValue = useSignal("");
  const snackData = useSignal<{ msg: string } | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSnack = (msg: string) => {
    snackData.value = { msg };
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => {
      snackData.value = null;
    }, 3000);
  };

  useEffect(() => () => {
    if (snackTimer.current) clearTimeout(snackTimer.current);
  }, []);

  // ── register the "list options" overflow into the shell's TopAppBar ───────
  // The top app bar is rendered by the shell (AppChrome), a separate island;
  // we hand it a trailing action via a shared module-scope signal.
  useEffect(() => {
    appBarAction.value = {
      icon: "dots",
      label: "List options",
      onClick: () => {
        renameValue.value = listName;
        mgmtOpen.value = true;
      },
    };
    return () => {
      appBarAction.value = null;
    };
  }, []);

  // ── sheet signals ────────────────────────────────────────────────────────
  const editingId = useSignal<string | null>(null);
  // item-editor: searchable category picker mode (replaces the sheet body
  // while open)
  const editCatPicking = useSignal(false);

  // ── item-editor: honest "Saved" indicator ───────────────────────────────
  // Driven directly by `lastSaved` (bumped only when a debounced list-item write
  // actually flushes to the API — see useShoppingList), read at the top level of
  // render so this island re-renders on each flush. We snapshot lastSaved when the
  // editor opens so the pill shows only for writes made this editing session, not
  // per keystroke. (A signal written from inside a useSignalEffect did NOT
  // re-render this island, so the pill is driven by this top-level read instead.)
  const savedBaseline = useRef(0);

  // ── item-editor: get current list item being edited ──────────────────────
  const editingListItem = () =>
    editingId.value
      ? (groupedList.value.flatMap((g) => g.items).find((li) =>
        li.id === editingId.value
      ) ?? null)
      : null;

  // ── item-editor: category change ─────────────────────────────────────────
  // Category lives on the catalog item (item.categoryId), not on the list item.
  // To change it we must call api.items.update() then refresh() to pull the new
  // categoryId back into the items signal — updateListItem only patches list-level
  // fields (qty, note, checked) and does not touch catalog metadata.
  const handleCategoryChange = async (newCategoryId: string) => {
    const li = editingListItem();
    if (!li) return;
    const name = getItemName(li.itemId);
    await api.items.update(li.itemId!, name, newCategoryId);
    await refresh();
  };

  // Top-level read → re-renders on each flush. Show the pill only for flushes
  // since the editor opened, and key it by savedTick so it re-animates each time.
  const savedTick = lastSaved.value;
  const showSaved = savedTick > savedBaseline.current;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div class="flex flex-col gap-4 pb-24">
      {/* Mode toggle (Plan / Shop) — list options live in the top app bar */}
      <Segmented
        options={[
          ["plan", "edit", "Plan"],
          ["shop", "cart", "Shop"],
        ]}
        value={mode.value}
        onChange={(m) => {
          mode.value = m as "plan" | "shop";
        }}
      />

      {/* ── Plan mode ── */}
      {mode.value === "plan" && (
        <div class="flex flex-col gap-4">
          {/* Grouped list */}
          <For each={groupedList}>
            {(group) => (
              <div class="flex flex-col gap-2">
                {/* SubHeader */}
                <div class="md-title-small text-primary uppercase tracking-wide px-1">
                  {group.category?.label ?? "Uncategorized"}
                </div>

                {/* Card of rows */}
                <Card variant="filled" pad={0} radius={16}>
                  {group.items.map((
                    li: ShoppingListItemInterface,
                    idx: number,
                  ) => (
                    <div key={li.id}>
                      <div class="flex items-center gap-3 px-4 py-3">
                        {/* Pressable name/note area opens item-editor sheet */}
                        <Pressable
                          as="div"
                          onClick={() => {
                            savedBaseline.current = lastSaved.value;
                            editingId.value = li.id ?? null;
                          }}
                          class="flex-1 min-w-0 cursor-pointer"
                        >
                          <div class="md-body-large text-on-surface overflow-hidden text-ellipsis whitespace-nowrap">
                            {getItemName(li.itemId)}
                          </div>
                          {li.note && (
                            <div class="md-body-small text-on-surface-variant overflow-hidden text-ellipsis whitespace-nowrap">
                              📝 {li.note}
                            </div>
                          )}
                        </Pressable>

                        {/* Inline quantity stepper */}
                        <Stepper
                          value={li.quantity ?? 1}
                          onChange={(v) =>
                            updateListItem(li.id!, { quantity: v })}
                        />
                      </div>

                      {/* 1px divider between rows, not after last */}
                      {idx < group.items.length - 1 && (
                        <div
                          class="bg-surface-chigh mx-4"
                          style={{ height: 1 }}
                        />
                      )}
                    </div>
                  ))}
                </Card>
              </div>
            )}
          </For>

          {groupedList.value.length === 0 && (
            <p class="md-body-large text-on-surface-variant text-center py-8">
              Tap Add items to get started.
            </p>
          )}
        </div>
      )}

      {/* ── Shop mode ── */}
      {mode.value === "shop" && (() => {
        const done = checkedItems.value.length;
        const total = list.value.length + checkedItems.value.length;
        const allDone = done === total && total > 0;

        return (
          <div class="flex flex-col gap-3">
            {/* Progress card */}
            <Card variant="filled" pad={16}>
              <div class="flex items-baseline justify-between gap-2 mb-2.5">
                <span class="md-title-medium text-on-surface whitespace-nowrap">
                  {done} / {total} in cart
                </span>
                {/* NOTE: Wake Lock API is not implemented in this spike — this is a static label only */}
                <span class="inline-flex items-center gap-1 md-label-small text-on-surface-variant whitespace-nowrap shrink-0">
                  <Icon name="bolt" size={13} /> Screen awake
                </span>
              </div>
              <Progress value={done} total={total} height={8} />
            </Card>

            {/* All-done celebration */}
            {allDone && (
              <Card
                variant="filled"
                pad={20}
                class="bg-tertiary-container text-center"
              >
                <div class="text-[34px] leading-none mb-1">🎉</div>
                <div class="md-title-large text-on-tertiary-container mt-1">
                  All done — nice work!
                </div>
                <div class="md-body-medium text-on-tertiary-container opacity-85 mt-1">
                  Everything's in the cart.
                </div>
              </Card>
            )}

            {/* Remaining items grouped by aisle */}
            {!allDone && (
              <For each={groupedList}>
                {(group) => (
                  <div class="flex flex-col gap-2">
                    {/* Aisle header */}
                    <div class="flex items-center justify-between mx-1 mt-1">
                      <span class="md-title-small text-primary uppercase tracking-[0.05em]">
                        {group.category?.label ?? "Uncategorized"}
                      </span>
                      <span class="md-label-medium text-on-surface-variant whitespace-nowrap shrink-0">
                        {group.items.length} left
                      </span>
                    </div>

                    {/* Item rows */}
                    <div class="flex flex-col gap-2">
                      {group.items.map((li: ShoppingListItemInterface) => (
                        <Pressable
                          key={li.id}
                          as="div"
                          onClick={() => handleCheckItem(li.id!)}
                          class="flex items-center gap-4 bg-surface-chigh rounded-2xl px-4"
                          style={{
                            minHeight: 60,
                            paddingTop: 14,
                            paddingBottom: 14,
                          }}
                        >
                          <RoundCheck checked={false} />
                          <div class="flex-1 min-w-0">
                            <div class="md-body-large text-on-surface overflow-hidden text-ellipsis whitespace-nowrap">
                              {getItemName(li.itemId)}
                            </div>
                            {li.note && (
                              <div class="md-body-small text-on-surface-variant overflow-hidden text-ellipsis whitespace-nowrap">
                                📝 {li.note}
                              </div>
                            )}
                          </div>
                          {(li.quantity ?? 1) > 1 && (
                            <span class="md-label-large bg-secondary-container text-on-secondary-container rounded-full px-2.5 py-0.5 shrink-0">
                              ×{li.quantity}
                            </span>
                          )}
                        </Pressable>
                      ))}
                    </div>
                  </div>
                )}
              </For>
            )}

            {/* "In cart" collapsible */}
            {checkedItems.value.length > 0 && (
              <div class="flex flex-col gap-2">
                {/* Toggle header */}
                <Pressable
                  as="div"
                  onClick={() => {
                    showDone.value = !showDone.value;
                  }}
                  class="flex items-center gap-2.5 px-1 py-2 mt-1"
                >
                  <span class="md-title-small text-on-surface-variant">
                    In cart · {checkedItems.value.length}
                  </span>
                  <div class="flex-1 h-px bg-surface-chigh" />
                  <span
                    class="text-on-surface-variant shrink-0"
                    style={{
                      transform: showDone.value
                        ? "rotate(90deg)"
                        : "rotate(0deg)",
                      transition: "transform .15s",
                      display: "inline-flex",
                    }}
                  >
                    <Icon name="chevron" size={20} />
                  </span>
                </Pressable>

                {/* Checked items */}
                {showDone.value && checkedItems.value.map(
                  (li: ShoppingListItemInterface) => (
                    <Pressable
                      key={li.id}
                      as="div"
                      onClick={() => uncheckItem(li.id!)}
                      class="flex items-center gap-4 bg-surface rounded-2xl px-4 opacity-60"
                      style={{
                        minHeight: 60,
                        paddingTop: 14,
                        paddingBottom: 14,
                      }}
                    >
                      <RoundCheck checked />
                      <div class="flex-1 min-w-0">
                        <div class="md-body-large text-on-surface line-through overflow-hidden text-ellipsis whitespace-nowrap">
                          {getItemName(li.itemId)}
                        </div>
                      </div>
                    </Pressable>
                  ),
                )}
              </div>
            )}

            {total === 0 && (
              <p class="md-body-large text-on-surface-variant text-center py-8">
                Switch to Plan to add items.
              </p>
            )}
          </div>
        );
      })()}

      {/* ══════════════════════ List-management sheet ══════════════════════ */}
      <Sheet
        open={mgmtOpen.value}
        onClose={() => {
          mgmtOpen.value = false;
        }}
        title="List options"
      >
        <div class="flex flex-col gap-1 pb-1">
          {/* Rename */}
          <div class="px-1 py-2">
            <div class="md-body-large text-on-surface mb-2">Rename list</div>
            <div class="flex gap-2">
              <input
                value={renameValue.value}
                onInput={(e) => {
                  renameValue.value = (e.target as HTMLInputElement).value;
                }}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && renameValue.value.trim()) {
                    await api.shoppingLists.rename(
                      listId,
                      renameValue.value.trim(),
                    );
                    mgmtOpen.value = false;
                    // The route SSR renders the list name into the shell TopAppBar;
                    // reload to reflect the new name there.
                    reloadPage();
                  }
                }}
                placeholder="List name"
                class="flex-1 md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-full)] py-3 px-4 outline-none"
              />
              <Button
                variant="filled"
                onClick={async () => {
                  const name = renameValue.value.trim();
                  if (!name) return;
                  await api.shoppingLists.rename(listId, name);
                  mgmtOpen.value = false;
                  reloadPage();
                }}
              >
                Save
              </Button>
            </div>
          </div>

          <div class="h-px bg-surface-chigh mx-1 my-1" />

          {/* Share — coming soon */}
          <ListItem
            headline="Share list"
            supporting="Invite household members"
            leading={
              <span class="w-10 h-10 rounded-full bg-surface-chigh text-on-surface-variant grid place-items-center">
                <Icon name="share" size={20} />
              </span>
            }
            onClick={() => {
              showSnack("Sharing is coming soon");
            }}
          />

          {/* Clear checked */}
          <ListItem
            headline="Clear checked items"
            supporting={checkedItems.value.length
              ? `${checkedItems.value.length} checked off`
              : "Nothing checked yet"}
            leading={
              <span class="w-10 h-10 rounded-full bg-surface-chigh text-on-surface-variant grid place-items-center">
                <Icon name="check" size={20} />
              </span>
            }
            onClick={async () => {
              const ids = checkedItems.value.map((li) => li.id!).filter(
                Boolean,
              );
              mgmtOpen.value = false;
              for (const id of ids) {
                await removeListItem(id);
              }
            }}
          />

          <div class="h-px bg-surface-chigh mx-1 my-1" />

          {/* Delete list */}
          <ListItem
            headline={<span class="text-error">Delete list</span>}
            leading={
              <span class="w-10 h-10 rounded-full bg-error-container text-error grid place-items-center">
                <Icon name="trash" size={20} />
              </span>
            }
            onClick={async () => {
              mgmtOpen.value = false;
              await api.shoppingLists.delete(listId);
              navigateTo("/shopping");
            }}
          />
        </div>
      </Sheet>

      {/* ══════════════════════ Item-editor sheet ══════════════════════ */}
      <Sheet
        open={editingId.value !== null}
        onClose={() => {
          const id = editingId.value;
          if (id) flushListItem(id);
          editingId.value = null;
          editCatPicking.value = false;
        }}
        title={editCatPicking.value
          ? "Choose category"
          : (editingId.value ? getItemName(editingListItem()?.itemId) : "")}
      >
        {(() => {
          const li = editingListItem();
          if (!li) return null;

          // Find category currently on the catalog item
          const catalogItem = items.value.find((i) => i.id === li.itemId);
          const currentCategoryId = catalogItem?.categoryId ?? "";
          const currentCatLabel =
            categories.value.find((c) => c.id === currentCategoryId)?.label ??
              "Uncategorized";

          // Searchable category picker replaces the editor body while open
          if (editCatPicking.value) {
            return (
              <CategoryPickerList
                categories={categories.value}
                selectedId={currentCategoryId}
                onSelect={(id) => {
                  handleCategoryChange(id);
                  editCatPicking.value = false;
                }}
              />
            );
          }

          return (
            <div class="flex flex-col gap-1.5 pb-1">
              {
                /* Saved pill — reserves row height; CSS-fades in/out, keyed by
                  savedTick so it replays on each flush */
              }
              <div class="h-6 flex justify-end items-center px-1">
                {savingIds.value.has(li.id!)
                  ? (
                    <span class="inline-flex items-center gap-1.5 md-label-medium text-on-surface-variant">
                      <Spinner size={12} /> Saving…
                    </span>
                  )
                  : showSaved && (
                    <span
                      key={savedTick}
                      class="md-saved-flash inline-flex items-center gap-1 md-label-medium text-on-tertiary-container bg-tertiary-container rounded-full px-2.5 py-0.5 pointer-events-none"
                    >
                      <Icon name="check" size={14} /> Saved
                    </span>
                  )}
              </div>

              {/* Quantity */}
              <div class="flex items-center justify-between px-1 py-1.5">
                <span class="md-body-large text-on-surface">Quantity</span>
                <Stepper
                  value={li.quantity ?? 1}
                  onChange={(v) => updateListItem(li.id!, { quantity: v })}
                />
              </div>
              <div class="h-px bg-surface-chigh mx-1" />

              {/* Category — opens the searchable picker */}
              <div class="px-1 py-1.5">
                <div class="md-body-large text-on-surface mb-2">Category</div>
                <Pressable
                  onClick={() => {
                    editCatPicking.value = true;
                  }}
                  class="flex items-center justify-between gap-2 w-full bg-surface-chigh rounded-[var(--md-shape-md)] px-4 py-3"
                >
                  <span class="md-body-large text-on-surface">
                    {currentCatLabel}
                  </span>
                  <Icon
                    name="chevron"
                    size={18}
                    class="text-on-surface-variant"
                  />
                </Pressable>
              </div>
              <div class="h-px bg-surface-chigh mx-1" />

              {/* Note */}
              <div class="px-1 py-1.5">
                <div class="md-body-large text-on-surface mb-2">Note</div>
                <textarea
                  value={li.note ?? ""}
                  onInput={(e) =>
                    updateListItem(li.id!, {
                      note: (e.target as HTMLTextAreaElement).value,
                    })}
                  rows={2}
                  placeholder="e.g. the red ones, big pack, any brand…"
                  class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none resize-none"
                />
              </div>

              {/* Done button */}
              <Button
                variant="filled"
                full
                onClick={() => {
                  const id = editingId.value;
                  if (id) flushListItem(id);
                  editingId.value = null;
                }}
                class="mt-2.5"
              >
                Done
              </Button>

              {/* Remove from list */}
              <Button
                variant="error"
                full
                onClick={async () => {
                  const id = li.id!;
                  editingId.value = null;
                  await removeListItem(id);
                }}
                class="mt-2"
              >
                Remove from list
              </Button>
            </div>
          );
        })()}
      </Sheet>

      {/* FAB — opens the full-screen add page (Plan mode only) */}
      {mode.value === "plan" && (
        <div
          class="fixed right-4 z-30"
          style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
        >
          <Fab
            icon="plus"
            label="Add items"
            aria-label="Add items"
            onClick={openAdd}
          />
        </div>
      )}

      {
        /* Keyboard primer — focused inside the FAB tap (see openAdd) so mobile
          browsers open the soft keyboard; focus then transfers to the overlay's
          search field, which keeps it open. Kept always-mounted and offscreen. */
      }
      <input
        ref={primerRef}
        type="text"
        aria-hidden="true"
        tabIndex={-1}
        class="fixed top-0 left-0 opacity-0 pointer-events-none"
        style={{ width: 1, height: 1, fontSize: 16 }}
      />

      {
        /* Add-items surface as a full-screen overlay. z-50 sits above the shell
          chrome (nav z-40); the internal editor Sheet (z-[200]) still layers on
          top. Fresh initial state is passed from the current signals so reopening
          reflects the latest list. */
      }
      {addOpen.value && (
        <div class="fixed inset-0 z-50 bg-surface overflow-y-auto">
          <AddItems
            listId={listId}
            listName={listName}
            items={items.value as Required<ItemInterface>[]}
            shoppingList={[...list.value, ...checkedItems.value]}
            categories={categories.value}
            initialQuery=""
            onClose={closeAdd}
          />
        </div>
      )}

      {/* ══════════════════════ Snackbar ══════════════════════ */}
      <Snackbar data={snackData.value} />
    </div>
  );
}
