// islands/design/DesignShowcase.tsx — dev-only, served by /design (404 in
// production). Every md3 component in its states: the live-verification
// surface for component work.
import { useEffect, useRef } from "preact/hooks";
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
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The dismiss timer must not fire against an unmounted showcase.
  useEffect(() => () => {
    if (snackTimer.current) clearTimeout(snackTimer.current);
  }, []);

  const showSnack = (msg: string) => {
    snack.value = { msg };
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => snack.value = null, 3000);
  };

  return (
    <div class="flex flex-col gap-2 pb-24">
      <h1 class="md-headline-small text-on-surface pt-4">MD3-voorbeelden</h1>
      <p class="md-body-medium text-on-surface-variant">
        Alleen voor ontwikkelaars. Bekijk elk onderdeel in zijn verschillende
        toestanden.
      </p>

      <Section title="Knoppen">
        <div class="flex flex-wrap gap-2 items-center">
          <Button>Gevuld</Button>
          <Button variant="tonal">Getint</Button>
          <Button variant="elevated">Met schaduw</Button>
          <Button variant="outlined">Omlijnd</Button>
          <Button variant="text">Tekst</Button>
          <Button variant="error">Fout</Button>
          <Button disabled>Uitgeschakeld</Button>
          <Button loading>Laden</Button>
          <Button icon="plus">Met pictogram</Button>
          <IconButton name="edit" aria-label="Bewerken" />
          <IconButton name="trash" variant="tonal" aria-label="Verwijderen" />
        </div>
      </Section>

      <Section title="Tekstvelden">
        <TextField
          id="sc-name"
          label="Naam"
          value={name.value}
          onInput={(v) => name.value = v}
          placeholder="bv. Frida"
          supporting="Zichtbaar voor het huishouden"
          icon="user"
        />
        <TextField
          id="sc-error"
          label="Met foutmelding"
          value=""
          onInput={() => {}}
          error="Naam is verplicht"
        />
        <TextField
          id="sc-disabled"
          label="Uitgeschakeld"
          value="Niet bewerkbaar"
          onInput={() => {}}
          disabled
        />
        <TextField
          id="sc-notes"
          label="Notities (meerdere regels)"
          value={notes.value}
          onInput={(v) => notes.value = v}
          multiline
          rows={3}
        />
      </Section>

      <Section title="Schakelaars">
        <Card pad={0}>
          <ListItem
            headline="Scherm aanhouden"
            supporting="Zolang de boodschappenlijst openstaat"
            trailing={
              <Switch
                checked={wake.value}
                onChange={(v) => wake.value = v}
                aria-label="Scherm aanhouden"
              />
            }
          />
          <Divider inset />
          <ListItem
            headline="Meldingen"
            supporting="Herinneringen op dit toestel"
            trailing={
              <Switch
                checked={push.value}
                onChange={(v) => push.value = v}
                aria-label="Meldingen"
              />
            }
          />
          <Divider inset />
          <ListItem
            headline="Uitgeschakelde schakelaar"
            trailing={
              <Switch
                checked={false}
                onChange={() => {}}
                disabled
                aria-label="Uitgeschakeld"
              />
            }
          />
        </Card>
      </Section>

      <Section title="Scheidingslijnen en lijsten">
        <Card pad={0}>
          <ListSubheader>Algemeen</ListSubheader>
          <ListItem
            headline="Een product op de lijst"
            supporting="Met toelichting"
          />
          <Divider inset />
          <ListItem headline="Nog een product" trailing="Informatie" />
          <Divider />
          <ListSubheader>Gevarenzone</ListSubheader>
          <ListItem headline="Scheidingslijn over de volledige breedte hierboven" />
        </Card>
      </Section>

      <Section title="Dialoogvensters">
        <div class="flex flex-wrap gap-2">
          <Button variant="tonal" onClick={() => dialogOpen.value = true}>
            Eenvoudig dialoogvenster
          </Button>
          <Button variant="tonal" onClick={() => fsOpen.value = true}>
            Dialoogvenster op volledig scherm
          </Button>
          <Button variant="tonal" onClick={() => sheetOpen.value = true}>
            Schuifpaneel (ter vergelijking)
          </Button>
        </div>
      </Section>

      <Section title="Keuzeknoppen en segmenten">
        <div class="flex flex-wrap gap-2">
          <Chip selected>Geselecteerd</Chip>
          <Chip>Niet geselecteerd</Chip>
          <Chip icon="tag">Met pictogram</Chip>
        </div>
        <Segmented
          options={[["plan", "edit", "Plannen"], ["shop", "cart", "Winkelen"]]}
          value={seg.value}
          onChange={(v) => seg.value = v}
        />
      </Section>

      <Section title="Terugkoppeling">
        <div class="flex items-center gap-4">
          <Spinner />
          <div class="flex-1">
            <Progress value={3} total={5} />
          </div>
          <Button
            variant="text"
            onClick={() => showSnack("Opgeslagen voor het huishouden")}
          >
            Korte melding
          </Button>
        </div>
      </Section>

      <Dialog
        open={dialogOpen.value}
        onClose={() => dialogOpen.value = false}
        headline="Lijstnaam wijzigen"
        actions={
          <>
            <Button variant="text" onClick={() => dialogOpen.value = false}>
              Annuleren
            </Button>
            <Button variant="text" onClick={() => dialogOpen.value = false}>
              Naam wijzigen
            </Button>
          </>
        }
      >
        <div class="pt-2">
          <TextField
            id="sc-dialog-name"
            label="Naam"
            value={dialogName.value}
            onInput={(v) => dialogName.value = v}
            placeholder="Typ met het toetsenbord open"
          />
        </div>
      </Dialog>

      <FullScreenDialog
        open={fsOpen.value}
        onClose={() => fsOpen.value = false}
        title="Nieuw lid"
        action={
          <Button variant="text" onClick={() => fsOpen.value = false}>
            Opslaan
          </Button>
        }
      >
        <div class="flex flex-col gap-4 pt-2">
          <TextField
            id="sc-fs-name"
            label="Naam"
            value={name.value}
            onInput={(v) => name.value = v}
          />
          <TextField
            id="sc-fs-notes"
            label="Notities"
            value={notes.value}
            onInput={(v) => notes.value = v}
            multiline
          />
          <ListItem
            headline="Beheerder"
            supporting="Kan leden bewerken en gegevens verwijderen"
            trailing={
              <Switch
                checked={push.value}
                onChange={(v) => push.value = v}
                aria-label="Beheerder"
              />
            }
          />
        </div>
      </FullScreenDialog>

      <Sheet
        open={sheetOpen.value}
        onClose={() => sheetOpen.value = false}
        title="Een schuifpaneel onderaan"
      >
        <p class="md-body-large text-on-surface pb-4">
          Schuifpanelen zijn bedoeld voor vensters zonder toetsenbord:
          bevestigingen, actielijsten en keuzes.
        </p>
        <Button full onClick={() => sheetOpen.value = false}>Begrepen</Button>
      </Sheet>

      <Snackbar data={snack.value} />
    </div>
  );
}
