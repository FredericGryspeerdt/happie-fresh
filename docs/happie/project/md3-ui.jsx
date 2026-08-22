// md3-ui.jsx — Material Design 3 component primitives for Happie
// Reads the active scheme + shape from MD3Ctx (useMd3). Exports to window.
const { useState: mU, useRef: mR, useEffect: mE } = React;

/* ───────────── one-time global CSS (ripple, state layers, fonts) ───────────── */
(function injectMd3Css() {
  if (document.getElementById("md3-css")) return;
  const css = `
  @keyframes md-ripple { from { transform: scale(0); opacity:.30 } to { transform: scale(2.4); opacity:0 } }
  @keyframes md-fade-in { from { opacity:0 } to { opacity:1 } }
  .md-press { position: relative; overflow: hidden; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; touch-action: manipulation; }
  .md-state { position:absolute; inset:0; opacity:0; transition: opacity .11s linear; pointer-events:none; border-radius: inherit; }
  @media (hover:hover){ .md-press:hover .md-state { opacity:.08 } }
  .md-press:active .md-state { opacity:.10 }
  .md-rip { position:absolute; border-radius:50%; pointer-events:none; animation: md-ripple .5s cubic-bezier(0.2,0,0,1) forwards; }
  *::-webkit-scrollbar { width:0; height:0; }
  `;
  const el = document.createElement("style");
  el.id = "md3-css"; el.textContent = css;
  document.head.appendChild(el);
})();

/* ───────────── ripple hook ───────────── */
function useRipple() {
  const [rips, setRips] = mU([]);
  const add = (e) => {
    const host = e.currentTarget;
    const b = host.getBoundingClientRect();
    const size = Math.max(b.width, b.height);
    const cx = (e.clientX ?? b.left + b.width / 2) - b.left;
    const cy = (e.clientY ?? b.top + b.height / 2) - b.top;
    const id = Math.random();
    setRips((r) => [...r, { id, cx, cy, size }]);
    setTimeout(() => setRips((r) => r.filter((p) => p.id !== id)), 520);
  };
  return [rips, add];
}

/* generic pressable surface with state layer + ripple */
function Pressable({ as = "button", color = "currentColor", onClick, style, className = "", disabled, children, stop = false, ...rest }) {
  const [rips, add] = useRipple();
  const Tag = as;
  return (
    <Tag
      className={`md-press ${className}`}
      disabled={Tag === "button" ? disabled : undefined}
      onPointerDown={disabled ? undefined : add}
      onClick={disabled ? undefined : (e) => { if (stop) e.stopPropagation(); onClick && onClick(e); }}
      style={{ border: "none", background: "transparent", font: "inherit", cursor: disabled ? "default" : "pointer", padding: 0, color: "inherit", ...style }}
      {...rest}
    >
      <span className="md-state" style={{ background: color }} />
      {rips.map((r) => (
        <span key={r.id} className="md-rip" style={{
          left: r.cx - r.size, top: r.cy - r.size, width: r.size * 2, height: r.size * 2,
          background: color, opacity: 0.22,
        }} />
      ))}
      {children}
    </Tag>
  );
}

