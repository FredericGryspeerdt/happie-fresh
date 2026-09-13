// md3-nav.jsx — MD3 navigation chrome: Navigation Bar, Top App Bar, FAB + FAB menu
const { useState: nU, useRef: nR } = React;

/* ───────────── Navigation Bar (pill active indicator) ───────────── */
function NavigationBar({ items, active, onSelect, labelMode = "all" }) {
  const { s } = useMd3();
  return (
    <div style={{
      flex: "0 0 auto", display: "flex", height: 80, paddingBottom: 0,
      background: s.surfaceContainer, position: "relative", zIndex: 5,
    }}>
      {items.map((it) => {
        const on = active === it.key;
        const showLabel = labelMode === "all" || (labelMode === "selected" && on);
        return (
          <Pressable key={it.key} onClick={() => onSelect(it.key)} color={on ? s.onSecondaryContainer : s.onSurfaceVariant} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 4, paddingTop: showLabel ? 12 : 0, paddingBottom: showLabel ? 16 : 0,
          }}>
            <div style={{ position: "relative", display: "grid", placeItems: "center", height: 32 }}>
              {/* pill indicator */}
              <span style={{
                position: "absolute", top: 0, bottom: 0, left: "50%", transform: "translateX(-50%)",
                width: on ? 64 : 32, background: s.secondaryContainer, borderRadius: 999,
                opacity: on ? 1 : 0, transition: "width .25s cubic-bezier(0.2,0,0,1), opacity .2s",
              }} />
              <span style={{ position: "relative", color: on ? s.onSecondaryContainer : s.onSurfaceVariant, transition: "color .2s" }}>
                <Icon name={it.icon} size={24} stroke={on ? 2.3 : 2} />
              </span>
            </div>
            {showLabel && (
              <span style={{ ...type(on ? "labelMedium" : "labelMedium"), color: on ? s.onSurface : s.onSurfaceVariant, fontWeight: on ? 700 : 500 }}>
                {it.label}
              </span>
            )}
          </Pressable>
        );
      })}
    </div>
  );
}

/* ───────────── Top App Bar ───────────── */
function TopAppBar({ variant = "small", title, leading, actions, subtitle }) {
  const { s } = useMd3();
  if (variant === "large") {
    return (
      <div style={{ flex: "0 0 auto", background: s.surface, paddingTop: 52 }}>
        <div style={{ height: 48, display: "flex", alignItems: "center", padding: "0 4px 0 12px" }}>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>{actions}</div>
        </div>
        <div style={{ padding: "4px 24px 16px" }}>
          {subtitle && <div style={{ ...type("labelLarge"), color: s.onSurfaceVariant, marginBottom: 2 }}>{subtitle}</div>}
          <div style={{ ...brand({ fontSize: 30, lineHeight: "36px" }), color: s.onSurface }}>{title}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ flex: "0 0 auto", background: s.surface, paddingTop: 52 }}>
      <div style={{ height: 56, display: "flex", alignItems: "center", gap: 4, padding: "0 4px" }}>
        {leading}
        <div style={{ flex: 1, minWidth: 0, ...brand({ fontSize: 22, lineHeight: "28px" }), color: s.onSurface, marginLeft: leading ? 0 : 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>{actions}</div>
      </div>
    </div>
  );
}

/* ───────────── FAB + Extended FAB ───────────── */
function Fab({ icon = "plus", label, onClick, color = "primaryContainer", size = "regular", style }) {
  const { s, cr } = useMd3();
  const palette = {
    primaryContainer: { bg: s.primaryContainer, fg: s.onPrimaryContainer },
    primary: { bg: s.primary, fg: s.onPrimary },
    tertiary: { bg: s.tertiaryContainer, fg: s.onTertiaryContainer },
    surface: { bg: s.surfaceContainerHigh, fg: s.primary },
  }[color];
  const dim = size === "small" ? 40 : 56;
  return (
    <Pressable onClick={onClick} color={palette.fg} style={{
      height: dim, minWidth: dim, borderRadius: cr(size === "small" ? 12 : 16),
      background: palette.bg, color: palette.fg, padding: label ? "0 20px" : 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 12,
      boxShadow: "0 3px 5px rgba(0,0,0,.2),0 1px 18px rgba(0,0,0,.08)", ...style,
    }}>
      <Icon name={icon} size={size === "small" ? 22 : 24} />
      {label && <span style={type("labelLarge", { fontSize: 15 })}>{label}</span>}
    </Pressable>
  );
}

/* ───────────── FAB menu (expressive speed dial) ───────────── */
function FabMenu({ actions, accentColor = "primaryContainer", bottom = 24 }) {
  const { s, cr } = useMd3();
  const [open, setOpen] = nU(false);
  const palette = {
    primaryContainer: { bg: s.primaryContainer, fg: s.onPrimaryContainer },
    primary: { bg: s.primary, fg: s.onPrimary },
  }[accentColor] || { bg: s.primaryContainer, fg: s.onPrimaryContainer };

  return (
    <>
      {/* scrim */}
      <div onClick={() => setOpen(false)} style={{
        position: "absolute", inset: 0, zIndex: 95, background: s.surface,
        opacity: open ? 0.82 : 0, pointerEvents: open ? "auto" : "none",
        transition: "opacity .3s cubic-bezier(0.2,0,0,1)",
      }} />
      <div style={{ position: "absolute", right: 16, bottom, zIndex: 96, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14 }}>
        {/* action items */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12, pointerEvents: open ? "auto" : "none" }}>
          {actions.map((a, i) => {
            const idx = actions.length - 1 - i; // bottom-most animates first
            return (
              <div key={a.label} style={{
                display: "flex", alignItems: "center", gap: 12,
                opacity: open ? 1 : 0,
                transform: open ? "translateY(0) scale(1)" : "translateY(16px) scale(.85)",
                transition: `opacity .26s ${open ? idx * 0.04 : 0}s cubic-bezier(0.05,0.7,0.1,1), transform .32s ${open ? idx * 0.04 : 0}s cubic-bezier(0.2,0.9,0.25,1.2)`,
              }}>
                <span style={{ ...type("labelLarge"), background: s.surfaceContainerHigh, color: s.onSurface, padding: "8px 14px", borderRadius: cr(8), boxShadow: "0 2px 6px rgba(0,0,0,.18)", whiteSpace: "nowrap" }}>{a.label}</span>
                <Fab icon={a.icon} size="small" color="surface" onClick={() => { setOpen(false); a.onClick(); }} />
              </div>
            );
          })}
        </div>
        {/* primary toggle */}
        <Pressable onClick={() => setOpen((o) => !o)} color={palette.fg} style={{
          height: 56, width: 56, borderRadius: cr(open ? 28 : 16),
          background: open ? s.tertiaryContainer : palette.bg, color: open ? s.onTertiaryContainer : palette.fg,
          display: "grid", placeItems: "center", boxShadow: "0 3px 5px rgba(0,0,0,.2),0 1px 18px rgba(0,0,0,.08)",
          transition: "border-radius .3s cubic-bezier(0.2,0,0,1), background .25s",
        }}>
          <span style={{ display: "grid", placeItems: "center", transform: open ? "rotate(135deg)" : "rotate(0)", transition: "transform .35s cubic-bezier(0.2,0.9,0.25,1.2)" }}>
            <Icon name="plus" size={26} />
          </span>
        </Pressable>
      </div>
    </>
  );
}

Object.assign(window, { NavigationBar, TopAppBar, Fab, FabMenu });
