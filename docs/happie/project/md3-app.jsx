// md3-app.jsx — Happie · Material Design 3. Root state, navigation, sheets, tweaks.
const { useState: aU, useRef: aR, useEffect: aE, useMemo: aM } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "seed": "#FFC21E",
  "roundness": "Default",
  "navLabels": "All",
  "fabStyle": "Menu",
  "planRow": "Summary",
  "shopLayout": "By aisle",
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
  { id: "pharm", name: "Pharmacy run", emoji: "💊", people: ["anke"], updated: "4d ago", items: [
    { id: 1, name: "Paracetamol", cat: "Pantry", qty: 1, done: false },
    { id: 2, name: "Plasters", cat: "Pantry", qty: 1, done: true },
    { id: 3, name: "Vitamin D", cat: "Pantry", qty: 1, done: false },
    { id: 4, name: "Toothpaste", cat: "Pantry", qty: 2, done: false },
  ]},
  { id: "garden", name: "Garden centre", emoji: "🪴", people: ["tom", "finn"], updated: "5d ago", items: [
    { id: 1, name: "Tomato seeds", cat: "Produce", qty: 2, done: false },
    { id: 2, name: "Potting soil", cat: "Pantry", qty: 3, done: false },
    { id: 3, name: "Watering can", cat: "Pantry", qty: 1, done: true },
  ]},
  { id: "school", name: "Back to school", emoji: "🎒", people: ["anke", "lotte", "finn"], updated: "1w ago", items: [
    { id: 1, name: "Notebooks", cat: "Pantry", qty: 6, done: false },
    { id: 2, name: "Pencil case", cat: "Pantry", qty: 2, done: false },
    { id: 3, name: "Lunch boxes", cat: "Pantry", qty: 2, done: true },
    { id: 4, name: "Glue sticks", cat: "Pantry", qty: 4, done: false },
    { id: 5, name: "Highlighters", cat: "Pantry", qty: 1, done: false },
  ]},
  { id: "bbq", name: "Weekend BBQ", emoji: "🍖", people: ["anke", "tom"], updated: "1w ago", items: [
    { id: 1, name: "Burgers", cat: "Pantry", qty: 8, done: false },
    { id: 2, name: "Buns", cat: "Bakery", qty: 8, done: false },
    { id: 3, name: "Charcoal", cat: "Pantry", qty: 1, done: false },
    { id: 4, name: "Corn", cat: "Produce", qty: 6, done: true },
  ]},
  { id: "petshop", name: "Pet shop", emoji: "🐾", people: ["lotte"], updated: "2w ago", items: [
    { id: 1, name: "Dog food", cat: "Pantry", qty: 1, done: false },
    { id: 2, name: "Cat litter", cat: "Pantry", qty: 1, done: false },
    { id: 3, name: "Chew toy", cat: "Pantry", qty: 2, done: true },
  ]},
  { id: "diy", name: "DIY weekend", emoji: "🔨", people: ["tom"], updated: "3w ago", items: [
    { id: 1, name: "Wall paint", cat: "Pantry", qty: 2, done: false },
    { id: 2, name: "Paint roller", cat: "Pantry", qty: 1, done: false },
    { id: 3, name: "Masking tape", cat: "Pantry", qty: 3, done: false },
    { id: 4, name: "Sandpaper", cat: "Pantry", qty: 1, done: true },
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
  ...["Apples", "Bananas", "Spinach", "Carrots", "Tomatoes", "Avocado"].map((n) => ({ name: n, cat: "Produce" })),
  ...["Milk", "Yoghurt", "Butter", "Cheese", "Eggs"].map((n) => ({ name: n, cat: "Dairy" })),
  ...["Bread", "Croissants", "Bagels"].map((n) => ({ name: n, cat: "Bakery" })),
  ...["Pasta", "Olive oil", "Rice", "Coffee", "Cereal"].map((n) => ({ name: n, cat: "Pantry" })),
];
const SUGGEST = ["Coffee", "Eggs", "Butter", "Avocado"];
const HOUSEHOLD = "Maes family";

const ROUND_MULT = { Sharp: 0.35, Default: 1, Rounded: 1.6 };

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // build MD3 scheme from the seed tweak + corner radius helper
  const scheme = aM(() => buildScheme(t.seed), [t.seed]);
  const mult = ROUND_MULT[t.roundness] ?? 1;
  const cr = aM(() => (n) => Math.max(0, Math.round(n * mult)), [mult]);
  const ctxValue = aM(() => ({ s: scheme, cr }), [scheme, cr]);
  const labelMode = { All: "all", Selected: "selected", None: "never" }[t.navLabels] || "all";

  const [tab, setTab] = aU("home");
  const [lists, setLists] = aU(SEED_LISTS);
  const [todos, setTodos] = aU(SEED_TODOS);
  const [activity, setActivity] = aU(SEED_ACTIVITY);
  const [shopTab, setShopTab] = aU("lists");
  const [openListId, setOpenListId] = aU(null);
  const [listMode, setListMode] = aU("plan");
  const [moreOpen, setMoreOpen] = aU(false);
  const [listMenu, setListMenu] = aU(false);
  const [rename, setRename] = aU({ open: false, val: "" });
  const [quick, setQuick] = aU({ open: false, target: "groc" });
  const [assign, setAssign] = aU({ open: false, itemId: null });
  const [catalogue, setCatalogue] = aU(CATALOGUE);
  const [cats, setCats] = aU(CATS);
  const catsAZ = aM(() => [...cats].sort((a, b) => a.localeCompare(b)), [cats]); // catalogue shows categories A–Z
  const [catView, setCatView] = aU(CATS[0]);
  const [catPick, setCatPick] = aU(false);                                // category jump/picker sheet
  const [catItemEdit, setCatItemEdit] = aU({ open: false, item: null });  // edit one catalogue item
  const [catMenu, setCatMenu] = aU({ open: false, cat: null });           // rename / delete a category
  const [catRename, setCatRename] = aU({ open: false, val: "", orig: "" });
  const [catAdd, setCatAdd] = aU({ open: false, presetCat: null, newCat: false });
  const [addSheet, setAddSheet] = aU({ open: false, listId: null });
  const [addQuery, setAddQuery] = aU("");
  const [editItem, setEditItem] = aU({ open: false, itemId: null });
  const [snack, setSnack] = aU(null);
  const [qInput, setQInput] = aU("");
  const snackTimer = aR(null);
  const bodyRef = aR(null);
  const qRef = aR(null);
  const addRef = aR(null);
  const catAddRef = aR(null);
  const renameRef = aR(null);
  const openList = lists.find((l) => l.id === openListId);

  // scale phone to fit
  const DW = 402, DH = 874;
  const [scale, setScale] = aU(1);
  aE(() => {
    function fit() { setScale(Math.min((window.innerWidth - 28) / DW, (window.innerHeight - 28) / DH, 1)); }
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  function showSnack(msg, action, onAction) {
    setSnack({ msg, action, onAction });
    clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => setSnack(null), 2400);
  }
  function logActivity(text, react) {
    setActivity((a) => [{ who: t.userName.toLowerCase().includes("tom") ? "tom" : "anke", text, time: "Just now", react }, ...a]);
  }
  function scrollTop() { if (bodyRef.current) bodyRef.current.scrollTop = 0; }

  // focus the quick-add field only once its sheet is actually open & visible
  aE(() => {
    if (quick.open) { const id = setTimeout(() => qRef.current?.focus(), 140); return () => clearTimeout(id); }
  }, [quick.open]);
  aE(() => {
    if (addSheet.open) { const id = setTimeout(() => addRef.current?.focus(), 140); return () => clearTimeout(id); }
  }, [addSheet.open]);
  aE(() => {
    if (catAdd.open && !catAdd.newCat) { const id = setTimeout(() => catAddRef.current?.focus(), 140); return () => clearTimeout(id); }
  }, [catAdd.open]);
  aE(() => {
    if (rename.open) { const id = setTimeout(() => { renameRef.current?.focus(); renameRef.current?.select(); }, 140); return () => clearTimeout(id); }
  }, [rename.open]);

  /* mutations */
  function addItem(listId, name, cat) {
    const found = catalogue.find((x) => x.name.toLowerCase() === name.toLowerCase());
    const c = cat || (found ? found.cat : "Pantry");
    setLists((ls) => ls.map((l) => l.id === listId ? { ...l, updated: "just now", items: [...l.items, { id: Date.now() + Math.random(), name, cat: c, qty: 1, assignee: null, note: "", done: false }] } : l));
    const ln = lists.find((l) => l.id === listId)?.name || "list";
    logActivity(`added ${name} to ${ln}`);
    showSnack(`Added “${name}” to ${ln}`, "Undo", () => removeItemByName(listId, name));
  }
  // add an item the user typed that isn't in the catalogue yet — saves it (with its category) for next time
  function createCatalogueItem(listId, name, cat) {
    const c = cat || "Pantry";
    setCatalogue((cl) => cl.some((x) => x.name.toLowerCase() === name.toLowerCase()) ? cl : [...cl, { name, cat: c }]);
    addItem(listId, name, c);
  }
  /* catalogue management */
  function openCatAdd(presetCat, newCat) { setCatAdd({ open: true, presetCat: presetCat || catView, newCat: !!newCat }); }
  function addCatalogueEntry(name, cat) {
    const c = cat || catView || "Pantry";
    setCatalogue((cl) => cl.some((x) => x.name.toLowerCase() === name.toLowerCase()) ? cl : [...cl, { name, cat: c }]);
    showSnack(`Added “${name}” to ${c}`);
  }
  function addCategory(name) {
    const v = (name || "").trim(); if (!v) return;
    setCats((cs) => cs.some((c) => c.toLowerCase() === v.toLowerCase()) ? cs : [...cs, v]);
    setCatView(v);
    showSnack(`Created category “${v}”`);
  }
  function removeCatalogueEntry(item) {
    setCatalogue((cl) => cl.filter((x) => !(x.name === item.name && x.cat === item.cat)));
    showSnack(`Removed “${item.name}” from catalogue`, "Undo", () => setCatalogue((cl) => [...cl, item]));
  }
  function deleteCategory(cat) {
    const removed = catalogue.filter((x) => x.cat === cat);
    setCatalogue((cl) => cl.filter((x) => x.cat !== cat));
    setCats((cs) => { const next = cs.filter((c) => c !== cat); setCatView((cv) => cv === cat ? (next[0] || "") : cv); return next; });
    showSnack(`Deleted “${cat}” · ${removed.length} item${removed.length === 1 ? "" : "s"}`, "Undo", () => {
      setCats((cs) => cs.includes(cat) ? cs : [...cs, cat]);
      setCatalogue((cl) => [...cl, ...removed]);
      setCatView(cat);
    });
  }
  function renameCategory(oldName, name) {
    const v = (name || "").trim(); if (!v || v === oldName) return;
    if (cats.some((c) => c.toLowerCase() === v.toLowerCase() && c.toLowerCase() !== oldName.toLowerCase())) { showSnack(`“${v}” already exists`); return; }
    setCats((cs) => cs.map((c) => c === oldName ? v : c));
    setCatalogue((cl) => cl.map((x) => x.cat === oldName ? { ...x, cat: v } : x));
    setLists((ls) => ls.map((l) => ({ ...l, items: l.items.map((i) => i.cat === oldName ? { ...i, cat: v } : i) })));
    setCatView((cv) => cv === oldName ? v : cv);
    showSnack(`Renamed category to “${v}”`);
  }
  function renameCatalogueItem(item, name) {
    const v = (name || "").trim(); if (!v || v === item.name) return;
    if (catalogue.some((x) => x.name.toLowerCase() === v.toLowerCase() && x.name.toLowerCase() !== item.name.toLowerCase())) { showSnack(`“${v}” is already in your catalogue`); return; }
    setCatalogue((cl) => cl.map((x) => (x.name === item.name && x.cat === item.cat) ? { ...x, name: v } : x));
    showSnack(`Renamed to “${v}”`);
  }
  function moveCatalogueItem(item, cat) {
    if (cat === item.cat) return;
    setCatalogue((cl) => cl.map((x) => (x.name === item.name && x.cat === item.cat) ? { ...x, cat } : x));
    showSnack(`Moved “${item.name}” to ${cat}`);
  }
  function setItemCat(listId, itemId, cat) {
    setLists((ls) => ls.map((l) => l.id === listId ? { ...l, items: l.items.map((i) => i.id === itemId ? { ...i, cat } : i) } : l));
  }
  /* list-level management */
  function renameList(id, name) {
    const v = name.trim(); if (!v) return;
    setLists((ls) => ls.map((l) => l.id === id ? { ...l, name: v } : l));
  }
  function deleteList(id) {
    const idx = lists.findIndex((l) => l.id === id);
    const removed = lists[idx];
    setOpenListId(null);
    setLists((ls) => ls.filter((l) => l.id !== id));
    if (removed) showSnack(`Deleted “${removed.name}”`, "Undo", () =>
      setLists((ls) => [...ls.slice(0, idx), removed, ...ls.slice(idx)]));
  }
  function clearChecked(id) {
    const l = lists.find((x) => x.id === id);
    const n = l ? l.items.filter((i) => i.done).length : 0;
    if (!n) { showSnack("Nothing checked off yet"); return; }
    setLists((ls) => ls.map((x) => x.id === id ? { ...x, items: x.items.filter((i) => !i.done) } : x));
    showSnack(`Cleared ${n} checked item${n > 1 ? "s" : ""}`);
  }
  function removeItem(listId, itemId) {
    const l = lists.find((x) => x.id === listId);
    const idx = l ? l.items.findIndex((i) => i.id === itemId) : -1;
    const removed = idx >= 0 ? l.items[idx] : null;
    setLists((ls) => ls.map((x) => x.id === listId ? { ...x, items: x.items.filter((i) => i.id !== itemId) } : x));
    if (removed) showSnack(`Removed “${removed.name}”`, "Undo", () =>
      setLists((ls) => ls.map((x) => x.id === listId ? { ...x, items: [...x.items.slice(0, idx), removed, ...x.items.slice(idx)] } : x)));
  }
  function setNote(listId, itemId, note) {
    setLists((ls) => ls.map((l) => l.id === listId ? { ...l, items: l.items.map((i) => i.id === itemId ? { ...i, note } : i) } : l));
  }
  function removeItemByName(listId, name) {
    setLists((ls) => ls.map((l) => l.id === listId ? { ...l, items: l.items.filter((i) => i.name !== name) } : l));
  }
  function setQty(listId, itemId, qty) {
    setLists((ls) => ls.map((l) => l.id === listId ? { ...l, items: l.items.map((i) => i.id === itemId ? { ...i, qty } : i) } : l));
  }
  function toggleDone(listId, itemId) {
    let became = false, nm = "";
    setLists((ls) => ls.map((l) => {
      if (l.id !== listId) return l;
      return { ...l, items: l.items.map((i) => { if (i.id !== itemId) return i; became = !i.done; nm = i.name; return { ...i, done: !i.done }; }) };
    }));
    if (became) showSnack(`✓ ${nm} in the cart`);
  }
  function setAssignee(listId, itemId, who) {
    setLists((ls) => ls.map((l) => l.id === listId ? { ...l, items: l.items.map((i) => i.id === itemId ? { ...i, assignee: who } : i) } : l));
  }

  /* nav */
  function goTab(k) { setTab(k); setOpenListId(null); setShopTab("lists"); scrollTop(); }
  function openListView(id) { setOpenListId(id); setListMode("plan"); scrollTop(); }
  function openQuick(target) { setQuick({ open: true, target: target || "groc" }); setQInput(""); }

  const s = scheme;
  const iconBtn = (name, onClick) => <IconButton name={name} onClick={onClick} />;
  // account / household lives on the avatar, consistently on every top-level screen
  const avatarBtn = (
    <Pressable onClick={() => setMoreOpen(true)} color={s.onSurface} style={{ borderRadius: "50%", marginLeft: 4 }}>
      <Avatar who={t.userName.toLowerCase().includes("tom") ? "tom" : "anke"} size={36} />
    </Pressable>
  );

  /* header */
  let header;
  if (openList) {
    header = <TopAppBar title={`${openList.emoji} ${openList.name}`} leading={iconBtn("back", () => setOpenListId(null))} actions={iconBtn("dots", () => setListMenu(true))} />;
  } else if (tab === "home") {
    header = <TopAppBar variant="large" subtitle={`${greeting()}, ${t.userName}`} title={HOUSEHOLD}
      actions={<><IconButton name="bell" />{avatarBtn}</>} />;
  } else if (tab === "shop") {
    header = <TopAppBar title="Shopping" actions={<><IconButton name="search" />{avatarBtn}</>} />;
  } else if (tab === "todos") {
    header = <TopAppBar title="To-dos" actions={avatarBtn} />;
  } else {
    header = <TopAppBar title="Menu planner" actions={avatarBtn} />;
  }

  /* body */
  let body;
  if (openList) {
    body = <ListDetail list={openList} mode={listMode} planModel={t.planRow === "Inline" ? "inline" : "summary"} shopLayout={t.shopLayout === "Flat" ? "flat" : "aisle"} onSetMode={setListMode}
      onSetQty={(id, v) => setQty(openList.id, id, v)} onToggle={(id) => toggleDone(openList.id, id)}
      onAddItem={() => { setAddQuery(""); setAddSheet({ open: true, listId: openList.id }); }}
      onOpenItem={(id) => setEditItem({ open: true, itemId: id })}
      onAssign={(id) => setAssign({ open: true, itemId: id })} />;
  } else if (tab === "home") {
    body = <Home userName={t.userName} household="the family" lists={lists} activity={activity} showActivity={t.showActivity}
      onOpenTab={goTab} onQuickAdd={openQuick} onComingSoon={(n) => showSnack(`${n} — coming soon`)} />;
  } else if (tab === "shop") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, padding: "4px 16px 0" }}>
          {[["lists", "Lists"], ["catalogue", "Catalogue"]].map(([k, l]) =>
            <Chip key={k} selected={shopTab === k} onClick={() => { setShopTab(k); scrollTop(); }}>{l}</Chip>)}
        </div>
        {shopTab === "lists"
          ? <ShopLists lists={lists} onOpenList={openListView} onNewList={() => showSnack("New list — pick a name")} />
          : <CatalogueScreen
              catalogue={catalogue} cats={catsAZ}
              selectedCat={cats.includes(catView) ? catView : (catsAZ[0] || "")}
              onSelectCat={(c) => { setCatView(c); scrollTop(); }}
              onAddTo={(c) => openCatAdd(c)}
              onOpenCatPicker={() => setCatPick(true)}
              onEditItem={(it) => setCatItemEdit({ open: true, item: it })}
              onCategoryMenu={(c) => setCatMenu({ open: true, cat: c })} />}
      </div>
    );
  } else if (tab === "todos") {
    body = <Todos todos={todos} onToggle={(id) => setTodos((ts) => ts.map((x) => x.id === id ? { ...x, done: !x.done } : x))} />;
  } else {
    body = <ComingSoon icon="plate" title="Menu planner" blurb="Plan the week's meals together, then turn them into a shopping list in one tap. This module is on the way." />;
  }

  const navItems = [
    { key: "home", icon: "home", label: "Home" },
    { key: "shop", icon: "cart", label: "Shop" },
    { key: "todos", icon: "checklist", label: "To-dos" },
    { key: "menu", icon: "plate", label: "Menu" },
  ];
  const assignItem = openList?.items.find((i) => i.id === assign.itemId);
  const editingItem = openList?.items.find((i) => i.id === editItem.itemId);
  const addList = lists.find((l) => l.id === addSheet.listId);
  const showFab = !openList;
  const onListsOverview = tab === "shop" && shopTab === "lists";
  const onCatalogue = tab === "shop" && shopTab === "catalogue";
  const newList = () => showSnack("New list — pick a name");
  // primary action adapts to context: create a list on the lists overview, add to the catalogue while browsing it, else quick-capture
  const fabPrimary = onListsOverview
    ? { icon: "plus", label: "New list", onClick: newList }
    : onCatalogue
    ? { icon: "plus", label: "Add item", onClick: () => openCatAdd(catView) }
    : { icon: "plus", label: "Add", onClick: () => openQuick("groc") };
  const fabActions = onCatalogue ? [
    { icon: "plus", label: "Add item", onClick: () => openCatAdd(catView) },
    { icon: "tag", label: "New category", onClick: () => openCatAdd(catView, true) },
  ] : [
    { icon: "cart", label: "Add to groceries", onClick: () => openQuick("groc") },
    { icon: "checklist", label: "New to-do", onClick: () => showSnack("New to-do — coming soon") },
    { icon: "plus", label: "New list", onClick: newList },
  ];

  return (
    <MD3Ctx.Provider value={ctxValue}>
      <div style={{ zoom: scale, ...schemeToVars(scheme) }}>
        <IOSDevice>
          <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: s.surface, overflow: "hidden" }}>
            {header}
            <div ref={bodyRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", background: s.surface, paddingBottom: 12 }}>{body}</div>
            <NavigationBar items={navItems} active={openList ? "shop" : tab} onSelect={goTab} labelMode={labelMode} />
            <div style={{ height: 24, background: s.surfaceContainer, flex: "0 0 auto" }} />

            {showFab && t.fabStyle === "Menu" && <FabMenu actions={fabActions} bottom={116} />}
            {showFab && t.fabStyle === "Single" && (
              <div style={{ position: "absolute", right: 16, bottom: 116, zIndex: 90 }}><Fab icon={fabPrimary.icon} onClick={fabPrimary.onClick} /></div>
            )}
            {showFab && t.fabStyle === "Extended" && (
              <div style={{ position: "absolute", right: 16, bottom: 116, zIndex: 90 }}><Fab icon={fabPrimary.icon} label={fabPrimary.label} onClick={fabPrimary.onClick} /></div>
            )}
            <Snackbar data={snack} />
          </div>

          {/* sheets layer */}
          <div style={{ position: "absolute", inset: 0, zIndex: 100, pointerEvents: "none" }}>
            <Sheet open={quick.open} onClose={() => setQuick((q) => ({ ...q, open: false }))} title="Quick add">
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 14 }}>
                {lists.map((l) => <Chip key={l.id} selected={quick.target === l.id} leadingCheck={false} onClick={() => setQuick((q) => ({ ...q, target: l.id }))}>{l.emoji} {l.name}</Chip>)}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input ref={qRef} value={qInput} onChange={(e) => setQInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && qInput.trim()) { addItem(quick.target, qInput.trim()); setQInput(""); } }}
                  placeholder="e.g. Coffee" style={{
                    flex: 1, ...type("bodyLarge"), color: s.onSurface, background: s.surfaceContainerHighest,
                    border: "none", borderBottom: `2px solid ${s.primary}`, borderRadius: `${cr(8)}px ${cr(8)}px 0 0`,
                    padding: "14px 16px", outline: "none",
                  }} />
                <Button variant="filled" disabled={!qInput.trim()} onClick={() => { addItem(quick.target, qInput.trim()); setQInput(""); }}>Add</Button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                {SUGGEST.map((sug) => <Chip key={sug} icon="plus" onClick={() => addItem(quick.target, sug)}>{sug}</Chip>)}
              </div>
            </Sheet>

            <Sheet open={assign.open} onClose={() => setAssign({ open: false, itemId: null })} title={assignItem ? `Who's getting ${assignItem.name}?` : "Assign"}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {Object.keys(MEMBERS).map((w) => (
                  <ListItem key={w} onClick={() => { setAssignee(openList.id, assign.itemId, w); setAssign({ open: false, itemId: null }); }}
                    leading={<Avatar who={w} size={40} />} headline={MEMBERS[w].name} supporting={MEMBERS[w].role} />
                ))}
                <ListItem onClick={() => { setAssignee(openList.id, assign.itemId, null); setAssign({ open: false, itemId: null }); }}
                  leading={<span style={{ width: 40, height: 40, borderRadius: "50%", border: `1.5px dashed ${s.outline}`, display: "grid", placeItems: "center" }}><Icon name="x" size={18} /></span>}
                  headline="No one for now" />
              </div>
            </Sheet>

            {/* Account & household — opened from the avatar on every screen */}
            <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={HOUSEHOLD}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "4px 4px 16px" }}>
                <Avatar who={t.userName.toLowerCase().includes("tom") ? "tom" : "anke"} size={52} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...type("titleMedium"), color: s.onSurface }}>{t.userName}</div>
                  <div style={{ ...type("bodyMedium"), color: s.onSurfaceVariant }}>{HOUSEHOLD} · 4 members</div>
                </div>
                <Pressable onClick={() => { setMoreOpen(false); showSnack("Switch household — coming soon"); }} color={s.onSurface}
                  style={{ ...type("labelLarge"), color: s.primary, padding: "8px 14px", borderRadius: 999, border: `1px solid ${s.outlineVariant}`, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="swap" size={16} /> Switch
                </Pressable>
              </div>
              <div style={{ ...type("titleSmall", { textTransform: "uppercase", letterSpacing: "0.8px" }), color: s.primary, margin: "0 0 4px" }}>More tools</div>
              <ListItem onClick={() => { setMoreOpen(false); showSnack("Loyalty cards — coming soon"); }}
                leading={<span style={{ width: 40, height: 40, borderRadius: "50%", background: s.primaryContainer, color: s.onPrimaryContainer, display: "grid", placeItems: "center" }}><Icon name="card" size={20} /></span>}
                headline="Loyalty cards" supporting="Store your shop cards" trailing={<Icon name="chevron" size={18} />} />
              <div style={{ ...type("titleSmall", { textTransform: "uppercase", letterSpacing: "0.8px" }), color: s.primary, margin: "12px 0 4px" }}>Household</div>
              {[["people", "Members"], ["cog", "Settings"]].map(([ic, lbl]) => (
                <ListItem key={lbl} onClick={() => { setMoreOpen(false); showSnack(`${lbl} — coming soon`); }}
                  leading={<span style={{ width: 40, height: 40, borderRadius: "50%", background: s.surfaceContainerHighest, color: s.onSurfaceVariant, display: "grid", placeItems: "center" }}><Icon name={ic} size={20} /></span>}
                  headline={lbl} trailing={<Icon name="chevron" size={18} />} />
              ))}
            </Sheet>

            {/* List management — opened from the ⋮ inside a list */}
            <Sheet open={listMenu} onClose={() => setListMenu(false)} title={openList ? `${openList.emoji} ${openList.name}` : "List"}>
              {openList && (() => {
                const checked = openList.items.filter((i) => i.done).length;
                const badge = (ic, bg, fg) => <span style={{ width: 40, height: 40, borderRadius: "50%", background: bg, color: fg, display: "grid", placeItems: "center" }}><Icon name={ic} size={20} /></span>;
                return (<>
                  <ListItem onClick={() => { setListMenu(false); setRename({ open: true, val: openList.name }); }}
                    leading={badge("edit", s.surfaceContainerHighest, s.onSurfaceVariant)} headline="Rename list" />
                  <ListItem onClick={() => { setListMenu(false); showSnack("Invite link copied — share with your household"); }}
                    leading={badge("share", s.surfaceContainerHighest, s.onSurfaceVariant)} headline="Share list" supporting="Invite household members" />
                  <ListItem onClick={() => { setListMenu(false); clearChecked(openList.id); }}
                    leading={badge("check", s.surfaceContainerHighest, s.onSurfaceVariant)} headline="Clear checked items"
                    supporting={checked ? `${checked} checked off` : "Nothing checked yet"} />
                  <div style={{ height: 1, background: s.surfaceContainerHighest, margin: "8px 4px" }} />
                  <ListItem onClick={() => { setListMenu(false); deleteList(openList.id); }}
                    leading={badge("trash", s.errorContainer, s.error)} headline={<span style={{ color: s.error }}>Delete list</span>} />
                </>);
              })()}
            </Sheet>

            {/* Rename list */}
            <Sheet open={rename.open} onClose={() => setRename({ open: false, val: "" })} title="Rename list">
              <input ref={renameRef} value={rename.val} onChange={(e) => setRename((r) => ({ ...r, val: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter" && rename.val.trim()) { renameList(openListId, rename.val); setRename({ open: false, val: "" }); } }}
                placeholder="List name" style={{
                  width: "100%", boxSizing: "border-box", ...type("bodyLarge"), color: s.onSurface,
                  background: s.surfaceContainerHighest, border: "none", borderBottom: `2px solid ${s.primary}`,
                  borderRadius: `${cr(8)}px ${cr(8)}px 0 0`, padding: "14px 16px", outline: "none", fontFamily: "'Roboto Flex', system-ui",
                }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <Button variant="text" onClick={() => setRename({ open: false, val: "" })}>Cancel</Button>
                <Button variant="filled" onClick={() => { if (rename.val.trim()) { renameList(openListId, rename.val); setRename({ open: false, val: "" }); } }}>Save</Button>
              </div>
            </Sheet>

            {/* Add to list — search the catalogue or create a brand-new item */}
            <Sheet open={addSheet.open} onClose={() => setAddSheet({ open: false, listId: null })} title={addList ? `Add to ${addList.name}` : "Add item"}>
              {addList && <AddItemBody catalogue={catalogue} list={addList} query={addQuery} setQuery={setAddQuery} inputRef={addRef}
                onAddExisting={(c) => addItem(addList.id, c.name)}
                onCreate={(name, cat) => { createCatalogueItem(addList.id, name, cat); setAddQuery(""); }} />}
            </Sheet>

            {/* Catalogue → jump to a category (New category pinned at top) */}
            <Sheet open={catPick} onClose={() => setCatPick(false)} title="Categories">
              {catPick && <CatPickerBody cats={catsAZ} catalogue={catalogue} selected={cats.includes(catView) ? catView : (catsAZ[0] || "")}
                onPick={(c) => { setCatView(c); setCatPick(false); scrollTop(); }}
                onNewCategory={() => { setCatPick(false); openCatAdd(catView, true); }} />}
            </Sheet>

            {/* Catalogue → edit one item: rename · move category · remove */}
            <Sheet open={catItemEdit.open} onClose={() => setCatItemEdit({ open: false, item: null })} title={catItemEdit.item ? catItemEdit.item.name : "Item"}>
              {catItemEdit.open && <CatalogueItemBody item={catItemEdit.item} cats={catsAZ}
                existingNames={new Set(catalogue.map((c) => c.name.toLowerCase()))}
                onRename={(v) => { renameCatalogueItem(catItemEdit.item, v); setCatItemEdit((e) => ({ ...e, item: { ...e.item, name: v.trim() } })); }}
                onMove={(c) => { moveCatalogueItem(catItemEdit.item, c); setCatItemEdit((e) => ({ ...e, item: { ...e.item, cat: c } })); }}
                onRemove={() => { removeCatalogueEntry(catItemEdit.item); setCatItemEdit({ open: false, item: null }); }} />}
            </Sheet>

            {/* Catalogue → category actions */}
            <Sheet open={catMenu.open} onClose={() => setCatMenu({ open: false, cat: null })} title={catMenu.cat || "Category"}>
              {catMenu.cat && (() => {
                const n = catalogue.filter((x) => x.cat === catMenu.cat).length;
                const badge = (ic, bg, fg) => <span style={{ width: 40, height: 40, borderRadius: "50%", background: bg, color: fg, display: "grid", placeItems: "center" }}><Icon name={ic} size={20} /></span>;
                return (<>
                  <ListItem onClick={() => { setCatMenu({ open: false, cat: null }); setCatRename({ open: true, val: catMenu.cat, orig: catMenu.cat }); }}
                    leading={badge("edit", s.surfaceContainerHighest, s.onSurfaceVariant)} headline="Rename category" />
                  {cats.length > 1 && (
                    <ListItem onClick={() => { const c = catMenu.cat; setCatMenu({ open: false, cat: null }); deleteCategory(c); }}
                      leading={badge("trash", s.errorContainer, s.error)} headline={<span style={{ color: s.error }}>Delete category</span>}
                      supporting={`${n} item${n === 1 ? "" : "s"} will be removed`} />
                  )}
                </>);
              })()}
            </Sheet>

            {/* Catalogue → rename category */}
            <Sheet open={catRename.open} onClose={() => setCatRename({ open: false, val: "", orig: "" })} title="Rename category">
              <input value={catRename.val} onChange={(e) => setCatRename((r) => ({ ...r, val: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter" && catRename.val.trim()) { renameCategory(catRename.orig, catRename.val); setCatRename({ open: false, val: "", orig: "" }); } }}
                placeholder="Category name" style={{
                  width: "100%", boxSizing: "border-box", ...type("bodyLarge"), color: s.onSurface,
                  background: s.surfaceContainerHighest, border: "none", borderBottom: `2px solid ${s.primary}`,
                  borderRadius: `${cr(8)}px ${cr(8)}px 0 0`, padding: "14px 16px", outline: "none", fontFamily: "'Roboto Flex', system-ui",
                }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <Button variant="text" onClick={() => setCatRename({ open: false, val: "", orig: "" })}>Cancel</Button>
                <Button variant="filled" onClick={() => { if (catRename.val.trim()) { renameCategory(catRename.orig, catRename.val); setCatRename({ open: false, val: "", orig: "" }); } }}>Save</Button>
              </div>
            </Sheet>

            {/* Add to catalogue — pick a category (or make one) and add items in a row */}
            <Sheet open={catAdd.open} onClose={() => setCatAdd({ open: false, presetCat: null, newCat: false })}
              title={catAdd.newCat ? "New category" : `Add to ${catAdd.presetCat || "catalogue"}`}>
              {catAdd.open && <CatalogueAddBody cats={catsAZ} presetCat={catAdd.presetCat} startNewCat={catAdd.newCat}
                existingNames={new Set(catalogue.map((c) => c.name.toLowerCase()))} inputRef={catAddRef}
                onAdd={addCatalogueEntry} onCreateCategory={addCategory} />}
            </Sheet>

            {/* Item editor — quantity, assignee, note, remove */}
            <Sheet open={editItem.open} onClose={() => setEditItem({ open: false, itemId: null })} title={editingItem ? editingItem.name : "Item"}>
              <ItemEditorBody item={editingItem} members={MEMBERS}
                onSetQty={(v) => setQty(openList.id, editItem.itemId, v)}
                onSetCat={(c) => setItemCat(openList.id, editItem.itemId, c)}
                onSetAssignee={(w) => setAssignee(openList.id, editItem.itemId, w)}
                onSetNote={(n) => setNote(openList.id, editItem.itemId, n)}
                onRemove={() => { removeItem(openList.id, editItem.itemId); setEditItem({ open: false, itemId: null }); }}
                onDone={() => { const nm = editingItem ? editingItem.name : "Item"; setEditItem({ open: false, itemId: null }); showSnack(`${nm} updated`); }} />
            </Sheet>
          </div>
          </div>
        </IOSDevice>
      </div>

      <TweaksPanel>
        <TweakSection label="Dynamic color" />
        <TweakColor label="Seed color" value={t.seed} options={["#FFC21E", "#6750A4", "#3F9D5B", "#3A6FF8"]} onChange={(v) => setTweak("seed", v)} />
        <TweakSection label="Shape & layout" />
        <TweakRadio label="Corner roundness" value={t.roundness} options={["Sharp", "Default", "Rounded"]} onChange={(v) => setTweak("roundness", v)} />
        <TweakRadio label="Nav bar labels" value={t.navLabels} options={["All", "Selected", "None"]} onChange={(v) => setTweak("navLabels", v)} />
        <TweakSection label="Capture (FAB)" />
        <TweakRadio label="FAB style" value={t.fabStyle} options={["Menu", "Single", "Extended"]} onChange={(v) => setTweak("fabStyle", v)} />
        <TweakSection label="Shopping list · Plan" />
        <TweakRadio label="Plan row" value={t.planRow} options={["Summary", "Inline"]} onChange={(v) => setTweak("planRow", v)} />
        <TweakSection label="Shopping list · Shop" />
        <TweakRadio label="Shop layout" value={t.shopLayout} options={["By aisle", "Flat"]} onChange={(v) => setTweak("shopLayout", v)} />
        <TweakSection label="Content" />
        <TweakText label="Your name" value={t.userName} onChange={(v) => setTweak("userName", v)} />
        <TweakToggle label="Show who-did-what" value={t.showActivity} onChange={(v) => setTweak("showActivity", v)} />
      </TweaksPanel>
    </MD3Ctx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
