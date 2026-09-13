// happie-ui.jsx — Happie design tokens, icons & shared primitives
// Warm, honey-gold, family-friendly. Exports primitives to window.
const { useState, useRef, useEffect } = React;

/* ───────────────── tokens ───────────────── */
const HT = {
  honey: "#FFC21E", honeyDeep: "#E08A00", honeySoft: "#FFEDB0",
  ink: "#2E2A24", inkSoft: "#8B8273", inkFaint: "#B7AD9B",
  line: "#EFE6D6", lineSoft: "#F5EEE1",
  paper: "#FBF4E9", card: "#FFFFFF", cardSoft: "#FFFAF1",
  good: "#3F9D5B",
};
// family member palette — soft, friendly, distinguishable
const MEMBERS = {
  anke: { name: "Anke", role: "Mom",  bg: "#FFE08A", fg: "#9A6B00", initial: "A" },
  tom:  { name: "Tom",  role: "Dad",  bg: "#BFE0F2", fg: "#1E6E9C", initial: "T" },
  lotte:{ name: "Lotte",role: "Kid",  bg: "#F2CCEC", fg: "#9B3F8E", initial: "L" },
  finn: { name: "Finn", role: "Kid",  bg: "#C9E9CB", fg: "#2F8F4E", initial: "F" },
};

// readable text color on an arbitrary accent
function onAccent(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  const L = (0.299*r + 0.587*g + 0.114*b) / 255;
  return L > 0.62 ? HT.ink : "#FFFFFF";
}

/* ───────────────── icons (stroke, currentColor) ───────────────── */
function Icon({ name, size = 24, stroke = 2.1, fill = false, style }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    home: <><path d="M4 11.5 12 4l8 7.5" {...p} /><path d="M6 10v9.5h12V10" {...p} /><path d="M10 19.5V14h4v5.5" {...p} /></>,
    cart: <><circle cx="9.5" cy="20" r="1.3" fill="currentColor" stroke="none" /><circle cx="18" cy="20" r="1.3" fill="currentColor" stroke="none" /><path d="M3 4h2.2l2 11.5h11l1.8-8H6.4" {...p} /></>,
    check: <><path d="M5 13.5 10 18l9-11" {...p} /></>,
    checklist: <><path d="M4 7l1.5 1.5L8.5 5" {...p} /><path d="M4 16l1.5 1.5L8.5 13.5" {...p} /><path d="M12 7h8M12 16h8" {...p} /></>,
    plate: <><circle cx="12" cy="12" r="8.2" {...p} /><circle cx="12" cy="12" r="3.6" {...p} /></>,
    card: <><rect x="3" y="6" width="18" height="12" rx="2.4" {...p} /><path d="M3 10h18" {...p} /><path d="M7 14.5h4" {...p} /></>,
    plus: <><path d="M12 5v14M5 12h14" {...p} /></>,
    minus: <><path d="M5 12h14" {...p} /></>,
    bell: <><path d="M6 10a6 6 0 0 1 12 0c0 5 1.5 6 1.5 6h-15S6 15 6 10Z" {...p} /><path d="M10.2 20a2 2 0 0 0 3.6 0" {...p} /></>,
    chevron: <><path d="M9 5l7 7-7 7" {...p} /></>,
    back: <><path d="M15 5l-7 7 7 7" {...p} /></>,
    search: <><circle cx="11" cy="11" r="6.2" {...p} /><path d="m20 20-3.6-3.6" {...p} /></>,
    dots: <><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
    grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.8" {...p} /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" {...p} /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" {...p} /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" {...p} /></>,
    people: <><circle cx="9" cy="9" r="3.2" {...p} /><path d="M3.5 19c.6-3 2.9-4.5 5.5-4.5S13.9 16 14.5 19" {...p} /><path d="M16 6.2A3 3 0 0 1 18 12M17.5 14.6c2 .5 3.4 2 3.9 4.4" {...p} /></>,
    awake: <><circle cx="12" cy="12" r="4" {...p} /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" {...p} /></>,
    sparkle: <><path d="M12 4.5 13.5 10 19 11.5 13.5 13 12 18.5 10.5 13 5 11.5 10.5 10Z" {...p} /></>,
    note: <><path d="M5 4h14v11l-4 4H5Z" {...p} /><path d="M15 19v-4h4" {...p} /></>,
    edit: <><path d="M5 19h3l9-9-3-3-9 9Z" {...p} /><path d="m14 7 3 3" {...p} /></>,
    user: <><circle cx="12" cy="8.5" r="3.6" {...p} /><path d="M5 19.5c1-3.4 3.8-5 7-5s6 1.6 7 5" {...p} /></>,
    swap: <><path d="M4 8h13l-3-3M20 16H7l3 3" {...p} /></>,
    cog: <><circle cx="12" cy="12" r="3.2" {...p} /><path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6 16.6 7.4M7.4 16.6 5.6 18.4M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" {...p} /></>,
    x: <><path d="M6 6l12 12M18 6 6 18" {...p} /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", ...style }}>
      {paths[name] || null}
    </svg>
  );
}

/* ───────────────── avatar ───────────────── */
function Avatar({ who, size = 34, ring = false }) {
  const m = MEMBERS[who] || { bg: HT.line, fg: HT.inkSoft, initial: "?" };
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flex: "0 0 auto",
      background: m.bg, color: m.fg, display: "grid", placeItems: "center",
      fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: size * 0.42,
      boxShadow: ring ? "0 0 0 2.5px #fff" : "none",
    }}>{m.initial}</div>
  );
}
function AvatarStack({ people, size = 28 }) {
  return (
    <div style={{ display: "flex" }}>
      {people.map((w, i) => (
        <div key={w} style={{ marginLeft: i ? -size * 0.34 : 0 }}><Avatar who={w} size={size} ring /></div>
      ))}
    </div>
  );
}

