// happie-app.jsx — Happie root: state, navigation, sheets, tweaks
const { useState: uS, useRef: uR, useEffect: uE, useMemo: uM } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#FFC21E",
  "quickAdd": "Both",
  "userName": "Anke",
  "showActivity": true
}/*EDITMODE-END*/;

/* ---- seed data ---- */
const SEED_LISTS = [
  { id: "groc", name: "Weekly groceries", emoji: "🛒", people: ["anke", "tom", "lotte"], updated: "2m ago", items: [
    { id: 1, name: "Apples", cat: "Produce", qty: 2, note: "the red ones", assignee: "lotte", done: false },
    { id: 2, name: "Spinach", cat: "Produce", qty: 1, assignee: null, done: false },
    { id: 3, name: "Bananas", cat: "Produce", qty: 1, assignee: null, done: true },
    { id: 4, name: "Milk", cat: "Dairy", qty: 1, assignee: "anke", done: true },
    { id: 5, name: "Yoghurt", cat: "Dairy", qty: 4, assignee: null, done: false },
    { id: 6, name: "Bread", cat: "Bakery", qty: 1, assignee: null, done: false },
    { id: 7, name: "Croissants", cat: "Bakery", qty: 6, assignee: "finn", done: false },
    { id: 8, name: "Pasta", cat: "Pantry", qty: 2, assignee: null, done: true },
    { id: 9, name: "Olive oil", cat: "Pantry", qty: 1, assignee: null, done: false },
  ]},
  { id: "hw", name: "Hardware store", emoji: "🔧", people: ["tom"], updated: "yesterday", items: [
    { id: 1, name: "Light bulbs", cat: "Pantry", qty: 4, done: false },
    { id: 2, name: "Batteries", cat: "Pantry", qty: 1, done: false },
    { id: 3, name: "Picture hooks", cat: "Pantry", qty: 1, done: true },
  ]},
  { id: "party", name: "Birthday party", emoji: "🎈", people: ["anke", "lotte"], updated: "3d ago", items: [
    { id: 1, name: "Balloons", cat: "Pantry", qty: 1, done: false },
    { id: 2, name: "Cake mix", cat: "Bakery", qty: 2, done: false },
    { id: 3, name: "Candles", cat: "Pantry", qty: 1, done: false },
  ]},
];
const SEED_TODOS = [
  { id: 1, title: "Take out recycling", when: "today", assignee: "finn", done: false },
  { id: 2, title: "Water the plants", when: "today", assignee: "lotte", done: true },
  { id: 3, title: "Book the dentist", when: "today", assignee: "anke", done: false },
  { id: 4, title: "Fix the garden gate", when: "week", assignee: "tom", done: false },
  { id: 5, title: "Plan the weekend trip", when: "week", assignee: null, done: false },
];
const SEED_ACTIVITY = [
  { who: "anke", text: "added Milk & Yoghurt to Groceries", time: "8:02", react: "👍 2" },
  { who: "finn", text: "checked off Bananas 🍌", time: "7:48", react: "🙌" },
  { who: "tom", text: "created the Hardware store list", time: "Yesterday" },
  { who: "lotte", text: "is bringing the Apples 🍎", time: "Yesterday", react: "❤️ 1" },
];
const CATALOGUE = [
  ...["Apples", "Bananas", "Spinach", "Carrots", "Tomatoes", "Avocado"].map(n => ({ name: n, cat: "Produce" })),
  ...["Milk", "Yoghurt", "Butter", "Cheese", "Eggs"].map(n => ({ name: n, cat: "Dairy" })),
  ...["Bread", "Croissants", "Bagels"].map(n => ({ name: n, cat: "Bakery" })),
  ...["Pasta", "Olive oil", "Rice", "Coffee", "Cereal"].map(n => ({ name: n, cat: "Pantry" })),
];
const SUGGEST = ["Coffee", "Eggs", "Butter", "Avocado"];
const HOUSEHOLD = "the Maes family";

