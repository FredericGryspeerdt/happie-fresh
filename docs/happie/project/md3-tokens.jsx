// md3-tokens.jsx — Material Design 3 tokens for Happie
// Dynamic color (OKLCH tonal palettes from a seed), MD3 type scale, shape & motion.
// Exports: hexToOklch, buildScheme, MD3Ctx, useMd3, type, MD3_MOTION, MD3_SHAPE, MEMBERS, onTone

/* ───────────── sRGB hex → OKLCH (Björn Ottosson) ───────────── */
function hexToOklch(hex) {
  const h = hex.replace("#", "");
  let r = parseInt(h.slice(0, 2), 16) / 255;
  let g = parseInt(h.slice(2, 4), 16) / 255;
  let b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  r = lin(r); g = lin(g); b = lin(b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L: L * 100, C, H };
}

// readable on-color for a given tone (0–100). Light tones → dark ink, dark → white.
function onTone(toneL) { return toneL > 61 ? "var(--md-on-surface)" : "#ffffff"; }

/* ───────────── tonal palette → MD3 light scheme ─────────────
   Tone T (0–100) maps to OKLCH lightness ≈ T%. Chroma is per-palette,
   damped toward the light/dark extremes so containers stay tasteful. */
function buildScheme(seedHex) {
  const seed = hexToOklch(seedHex);
  const Hp = seed.H;
  const Ht = (Hp + 50) % 360;        // tertiary hue offset (≈ HCT +60)
  const Cp = Math.min(Math.max(seed.C, 0.10), 0.16); // primary chroma, vivid but bounded
  const Cs = 0.045;                  // secondary (muted)
  const Ct = 0.085;                  // tertiary
  const Cn = 0.006;                  // neutral (barely tinted)
  const Cnv = 0.018;                 // neutral-variant

  // damp chroma as tone approaches 0/100 so very light/dark stay clean
  const damp = (t) => {
    const d = 1 - Math.pow(Math.abs(t - 50) / 50, 1.6) * 0.45;
    return d;
  };
  const T = (t, c, hue) => `oklch(${t}% ${(c * damp(t)).toFixed(4)} ${hue.toFixed(1)})`;

  const P = (t) => T(t, Cp, Hp);
  const Sc = (t) => T(t, Cs, Hp);
  const Tc = (t) => T(t, Ct, Ht);
  const N = (t) => T(t, Cn, Hp);
  const NV = (t) => T(t, Cnv, Hp);

  return {
    seed: seedHex,
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
    onBackground: N(15),
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

    // tone of the primary swatch (for on-color decisions on filled buttons)
    _primaryToneL: 46,
  };
}

/* expose scheme as CSS custom props on a root element */
function schemeToVars(s) {
  return {
    "--md-primary": s.primary,
    "--md-on-primary": s.onPrimary,
    "--md-primary-container": s.primaryContainer,
    "--md-on-primary-container": s.onPrimaryContainer,
    "--md-secondary": s.secondary,
    "--md-on-secondary": s.onSecondary,
    "--md-secondary-container": s.secondaryContainer,
    "--md-on-secondary-container": s.onSecondaryContainer,
    "--md-tertiary": s.tertiary,
    "--md-on-tertiary": s.onTertiary,
    "--md-tertiary-container": s.tertiaryContainer,
    "--md-on-tertiary-container": s.onTertiaryContainer,
    "--md-error": s.error,
    "--md-on-error": s.onError,
    "--md-error-container": s.errorContainer,
    "--md-on-error-container": s.onErrorContainer,
    "--md-success": s.success,
    "--md-success-container": s.successContainer,
    "--md-on-success-container": s.onSuccessContainer,
    "--md-background": s.background,
    "--md-surface": s.surface,
    "--md-surface-dim": s.surfaceDim,
    "--md-surface-bright": s.surfaceBright,
    "--md-surface-clow": s.surfaceContainerLow,
    "--md-surface-clowest": s.surfaceContainerLowest,
    "--md-surface-c": s.surfaceContainer,
    "--md-surface-chigh": s.surfaceContainerHigh,
    "--md-surface-chighest": s.surfaceContainerHighest,
    "--md-on-surface": s.onSurface,
    "--md-on-surface-variant": s.onSurfaceVariant,
    "--md-outline": s.outline,
    "--md-outline-variant": s.outlineVariant,
    "--md-inverse-surface": s.inverseSurface,
    "--md-inverse-on-surface": s.inverseOnSurface,
    "--md-inverse-primary": s.inversePrimary,
  };
}