/* ───────────── icons (line, currentColor) ───────────── */
function Icon({ name, size = 24, stroke = 2, fill = false, style }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    home: <><path d="M4 11.5 12 4l8 7.5" {...p} /><path d="M6 10v9.5h12V10" {...p} /><path d="M10 19.5V14h4v5.5" {...p} /></>,
    cart: <><circle cx="9.5" cy="20" r="1.4" fill="currentColor" stroke="none" /><circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" /><path d="M3 4h2.2l2 11.5h11l1.8-8H6.4" {...p} /></>,
    check: <><path d="M5 13l4.5 4.5L19 6.5" {...p} /></>,
    checklist: <><path d="M4 7l1.5 1.5L8.5 5" {...p} /><path d="M4 16l1.5 1.5L8.5 13.5" {...p} /><path d="M12 7h8M12 16h8" {...p} /></>,
    plate: <><circle cx="12" cy="12" r="8.2" {...p} /><circle cx="12" cy="12" r="3.6" {...p} /></>,
    card: <><rect x="3" y="6" width="18" height="12" rx="2.4" {...p} /><path d="M3 10h18M7 14.5h4" {...p} /></>,
    plus: <><path d="M12 5v14M5 12h14" {...p} /></>,
    minus: <><path d="M5 12h14" {...p} /></>,
    bell: <><path d="M6 10a6 6 0 0 1 12 0c0 5 1.5 6 1.5 6h-15S6 15 6 10Z" {...p} /><path d="M10.2 20a2 2 0 0 0 3.6 0" {...p} /></>,
    chevron: <><path d="M9 5l7 7-7 7" {...p} /></>,
    back: <><path d="M19 12H5M11 18l-6-6 6-6" {...p} /></>,
    search: <><circle cx="11" cy="11" r="6.4" {...p} /><path d="m20 20-3.6-3.6" {...p} /></>,
    dots: <><circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" /></>,
    tune: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" {...p} /><circle cx="16" cy="7" r="2.2" {...p} /><circle cx="8" cy="17" r="2.2" {...p} /></>,
    people: <><circle cx="9" cy="9" r="3.2" {...p} /><path d="M3.5 19c.6-3 2.9-4.5 5.5-4.5S13.9 16 14.5 19" {...p} /><path d="M16 6.2A3 3 0 0 1 18 12M17.5 14.6c2 .5 3.4 2 3.9 4.4" {...p} /></>,
    bolt: <><path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" {...p} /></>,
    sparkle: <><path d="M12 4.5 13.5 10 19 11.5 13.5 13 12 18.5 10.5 13 5 11.5 10.5 10Z" {...p} /></>,
    edit: <><path d="M5 19h3l9-9-3-3-9 9Z" {...p} /><path d="m14 7 3 3" {...p} /></>,
    user: <><circle cx="12" cy="8.5" r="3.6" {...p} /><path d="M5 19.5c1-3.4 3.8-5 7-5s6 1.6 7 5" {...p} /></>,
    swap: <><path d="M4 8h13l-3-3M20 16H7l3 3" {...p} /></>,
    cog: <><circle cx="12" cy="12" r="3.2" {...p} /><path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6 16.6 7.4M7.4 16.6 5.6 18.4M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" {...p} /></>,
    x: <><path d="M6 6l12 12M18 6 6 18" {...p} /></>,
    trash: <><path d="M5 7h14M10 7V5h4v2M6.5 7l1 12.5h9l1-12.5" {...p} /><path d="M10 11v5.5M14 11v5.5" {...p} /></>,
    share: <><circle cx="6.5" cy="12" r="2.3" {...p} /><circle cx="17" cy="6.5" r="2.3" {...p} /><circle cx="17" cy="17.5" r="2.3" {...p} /><path d="m8.5 10.8 6-3.1M8.5 13.2l6 3.1" {...p} /></>,
    calendar: <><rect x="4" y="5.5" width="16" height="15" rx="2.4" {...p} /><path d="M4 9.5h16M8 3.5v4M16 3.5v4" {...p} /></>,
    leaf: <><path d="M5 19c0-8 6-13 14-13 0 8-5 14-14 13Z" {...p} /><path d="M9 15c2-3 4-4 7-5" {...p} /></>,
    flame: <><path d="M12 3c4 4 5 7 3 10a3 3 0 1 1-6-1c-2 1-3-2-1-5 1 2 2 1 2-1 0-1 .5-2 2-3Z" {...p} /></>,
    tag: <><path d="M3 11V4h7l11 11-7 7L3 11Z" {...p} /><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", ...style }}>
      {paths[name] || null}
    </svg>
  );
}

