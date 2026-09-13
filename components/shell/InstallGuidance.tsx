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
        Open your browser's menu and look for <b>Install app</b> or{" "}
        <b>Add to Home Screen</b>.
      </div>
    );
  }
  return (
    <ol
      class="flex flex-col gap-2 md-body-medium text-on-surface-variant list-decimal"
      style={{ paddingLeft: "20px" }}
    >
      <li>
        Tap the <b>Share</b>{" "}
        button (the square with an arrow) in Safari's toolbar.
      </li>
      <li>
        Scroll down and tap <b>Add to Home Screen</b>.
      </li>
      <li>
        Tap <b>Add</b>{" "}
        — Happie gets its own icon and opens full screen, with reminders
        available.
      </li>
    </ol>
  );
}
