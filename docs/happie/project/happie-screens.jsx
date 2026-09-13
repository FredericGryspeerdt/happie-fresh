// happie-screens.jsx — Happie screen components (consume window primitives)
const { useState: useStateS, useRef: useRefS, useEffect: useEffectS } = React;
const CATS = ["Produce", "Dairy", "Bakery", "Pantry"];

/* greeting by hour */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/* ============ HOME ============ */
function Home({ accent, userName, household, lists, activity, members, onOpenTab, onQuickAdd, quickBar, showActivity, onComingSoon }) {
  const groc = lists[0];
  const grocDone = groc.items.filter(i => i.done).length;
  const todosOpen = 3;
  const tiles = [
    { key: "shop", icon: "cart", label: "Shopping", sub: `${groc.items.length} items · ${lists.length} lists`, prog: [grocDone, groc.items.length], go: () => onOpenTab("shop") },
    { key: "todos", icon: "checklist", label: "To-dos", sub: `${todosOpen} today · 1 yours`, prog: [1, 3], go: () => onOpenTab("todos") },
    { key: "menu", icon: "plate", label: "Menu planner", sub: "Plan this week", go: () => onOpenTab("menu") },
    { key: "cards", icon: "card", label: "Loyalty cards", sub: "4 saved", go: () => onComingSoon("Loyalty cards") },
  ];
  return (
    <div style={{ padding: "4px 18px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ color: HT.inkSoft, fontWeight: 700, fontSize: 15 }}>{greeting()},</div>
        <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 28, color: HT.ink, lineHeight: 1.1 }}>
          {userName} <span style={{ fontSize: 24 }}>👋</span>
        </div>
      </div>

      {quickBar && (
        <button onClick={() => onQuickAdd(null)} style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%", cursor: "pointer",
          background: HT.card, border: `1.5px solid ${HT.line}`, borderRadius: 16, padding: "13px 16px",
          color: HT.inkFaint, font: "inherit", fontWeight: 700, fontSize: 15.5, textAlign: "left",
        }}>
          <span style={{ color: accent, display: "grid", placeItems: "center" }}><Icon name="plus" size={20} /></span>
          What do you need?
        </button>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {tiles.map(t => (
          <Card key={t.key} onClick={t.go} pad={14} style={{ display: "flex", flexDirection: "column", gap: 9, minHeight: 116 }}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: HT.honeySoft, color: HT.honeyDeep, display: "grid", placeItems: "center" }}>
              <Icon name={t.icon} size={23} />
            </div>
            <div style={{ marginTop: "auto" }}>
              <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 17, color: HT.ink }}>{t.label}</div>
              <div style={{ color: HT.inkSoft, fontWeight: 600, fontSize: 12.5 }}>{t.sub}</div>
            </div>
            {t.prog && <Progress value={t.prog[0]} total={t.prog[1]} accent={accent} height={7} />}
          </Card>
        ))}
      </div>

      <Card pad={14} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 15.5, color: HT.ink, whiteSpace: "nowrap" }}>Who's home</div>
        <AvatarStack people={["anke", "lotte", "finn"]} size={30} />
      </Card>

      {showActivity && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "0 2px 9px" }}>
            <span style={{ color: accent }}><Icon name="sparkle" size={18} /></span>
            <span style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 16, color: HT.ink }}>Lately in {household}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {activity.slice(0, 4).map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                <Avatar who={a.who} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: HT.ink, lineHeight: 1.3 }}>
                    <b style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700 }}>{MEMBERS[a.who]?.name}</b> {a.text}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                    <span style={{ color: HT.inkFaint, fontWeight: 600, fontSize: 12 }}>{a.time}</span>
                    {a.react && <span style={{ fontSize: 12.5, fontWeight: 700, color: HT.inkSoft, border: `1.5px solid ${HT.line}`, borderRadius: 999, padding: "1px 8px" }}>{a.react}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ SHOP — lists overview ============ */
function ShopLists({ accent, lists, onOpenList, onNewList }) {
  return (
    <div style={{ padding: "4px 18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      {lists.map(l => {
        const done = l.items.filter(i => i.done).length;
        return (
          <Card key={l.id} onClick={() => onOpenList(l.id)} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 21 }}>{l.emoji}</span>
                <span style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 17, color: HT.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
              </div>
              <Pill>{l.items.length}</Pill>
            </div>
            <Progress value={done} total={l.items.length} accent={accent} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <AvatarStack people={l.people} size={26} />
              <span style={{ color: HT.inkFaint, fontWeight: 600, fontSize: 12.5 }}>{done}/{l.items.length} done · {l.updated}</span>
            </div>
          </Card>
        );
      })}
      <button onClick={onNewList} style={{
        border: `1.5px dashed ${HT.line}`, borderRadius: 22, padding: "15px", cursor: "pointer",
        background: "transparent", color: HT.inkSoft, font: "inherit", fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 15.5,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <Icon name="plus" size={20} /> New list
      </button>
    </div>
  );
}

