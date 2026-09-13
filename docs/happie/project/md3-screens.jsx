// md3-screens.jsx — Happie MD3 screens (consume window primitives via useMd3)
const { useState: scU } = React;
const CATS = ["Produce", "Dairy", "Bakery", "Pantry"];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/* small reusable bits */
function SubHeader({ children }) {
  const { s } = useMd3();
  return <div style={{ ...type("titleSmall", { textTransform: "uppercase", letterSpacing: "0.8px" }), color: s.primary, margin: "4px 4px 8px" }}>{children}</div>;
}

function Stepper({ value, onChange }) {
  const { s, cr } = useMd3();
  const btn = (icon, fn) => (
    <Pressable onClick={(e) => { e.stopPropagation(); fn(); }} color={s.onSecondaryContainer} style={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center", background: s.secondaryContainer, color: s.onSecondaryContainer }}>
      <Icon name={icon} size={18} stroke={2.3} />
    </Pressable>
  );
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {btn("minus", () => onChange(Math.max(1, value - 1)))}
      <span style={{ ...type("titleMedium"), minWidth: 16, textAlign: "center", color: s.onSurface }}>{value}</span>
      {btn("plus", () => onChange(value + 1))}
    </div>
  );
}

function RoundCheck({ checked }) {
  const { s } = useMd3();
  return (
    <span style={{
      width: 24, height: 24, borderRadius: "50%", flex: "0 0 auto", display: "grid", placeItems: "center",
      border: checked ? "none" : `2px solid ${s.outline}`, background: checked ? s.primary : "transparent",
      color: s.onPrimary, transition: "background .15s, border-color .15s",
    }}>{checked && <Icon name="check" size={16} stroke={2.6} />}</span>
  );
}

/* ============ HOME ============ */
function Home({ userName, household, lists, activity, showActivity, onOpenTab, onQuickAdd, onComingSoon }) {
  const { s, cr } = useMd3();
  const groc = lists[0];
  const grocDone = groc.items.filter((i) => i.done).length;
  const tiles = [
    { key: "shop", icon: "cart", label: "Shopping", sub: `${groc.items.length} items · ${lists.length} lists`, prog: [grocDone, groc.items.length], go: () => onOpenTab("shop") },
    { key: "todos", icon: "checklist", label: "To-dos", sub: "3 today · 1 yours", prog: [1, 3], go: () => onOpenTab("todos") },
    { key: "menu", icon: "plate", label: "Menu planner", sub: "Plan this week", go: () => onOpenTab("menu") },
    { key: "cards", icon: "card", label: "Loyalty cards", sub: "4 saved", go: () => onComingSoon("Loyalty cards") },
  ];
  return (
    <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
      <SearchBar placeholder="Add or search anything…" onClick={() => onQuickAdd(null)} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {tiles.map((t) => (
          <Card key={t.key} variant="filled" onClick={t.go} pad={16} style={{ borderRadius: cr(20) }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 116 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: s.primaryContainer, color: s.onPrimaryContainer, display: "grid", placeItems: "center" }}>
                <Icon name={t.icon} size={24} />
              </div>
              <div style={{ marginTop: "auto" }}>
                <div style={{ ...type("titleMedium"), color: s.onSurface }}>{t.label}</div>
                <div style={{ ...type("bodySmall"), color: s.onSurfaceVariant }}>{t.sub}</div>
              </div>
              {t.prog && <Progress value={t.prog[0]} total={t.prog[1]} />}
            </div>
          </Card>
        ))}
      </div>

      <Card variant="outlined" pad={16} style={{ borderRadius: cr(20) }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ ...type("titleMedium"), color: s.onSurface }}>Who's home</div>
            <div style={{ ...type("bodySmall"), color: s.onSurfaceVariant }}>3 of 4 family members</div>
          </div>
          <AvatarStack people={["anke", "lotte", "finn"]} size={34} />
        </div>
      </Card>

      {showActivity && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 4px 12px" }}>
            <span style={{ color: s.tertiary }}><Icon name="sparkle" size={20} /></span>
            <span style={{ ...type("titleMedium"), color: s.onSurface }}>Lately in {household}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {activity.slice(0, 4).map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <Avatar who={a.who} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...type("bodyMedium"), color: s.onSurface }}>
                    <b style={{ fontWeight: 600 }}>{MEMBERS[a.who]?.name}</b> {a.text}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <span style={{ ...type("labelMedium"), color: s.onSurfaceVariant }}>{a.time}</span>
                    {a.react && <span style={{ ...type("labelMedium"), color: s.onSecondaryContainer, background: s.secondaryContainer, borderRadius: 999, padding: "2px 8px" }}>{a.react}</span>}
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

