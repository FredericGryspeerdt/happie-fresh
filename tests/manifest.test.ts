import { assert, assertEquals } from "jsr:@std/assert@^1.0.19";
import { NAV_CONFIG } from "@/config/navigation.ts";

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface ManifestShortcut {
  name: string;
  url: string;
  icons?: ManifestIcon[];
}

interface Manifest {
  name: string;
  short_name: string;
  id: string;
  description: string;
  display: string;
  theme_color: string;
  background_color: string;
  scope: string;
  start_url: string;
  icons: ManifestIcon[];
  shortcuts: ManifestShortcut[];
}

const manifest: Manifest = JSON.parse(
  await Deno.readTextFile("static/manifest.webmanifest"),
);

Deno.test("manifest — standalone display (fullscreen hides the status bar)", () => {
  assertEquals(manifest.display, "standalone");
});

Deno.test("manifest — MD3 surface color for theme and splash background", () => {
  assertEquals(manifest.theme_color, "#fdfcf9");
  assertEquals(manifest.background_color, "#fdfcf9");
});

Deno.test("manifest — stable identity and install metadata", () => {
  assertEquals(manifest.id, "/");
  assertEquals(manifest.scope, "/");
  assertEquals(manifest.start_url, "/");
  assert(manifest.description.length > 0, "description missing");
});

Deno.test("manifest — icons cover 192, 512 and maskable, all files exist", async () => {
  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert(sizes.includes("192x192"), "192x192 icon missing");
  assert(sizes.includes("512x512"), "512x512 icon missing");
  assert(
    manifest.icons.some((icon) => icon.purpose === "maskable"),
    "maskable icon missing",
  );
  const all = [
    ...manifest.icons,
    ...manifest.shortcuts.flatMap((shortcut) => shortcut.icons ?? []),
  ];
  for (const icon of all) {
    const stat = await Deno.stat(`static${icon.src}`);
    assert(stat.isFile, `icon file missing: ${icon.src}`);
  }
});

Deno.test("manifest — every shortcut targets a navigation route", () => {
  assert(manifest.shortcuts.length >= 3, "expected at least 3 shortcuts");
  const routes = NAV_CONFIG.map((item) => item.defaultRoute);
  for (const shortcut of manifest.shortcuts) {
    assert(
      routes.includes(shortcut.url),
      `shortcut "${shortcut.name}" targets unknown route ${shortcut.url}`,
    );
  }
});