/* ============ SHOP — catalogue ============ */
function Catalogue({ accent, catalogue, inList, onToggle }) {
  const [cat, setCat] = useStateS("Produce");
  const items = catalogue.filter(c => c.cat === cat);
  return (
    <div style={{ padding: "4px 0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 18px" }}>
        {CATS.map(c => <Chip key={c} on={c === cat} accent={accent} onClick={() => setCat(c)}>{c}</Chip>)}
      </div>
      <div style={{ padding: "0 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {items.map(it => {
          const added = inList.has(it.name);
          return (
            <button key={it.name} onClick={() => onToggle(it)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer",
              background: added ? HT.honeySoft : HT.card, border: `1.5px solid ${added ? accent : HT.line}`,
              borderRadius: 16, padding: "12px 14px", font: "inherit", fontWeight: 700, fontSize: 14.5, color: HT.ink, textAlign: "left",
            }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
              <span style={{ color: added ? HT.honeyDeep : HT.inkFaint, display: "grid", placeItems: "center" }}>
                <Icon name={added ? "check" : "plus"} size={18} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============ SHOP — list detail (Plan vs Shop) ============ */
function SegToggle({ mode, onChange, accent }) {
  const opts = [["plan", "edit", "Plan"], ["shop", "cart", "Shop"]];
  return (
    <div style={{ display: "flex", gap: 4, background: HT.lineSoft, borderRadius: 14, padding: 4 }}>
      {opts.map(([k, ic, lbl]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer",
          border: "none", borderRadius: 11, padding: "9px 0", font: "inherit", fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 15,
          background: mode === k ? HT.card : "transparent", color: mode === k ? HT.ink : HT.inkSoft,
          boxShadow: mode === k ? "0 1px 3px rgba(46,42,36,.12)" : "none", transition: "all .15s",
        }}>
          <Icon name={ic} size={18} /> {lbl}
        </button>
      ))}
    </div>
  );
}

function PlanMode({ accent, list, onSetQty, onAddItem, onAssign }) {
  const byCat = {};
  list.items.forEach(it => { (byCat[it.cat] = byCat[it.cat] || []).push(it); });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <button onClick={onAddItem} style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", cursor: "pointer",
        background: HT.card, border: `1.5px solid ${HT.line}`, borderRadius: 16, padding: "13px 15px",
        color: HT.inkFaint, font: "inherit", fontWeight: 700, fontSize: 15, textAlign: "left",
      }}>
        <Icon name="search" size={19} /> Add item or search catalogue…
        <span style={{ marginLeft: "auto", color: accent }}><Icon name="plus" size={20} /></span>
      </button>
      {CATS.filter(c => byCat[c]).map(c => (
        <div key={c}>
          <div style={{ fontWeight: 800, fontSize: 12.5, letterSpacing: .6, textTransform: "uppercase", color: HT.inkFaint, margin: "0 2px 8px" }}>{c}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {byCat[c].map(it => (
              <Card key={it.id} pad={12} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15.5, color: HT.ink }}>{it.name}</div>
                  {it.note && <div style={{ color: HT.inkSoft, fontWeight: 600, fontSize: 12.5, marginTop: 1 }}>📝 {it.note}</div>}
                </div>
                <button onClick={() => onAssign(it.id)} title="Assign" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>
                  {it.assignee ? <Avatar who={it.assignee} size={30} /> :
                    <span style={{ width: 30, height: 30, borderRadius: "50%", border: `1.5px dashed ${HT.line}`, color: HT.inkFaint, display: "grid", placeItems: "center" }}><Icon name="user" size={16} /></span>}
                </button>
                <Stepper value={it.qty} onChange={(v) => onSetQty(it.id, v)} accent={accent} />
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ShopMode({ accent, list, onToggle }) {
  const done = list.items.filter(i => i.done).length;
  const total = list.items.length;
  const sorted = [...list.items].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
  const allDone = done === total && total > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card pad={13} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
            <span style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 15.5, color: HT.ink, whiteSpace: "nowrap" }}>{done} of {total} in cart</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: HT.honeyDeep, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
              <Icon name="awake" size={14} /> stays awake
            </span>
          </div>
          <Progress value={done} total={total} accent={accent} height={10} />
        </div>
      </Card>

      {allDone && (
        <Card style={{ textAlign: "center", background: HT.honeySoft, borderColor: accent, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 32 }}>🎉</div>
          <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 19, color: HT.ink }}>All done — nice work!</div>
          <div style={{ color: HT.honeyDeep, fontWeight: 700, fontSize: 13.5 }}>Everything's in the cart.</div>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {sorted.map(it => (
          <button key={it.id} onClick={() => onToggle(it.id)} style={{
            display: "flex", alignItems: "center", gap: 13, width: "100%", cursor: "pointer", textAlign: "left",
            background: it.done ? HT.cardSoft : HT.card, border: `1.5px solid ${it.done ? HT.lineSoft : HT.line}`,
            borderRadius: 18, padding: "15px 16px", font: "inherit", minHeight: 58, transition: "all .15s",
            opacity: it.done ? 0.6 : 1,
          }}>
            <span style={{
              width: 30, height: 30, borderRadius: "50%", flex: "0 0 auto", display: "grid", placeItems: "center",
              border: `2px solid ${it.done ? accent : HT.line}`, background: it.done ? accent : "transparent", color: onAccent(accent),
            }}>{it.done && <Icon name="check" size={18} />}</span>
            <span style={{ flex: 1, fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 18, color: HT.ink, textDecoration: it.done ? "line-through" : "none" }}>{it.name}</span>
            {it.qty > 1 && <Pill style={{ background: HT.lineSoft, color: HT.inkSoft }}>×{it.qty}</Pill>}
            {it.assignee && <Avatar who={it.assignee} size={26} />}
          </button>
        ))}
      </div>
    </div>
  );
}

