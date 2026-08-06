import { useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { Button } from "@/components/md3/Button.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
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
  const { state, busy, enable, disable, sendTest } = useMemo(
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
        headline="Notifications"
        trailing={<Icon name="chevron" size={18} />}
        onClick={() => {
          onOpen?.();
          open.value = true;
        }}
      />

      <Sheet
        open={open.value}
        onClose={() => (open.value = false)}
        title="Notifications"
      >
        {open.value && (
          <div class="flex flex-col gap-3 pb-1">
            {state.value === "unsupported" && (
              <div class="md-body-medium text-on-surface-variant">
                This browser can't show notifications.
              </div>
            )}

            {state.value === "needs-install" && (
              <div class="md-body-medium text-on-surface-variant">
                Add Happie to your home screen first — on iPhone and iPad,
                notifications only work once the app is installed.
              </div>
            )}

            {state.value === "denied" && (
              <div class="md-body-medium text-on-surface-variant">
                Notifications are blocked. You'll need to allow them for Happie
                in your browser settings.
              </div>
            )}

            {state.value === "default" && (
              <>
                <div class="md-body-medium text-on-surface-variant">
                  Get a nudge on this device when a to-do is due.
                </div>
                <Button
                  variant="filled"
                  full
                  loading={busy.value}
                  onClick={async () => {
                    const ok = await enable();
                    message.value = ok
                      ? "Reminders are on."
                      : "That didn't work. Try again?";
                  }}
                >
                  Turn on reminders
                </Button>
              </>
            )}

            {state.value === "granted" && (
              <>
                <div class="md-body-medium text-on-surface-variant">
                  Reminders are on for this device.
                </div>
                <Button
                  variant="tonal"
                  full
                  loading={busy.value}
                  onClick={async () => {
                    const res = await sendTest();
                    message.value = res && res.sent > 0
                      ? "Sent — it should arrive in a moment."
                      : "Couldn't send it. Try again?";
                  }}
                >
                  Send a test notification
                </Button>
                <Button
                  variant="text"
                  full
                  loading={busy.value}
                  onClick={async () => {
                    await disable();
                    message.value = "Reminders are off for this device.";
                  }}
                >
                  Turn off on this device
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
