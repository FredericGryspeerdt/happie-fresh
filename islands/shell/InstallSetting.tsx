import { useEffect, useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { Button } from "@/components/md3/Button.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { InstallGuidance } from "@/components/shell/InstallGuidance.tsx";
import { useInstallPrompt } from "@/islands/shell/useInstallPrompt.ts";

interface Props {
  /** Rendered as the More sheet's row; the sheet closes itself on tap. */
  onOpen?: () => void;
}

/**
 * The durable home for "put Happie on your home screen", reachable from the
 * More sheet. One-tap native install where the browser offers it
 * (Chromium), guided steps everywhere else.
 */
export default function InstallSetting({ onOpen }: Props) {
  const { state, busy, promptInstall } = useMemo(
    () => useInstallPrompt(),
    [],
  );
  const open = useSignal(false);
  const message = useSignal<string | null>(null);

  // The row hides for installed users only after hydration: SSR and the
  // first client render must agree (§11), so the flip waits for mount.
  const mounted = useSignal(false);
  useEffect(() => {
    mounted.value = true;
  }, []);
  if (mounted.value && state.value === "installed" && !open.value) {
    return null;
  }

  // Matches MoreSheet's badge() helper — this row sits among its rows.
  const badge = (
    <span
      class="grid place-items-center bg-primary-container text-on-primary-container rounded-full"
      style={{ width: 40, height: 40 }}
    >
      <Icon name="download" size={20} />
    </span>
  );

  return (
    <>
      <ListItem
        leading={badge}
        headline="De app installeren"
        trailing={<Icon name="chevron" size={18} />}
        onClick={() => {
          onOpen?.();
          open.value = true;
        }}
      />

      <Sheet
        open={open.value}
        onClose={() => (open.value = false)}
        title="De app installeren"
      >
        {open.value && (
          <div class="flex flex-col gap-3 pb-1">
            {state.value === "installed" && (
              <div class="md-body-medium text-on-surface-variant">
                Happie staat al op je beginscherm.
              </div>
            )}

            {state.value === "promptable" && (
              <>
                <div class="md-body-medium text-on-surface-variant">
                  Zet Happie op je beginscherm. De app opent op het volledige
                  scherm, net als je andere apps.
                </div>
                <Button
                  variant="filled"
                  full
                  loading={busy.value}
                  onClick={async () => {
                    const outcome = await promptInstall();
                    message.value = outcome === "accepted"
                      ? "Happie staat op je beginscherm!"
                      : outcome === "dismissed"
                      ? "Misschien later — je kunt altijd terugkomen."
                      : "Dat is niet gelukt. Probeer opnieuw.";
                  }}
                >
                  Happie installeren
                </Button>
              </>
            )}

            {state.value === "ios-browser" && <InstallGuidance variant="ios" />}

            {state.value === "manual" && <InstallGuidance variant="generic" />}

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