function ListDetail({ accent, list, mode, onSetMode, onSetQty, onToggle, onAddItem, onAssign }) {
  return (
    <div style={{ padding: "2px 18px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
      <SegToggle mode={mode} onChange={onSetMode} accent={accent} />
      {mode === "plan"
        ? <PlanMode accent={accent} list={list} onSetQty={onSetQty} onAddItem={onAddItem} onAssign={onAssign} />
        : <ShopMode accent={accent} list={list} onToggle={onToggle} />}
    </div>
  );
}

/* ============ TO-DOS (light module) ============ */
function Todos({ accent, todos, onToggle }) {
  const groups = [["Today", todos.filter(t => t.when === "today")], ["This week", todos.filter(t => t.when === "week")]];
  return (
    <div style={{ padding: "4px 18px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
      {groups.map(([label, items]) => items.length > 0 && (
        <div key={label}>
          <div style={{ fontWeight: 800, fontSize: 12.5, letterSpacing: .6, textTransform: "uppercase", color: HT.inkFaint, margin: "0 2px 9px" }}>{label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {items.map(t => (
              <button key={t.id} onClick={() => onToggle(t.id)} style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", cursor: "pointer", textAlign: "left",
                background: t.done ? HT.cardSoft : HT.card, border: `1.5px solid ${t.done ? HT.lineSoft : HT.line}`,
                borderRadius: 16, padding: "13px 15px", font: "inherit", opacity: t.done ? 0.55 : 1,
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: "50%", flex: "0 0 auto", display: "grid", placeItems: "center",
                  border: `2px solid ${t.done ? accent : HT.line}`, background: t.done ? accent : "transparent", color: onAccent(accent),
                }}>{t.done && <Icon name="check" size={16} />}</span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 15.5, color: HT.ink, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</span>
                {t.assignee && <Avatar who={t.assignee} size={28} />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============ generic module placeholder ============ */
function ComingSoon({ accent, icon, title, blurb }) {
  return (
    <div style={{ padding: "40px 28px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14 }}>
      <div style={{ width: 76, height: 76, borderRadius: 24, background: HT.honeySoft, color: HT.honeyDeep, display: "grid", placeItems: "center" }}>
        <Icon name={icon} size={40} />
      </div>
      <div style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 23, color: HT.ink }}>{title}</div>
      <div style={{ color: HT.inkSoft, fontWeight: 600, fontSize: 15, lineHeight: 1.5, maxWidth: 260 }}>{blurb}</div>
      <span style={{ marginTop: 4, fontWeight: 800, fontSize: 13, letterSpacing: .5, textTransform: "uppercase", color: accent, background: HT.honeySoft, padding: "6px 14px", borderRadius: 999 }}>Coming soon</span>
    </div>
  );
}

Object.assign(window, { Home, ShopLists, Catalogue, ListDetail, Todos, ComingSoon, CATS, greeting });
