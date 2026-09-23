import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { Button } from "@/components/md3/Button.tsx";

const STARTUP_QUERY =
  "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)";

interface StandaloneNavigator extends Navigator {
  standalone?: boolean;
}

export default function LaunchDiagnostics() {
  const report = useSignal("Measuring…");
  const copyLabel = useSignal("Copy report");

  useEffect(() => {
    const data = {
      url: location.href,
      userAgent: navigator.userAgent,
      standalone: (navigator as StandaloneNavigator).standalone ?? null,
      displayModeStandalone: matchMedia("(display-mode: standalone)").matches,
      startupQuery: STARTUP_QUERY,
      startupQueryMatches: matchMedia(STARTUP_QUERY).matches,
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        orientation: screen.orientation?.type ?? null,
      },
      viewport: { width: innerWidth, height: innerHeight },
      devicePixelRatio,
      visibilityState: document.visibilityState,
    };
    report.value = JSON.stringify(data, null, 2);
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(report.value);
    copyLabel.value = "Copied";
  };

  return (
    <main class="mx-auto max-w-xl px-4 py-8">
      <h1 class="md-headline-large mb-3">Launch diagnostics</h1>
      <p class="md-body-medium text-on-surface-variant mb-4">
        Open this page from the installed Happie app, then copy the report.
      </p>
      <pre class="mb-4 overflow-x-auto whitespace-pre-wrap rounded-xl bg-surface-c p-4 text-xs">
        {report.value}
      </pre>
      <Button onClick={copy}>{copyLabel.value}</Button>
    </main>
  );
}
