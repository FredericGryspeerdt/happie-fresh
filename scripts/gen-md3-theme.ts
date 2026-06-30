// scripts/gen-md3-theme.ts
// One-off: prints the baked MD3 :root CSS-var block for a seed hex.
// Usage: deno run scripts/gen-md3-theme.ts "#FFC21E"
function hexToOklch(hex: string) {
  const h = hex.replace("#", "");
  let r = parseInt(h.slice(0, 2), 16) / 255;
  let g = parseInt(h.slice(2, 4), 16) / 255;
  let b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (
    v: number,
  ) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  r = lin(r);
  g = lin(g);
  b = lin(b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { C, H };
}
function buildScheme(seedHex: string) {
  const seed = hexToOklch(seedHex);
  const Hp = seed.H;
  const Ht = (Hp + 50) % 360;
  const Cp = Math.min(Math.max(seed.C, 0.10), 0.16);
  const Cs = 0.045, Ct = 0.085, Cn = 0.006, Cnv = 0.018;
  const damp = (t: number) => 1 - Math.pow(Math.abs(t - 50) / 50, 1.6) * 0.45;
  const T = (t: number, c: number, hue: number) =>
    `oklch(${t}% ${(c * damp(t)).toFixed(4)} ${hue.toFixed(1)})`;
  const P = (t: number) => T(t, Cp, Hp),
    Sc = (t: number) => T(t, Cs, Hp),
    Tc = (t: number) => T(t, Ct, Ht),
    N = (t: number) => T(t, Cn, Hp),
    NV = (t: number) => T(t, Cnv, Hp);
  return {
    primary: P(46),
    onPrimary: "#ffffff",
    primaryContainer: P(90),
    onPrimaryContainer: P(26),
    primaryFixedDim: P(82),
    secondary: Sc(46),
    onSecondary: "#ffffff",
    secondaryContainer: Sc(91),
    onSecondaryContainer: Sc(26),
    tertiary: Tc(46),
    onTertiary: "#ffffff",
    tertiaryContainer: Tc(90),
    onTertiaryContainer: Tc(26),
    error: "oklch(50% 0.18 27)",
    onError: "#ffffff",
    errorContainer: "oklch(92% 0.05 25)",
    onErrorContainer: "oklch(30% 0.12 27)",
    success: T(52, 0.12, 150),
    successContainer: T(92, 0.05, 150),
    onSuccessContainer: T(28, 0.09, 150),
    background: N(99),
    surface: N(99),
    surfaceDim: N(89),
    surfaceBright: N(99),
    surfaceContainerLowest: "#ffffff",
    surfaceContainerLow: N(97),
    surfaceContainer: N(95),
    surfaceContainerHigh: N(93),
    surfaceContainerHighest: N(91),
    onSurface: N(17),
    onSurfaceVariant: NV(38),
    outline: NV(52),
    outlineVariant: NV(83),
    inverseSurface: N(24),
    inverseOnSurface: N(95),
    inversePrimary: P(80),
  };
}
const map: Record<string, string> = {
  "--md-primary": "primary",
  "--md-on-primary": "onPrimary",
  "--md-primary-container": "primaryContainer",
  "--md-on-primary-container": "onPrimaryContainer",
  "--md-secondary": "secondary",
  "--md-on-secondary": "onSecondary",
  "--md-secondary-container": "secondaryContainer",
  "--md-on-secondary-container": "onSecondaryContainer",
  "--md-tertiary": "tertiary",
  "--md-on-tertiary": "onTertiary",
  "--md-tertiary-container": "tertiaryContainer",
  "--md-on-tertiary-container": "onTertiaryContainer",
  "--md-error": "error",
  "--md-on-error": "onError",
  "--md-error-container": "errorContainer",
  "--md-on-error-container": "onErrorContainer",
  "--md-success": "success",
  "--md-success-container": "successContainer",
  "--md-on-success-container": "onSuccessContainer",
  "--md-background": "background",
  "--md-surface": "surface",
  "--md-surface-dim": "surfaceDim",
  "--md-surface-bright": "surfaceBright",
  "--md-surface-clow": "surfaceContainerLow",
  "--md-surface-clowest": "surfaceContainerLowest",
  "--md-surface-c": "surfaceContainer",
  "--md-surface-chigh": "surfaceContainerHigh",
  "--md-surface-chighest": "surfaceContainerHighest",
  "--md-on-surface": "onSurface",
  "--md-on-surface-variant": "onSurfaceVariant",
  "--md-outline": "outline",
  "--md-outline-variant": "outlineVariant",
  "--md-inverse-surface": "inverseSurface",
  "--md-inverse-on-surface": "inverseOnSurface",
  "--md-inverse-primary": "inversePrimary",
};
const seed = Deno.args[0] ?? "#FFC21E";
const s = buildScheme(seed) as Record<string, string>;
const lines = Object.entries(map).map(([cssVar, key]) =>
  `  ${cssVar}: ${s[key]};`
);
console.log(
  `/* MD3 scheme baked from seed ${seed} — regenerate with scripts/gen-md3-theme.ts */\n:root {\n${
    lines.join("\n")
  }\n}`,
);