/* ============ SHOP — lists ============ */
function ShopLists({ lists, onOpenList, onNewList }) {
  const { s, cr } = useMd3();
  if (lists.length === 0) {
    return (
      <div style={{ padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: s.secondaryContainer, display: "grid", placeItems: "center" }}>
          <Icon name="cart" size={32} />
        </div>
        <div>
          <div style={{ ...type("titleMedium"), color: s.onSurface }}>No lists yet</div>
          <div style={{ ...type("bodyMedium"), color: s.onSurfaceVariant, marginTop: 4 }}>Tap the + button to start your first shopping list.</div>
        </div>
        <Button variant="filled" onClick={onNewList}>New list</Button>
      </div>
    );
  }
  return (
    <div style={{ padding: "4px 16px 96px", display: "flex", flexDirection: "column", gap: 12 }}>
      {lists.map((l) => {
        const done = l.items.filter((i) => i.done).length;
        return (
          <Card key={l.id} variant="filled" onClick={() => onOpenList(l.id)} pad={16} style={{ borderRadius: cr(20) }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: s.tertiaryContainer, display: "grid", placeItems: "center", fontSize: 22, flex: "0 0 auto" }}>{l.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...type("titleMedium"), color: s.onSurface, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</div>
                  <div style={{ ...type("bodySmall"), color: s.onSurfaceVariant }}>{done}/{l.items.length} done · {l.updated}</div>
                </div>
                <span style={{ ...type("labelLarge"), background: s.secondaryContainer, color: s.onSecondaryContainer, borderRadius: 999, padding: "4px 12px" }}>{l.items.length}</span>
              </div>
              <Progress value={done} total={l.items.length} />
              <AvatarStack people={l.people} size={28} />
            </div>
          </Card>
        );
      })}
      {/* sticky footer — stays reachable no matter how many lists scroll past */}
      {null}
    </div>
  );
}

/* ============ SHOP — catalogue ============ */
function Catalogue({ catalogue, inList, onToggle }) {
  const { s, cr } = useMd3();
  const [cat, setCat] = scU("Produce");
  const items = catalogue.filter((c) => c.cat === cat);
  return (
    <div style={{ padding: "4px 0 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 16px" }}>
        {CATS.map((c) => <Chip key={c} selected={c === cat} onClick={() => setCat(c)}>{c}</Chip>)}
      </div>
      <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {items.map((it) => {
          const added = inList.has(it.name);
          return (
            <Pressable key={it.name} onClick={() => onToggle(it)} color={added ? s.onSecondaryContainer : s.onSurface} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              background: added ? s.secondaryContainer : s.surface, border: added ? "none" : `1px solid ${s.outlineVariant}`,
              borderRadius: cr(12), padding: "14px 16px", ...type("bodyLarge"),
              color: added ? s.onSecondaryContainer : s.onSurface,
            }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
              <Icon name={added ? "check" : "plus"} size={20} stroke={2.3} />
            </Pressable>
          );
        })}
      </div>
    </div>
  );
}

