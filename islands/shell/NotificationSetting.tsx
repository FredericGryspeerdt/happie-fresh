import { useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { Button } from "@/components/md3/Button.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { InstallGuidance } from "@/components/shell/InstallGuidance.tsx";
import { usePushNotifications } from "@/islands/shell/usePushNotifications.ts";

interface Props {
  /** Rendered as the More sheet's row; the sheet closes itself on tap. */
  onOpen?: () => void;
}

/**
 * The durable home for notifications, reachable from the More sheet.
 *
 * This exists so the contextual nudge on /todos can be safely dismissed: a nudge
 * you can dismiss and never recover is a trap. It also carries the test button,
 * which is the only way to confirm the pipeline on a real phone without waiting
 * for a cron tick.
 */
export default function NotificationSetting({ onOpen }: Props) {
  const { state, busy, enable, disable, sendTest, syncIfGranted } = useMemo(
    () => usePushNotifications(),
    [],
  );
  const open = useSignal(false);
  const message = useSignal<string | null>(null);

  // Matches MoreSheet's own badge() helper rather than inventing a style: this
  // row sits directly among Shopping, To-dos and Loyalty cards.
  const badge = (
    <span
      class="grid place-items-center bg-primary-container text-on-primary-container rounded-full"
      style={{ width: 40, height: 40 }}
    >
      <Icon name="bell" size={20} />
    </span>
  );

  return (
    <>
      <ListItem
        leading={badge}
        headline="Meldingen"
        trailing={<Icon name="chevron" size={18} />}
        onClick={() => {
          onOpen?.();
          open.value = true;
          // Silent repair for a device whose permission is granted but which
          // the server has never heard of (a phone restored from backup keeps
          // the permission, not the push endpoint). Runs inside the tap so
          // Safari treats the subscribe as user-initiated; nothing to show if
          // it fails — the test button below reports the real outcome.
          syncIfGranted().catch((err) =>
            console.error("[push] resubscribe failed", err)
          );
        }}
      />

      <Sheet
        open={open.value}
        onClose={() => (open.value = false)}
        title="Meldingen"
      >
        {open.value && (
          <div class="flex flex-col gap-3 pb-1">
            {state.value === "unsupported" && (
              <div class="md-body-medium text-on-surface-variant">
                Deze browser kan geen meldingen tonen.
              </div>
            )}

            {state.value === "needs-install" && (
              <>
                <div class="md-body-medium text-on-surface-variant">
                  Zet Happie eerst op je beginscherm. Op iPhone en iPad werken
                  meldingen alleen als de app geïnstalleerd is.
                </div>
                <InstallGuidance variant="ios" />
              </>
            )}

            {state.value === "denied" && (
              <div class="md-body-medium text-on-surface-variant">
                Meldingen zijn geblokkeerd. Geef Happie toestemming in de
                instellingen van je browser.
              </div>
            )}

            {(state.value === "default" || state.value === "disabled") && (
              <>
                <div class="md-body-medium text-on-surface-variant">
                  Krijg op dit toestel een herinnering wanneer het tijd is om
                  iets te doen.
                </div>
                <Button
                  variant="filled"
                  full
                  loading={busy.value}
                  onClick={async () => {
                    const ok = await enable();
                    message.value = ok
                      ? "Herinneringen zijn ingeschakeld."
                      : "Dat is niet gelukt. Probeer opnieuw.";
                  }}
                >
                  Herinneringen inschakelen
                </Button>
              </>
            )}

            {state.value === "granted" && (
              <>
                <div class="md-body-medium text-on-surface-variant">
                  Herinneringen zijn ingeschakeld op dit toestel.
                </div>
                <Button
                  variant="tonal"
                  full
                  loading={busy.value}
                  onClick={async () => {
                    const res = await sendTest();
                    message.value = res && res.sent > 0
                      ? "Verstuurd — de melding komt zo aan."
                      : "Versturen is niet gelukt. Probeer opnieuw.";
                  }}
                >
                  Testmelding versturen
                </Button>
                <Button
                  variant="text"
                  full
                  loading={busy.value}
                  onClick={async () => {
                    const ok = await disable();
                    message.value = ok
                      ? "Herinneringen zijn uitgeschakeld op dit toestel."
                      : "Herinneringen uitschakelen is niet gelukt. Probeer opnieuw.";
                  }}
                >
                  Uitschakelen op dit toestel
                </Button>
              </>
            )}

            {message.value && (
              <div class="md-body-small text-on-surface-variant">
                {message.value}
              </div>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