/* ───────────── avatar ───────────── */
function Avatar({ who, size = 36, ring = false }) {
  const m = MEMBERS[who] || { bg: "#ddd", fg: "#555", initial: "?" };
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flex: "0 0 auto",
      background: m.bg, color: m.fg, display: "grid", placeItems: "center",
      fontFamily: "'Roboto Flex', system-ui", fontWeight: 600, fontSize: size * 0.42,
      boxShadow: ring ? "0 0 0 2.5px var(--md-surface)" : "none",
    }}>{m.initial}</div>
  );
}
function AvatarStack({ people, size = 28 }) {
  return (
    <div style={{ display: "flex" }}>
      {people.map((w, i) => <div key={w} style={{ marginLeft: i ? -size * 0.34 : 0 }}><Avatar who={w} size={size} ring /></div>)}
    </div>
  );
}

/* ───────────── buttons ───────────── */
function Button({ variant = "filled", icon, children, onClick, disabled, full = false, style }) {
  const { s, cr } = useMd3();
  const map = {
    filled:   { bg: s.primary, fg: s.onPrimary, bd: "none", sh: "none" },
    tonal:    { bg: s.secondaryContainer, fg: s.onSecondaryContainer, bd: "none", sh: "none" },
    elevated: { bg: s.surfaceContainerLow, fg: s.primary, bd: "none", sh: "0 1px 3px rgba(0,0,0,.16),0 1px 2px rgba(0,0,0,.04)" },
    outlined: { bg: "transparent", fg: s.primary, bd: `1px solid ${s.outlineVariant}`, sh: "none" },
    text:     { bg: "transparent", fg: s.primary, bd: "none", sh: "none" },
  }[variant];
  return (
    <Pressable onClick={onClick} disabled={disabled} color={map.fg} style={{
      ...type("labelLarge"), height: 40, padding: icon ? "0 22px 0 16px" : "0 24px",
      borderRadius: 999, background: disabled ? "color-mix(in srgb, var(--md-on-surface) 12%, transparent)" : map.bg,
      color: disabled ? "color-mix(in srgb, var(--md-on-surface) 38%, transparent)" : map.fg,
      border: map.bd, boxShadow: disabled ? "none" : map.sh,
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      width: full ? "100%" : "auto", whiteSpace: "nowrap", ...style,
    }}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </Pressable>
  );
}

function IconButton({ name, variant = "standard", onClick, size = 40, iconSize = 22, selected = false, style }) {
  const { s } = useMd3();
  const map = {
    standard: { bg: "transparent", fg: s.onSurfaceVariant },
    filled:   { bg: s.primary, fg: s.onPrimary },
    tonal:    { bg: s.secondaryContainer, fg: s.onSecondaryContainer },
    outlined: { bg: "transparent", fg: s.onSurfaceVariant, bd: `1px solid ${s.outlineVariant}` },
  }[variant];
  return (
    <Pressable onClick={onClick} color={map.fg} style={{
      width: size, height: size, borderRadius: 999, flex: "0 0 auto",
      background: map.bg, color: map.fg, border: map.bd || "none",
      display: "grid", placeItems: "center", ...style,
    }}>
      <Icon name={name} size={iconSize} />
    </Pressable>
  );
}

/* ───────────── cards ───────────── */
function Card({ variant = "filled", children, onClick, style, pad = 16 }) {
  const { s, cr } = useMd3();
  const map = {
    filled:   { bg: s.surfaceContainerHigh, bd: "none", sh: "none" },
    elevated: { bg: s.surfaceContainerLow, bd: "none", sh: "0 1px 3px rgba(0,0,0,.14),0 1px 2px rgba(0,0,0,.04)" },
    outlined: { bg: s.surface, bd: `1px solid ${s.outlineVariant}`, sh: "none" },
  }[variant];
  const inner = (
    <div style={{ padding: pad, position: "relative" }}>{children}</div>
  );
  const baseStyle = {
    background: map.bg, border: map.bd, boxShadow: map.sh,
    borderRadius: cr(12), color: s.onSurface, ...style,
  };
  if (onClick) {
    return <Pressable onClick={onClick} color={s.onSurface} style={{ display: "block", textAlign: "left", width: "100%", ...baseStyle }}>{inner}</Pressable>;
  }
  return <div style={baseStyle}>{inner}</div>;
}

