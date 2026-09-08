import { useSignal } from "@preact/signals";
import type { ShoppingListInterface } from "@/models/index.ts";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Dialog } from "@/components/md3/Dialog.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { TextField } from "@/components/md3/TextField.tsx";

interface Props {
  open: boolean;
  lists: ShoppingListInterface[];
  rememberedListId: string | null;
  busy: boolean;
  onPick: (list: ShoppingListInterface) => void;
  onCreate: (name: string) => Promise<boolean>;
  onClose: () => void;
}

const DEFAULT_NAME = "Groceries";

// "Which list?" — a keyboard-less picker on a Sheet; typing a new list's name
// happens in a centered Dialog (patterns doc §9). With no lists at all the
// Dialog opens directly.
export function ShoppingListPickerSheet(
  { open, lists, rememberedListId, busy, onPick, onCreate, onClose }: Props,
) {
  const creating = useSignal(false);
  const name = useSignal(DEFAULT_NAME);
  const noLists = lists.length === 0;
  const dialogOpen = open && (noLists || creating.value);

  const closeDialog = () => {
    creating.value = false;
    if (noLists) onClose();
  };
  const submit = async () => {
    if (await onCreate(name.value)) {
      creating.value = false;
      name.value = DEFAULT_NAME;
    }
  };

  return (
    <>
      {
        /* Not rendered at all with no lists — a closed Sheet still puts its
          title in the DOM, and there is nothing to pick from. */
      }
      {!noLists && (
        <Sheet open={open} onClose={onClose} title="Which list?">
          <div class="-mx-6">
            {lists.map((l) => {
              const remembered = l.id === rememberedListId;
              return (
                <ListItem
                  key={l.id}
                  headline={l.name}
                  supporting={remembered ? "Used last time" : undefined}
                  trailing={remembered
                    ? <Icon name="check" size={20} />
                    : undefined}
                  onClick={() => onPick(l)}
                />
              );
            })}
          </div>
          <div class="pt-2">
            <Button
              variant="text"
              icon="plus"
              onClick={() => (creating.value = true)}
            >
              New list
            </Button>
          </div>
        </Sheet>
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
          label="List name"
          value={name.value}
          onInput={(v) => (name.value = v)}
        />
      </Dialog>
    </>
  );
}
