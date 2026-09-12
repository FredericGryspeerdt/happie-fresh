import { useSignal } from "@preact/signals";
import type { ShoppingListInterface } from "@/models/index.ts";
import { Dialog } from "@/components/md3/Dialog.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { TextField } from "@/components/md3/TextField.tsx";

interface Props {
  open: boolean;
  lists: ShoppingListInterface[];
  markedListId: string | null;
  markedLabel: string;
  busy: boolean;
  onPick: (list: ShoppingListInterface) => void;
  onCreate: (name: string) => Promise<boolean>;
  onClose: () => void;
}

const DEFAULT_NAME = "Groceries";

// "Which list?" — a picker in a Dialog; typing a new list's name
// happens in a centered Dialog (patterns doc §9). With no lists at all the
// Dialog opens directly.
export function ShoppingListPickerDialog(
  { open, lists, markedListId, markedLabel, busy, onPick, onCreate, onClose }:
    Props,
) {
  const noLists = lists.length === 0;
  // Only prefill "Groceries" when the household has no lists at all — once
  // there's at least one, a new list is a deliberate addition and shouldn't
  // nudge the name toward a duplicate-sounding default. useSignal's initial
  // value is read only on mount, which is fine here: `noLists` can't flip
  // while this dialog instance is alive.
  const defaultName = noLists ? DEFAULT_NAME : "";
  const creating = useSignal(false);
  const name = useSignal(defaultName);
  const dialogOpen = open && (noLists || creating.value);

  const closeDialog = () => {
    creating.value = false;
    name.value = defaultName;
    if (noLists) onClose();
  };
  const submit = async () => {
    if (await onCreate(name.value)) {
      creating.value = false;
      name.value = defaultName;
    }
  };

  return (
    <>
      {
        /* Not rendered at all with no lists — a closed Dialog still puts its
          title in the DOM, and there is nothing to pick from. */
      }
      {!noLists && (
        // Hide the picker while creating a new list to avoid Escape firing both
        // the picker and create-dialog handlers, and to prevent stacking issues (z-[200]).
        <Dialog
          open={open && !creating.value}
          onClose={onClose}
          headline="Which list?"
        >
          <div class="-mx-6">
            {lists.map((l) => {
              const marked = l.id === markedListId;
              return (
                <ListItem
                  key={l.id}
                  headline={l.name}
                  supporting={marked ? markedLabel : undefined}
                  trailing={marked
                    ? <Icon name="check" size={20} />
                    : undefined}
                  onClick={busy ? undefined : () => onPick(l)}
                />
              );
            })}
          </div>
          <div class="pt-2">
            <Button
              variant="text"
              disabled={busy}
              icon="plus"
              onClick={() => (creating.value = true)}
            >
              New list
            </Button>
          </div>
        </Dialog>
      )}

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        headline="New shopping list"
        actions={
          <>
            <Button variant="text" onClick={closeDialog}>Cancel</Button>
            <Button
              variant="text"
              loading={busy}
              disabled={!name.value.trim()}
              onClick={() => void submit()}
            >
              Create list
            </Button>
          </>
        }
      >
        {noLists && (
          <p class="md-body-medium text-on-surface-variant">
            You don't have a shopping list yet. Let's make one for these
            ingredients.
          </p>
        )}
        <TextField
          id="new-shopping-list-name"
          label="List name"
          value={name.value}
          onInput={(v) => (name.value = v)}
        />
      </Dialog>
    </>
  );
}
