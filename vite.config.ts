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