/* ───────────────── card / chip / pill ───────────────── */
function Card({ children, soft = false, style, onClick, pad = 16 }) {
  return (
    <div onClick={onClick} style={{
      background: soft ? HT.cardSoft : HT.card,
      border: `1.5px solid ${HT.line}`, borderRadius: 22, padding: pad,
      boxShadow: "0 1px 2px rgba(46,42,36,.04)",
      cursor: onClick ? "pointer" : "default", ...style,
    }}>{children}</div>
  );
}
function Chip({ children, on = false, accent = HT.honey, onClick, style }) {
  return (
    <button onClick={onClick} style={{
      font: "inherit", fontWeight: 700, fontSize: 14.5,
      display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
      padding: "7px 14px", borderRadius: 999, cursor: "pointer",
      border: `1.5px solid ${on ? accent : HT.line}`,
      background: on ? accent : HT.card, color: on ? onAccent(accent) : HT.inkSoft,
      transition: "all .15s", ...style,
    }}>{children}</button>
  );
}
function Pill({ children, style }) {
  return <span style={{
    fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 13,
    padding: "2px 9px", borderRadius: 999, background: HT.honeySoft, color: HT.honeyDeep, ...style,
  }}>{children}</span>;
}

/* ───────────────── qty stepper ───────────────── */
function Stepper({ value, onChange, accent = HT.honey }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 2, border: `1.5px solid ${HT.line}`, borderRadius: 999, padding: 2, background: HT.card }}>
      <button onClick={(e) => { e.stopPropagation(); onChange(Math.max(1, value - 1)); }} style={stepBtn}>
        <Icon name="minus" size={16} />
      </button>
      <span style={{ minWidth: 22, textAlign: "center", fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 15 }}>{value}</span>
      <button onClick={(e) => { e.stopPropagation(); onChange(value + 1); }} style={{ ...stepBtn, background: accent, color: onAccent(accent) }}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}
const stepBtn = {
  width: 28, height: 28, borderRadius: "50%", border: "none", cursor: "pointer",
  background: HT.lineSoft, color: HT.ink, display: "grid", placeItems: "center",
};

/* ───────────────── progress bar ───────────────── */
function Progress({ value, total, accent = HT.honey, height = 9 }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ height, borderRadius: 999, background: HT.lineSoft, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: accent, borderRadius: 999, transition: "width .4s cubic-bezier(.2,.8,.2,1)" }} />
    </div>
  );
}

/* ───────────────── bottom sheet ───────────────── */
function Sheet({ open, onClose, children, title, accent = HT.honey }) {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 200, pointerEvents: open ? "auto" : "none",
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
    }}>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, background: "rgba(38,34,28,.46)",
        opacity: open ? 1 : 0, transition: "opacity .25s",
      }} />
      <div style={{
        position: "relative", background: HT.paper, borderRadius: "28px 28px 0 0",
        padding: "10px 18px 38px", maxHeight: "82%",
        display: "flex", flexDirection: "column",
        transform: open ? "translateY(0)" : "translateY(110%)",
        transition: "transform .32s cubic-bezier(.2,.85,.25,1)",
        boxShadow: "0 -10px 40px rgba(46,42,36,.18)",
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: HT.line, margin: "0 auto 12px", flex: "0 0 auto" }} />
        {title && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flex: "0 0 auto" }}>
          <span style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 21, color: HT.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>{title}</span>
          <button onClick={onClose} style={{ border: "none", background: HT.lineSoft, width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center", cursor: "pointer", color: HT.inkSoft, flex: "0 0 auto" }}>
            <Icon name="x" size={18} />
          </button>
        </div>}
        <div style={{ overflowY: "auto", overscrollBehavior: "contain", margin: "0 -4px", padding: "0 4px" }}>{children}</div>
      </div>
    </div>
  );
}

/* ───────────────── toast ───────────────── */
function Toast({ toast }) {
  return (
    <div style={{
      position: "absolute", left: "50%", bottom: 96, transform: `translateX(-50%) translateY(${toast ? 0 : 20}px)`,
      zIndex: 300, opacity: toast ? 1 : 0, transition: "all .28s", pointerEvents: "none",
    }}>
      {toast && <div style={{
        display: "flex", alignItems: "center", gap: 9, background: HT.ink, color: "#fff",
        padding: "11px 18px", borderRadius: 999, fontWeight: 700, fontSize: 14.5,
        boxShadow: "0 8px 24px rgba(46,42,36,.3)", whiteSpace: "nowrap",
      }}>
        <span style={{ color: HT.honey, display: "grid", placeItems: "center" }}><Icon name="check" size={18} /></span>
        {toast}
      </div>}
    </div>
  );
}

/* ───────────────── primary button ───────────────── */
function Btn({ children, onClick, accent = HT.honey, ghost = false, full = false, disabled = false, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      font: "inherit", fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 16,
      padding: "13px 20px", borderRadius: 16, cursor: disabled ? "default" : "pointer",
      width: full ? "100%" : "auto", border: ghost ? `1.5px solid ${HT.line}` : "none",
      background: ghost ? HT.card : accent, color: ghost ? HT.ink : onAccent(accent),
      opacity: disabled ? 0.45 : 1, transition: "transform .1s, opacity .15s",
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, ...style,
    }}
    onPointerDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(.97)"; }}
    onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    onPointerLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >{children}</button>
  );
}

Object.assign(window, {
  HT, MEMBERS, onAccent, Icon, Avatar, AvatarStack, Card, Chip, Pill, Stepper, Progress, Sheet, Toast, Btn,
});