/* ───────────── chips ───────────── */
function Chip({ children, selected = false, onClick, leadingCheck = true, icon, style }) {
  const { s, cr } = useMd3();
  return (
    <Pressable onClick={onClick} color={selected ? s.onSecondaryContainer : s.onSurfaceVariant} style={{
      ...type("labelLarge"), height: 32, padding: selected && leadingCheck ? "0 14px 0 8px" : "0 14px",
      borderRadius: cr(8), display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
      background: selected ? s.secondaryContainer : "transparent",
      color: selected ? s.onSecondaryContainer : s.onSurfaceVariant,
      border: selected ? "none" : `1px solid ${s.outlineVariant}`, flex: "0 0 auto", ...style,
    }}>
      {selected && leadingCheck && <Icon name="check" size={16} stroke={2.4} />}
      {icon && !selected && <Icon name={icon} size={16} />}
      {children}
    </Pressable>
  );
}

/* ───────────── list item ───────────── */
function ListItem({ leading, headline, supporting, trailing, onClick, style }) {
  const { s } = useMd3();
  const body = (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 16px", minHeight: 56, position: "relative" }}>
      {leading && <div style={{ flex: "0 0 auto", display: "grid", placeItems: "center", color: s.onSurfaceVariant }}>{leading}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...type("bodyLarge"), color: s.onSurface, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{headline}</div>
        {supporting && <div style={{ ...type("bodyMedium"), color: s.onSurfaceVariant, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{supporting}</div>}
      </div>
      {trailing && <div style={{ flex: "0 0 auto", color: s.onSurfaceVariant }}>{trailing}</div>}
    </div>
  );
  if (onClick) return <Pressable onClick={onClick} color={s.onSurface} style={{ display: "block", width: "100%", textAlign: "left", color: s.onSurface, ...style }}>{body}</Pressable>;
  return <div style={style}>{body}</div>;
}

/* ───────────── switch ───────────── */
function Switch({ checked, onChange }) {
  const { s } = useMd3();
  const on = checked;
  return (
    <Pressable onClick={() => onChange(!on)} color={on ? s.onPrimary : s.onSurfaceVariant} style={{
      width: 52, height: 32, borderRadius: 999, flex: "0 0 auto",
      background: on ? s.primary : s.surfaceContainerHighest,
      border: on ? "none" : `2px solid ${s.outline}`,
      transition: "background .2s, border-color .2s",
    }}>
      <span style={{
        position: "absolute", top: "50%", left: on ? "calc(100% - 26px)" : 6,
        width: on ? 24 : 16, height: on ? 24 : 16, borderRadius: "50%",
        transform: "translateY(-50%)",
        background: on ? s.onPrimary : s.outline,
        display: "grid", placeItems: "center", color: s.primary,
        transition: "left .22s cubic-bezier(0.2,0.9,0.25,1.2), width .18s, height .18s, background .2s",
      }}>{on && <Icon name="check" size={15} stroke={2.6} />}</span>
    </Pressable>
  );
}

/* ───────────── segmented button ───────────── */
function Segmented({ options, value, onChange }) {
  const { s, cr } = useMd3();
  return (
    <div style={{ display: "flex", border: `1px solid ${s.outline}`, borderRadius: 999, overflow: "hidden", height: 40 }}>
      {options.map(([k, icon, label], i) => {
        const on = value === k;
        return (
          <Pressable key={k} onClick={() => onChange(k)} color={on ? s.onSecondaryContainer : s.onSurface} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            background: on ? s.secondaryContainer : "transparent",
            color: on ? s.onSecondaryContainer : s.onSurface,
            borderLeft: i ? `1px solid ${s.outline}` : "none", ...type("labelLarge"),
          }}>
            {on ? <Icon name="check" size={18} stroke={2.4} /> : <Icon name={icon} size={18} />} {label}
          </Pressable>
        );
      })}
    </div>
  );
}

/* ───────────── linear progress (MD3, rounded w/ gap) ───────────── */
function Progress({ value, total, height = 4 }) {
  const { s } = useMd3();
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, height }}>
      <div style={{ width: `${pct}%`, height, background: s.primary, borderRadius: 999, transition: "width .45s cubic-bezier(0.2,0,0,1)" }} />
      {pct < 100 && <>
        <span style={{ width: 4, height, background: s.primary, borderRadius: 999, flex: "0 0 auto" }} />
        <div style={{ flex: 1, height, background: s.primaryContainer, borderRadius: 999 }} />
      </>}
    </div>
  );
}

