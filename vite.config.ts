import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import tailwindcss from "@tailwindcss/vite";

const CERT_FILE = "certs/dev-cert.pem";
const KEY_FILE = "certs/dev-key.pem";

/**
 * Opt-in HTTPS for on-device testing (`deno task dev:mobile`).
 *
 * PWA features need a secure context, and the session cookie is `Secure`
 * (see routes/login.tsx), so plain HTTP over the LAN cannot even log in.
 * Gated behind an env var rather than "certs happen to exist" so that plain
 * `deno task dev` stays on http://localhost and keeps working without certs.
 *
 * See docs/mobile-testing.md for the mkcert setup.
 */
function mobileHttps() {
  if (Deno.env.get("MOBILE_HTTPS") !== "1") return undefined;

  try {
    return {
      key: Deno.readTextFileSync(KEY_FILE),
      cert: Deno.readTextFileSync(CERT_FILE),
    };
  } catch (cause) {
    throw new Error(
      `MOBILE_HTTPS=1 but no dev certificate found at ${CERT_FILE} / ${KEY_FILE}.\n` +
        `Generate one with mkcert — see docs/mobile-testing.md.`,
      { cause },
    );
  }
}

const https = mobileHttps();

export default defineConfig({
  plugins: [
    fresh(),
    tailwindcss(),
  ],
  ssr: {
    // web-push reaches the server graph through the Deno.cron sweep in main.ts,
    // and it depends on CommonJS packages (asn1.js and friends) that neither
    // Vite's dev SSR module runner nor the production Rollup pass can turn into
    // working ESM — both emit a bundle that dies on `exports is not defined`.
    // Externalising covers transitive deps too, so Deno imports them natively,
    // exactly as it already does under `deno test`.
    //
    // Both settings are needed: `ssr.external` governs dev, and the SSR build
    // needs the Rollup-level external below or it inlines web-push anyway.
    external: ["web-push"],
  },
  environments: {
    ssr: {
      build: {
        rollupOptions: { external: [/^web-push($|\/)/] },
      },
    },
  },
  server: {
    // Both only take effect for `deno task dev:mobile`; `undefined` leaves
    // Vite's defaults (localhost, HTTP) untouched for the normal dev flow.
    https,
    host: https ? true : undefined,
    watch: {
      // Prevent full-page reloads when Deno KV writes to local files
      ignored: [
        "../data/**",
        "../../data/**",
      ],
    },
  },
});