/* ---- app bar ---- */
function AppBar({ title, onBack, right }) {
  return (
    <div style={{ flex: "0 0 auto", padding: "52px 18px 10px", display: "flex", alignItems: "center", gap: 10, background: HT.paper }}>
      {onBack && (
        <button onClick={onBack} style={{ border: "none", background: HT.card, boxShadow: `0 0 0 1.5px ${HT.line}`, width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", cursor: "pointer", color: HT.ink, flex: "0 0 auto" }}>
          <Icon name="back" size={20} />
        </button>
      )}
      <div style={{ flex: 1, fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: onBack ? 22 : 27, color: HT.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
      {right}
    </div>
  );
}

/* ---- tab bar ---- */
function TabBar({ tab, accent, onTab, onMore }) {
  const items = [
    { key: "home", icon: "home", label: "Home" },
    { key: "shop", icon: "cart", label: "Shop" },
    { key: "todos", icon: "checklist", label: "To-dos" },
    { key: "menu", icon: "plate", label: "Menu" },
    { key: "more", icon: "dots", label: "More" },
  ];
  return (
    <div style={{ flex: "0 0 auto", display: "flex", padding: "9px 6px 26px", background: HT.card, borderTop: `1.5px solid ${HT.line}` }}>
      {items.map(it => {
        const active = it.key !== "more" && tab === it.key;
        return (
          <button key={it.key} onClick={() => it.key === "more" ? onMore() : onTab(it.key)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer",
            border: "none", background: "transparent", font: "inherit", padding: "4px 0",
            color: active ? HT.ink : HT.inkFaint,
          }}>
            <span style={{ color: active ? accent : HT.inkFaint, transition: "color .15s" }}><Icon name={it.icon} size={25} /></span>
            <span style={{ fontWeight: 700, fontSize: 11 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---- FAB ---- */
function FAB({ accent, onClick }) {
  return (
    <button onClick={onClick} style={{
      position: "absolute", right: 18, bottom: 92, zIndex: 90,
      width: 58, height: 58, borderRadius: "50%", border: "none", cursor: "pointer",
      background: accent, color: onAccent(accent), display: "grid", placeItems: "center",
      boxShadow: "0 8px 22px rgba(46,42,36,.28)",
    }}
    onPointerDown={(e) => e.currentTarget.style.transform = "scale(.92)"}
    onPointerUp={(e) => e.currentTarget.style.transform = "scale(1)"}
    onPointerLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
    ><Icon name="plus" size={30} /></button>
  );
}

/* ============ APP ============ */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const accent = t.accent;

  // deep-link initial state via #shot= (used for static mock exports) — synchronous so first paint is correct & un-animated
  const SHOT = (typeof window !== "undefined" && (window.location.hash || "").match(/shot=([a-z]+)/i) || [])[1] || "";

  const [tab, setTab] = uS(SHOT === "shop" || SHOT === "catalogue" ? "shop" : SHOT === "todos" ? "todos" : SHOT === "menu" ? "menu" : "home");
  const [lists, setLists] = uS(SEED_LISTS);
  const [todos, setTodos] = uS(SEED_TODOS);
  const [activity, setActivity] = uS(SEED_ACTIVITY);
  const [shopTab, setShopTab] = uS(SHOT === "catalogue" ? "catalogue" : "lists");
  const [openListId, setOpenListId] = uS(SHOT === "list" || SHOT === "assign" ? "groc" : null);
  const [listMode, setListMode] = uS("plan");
  const [moreOpen, setMoreOpen] = uS(SHOT === "more");
  const [quick, setQuick] = uS({ open: SHOT === "quickadd", target: "groc" });
  const [assign, setAssign] = uS({ open: SHOT === "assign", itemId: SHOT === "assign" ? 1 : null });
  const [toast, setToast] = uS(null);
  const [qInput, setQInput] = uS("");
  const toastTimer = uR(null);
  const bodyRef = uR(null);

  const quickBar = t.quickAdd !== "FAB";
  const showFab = t.quickAdd !== "Home bar";
  const openList = lists.find(l => l.id === openListId);

  // scale the fixed-size phone to always fit the window
  const DW = 402, DH = 874;
  const EXPORT = typeof window !== "undefined" && /[?&]export=(\d+)/.test(window.location.search);
  const EXPORT_SCALE = EXPORT ? parseFloat((window.location.search.match(/[?&]export=(\d+(?:\.\d+)?)/) || [])[1]) || 2 : 0;
  const [scale, setScale] = uS(EXPORT ? EXPORT_SCALE : 1);
  uE(() => {
    if (EXPORT) { setScale(EXPORT_SCALE); document.documentElement.setAttribute("data-export", "1"); return; }
    function fit() { setScale(Math.min((window.innerWidth - 28) / DW, (window.innerHeight - 28) / DH, 1)); }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }
  function logActivity(text, react) {
    setActivity(a => [{ who: t.userName.toLowerCase().includes("tom") ? "tom" : "anke", text, time: "Just now", react }, ...a]);
  }
  function scrollTop() { if (bodyRef.current) bodyRef.current.scrollTop = 0; }

  /* mutations */
  function addItem(listId, name) {
    const cat = (CATALOGUE.find(c => c.name.toLowerCase() === name.toLowerCase()) || {}).cat || "Pantry";
    setLists(ls => ls.map(l => l.id === listId
      ? { ...l, updated: "just now", items: [...l.items, { id: Date.now(), name, cat, qty: 1, assignee: null, done: false }] }
      : l));
    const ln = lists.find(l => l.id === listId)?.name || "list";
    logActivity(`added ${name} to ${ln}`);
    showToast(`Added “${name}” to ${ln}`);
  }
  function removeItemByName(listId, name) {
    setLists(ls => ls.map(l => l.id === listId ? { ...l, items: l.items.filter(i => i.name !== name) } : l));
  }
  function setQty(listId, itemId, qty) {
    setLists(ls => ls.map(l => l.id === listId ? { ...l, items: l.items.map(i => i.id === itemId ? { ...i, qty } : i) } : l));
  }
  function toggleDone(listId, itemId) {
    let became = false, nm = "";
    setLists(ls => ls.map(l => {
      if (l.id !== listId) return l;
      return { ...l, items: l.items.map(i => {
        if (i.id !== itemId) return i;
        became = !i.done; nm = i.name;
        return { ...i, done: !i.done };
      }) };
    }));
    if (became) showToast(`✓ ${nm} in the cart`);
  }
  function setAssignee(listId, itemId, who) {
    setLists(ls => ls.map(l => l.id === listId ? { ...l, items: l.items.map(i => i.id === itemId ? { ...i, assignee: who } : i) } : l));
  }

  /* nav helpers */
  function goTab(k) { setTab(k); setOpenListId(null); setShopTab("lists"); scrollTop(); }
  function openListView(id) { setOpenListId(id); setListMode("plan"); scrollTop(); }
  function backFromList() { setOpenListId(null); scrollTop(); }
  function openQuick(target) { setQuick({ open: true, target: target || "groc" }); setQInput(""); }

  /* ---- header config ---- */
  let header;
  if (openList) {
    header = <AppBar title={`${openList.emoji} ${openList.name}`} onBack={backFromList}
      right={<button onClick={() => {}} style={iconBtn}><Icon name="dots" size={20} /></button>} />;
  } else if (tab === "home") {
    header = <AppBar title={HOUSEHOLD.replace("the ", "").replace(/\b\w/, c => c.toUpperCase())}
      right={<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button style={iconBtn}><Icon name="bell" size={20} /></button>
        <Avatar who={t.userName.toLowerCase().includes("tom") ? "tom" : "anke"} size={36} />
      </div>} />;
  } else if (tab === "shop") {
    header = <AppBar title="Shopping" right={<button style={iconBtn}><Icon name="search" size={20} /></button>} />;
  } else if (tab === "todos") {
    header = <AppBar title="To-dos" />;
  } else {
    header = <AppBar title="Menu planner" />;
  }

  /* ---- body ---- */
  let body;
  if (openList) {
    body = <ListDetail accent={accent} list={openList} mode={listMode} onSetMode={setListMode}
      onSetQty={(id, v) => setQty(openList.id, id, v)} onToggle={(id) => toggleDone(openList.id, id)}
      onAddItem={() => openQuick(openList.id)} onAssign={(id) => setAssign({ open: true, itemId: id })} />;
  } else if (tab === "home") {
    body = <Home accent={accent} userName={t.userName} household="the family" lists={lists} activity={activity}
      members={MEMBERS} onOpenTab={goTab} onQuickAdd={openQuick} quickBar={quickBar} showActivity={t.showActivity}
      onComingSoon={(n) => showToast(`${n} — coming soon`)} />;
  } else if (tab === "shop") {
    const grocNames = new Set((lists.find(l => l.id === "groc")?.items || []).map(i => i.name));
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "2px 18px 0" }}>
          {[["lists", "Lists"], ["catalogue", "Catalogue"]].map(([k, l]) =>
            <Chip key={k} on={shopTab === k} accent={accent} onClick={() => { setShopTab(k); scrollTop(); }}>{l}</Chip>)}
        </div>
        {shopTab === "lists"
          ? <ShopLists accent={accent} lists={lists} onOpenList={openListView} onNewList={() => showToast("New list — pick a name")} />
          : <Catalogue accent={accent} catalogue={CATALOGUE} inList={grocNames}
              onToggle={(it) => grocNames.has(it.name) ? removeItemByName("groc", it.name) : addItem("groc", it.name)} />}
      </div>
    );
  } else if (tab === "todos") {
    body = <Todos accent={accent} todos={todos}
      onToggle={(id) => setTodos(ts => ts.map(x => x.id === id ? { ...x, done: !x.done } : x))} />;
  } else {
    body = <ComingSoon accent={accent} icon="plate" title="Menu planner" blurb="Plan the week's meals together, then turn them into a shopping list in one tap. This module is on the way." />;
  }

  const assignItem = openList?.items.find(i => i.id === assign.itemId);

  return (
    <>
      <div style={{ zoom: scale }}>
      <IOSDevice>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: HT.paper, overflow: "hidden" }}>
          {header}
          <div ref={bodyRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", paddingBottom: (showFab && !openList) ? 84 : 8 }}>{body}</div>
          <TabBar tab={tab} accent={accent} onTab={goTab} onMore={() => setMoreOpen(true)} />

          {showFab && !openList && <FAB accent={accent} onClick={() => openQuick("groc")} />}
          <Toast toast={toast} />
        </div>

        <div style={{ position: "absolute", inset: 0, zIndex: 100, pointerEvents: "none" }}>
          {/* quick add sheet */}
          <Sheet open={quick.open} onClose={() => setQuick(q => ({ ...q, open: false }))} title="Quick add" accent={accent}>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12 }}>
              {lists.map(l => <Chip key={l.id} on={quick.target === l.id} accent={accent} onClick={() => setQuick(q => ({ ...q, target: l.id }))}>{l.emoji} {l.name}</Chip>)}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input autoFocus value={qInput} onChange={(e) => setQInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && qInput.trim()) { addItem(quick.target, qInput.trim()); setQInput(""); } }}
                placeholder="e.g. Coffee" style={{
                  flex: 1, font: "inherit", fontWeight: 700, fontSize: 16, color: HT.ink,
                  border: `1.5px solid ${HT.line}`, borderRadius: 14, padding: "13px 15px", outline: "none", background: HT.card,
                }} />
              <Btn accent={accent} disabled={!qInput.trim()} onClick={() => { addItem(quick.target, qInput.trim()); setQInput(""); }}>Add</Btn>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {SUGGEST.map(s => <Chip key={s} accent={accent} onClick={() => addItem(quick.target, s)}>+ {s}</Chip>)}
            </div>
            <div style={{ textAlign: "center", color: HT.inkFaint, fontWeight: 600, fontSize: 12.5, marginTop: 14 }}>
              Tip: add several, then close — they sync for everyone instantly.
            </div>
          </Sheet>

          {/* assign sheet */}
          <Sheet open={assign.open} onClose={() => setAssign({ open: false, itemId: null })} title={assignItem ? `Who's getting ${assignItem.name}?` : "Assign"} accent={accent}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.keys(MEMBERS).map(w => (
                <button key={w} onClick={() => { setAssignee(openList.id, assign.itemId, w); setAssign({ open: false, itemId: null }); }} style={rowBtn}>
                  <Avatar who={w} size={36} />
                  <span style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 16.5, color: HT.ink }}>{MEMBERS[w].name}</span>
                  <span style={{ marginLeft: "auto", color: HT.inkFaint, fontWeight: 600, fontSize: 13 }}>{MEMBERS[w].role}</span>
                </button>
              ))}
              <button onClick={() => { setAssignee(openList.id, assign.itemId, null); setAssign({ open: false, itemId: null }); }} style={{ ...rowBtn, color: HT.inkSoft }}>
                <span style={{ width: 36, height: 36, borderRadius: "50%", border: `1.5px dashed ${HT.line}`, display: "grid", placeItems: "center", color: HT.inkFaint }}><Icon name="x" size={18} /></span>
                <span style={{ fontWeight: 700, fontSize: 16 }}>No one for now</span>
              </button>
            </div>
          </Sheet>

          {/* more sheet */}
          <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={HOUSEHOLD.replace(/\b\w/, c => c.toUpperCase())} accent={accent}>
            <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: .6, textTransform: "uppercase", color: HT.inkFaint, margin: "0 2px 8px" }}>Modules</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[["cart", "Shopping", () => goTab("shop")], ["checklist", "To-dos", () => goTab("todos")], ["plate", "Menu planner", () => goTab("menu")], ["card", "Loyalty cards", () => showToast("Loyalty cards — coming soon")]].map(([ic, lbl, go]) => (
                <button key={lbl} onClick={() => { setMoreOpen(false); go(); }} style={rowBtn}>
                  <span style={{ width: 34, height: 34, borderRadius: 11, background: HT.honeySoft, color: HT.honeyDeep, display: "grid", placeItems: "center" }}><Icon name={ic} size={19} /></span>
                  <span style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 16, color: HT.ink }}>{lbl}</span>
                  <span style={{ marginLeft: "auto", color: HT.inkFaint }}><Icon name="chevron" size={18} /></span>
                </button>
              ))}
              <button onClick={() => showToast("Add a module — coming soon")} style={{ ...rowBtn, border: `1.5px dashed ${HT.line}`, color: HT.inkSoft, justifyContent: "center" }}>
                <Icon name="plus" size={18} /> <span style={{ fontWeight: 700 }}>Add module</span>
              </button>
            </div>
            <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: .6, textTransform: "uppercase", color: HT.inkFaint, margin: "16px 2px 8px" }}>Household</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[["people", "Members"], ["cog", "Settings"], ["swap", "Switch household"]].map(([ic, lbl]) => (
                <button key={lbl} onClick={() => showToast(`${lbl} — coming soon`)} style={rowBtn}>
                  <span style={{ width: 34, height: 34, borderRadius: 11, background: HT.lineSoft, color: HT.inkSoft, display: "grid", placeItems: "center" }}><Icon name={ic} size={19} /></span>
                  <span style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 700, fontSize: 16, color: HT.ink }}>{lbl}</span>
                  <span style={{ marginLeft: "auto", color: HT.inkFaint }}><Icon name="chevron" size={18} /></span>
                </button>
              ))}
            </div>
          </Sheet>
        </div>
      </IOSDevice>
      </div>

      <TweaksPanel>
        <TweakSection label="Quick add — the FAB question" />
        <TweakRadio label="Capture style" value={t.quickAdd} options={["FAB", "Home bar", "Both"]} onChange={(v) => setTweak("quickAdd", v)} />
        <TweakSection label="Brand accent" />
        <TweakColor label="Accent" value={t.accent} options={["#FFC21E", "#F39B12", "#FF7A59", "#4FB477"]} onChange={(v) => setTweak("accent", v)} />
        <TweakSection label="Content" />
        <TweakText label="Your name" value={t.userName} onChange={(v) => setTweak("userName", v)} />
        <TweakToggle label="Show who-did-what" value={t.showActivity} onChange={(v) => setTweak("showActivity", v)} />
      </TweaksPanel>
    </>
  );
}

const iconBtn = { border: "none", background: HT.card, boxShadow: `0 0 0 1.5px ${HT.line}`, width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", cursor: "pointer", color: HT.ink, flex: "0 0 auto" };
const rowBtn = { display: "flex", alignItems: "center", gap: 12, width: "100%", cursor: "pointer", background: HT.card, border: `1.5px solid ${HT.line}`, borderRadius: 16, padding: "12px 14px", font: "inherit", textAlign: "left", color: HT.ink, whiteSpace: "nowrap" };

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
