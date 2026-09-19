import type { ComponentChildren } from "preact";
import { type Signal, useComputed, useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import type {
  CategoryInterface,
  ShoppingListInterface,
  ShoppingListItemInterface,
} from "@/models/index.ts";
import {
  MAX_MOVE_ITEMS,
  type MoveItemsInput,
} from "@/models/shopping-list/move.ts";
import { api } from "@/services/api.ts";
import { beginBusy, endBusy } from "@/utils/loading.ts";
import { Button } from "@/components/md3/Button.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Dialog } from "@/components/md3/Dialog.tsx";
import { Card } from "@/components/md3/Card.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
import { useSnack } from "@/hooks/useSnack.ts";
import { useModal } from "@/components/md3/useModal.ts";
import { SelectionRow } from "./SelectionRow.tsx";

// Mounted inside the Sheet portal so focus is acquired after portal relocation.
function MoveFocusScope(
  { onClose, children }: { onClose: () => void; children: ComponentChildren },
) {
  const surface = useRef<HTMLDivElement>(null);
  useModal(true, onClose, surface);
  return (
    <div
      ref={surface}
      tabIndex={-1}
      class="flex flex-col gap-3 pb-[env(safe-area-inset-bottom)]"
    >
      {children}
    </div>
  );
}

type Entry = ShoppingListItemInterface;
interface Props {
  active: Signal<boolean>;
  busy: Signal<boolean>;
  listId: string;
  listName: string;
  groups: { category: CategoryInterface | null; items: Entry[] }[];
  checked: Entry[];
  otherLists: ShoppingListInterface[];
  getName: (id: string) => string;
  prepareMove: (ids: string[]) => Promise<boolean>;
  onMoved: (ids: string[]) => void;
  onRestored: (items: Entry[]) => void;
}

export function MoveItems(
  {
    active,
    busy,
    listId,
    listName,
    groups,
    checked,
    otherLists,
    getName,
    prepareMove,
    onMoved,
    onRestored,
  }: Props,
) {
  const selected = useSignal(new Set<string>());
  const sheetOpen = useSignal(false);
  const creating = useSignal(false);
  const destinationId = useSignal("");
  const newName = useSignal("");
  const destinations = useSignal(otherLists);
  const error = useSignal("");
  const leaving = useSignal(false);
  const request = useSignal<MoveItemsInput | null>(null);
  const { snack, showSnack } = useSnack(6000);
  const primer = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const handedOff = useSignal(false);
  const count = useComputed(() => selected.value.size);
  const entries = [...groups.flatMap((g) => g.items), ...checked];
  const chosen = entries.filter((e) => selected.value.has(e.id));
  const closeSheet = () => {
    if (!busy.value) sheetOpen.value = false;
  };

  useEffect(() => {
    if (!active.value) {
      selected.value = new Set();
      sheetOpen.value = false;
      creating.value = false;
      request.value = null;
      error.value = "";
    }
  }, [active.value]);
  useEffect(() => {
    if (creating.value) {
      nameInput.current?.focus();
      handedOff.value = true;
    }
  }, [creating.value]);

  const toggle = (id: string) => {
    if (busy.value) return;
    const next = new Set(selected.value);
    if (next.has(id)) next.delete(id);
    else if (next.size < MAX_MOVE_ITEMS) next.add(id);
    else {
      showSnack(`Move up to ${MAX_MOVE_ITEMS} items at a time`);
      return;
    }
    selected.value = next;
    request.value = null;
  };
  const undo = async (requestId: string) => {
    if (busy.value) return;
    busy.value = true;
    beginBusy();
    // Persistent: the outcome is unknown until the request settles, so nothing
    // may dismiss this on a clock (the next snack replaces it).
    showSnack("Undoing move…", undefined, undefined, null);
    try {
      const result = await api.shoppingList.undoMove(listId, requestId);
      if (result?.ok) {
        onRestored(result.items);
        showSnack("Items moved back");
      } else {
        showSnack(
          result?.error ?? "Couldn't confirm Undo. Try again.",
          "Retry",
          () => void undo(requestId),
        );
      }
    } finally {
      busy.value = false;
      endBusy();
    }
  };
  const move = async (create: boolean) => {
    if (
      busy.value || !count.value ||
      (create ? !newName.value.trim() : !destinationId.value)
    ) return;
    busy.value = true;
    error.value = "";
    beginBusy();
    try {
      const ids = [...selected.value];
      if (!await prepareMove(ids)) {
        error.value = "Couldn't save your latest changes. Try moving again.";
        return;
      }
      const input = request.value ?? {
        requestId: crypto.randomUUID(),
        itemIds: ids,
        ...(create
          ? { newListName: newName.value.trim() }
          : { destinationListId: destinationId.value }),
      };
      request.value = input;
      const result = await api.shoppingList.moveItems(listId, input);
      if (!result?.ok) {
        error.value = result?.error ??
          "Couldn't confirm the move. Try again to check.";
        return;
      }
      if (!destinations.value.some((d) => d.id === result.destination.id)) {
        destinations.value = [...destinations.value, result.destination];
      }
      sheetOpen.value = false;
      creating.value = false;
      leaving.value = true;
      await new Promise((resolve) => setTimeout(resolve, 250));
      onMoved(ids);
      leaving.value = false;
      active.value = false;
      showSnack(
        `${result.count} ${
          result.count === 1 ? "item" : "items"
        } moved to ${result.destination.name}`,
        "Undo",
        () => void undo(result.requestId),
      );
    } finally {
      busy.value = false;
      endBusy();
    }
  };
  const renderRows = (items: Entry[]) => (
    <Card variant="filled" pad={0} radius={16}>
      {items.map((item) => (
        <SelectionRow
          key={item.id}
          item={item}
          name={getName(item.itemId)}
          selected={selected.value.has(item.id)}
          disabled={busy.value ||
            (count.value >= MAX_MOVE_ITEMS && !selected.value.has(item.id))}
          exiting={leaving.value && selected.value.has(item.id)}
          onToggle={() => toggle(item.id)}
        />
      ))}
    </Card>
  );

  return (
    <>
      {active.value && (
        <>
          <div class="flex items-center justify-between gap-2">
            <span role="status" class="md-title-medium text-on-surface">
              {count.value} selected
            </span>
            <div class="flex gap-1">
              <Button
                variant="text"
                disabled={busy.value || !count.value}
                onClick={() => {
                  selected.value = new Set();
                  request.value = null;
                }}
              >
                Clear
              </Button>
              <Button
                variant="text"
                disabled={busy.value}
                onClick={() => active.value = false}
              >
                Cancel
              </Button>
            </div>
          </div>
          <p class="md-body-small text-on-surface-variant">
            Choose up to {MAX_MOVE_ITEMS} items to move.
          </p>
          <div class="flex flex-col gap-4">
            {groups.map((g) => (
              <div
                key={g.category?.id ?? "uncategorized"}
                class="flex flex-col gap-2"
              >
                <div class="md-title-small text-primary uppercase tracking-wide px-1">
                  {g.category?.label ?? "Uncategorized"}
                </div>
                {renderRows(g.items)}
              </div>
            ))}
            {checked.length > 0 && (
              <div class="flex flex-col gap-2">
                <div class="md-title-small text-primary px-1">In cart</div>
                {renderRows(checked)}
              </div>
            )}
          </div>
          <div
            class="fixed left-4 right-4 z-30 max-w-md mx-auto"
            style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
          >
            <Button
              full
              disabled={!count.value || busy.value}
              class={`!h-12 ${
                !busy.value && count.value
                  ? "!bg-primary-container !text-on-primary-container"
                  : ""
              }`}
              onClick={() => {
                error.value = "";
                sheetOpen.value = true;
              }}
            >
              Move to list{count.value ? ` (${count.value})` : ""}
            </Button>
          </div>
        </>
      )}
      {sheetOpen.value && (
        <Sheet
          open
          onClose={closeSheet}
          title="Move to list"
          class="w-full sm:max-w-lg sm:mx-auto"
        >
          <MoveFocusScope onClose={closeSheet}>
            <div>
              <p class="md-body-large text-on-surface-variant">
                {count.value} {count.value === 1 ? "item" : "items"} from{" "}
                {listName}
              </p>
              <p class="md-body-medium text-on-surface-variant mt-1 truncate">
                {chosen.slice(0, 3).map((e) => getName(e.itemId)).join(", ")}
                {count.value > 3 ? ` +${count.value - 3} more` : ""}
              </p>
            </div>
            <div class="rounded-2xl bg-surface-chigh overflow-hidden">
              <fieldset
                disabled={busy.value}
                class="max-h-32 overflow-y-auto"
              >
                <legend class="sr-only">Destination list</legend>
                {destinations.value.map((d) => (
                  <label
                    key={d.id}
                    class="flex items-center gap-4 px-4 py-4 min-h-14 cursor-pointer md-body-large"
                  >
                    <input
                      type="radio"
                      name="move-destination"
                      value={d.id}
                      checked={destinationId.value === d.id}
                      onChange={() => {
                        destinationId.value = d.id;
                        request.value = null;
                      }}
                      class="w-5 h-5 shrink-0 accent-primary"
                    />
                    <span class="break-words min-w-0">{d.name}</span>
                  </label>
                ))}
              </fieldset>
              {!destinations.value.length && (
                <p class="px-4 pt-4 md-body-medium text-on-surface-variant">
                  Create a list for these items.
                </p>
              )}
              <div class="border-t border-outline-variant mx-4" />
              <Button
                icon="plus"
                variant="text"
                disabled={busy.value}
                full
                class="!justify-start !h-14"
                onClick={() => {
                  handedOff.value = false;
                  primer.current?.focus();
                  sheetOpen.value = false;
                  creating.value = true;
                  error.value = "";
                  request.value = null;
                }}
              >
                Create new list
              </Button>
            </div>
            {error.value && (
              <p role="alert" class="md-body-medium text-error">
                {error.value}
              </p>
            )}
            <Button
              full
              loading={busy.value}
              disabled={!destinationId.value}
              class={`!h-12 ${
                !busy.value && destinationId.value
                  ? "!bg-primary-container !text-on-primary-container"
                  : ""
              }`}
              onClick={() => void move(false)}
            >
              Move {count.value} {count.value === 1 ? "item" : "items"}
            </Button>
            <Button
              variant="text"
              full
              disabled={busy.value}
              onClick={closeSheet}
            >
              Cancel
            </Button>
          </MoveFocusScope>
        </Sheet>
      )}
      {(!creating.value || !handedOff.value) && (
        <input
          ref={primer}
          type="text"
          aria-hidden="true"
          tabIndex={-1}
          class="fixed top-0 left-0 opacity-0 pointer-events-none"
          style={{ width: 1, height: 1, fontSize: 16 }}
        />
      )}
      {creating.value && (
        <Dialog
          open
          headline="Create new list"
          onClose={() => {
            if (!busy.value) {
              creating.value = false;
              sheetOpen.value = true;
            }
          }}
          actions={
            <>
              <Button
                variant="text"
                disabled={busy.value}
                onClick={() => {
                  creating.value = false;
                  sheetOpen.value = true;
                }}
              >
                Cancel
              </Button>
              <Button
                loading={busy.value}
                disabled={!newName.value.trim()}
                onClick={() => void move(true)}
              >
                Create &amp; move
              </Button>
            </>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void move(true);
            }}
          >
            <label class="block md-body-medium" for="move-new-list-name">
              List name
            </label>
            <input
              ref={nameInput}
              id="move-new-list-name"
              maxLength={100}
              required
              value={newName.value}
              disabled={busy.value}
              onInput={(e) => {
                newName.value = e.currentTarget.value;
                request.value = null;
              }}
              class="mt-2 w-full md-body-large text-on-surface bg-surface-clow rounded-xl border border-outline-variant px-4 py-3"
            />
            <p class="mt-3 md-body-medium">
              {count.value} {count.value === 1 ? "item will" : "items will"}
              {" "}
              move from {listName}.
            </p>
            {error.value && (
              <p role="alert" class="mt-3 md-body-medium text-error">
                {error.value}
              </p>
            )}
          </form>
        </Dialog>
      )}
      <Snackbar data={snack.value} />
    </>
  );
}