/* ============ SHOP — list detail ============ */
function PlanMode({ list, model = "summary", onSetQty, onAddItem, onAssign, onOpenItem }) {
  const { s, cr } = useMd3();
  const byCat = {};
  list.items.forEach((it) => { (byCat[it.cat] = byCat[it.cat] || []).push(it); });
  // known categories first, then any new ones introduced via catalogue management
  const order = CATS.filter((c) => byCat[c]).concat(Object.keys(byCat).filter((c) => !CATS.includes(c)));
  const unassigned = list.items.filter((i) => !i.assignee).length;
  const summary = model === "summary";

  // small read-only pill used in summary rows
  const pill = (children) => (
    <span style={{ ...type("labelMedium"), background: s.surface, color: s.onSurfaceVariant, borderRadius: 999, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>{children}</span>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SearchBar placeholder="Add item or search catalogue…" onClick={onAddItem} trailing={<span style={{ color: s.primary }}><Icon name="plus" size={22} /></span>} />

      {/* planning summary — what still needs attention */}
      {unassigned > 0 && (
        <Pressable onClick={() => { const first = list.items.find((i) => !i.assignee); if (first) (summary ? onOpenItem : onAssign)(first.id); }}
          color={s.onTertiaryContainer} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
            background: s.tertiaryContainer, color: s.onTertiaryContainer, border: "none",
            borderRadius: cr(16), padding: "12px 16px",
          }}>
          <Icon name="user" size={18} />
          <span style={{ flex: 1, ...type("bodyMedium") }}>{unassigned} item{unassigned === 1 ? "" : "s"} still need{unassigned === 1 ? "s" : ""} an owner</span>
          <Icon name="chevron" size={18} style={{ transform: "rotate(0deg)", opacity: .7 }} />
        </Pressable>
      )}

      {order.map((c) => (
        <div key={c}>
          <SubHeader>{c}</SubHeader>
          <Card variant="filled" pad={0} style={{ borderRadius: cr(16), overflow: "hidden" }}>
            {byCat[c].map((it, idx) => (
              <div key={it.id}>
                {summary ? (
                  /* ── Model A · row = summary, whole row opens the editor ── */
                  <Pressable as="div" onClick={() => onOpenItem(it.id)} color={s.onSurface}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }}>
                    {it.assignee
                      ? <Avatar who={it.assignee} size={32} />
                      : <span style={{ width: 32, height: 32, borderRadius: "50%", border: `1.5px dashed ${s.outline}`, color: s.onSurfaceVariant, display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name="user" size={17} /></span>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...type("bodyLarge"), color: s.onSurface, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                      {it.note && <div style={{ ...type("bodySmall"), color: s.onSurfaceVariant, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📝 {it.note}</div>}
                    </div>
                    {it.qty > 1 && pill(<>×{it.qty}</>)}
                    <Icon name="chevron" size={20} style={{ color: s.onSurfaceVariant, opacity: .6, transform: "rotate(0deg)" }} />
                  </Pressable>
                ) : (
                  /* ── Model B · fast inline edit; name opens sheet for note/category/remove ── */
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                    <Pressable as="div" stop onClick={() => onOpenItem(it.id)} color={s.onSurface} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                      <div style={{ ...type("bodyLarge"), color: s.onSurface, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                      {it.note
                        ? <div style={{ ...type("bodySmall"), color: s.onSurfaceVariant, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📝 {it.note}</div>
                        : <div style={{ ...type("bodySmall"), color: s.onSurfaceVariant, opacity: .5, display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="edit" size={12} /> Tap to edit</div>}
                    </Pressable>
                    <Pressable stop onClick={() => onAssign(it.id)} color={s.onSurface} style={{ borderRadius: "50%" }}>
                      {it.assignee ? <Avatar who={it.assignee} size={32} /> :
                        <span style={{ width: 32, height: 32, borderRadius: "50%", border: `1.5px dashed ${s.outline}`, color: s.onSurfaceVariant, display: "grid", placeItems: "center" }}><Icon name="user" size={17} /></span>}
                    </Pressable>
                    <Stepper value={it.qty} onChange={(v) => onSetQty(it.id, v)} />
                  </div>
                )}
                {idx < byCat[c].length - 1 && <div style={{ height: 1, background: s.surface, margin: "0 16px" }} />}
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}

/* ── Add-item search + create sheet body ── */
function AddItemBody({ catalogue, list, query, setQuery, onAddExisting, onCreate, inputRef }) {
  const { s, cr } = useMd3();
  const [newCat, setNewCat] = scU("Pantry");
  const q = query.trim();
  const ql = q.toLowerCase();
  const inList = new Set(list.items.map((i) => i.name.toLowerCase()));
  const matches = ql ? catalogue.filter((c) => c.name.toLowerCase().includes(ql)) : catalogue;
  const exact = catalogue.some((c) => c.name.toLowerCase() === ql);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: s.onSurfaceVariant }}><Icon name="search" size={20} /></span>
        <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && q && !exact) onCreate(q); }}
          placeholder="Search or add an item…" style={{
            width: "100%", boxSizing: "border-box", ...type("bodyLarge"), color: s.onSurface,
            background: s.surfaceContainerHighest, border: "none", borderRadius: cr(16),
            padding: "14px 16px 14px 44px", outline: "none", fontFamily: "'Roboto Flex', system-ui",
          }} />
      </div>

      {q && !exact && (
        <div style={{ background: s.primaryContainer, color: s.onPrimaryContainer, borderRadius: cr(16), padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 36, height: 36, borderRadius: "50%", background: s.onPrimaryContainer, color: s.primaryContainer, display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name="plus" size={20} stroke={2.4} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...type("bodyLarge") }}>Add “{q}”</div>
              <div style={{ ...type("bodySmall"), opacity: .8 }}>New item — pick a category</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CATS.map((c) => (
              <Pressable key={c} onClick={() => setNewCat(c)} color={s.onPrimaryContainer} style={{
                ...type("labelLarge"), height: 32, padding: newCat === c ? "0 14px 0 10px" : "0 14px", borderRadius: cr(8),
                display: "inline-flex", alignItems: "center", gap: 6,
                background: newCat === c ? s.onPrimaryContainer : "transparent",
                color: newCat === c ? s.primaryContainer : s.onPrimaryContainer,
                border: newCat === c ? "none" : `1px solid ${s.onPrimaryContainer}`,
              }}>
                {newCat === c && <Icon name="check" size={16} stroke={2.4} />}{c}
              </Pressable>
            ))}
          </div>
          <Button variant="filled" full onClick={() => onCreate(q, newCat)} style={{ background: s.onPrimaryContainer, color: s.primaryContainer }}>Add to {newCat}</Button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column" }}>
        {!q && <div style={{ ...type("labelMedium", { textTransform: "uppercase", letterSpacing: ".8px" }), color: s.onSurfaceVariant, margin: "2px 4px 4px" }}>From your catalogue</div>}
        {matches.map((c) => {
          const added = inList.has(c.name.toLowerCase());
          return (
            <ListItem key={c.name} onClick={() => { if (!added) onAddExisting(c); }}
              headline={c.name} supporting={c.cat}
              trailing={added
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: s.primary, ...type("labelMedium") }}><Icon name="check" size={18} stroke={2.4} /> Added</span>
                : <span style={{ color: s.primary }}><Icon name="plus" size={22} /></span>} />
          );
        })}
        {q && matches.length === 0 && (
          <div style={{ ...type("bodyMedium"), color: s.onSurfaceVariant, padding: "14px 4px" }}>No catalogue match — use “Add “{q}”” above to create it.</div>
        )}
      </div>
    </div>
  );
}

/* ── Item editor sheet body: qty, assignee, note, remove ──
   Edits apply live; a "Saved" flash confirms each change and a Done button is the clear exit. */
function ItemEditorBody({ item, members, onSetQty, onSetCat, onSetAssignee, onSetNote, onRemove, onDone }) {
  const { s, cr } = useMd3();
  const [savedAt, setSavedAt] = scU(0);   // bump on every change; pill mounts fresh each time
  const timer = React.useRef(null);
  // flash "Saved" for ~1.4s after any change (mount a fresh node — robust to style instrumentation)
  function flash() {
    setSavedAt(Date.now());
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSavedAt(0), 1400);
  }
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const mark = (fn) => (...a) => { fn(...a); flash(); };
  if (!item) return null;
  const rule = <div style={{ height: 1, background: s.surfaceContainerHighest, margin: "4px 4px" }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 4 }}>
      {/* live save indicator — reserves its own row so layout doesn't jump.
          Mounted only while flashing (no opacity/animation — robust to sheet style instrumentation). */}
      <div style={{ height: 24, display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "0 4px" }}>
        {savedAt > 0 && (
          <span key={savedAt} style={{
            display: "inline-flex", alignItems: "center", gap: 5, ...type("labelMedium"),
            color: s.onTertiaryContainer, background: s.tertiaryContainer, borderRadius: 999, padding: "3px 10px",
            pointerEvents: "none",
          }}><Icon name="check" size={14} stroke={2.5} /> Saved</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 4px" }}>
        <span style={{ ...type("bodyLarge"), color: s.onSurface }}>Quantity</span>
        <Stepper value={item.qty} onChange={mark(onSetQty)} />
      </div>
      {rule}
      <div style={{ padding: "6px 4px" }}>
        <div style={{ ...type("bodyLarge"), color: s.onSurface, marginBottom: 12 }}>Category</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATS.map((c) => <Chip key={c} selected={item.cat === c} onClick={mark(() => onSetCat(c))}>{c}</Chip>)}
        </div>
      </div>
      {rule}
      <div style={{ padding: "6px 4px" }}>
        <div style={{ ...type("bodyLarge"), color: s.onSurface, marginBottom: 12 }}>Assigned to</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {Object.keys(members).map((w) => {
            const on = item.assignee === w;
            return (
              <Pressable key={w} onClick={mark(() => onSetAssignee(on ? null : w))} color={s.onSurface}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, opacity: on ? 1 : 0.5 }}>
                <span style={{ borderRadius: "50%", boxShadow: on ? `0 0 0 2.5px ${s.primary}` : "none" }}><Avatar who={w} size={44} /></span>
                <span style={{ ...type("labelSmall"), color: on ? s.primary : s.onSurfaceVariant }}>{members[w].name}</span>
              </Pressable>
            );
          })}
        </div>
      </div>
      {rule}
      <div style={{ padding: "6px 4px" }}>
        <div style={{ ...type("bodyLarge"), color: s.onSurface, marginBottom: 8 }}>Note</div>
        <textarea value={item.note || ""} onChange={(e) => { onSetNote(e.target.value); flash(); }} rows={2}
          placeholder="e.g. the red ones, big pack, any brand…" style={{
            width: "100%", boxSizing: "border-box", resize: "none", ...type("bodyLarge"),
            color: s.onSurface, background: s.surfaceContainerHighest, border: "none",
            borderRadius: cr(16), padding: "12px 16px", outline: "none", fontFamily: "'Roboto Flex', system-ui",
          }} />
      </div>

      <Button variant="filled" full onClick={onDone} style={{ marginTop: 10 }}>Done</Button>
      <Pressable onClick={onRemove} color={s.error} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8,
        padding: "12px", borderRadius: 999, color: s.error, ...type("labelLarge"),
        border: `1px solid ${s.outlineVariant}`,
      }}>
        <Icon name="x" size={18} /> Remove from list
      </Pressable>
    </div>
  );
}

function ShopMode({ list, onToggle, layout = "aisle" }) {
  const { s, cr } = useMd3();
  const [showDone, setShowDone] = scU(false);
  const done = list.items.filter((i) => i.done).length;
  const total = list.items.length;
  const remaining = list.items.filter((i) => !i.done);
  const checked = list.items.filter((i) => i.done);
  const allDone = done === total && total > 0;

  // remaining items grouped by aisle (catalogue category) — mirrors how you walk the store
  const byCat = {};
  remaining.forEach((it) => { (byCat[it.cat] = byCat[it.cat] || []).push(it); });
  const order = CATS.filter((c) => byCat[c]).concat(Object.keys(byCat).filter((c) => !CATS.includes(c)));

  // one shopping row — big tap target, surfaces the note (the bit you need in-aisle)
  const itemRow = (it) => (
    <Pressable key={it.id} onClick={() => onToggle(it.id)} color={s.onSurface} style={{
      display: "flex", alignItems: "center", gap: 16, width: "100%", textAlign: "left",
      background: it.done ? s.surfaceContainer : s.surfaceContainerHigh, borderRadius: cr(16),
      padding: "14px 16px", minHeight: 60, opacity: it.done ? 0.6 : 1, transition: "opacity .15s",
    }}>
      <RoundCheck checked={it.done} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...type("bodyLarge", { fontSize: 17 }), color: s.onSurface, textDecoration: it.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
        {it.note && !it.done && <div style={{ ...type("bodySmall"), color: s.onSurfaceVariant, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📝 {it.note}</div>}
      </div>
      {it.qty > 1 && <span style={{ ...type("labelLarge"), background: s.secondaryContainer, color: s.onSecondaryContainer, borderRadius: 999, padding: "3px 10px", flex: "0 0 auto" }}>×{it.qty}</span>}
      {it.assignee && <Avatar who={it.assignee} size={28} />}
    </Pressable>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card variant="filled" pad={16} style={{ borderRadius: cr(20) }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <span style={{ ...type("titleMedium"), color: s.onSurface, whiteSpace: "nowrap" }}>{done} / {total} in cart</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, ...type("labelSmall"), color: s.onSurfaceVariant, whiteSpace: "nowrap", flex: "0 0 auto" }}><Icon name="bolt" size={13} /> Screen awake</span>
        </div>
        <Progress value={done} total={total} height={8} />
      </Card>

      {allDone && (
        <Card variant="filled" pad={20} style={{ borderRadius: cr(20), background: s.tertiaryContainer, textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>🎉</div>
          <div style={{ ...type("titleLarge"), color: s.onTertiaryContainer, marginTop: 4 }}>All done — nice work!</div>
          <div style={{ ...type("bodyMedium"), color: s.onTertiaryContainer, opacity: 0.85 }}>Everything's in the cart.</div>
        </Card>
      )}

      {/* still to grab — grouped by aisle, or one flat list */}
      {!allDone && (layout === "aisle"
        ? order.map((c) => (
          <div key={c} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 4px 0" }}>
              <span style={{ ...type("titleSmall", { textTransform: "uppercase", letterSpacing: "0.8px" }), color: s.primary }}>{c}</span>
              <span style={{ ...type("labelMedium"), color: s.onSurfaceVariant, whiteSpace: "nowrap", flex: "0 0 auto" }}>{byCat[c].length} left</span>
            </div>
            {byCat[c].map(itemRow)}
          </div>
        ))
        : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{remaining.map(itemRow)}</div>
      )}

      {/* in the cart — collapsed out of the way while shopping, expanded once done */}
      {checked.length > 0 && (allDone
        ? <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{checked.map(itemRow)}</div>
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Pressable onClick={() => setShowDone((v) => !v)} color={s.onSurface} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", marginTop: 4 }}>
              <span style={{ ...type("titleSmall"), color: s.onSurfaceVariant }}>In cart · {checked.length}</span>
              <div style={{ flex: 1, height: 1, background: s.surfaceContainerHighest }} />
              <Icon name="chevron" size={20} style={{ color: s.onSurfaceVariant, transform: showDone ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .15s" }} />
            </Pressable>
            {showDone && checked.map(itemRow)}
          </div>
        ))}
    </div>
  );
}

function ListDetail({ list, mode, planModel, shopLayout, onSetMode, onSetQty, onToggle, onAddItem, onAssign, onOpenItem }) {
  return (
    <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <Segmented options={[["plan", "edit", "Plan"], ["shop", "cart", "Shop"]]} value={mode} onChange={onSetMode} />
      {mode === "plan"
        ? <PlanMode list={list} model={planModel} onSetQty={onSetQty} onAddItem={onAddItem} onAssign={onAssign} onOpenItem={onOpenItem} />
        : <ShopMode list={list} onToggle={onToggle} layout={shopLayout} />}
    </div>
  );
}

/* ============ TO-DOS ============ */
function Todos({ todos, onToggle }) {
  const { s, cr } = useMd3();
  const groups = [["Today", todos.filter((t) => t.when === "today")], ["This week", todos.filter((t) => t.when === "week")]];
  return (
    <div style={{ padding: "4px 16px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
      {groups.map(([label, items]) => items.length > 0 && (
        <div key={label}>
          <SubHeader>{label}</SubHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((t) => (
              <Pressable key={t.id} onClick={() => onToggle(t.id)} color={s.onSurface} style={{
                display: "flex", alignItems: "center", gap: 16, width: "100%", textAlign: "left",
                background: t.done ? s.surfaceContainer : s.surfaceContainerHigh, borderRadius: cr(16),
                padding: "14px 16px", opacity: t.done ? 0.6 : 1,
              }}>
                <RoundCheck checked={t.done} />
                <span style={{ flex: 1, ...type("bodyLarge"), color: s.onSurface, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</span>
                {t.assignee && <Avatar who={t.assignee} size={28} />}
              </Pressable>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============ Coming soon ============ */
function ComingSoon({ icon, title, blurb }) {
  const { s, cr } = useMd3();
  return (
    <div style={{ padding: "48px 28px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
      <div style={{ width: 88, height: 88, borderRadius: cr(28), background: s.primaryContainer, color: s.onPrimaryContainer, display: "grid", placeItems: "center" }}>
        <Icon name={icon} size={44} />
      </div>
      <div style={{ ...type("headlineSmall"), color: s.onSurface }}>{title}</div>
      <div style={{ ...type("bodyMedium"), color: s.onSurfaceVariant, maxWidth: 280 }}>{blurb}</div>
      <span style={{ ...type("labelLarge"), color: s.onTertiaryContainer, background: s.tertiaryContainer, padding: "8px 16px", borderRadius: 999, marginTop: 4 }}>Coming soon</span>
    </div>
  );
}

Object.assign(window, { Home, ShopLists, Catalogue, ListDetail, AddItemBody, ItemEditorBody, Todos, ComingSoon, CATS, greeting });
