// islands/design/DesignShowcase.tsx — dev-only, served by /design (404 in
// production). Every md3 component in its states: the live-verification
// surface for component work.
import { useSignal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { Button } from "@/components/md3/Button.tsx";
import { Card } from "@/components/md3/Card.tsx";
import { Chip } from "@/components/md3/Chip.tsx";
import { Dialog } from "@/components/md3/Dialog.tsx";
import { Divider } from "@/components/md3/Divider.tsx";
import { FullScreenDialog } from "@/components/md3/FullScreenDialog.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { ListSubheader } from "@/components/md3/ListSubheader.tsx";
import { Progress } from "@/components/md3/Progress.tsx";
import { Segmented } from "@/components/md3/Segmented.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
import { Spinner } from "@/components/md3/Spinner.tsx";
import { Switch } from "@/components/md3/Switch.tsx";
import { TextField } from "@/components/md3/TextField.tsx";

function Section(
  { title, children }: { title: string; children?: ComponentChildren },
) {
  return (
    <section class="flex flex-col gap-3">
      <h2 class="md-title-medium text-on-surface pt-6">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignShowcase() {
  const name = useSignal("");
  const notes = useSignal("");
  const seg = useSignal("plan");
  const wake = useSignal(true);
  const push = useSignal(false);
  const dialogOpen = useSignal(false);
  const dialogName = useSignal("");
  const fsOpen = useSignal(false);
  const sheetOpen = useSignal(false);
  const snack = useSignal<{ msg: string } | null>(null);
  return (
    <div class="flex flex-col gap-2 pb-24">
      <h1 class="md-headline-small text-on-surface pt-4">MD3 showcase</h1>
      <p class="md-body-medium text-on-surface-variant">
        Dev-only. Every component in its states — the live-verification surface
        for component work.
      </p>

      <Section title="Buttons">
        <div class="flex flex-wrap gap-2 items-center">
          <Button>Filled</Button>
          <Button variant="tonal">Tonal</Button>
          <Button variant="elevated">Elevated</Button>
          <Button variant="outlined">Outlined</Button>
          <Button variant="text">Text</Button>
          <Button variant="error">Error</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
          <Button icon="plus">With icon</Button>
          <IconButton name="edit" aria-label="Edit" />
          <IconButton name="trash" variant="tonal" aria-label="Delete" />
        </div>
      </Section>

      <Section title="Text fields">
        <TextField
          id="sc-name"
          label="Name"
          value={name.value}
          onInput={(v) => name.value = v}
          placeholder="e.g. Frida"
          supporting="Visible to the household"
          icon="user"
        />
        <TextField
          id="sc-error"
          label="With error"
          value=""
          onInput={() => {}}
          error="Name is required"
        />
        <TextField
          id="sc-disabled"
          label="Disabled"
          value="Can't touch this"
          onInput={() => {}}
          disabled
        />
        <TextField
          id="sc-notes"
          label="Notes (multiline)"
          value={notes.value}
          onInput={(v) => notes.value = v}
          multiline
          rows={3}
        />
      </Section>

      <Section title="Switches">
        <Card pad={0}>
          <ListItem
            headline="Keep screen awake"
            supporting="While the shopping list is open"
            trailing={
              <Switch
                checked={wake.value}
                onChange={(v) => wake.value = v}
                aria-label="Keep screen awake"
              />
            }
          />
          <Divider inset />
          <ListItem
            headline="Notifications"
            supporting="Due to-dos on this device"
            trailing={
              <Switch
                checked={push.value}
                onChange={(v) => push.value = v}
                aria-label="Notifications"
              />
            }
          />
          <Divider inset />
          <ListItem
            headline="Disabled switch"
            trailing={
              <Switch
                checked={false}
                onChange={() => {}}
                disabled
                aria-label="Disabled"
              />
            }
          />
        </Card>
      </Section>

      <Section title="Dividers & lists">
        <Card pad={0}>
          <ListSubheader>General</ListSubheader>
          <ListItem headline="A list item" supporting="With supporting text" />
          <Divider inset />
          <ListItem headline="Another item" trailing="Meta" />
          <Divider />
          <ListSubheader>Danger zone</ListSubheader>
          <ListItem headline="Full-width divider above" />
        </Card>
      </Section>

      <Section title="Dialogs">
        <div class="flex flex-wrap gap-2">
          <Button variant="tonal" onClick={() => dialogOpen.value = true}>
            Basic dialog
          </Button>
          <Button variant="tonal" onClick={() => fsOpen.value = true}>
            Full-screen dialog
          </Button>
          <Button variant="tonal" onClick={() => sheetOpen.value = true}>
            Sheet (for comparison)
          </Button>
        </div>
      </Section>

      <Section title="Chips & segmented">
        <div class="flex flex-wrap gap-2">
          <Chip selected>Selected</Chip>
          <Chip>Unselected</Chip>
          <Chip icon="tag">With icon</Chip>
        </div>
        <Segmented
          options={[["plan", "edit", "Plan"], ["shop", "cart", "Shop"]]}
          value={seg.value}
          onChange={(v) => seg.value = v}
        />
      </Section>

      <Section title="Feedback">
        <div class="flex items-center gap-4">
          <Spinner />
          <div class="flex-1">
            <Progress value={3} total={5} />
          </div>
          <Button
            variant="text"
            onClick={() => {
              snack.value = { msg: "Saved to the household" };
              setTimeout(() => snack.value = null, 3000);
            }}
          >
            Snackbar
          </Button>
        </div>
      </Section>

      <Dialog
        open={dialogOpen.value}
        onClose={() => dialogOpen.value = false}
        headline="Rename list"
        actions={
          <>
            <Button variant="text" onClick={() => dialogOpen.value = false}>
              Cancel
            </Button>
            <Button variant="text" onClick={() => dialogOpen.value = false}>
              Rename
            </Button>
          </>
        }
      >
        <div class="pt-2">
          <TextField
            id="sc-dialog-name"
            label="Name"
            value={dialogName.value}
            onInput={(v) => dialogName.value = v}
            placeholder="Type with the keyboard open"
          />
        </div>
      </Dialog>

      <FullScreenDialog
        open={fsOpen.value}
        onClose={() => fsOpen.value = false}
        title="New member"
        action={
          <Button variant="text" onClick={() => fsOpen.value = false}>
            Save
          </Button>
        }
      >
        <div class="flex flex-col gap-4 pt-2">
          <TextField
            id="sc-fs-name"
            label="Name"
            value={name.value}
            onInput={(v) => name.value = v}
          />
          <TextField
            id="sc-fs-notes"
            label="Notes"
            value={notes.value}
            onInput={(v) => notes.value = v}
            multiline
          />
          <ListItem
            headline="Manager"
            supporting="Can edit members and delete"
            trailing={
              <Switch
                checked={push.value}
                onChange={(v) => push.value = v}
                aria-label="Manager"
              />
            }
          />
        </div>
      </FullScreenDialog>

      <Sheet
        open={sheetOpen.value}
        onClose={() => sheetOpen.value = false}
        title="A bottom sheet"
      >
        <p class="md-body-large text-on-surface pb-4">
          Sheets stay the home of keyboard-less overlays: confirmations, action
          lists, pickers.
        </p>
        <Button full onClick={() => sheetOpen.value = false}>Got it</Button>
      </Sheet>

      <Snackbar data={snack.value} />
    </div>
  );
}