/* ───────────── MD3 type scale (Roboto / Roboto Flex) ─────────────
   Returns a style object for a given role. */
const TYPE = {
  displayLarge:   { fontSize: 44, lineHeight: "52px", fontWeight: 400, letterSpacing: "-0.25px" },
  displayMedium:  { fontSize: 34, lineHeight: "42px", fontWeight: 400 },
  headlineLarge:  { fontSize: 30, lineHeight: "38px", fontWeight: 400 },
  headlineMedium: { fontSize: 26, lineHeight: "34px", fontWeight: 400 },
  headlineSmall:  { fontSize: 23, lineHeight: "30px", fontWeight: 400 },
  titleLarge:     { fontSize: 21, lineHeight: "28px", fontWeight: 400 },
  titleMedium:    { fontSize: 16, lineHeight: "24px", fontWeight: 500, letterSpacing: "0.15px" },
  titleSmall:     { fontSize: 14, lineHeight: "20px", fontWeight: 500, letterSpacing: "0.1px" },
  bodyLarge:      { fontSize: 16, lineHeight: "24px", fontWeight: 400, letterSpacing: "0.15px" },
  bodyMedium:     { fontSize: 14, lineHeight: "20px", fontWeight: 400, letterSpacing: "0.2px" },
  bodySmall:      { fontSize: 12, lineHeight: "16px", fontWeight: 400, letterSpacing: "0.3px" },
  labelLarge:     { fontSize: 14, lineHeight: "20px", fontWeight: 500, letterSpacing: "0.1px" },
  labelMedium:    { fontSize: 12, lineHeight: "16px", fontWeight: 500, letterSpacing: "0.5px" },
  labelSmall:     { fontSize: 11, lineHeight: "16px", fontWeight: 500, letterSpacing: "0.5px" },
};
function type(role, extra) {
  return { fontFamily: "'Roboto Flex', 'Roboto', system-ui, sans-serif", ...TYPE[role], ...extra };
}
// Brand display font — keeps a touch of Happie warmth in headers
function brand(extra) {
  return { fontFamily: "'Baloo 2', system-ui", fontWeight: 700, ...extra };
}

/* ───────────── shape & motion ───────────── */
// shape scale multiplier set by the "corner roundness" tweak
const MD3_SHAPE = {
  none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 28, full: 999,
};
const MD3_MOTION = {
  // emphasized (the MD3 signature) + standard
  emphasized: "cubic-bezier(0.2, 0, 0, 1)",
  emphasizedDecel: "cubic-bezier(0.05, 0.7, 0.1, 1)",
  emphasizedAccel: "cubic-bezier(0.3, 0, 0.8, 0.15)",
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  spring: "cubic-bezier(0.2, 0.9, 0.25, 1.2)",
};

/* family member palette (kept from Happie, tones tuned for MD3 containers) */
const MEMBERS = {
  anke:  { name: "Anke",  role: "Parent", bg: "#FFD98A", fg: "#5C3D00", initial: "A" },
  tom:   { name: "Tom",   role: "Parent", bg: "#AED6F1", fg: "#0E4D6E", initial: "T" },
  lotte: { name: "Lotte", role: "Kid",    bg: "#F3C6E8", fg: "#6E2A60", initial: "L" },
  finn:  { name: "Finn",  role: "Kid",    bg: "#BFE3C4", fg: "#1E5E35", initial: "F" },
};

/* React context carrying the active scheme + shape radius */
const MD3Ctx = React.createContext(null);
function useMd3() { return React.useContext(MD3Ctx); }

Object.assign(window, {
  hexToOklch, buildScheme, schemeToVars, onTone,
  type, brand, TYPE, MD3_SHAPE, MD3_MOTION, MEMBERS, MD3Ctx, useMd3,
});
