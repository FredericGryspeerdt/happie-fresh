interface InstallGuidanceProps {
  variant: "ios" | "generic";
}

/**
 * Step-by-step "add Happie to your home screen" instructions. Purely
 * presentational — the Chromium one-tap install button lives in
 * islands/shell/InstallSetting.tsx, not here.
 */
export function InstallGuidance({ variant }: InstallGuidanceProps) {
  if (variant === "generic") {
    return (
      <div class="md-body-medium text-on-surface-variant">
        Open het menu van je browser en zoek naar <b>App installeren</b> of{" "}
        <b>Zet op beginscherm</b>.
      </div>
    );
  }
  return (
    <ol
      class="flex flex-col gap-2 md-body-medium text-on-surface-variant list-decimal"
      style={{ paddingLeft: "20px" }}
    >
      <li>
        Tik op de knop <b>Delen</b>{" "}
        (het vierkant met een pijl) in de knoppenbalk van Safari.
      </li>
      <li>
        Scrol omlaag en tik op <b>Zet op beginscherm</b>.
      </li>
      <li>
        Tik op <b>Toevoegen</b>{" "}
        — Happie krijgt een eigen pictogram en opent op het volledige scherm. Je
        kunt dan ook herinneringen ontvangen.
      </li>
    </ol>
  );
}