/* ───────────── search bar (MD3) ───────────── */
function SearchBar({ placeholder, onClick, trailing }) {
  const { s } = useMd3();
  return (
    <Pressable onClick={onClick} color={s.onSurface} style={{
      display: "flex", alignItems: "center", gap: 14, height: 52, padding: "0 16px",
      background: s.surfaceContainerHigh, borderRadius: 999, width: "100%", textAlign: "left",
    }}>
      <Icon name="search" size={22} style={{ color: s.onSurfaceVariant }} />
      <span style={{ ...type("bodyLarge"), color: s.onSurfaceVariant, flex: 1 }}>{placeholder}</span>
      {trailing}
    </Pressable>
  );
}

/* ───────────── bottom sheet ───────────── */
function Sheet({ open, onClose, title, children }) {
  const { s, cr } = useMd3();
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 200, pointerEvents: open ? "auto" : "none", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.32)", opacity: open ? 1 : 0, transition: "opacity .3s cubic-bezier(0.2,0,0,1)" }} />
      <div style={{
        position: "relative", background: s.surfaceContainerLow, borderRadius: `${cr(28)}px ${cr(28)}px 0 0`,
        padding: "0 24px 32px", maxHeight: "84%", display: "flex", flexDirection: "column",
        transform: open ? "translateY(0)" : "translateY(110%)",
        transition: "transform .4s cubic-bezier(0.05,0.7,0.1,1)",
        boxShadow: "0 -8px 40px rgba(0,0,0,.22)",
      }}>
        <div style={{ padding: "16px 0 12px", display: "flex", justifyContent: "center", flex: "0 0 auto" }}>
          <div style={{ width: 32, height: 4, borderRadius: 999, background: s.onSurfaceVariant, opacity: 0.4 }} />
        </div>
        {title && <div style={{ ...type("titleLarge"), color: s.onSurface, marginBottom: 8, flex: "0 0 auto" }}>{title}</div>}
        <div style={{ overflowY: "auto", overscrollBehavior: "contain", margin: "0 -24px", padding: "4px 24px 0" }}>{children}</div>
      </div>
    </div>
  );
}

/* ───────────── snackbar ───────────── */
function Snackbar({ data }) {
  const { s } = useMd3();
  return (
    <div style={{
      position: "absolute", left: 16, right: 16, bottom: 104, zIndex: 300,
      transform: `translateY(${data ? 0 : 16}px)`, opacity: data ? 1 : 0,
      transition: "all .3s cubic-bezier(0.2,0,0,1)", pointerEvents: "none",
    }}>
      {data && <div style={{
        display: "flex", alignItems: "center", gap: 12, background: s.inverseSurface, color: s.inverseOnSurface,
        padding: "6px 8px 6px 16px", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,.3)",
      }}>
        <span style={{ ...type("bodyMedium"), flex: 1 }}>{data.msg}</span>
        {data.action && <button onClick={data.onAction} style={{ ...type("labelLarge"), color: s.inversePrimary, background: "transparent", border: "none", padding: "8px 12px", borderRadius: 999, cursor: "pointer", pointerEvents: "auto" }}>{data.action}</button>}
      </div>}
    </div>
  );
}

Object.assign(window, {
  Pressable, useRipple, Icon, Avatar, AvatarStack,
  Button, IconButton, Card, Chip, ListItem, Switch, Segmented, Progress, SearchBar, Sheet, Snackbar,
});
