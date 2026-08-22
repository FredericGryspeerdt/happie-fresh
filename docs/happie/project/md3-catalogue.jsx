// md3-catalogue.jsx — Catalogue = the household's item library. Manage items + categories.
// (Adding items to a shopping list happens from inside a list, via AddItemBody — not here.)
//   • Search filters the whole catalogue, grouped under sticky category headers.
//   • Category rail is alphabetical; a pinned "All" button opens the category picker.
//   • Tap an item → edit sheet (rename · move category · remove).
//   • Category header ⋮ → rename / delete the category.
const { useState: cgU, useRef: cgR, useEffect: cgE } = React;

const catLabel = (s) => ({ ...type("labelMedium", { textTransform: "uppercase", letterSpacing: ".8px" }), color: s.onSurfaceVariant });

/* ── Catalogue screen ── */
function CatalogueScreen({ catalogue, cats, selectedCat, onSelectCat, onAddTo, onOpenCatPicker, onEditItem, onCategoryMenu }) {
  const { s, cr } = useMd3();
  const [query, setQuery] = cgU("");
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const items = catalogue.filter((c) => c.cat === selectedCat);
  const matches = searching ? catalogue.filter((c) => c.name.toLowerCase().includes(q)) : [];
  const empty = items.length === 0;

  function itemTile(it) {
    return (
      <Pressable key={it.name + "·" + it.cat} onClick={() => onEditItem(it)} color={s.onSurface} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        background: s.surface, border: `1px solid ${s.outlineVariant}`, borderRadius: cr(12),
        padding: "14px 16px", ...type("bodyLarge"), color: s.onSurface, textAlign: "left",
      }}>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
        <Icon name="edit" size={18} style={{ color: s.onSurfaceVariant, opacity: .65, flex: "0 0 auto" }} />
      </Pressable>
    );
  }

  const ghostTile = (
    <Pressable onClick={() => onAddTo(selectedCat)} color={s.primary} style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      border: `1.5px dashed ${s.outline}`, borderRadius: cr(12), padding: "14px 16px",
      color: s.primary, ...type("labelLarge"), minHeight: 52, gridColumn: empty ? "1 / -1" : "auto",
    }}>
      <Icon name="plus" size={20} stroke={2.3} /> Add item
    </Pressable>
  );

  return (
    <div style={{ padding: "4px 0 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* search the whole catalogue */}
      <div style={{ padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: s.surfaceContainerHighest, borderRadius: 999, padding: "0 6px 0 14px", height: 48 }}>
          <Icon name="search" size={20} style={{ color: s.onSurfaceVariant }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the catalogue"
            style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none", ...type("bodyLarge"), color: s.onSurface, fontFamily: "'Roboto Flex', system-ui" }} />
          {searching && <IconButton name="x" size={36} iconSize={18} onClick={() => setQuery("")} />}
        </div>
      </div>

      {/* category rail — pinned picker (never scrolls away) + alphabetical quick-filter chips */}
      {!searching && (
        <div style={{ display: "flex", gap: 8, padding: "0 16px", alignItems: "center" }}>
          <Pressable onClick={onOpenCatPicker} color={s.onSurfaceVariant} style={{
            ...type("labelLarge"), height: 32, padding: "0 12px", borderRadius: cr(8), flex: "0 0 auto",
            display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
            background: "transparent", color: s.onSurfaceVariant, border: `1px solid ${s.outlineVariant}`,
          }}>
            <Icon name="tune" size={16} /> All
          </Pressable>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", flex: 1, paddingRight: 4 }}>
            {cats.map((c) => <Chip key={c} selected={c === selectedCat} onClick={() => onSelectCat(c)}>{c}</Chip>)}
          </div>
        </div>
      )}

      {/* category management header — count + ⋮ (rename / delete) */}
      {!searching && selectedCat && (
        <div style={{ padding: "0 8px 0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ ...type("bodyMedium"), color: s.onSurfaceVariant }}>{items.length} item{items.length === 1 ? "" : "s"} in {selectedCat}</span>
          <IconButton name="dots" size={36} iconSize={20} onClick={() => onCategoryMenu(selectedCat)} />
        </div>
      )}

      {/* ── search results: every match, grouped under sticky category headers ── */}
      {searching && (
        matches.length === 0 ? (
          <div style={{ padding: "8px 24px 0", textAlign: "center" }}>
            <div style={{ ...type("titleMedium"), color: s.onSurface }}>No items match “{query.trim()}”</div>
            <div style={{ ...type("bodyMedium"), color: s.onSurfaceVariant, marginTop: 4 }}>Try another word, or add it to your catalogue.</div>
            <div style={{ marginTop: 16 }}><Button variant="tonal" icon="plus" onClick={() => onAddTo(selectedCat)}>Add to catalogue</Button></div>
          </div>
        ) : (
          cats.filter((c) => matches.some((m) => m.cat === c)).map((c) => (
            <div key={c} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ ...catLabel(s), position: "sticky", top: 0, zIndex: 1, background: s.surface, padding: "6px 16px 4px" }}>{c}</div>
              <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {matches.filter((m) => m.cat === c).map(itemTile)}
              </div>
            </div>
          ))
        )
      )}

      {/* ── browse: the selected category ── */}
      {!searching && (
        <>
          {empty && (
            <div style={{ padding: "0 24px", textAlign: "center" }}>
              <div style={{ ...type("titleMedium"), color: s.onSurface }}>No items in {selectedCat} yet</div>
              <div style={{ ...type("bodyMedium"), color: s.onSurfaceVariant, marginTop: 4 }}>Add your first item below.</div>
            </div>
          )}
          <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {items.map(itemTile)}
            {ghostTile}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Edit one catalogue item: rename · move category · remove ── */
function CatalogueItemBody({ item, cats, existingNames, onRename, onMove, onRemove }) {
  const { s, cr } = useMd3();
  const [name, setName] = cgU(item ? item.name : "");
  cgE(() => { setName(item ? item.name : ""); }, [item && item.name, item && item.cat]);
  if (!item) return null;
  const v = name.trim();
  const dupe = !!v && v.toLowerCase() !== item.name.toLowerCase() && existingNames.has(v.toLowerCase());
  const field = {
    flex: 1, minWidth: 0, ...type("bodyLarge"), color: s.onSurface, background: s.surfaceContainerHighest,
    border: "none", borderBottom: `2px solid ${s.primary}`, borderRadius: `${cr(8)}px ${cr(8)}px 0 0`,
    padding: "14px 16px", outline: "none", fontFamily: "'Roboto Flex', system-ui", boxSizing: "border-box",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 4 }}>
      <div>
        <div style={{ ...catLabel(s), margin: "0 2px 8px" }}>Name</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && v && !dupe && v !== item.name) onRename(v); }} style={field} />
          <Button variant="filled" disabled={!v || dupe || v === item.name} onClick={() => onRename(v)}>Save</Button>
        </div>
        {dupe && <div style={{ ...type("bodySmall"), color: s.error, margin: "8px 2px 0" }}>“{v}” is already in your catalogue</div>}
      </div>
      <div>
        <div style={{ ...catLabel(s), margin: "0 2px 8px" }}>Category</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {cats.map((c) => <Chip key={c} selected={c === item.cat} onClick={() => onMove(c)}>{c}</Chip>)}
        </div>
      </div>
      <Pressable onClick={onRemove} color={s.error} style={{
        ...type("labelLarge"), color: s.error, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "12px 16px", borderRadius: cr(12), border: `1px solid ${s.outlineVariant}`,
      }}>
        <Icon name="trash" size={18} /> Remove from catalogue
      </Pressable>
    </div>
  );
}

/* ── Category picker sheet body: pinned "New category", searchable list of all categories ── */
function CatPickerBody({ cats, catalogue, selected, onPick, onNewCategory }) {
  const { s, cr } = useMd3();
  const [q, setQ] = cgU("");
  const query = q.trim().toLowerCase();
  const counts = {};
  catalogue.forEach((c) => { counts[c.cat] = (counts[c.cat] || 0) + 1; });
  const shown = cats.filter((c) => c.toLowerCase().includes(query));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* pinned at the top — always reachable no matter how many categories */}
      <Pressable onClick={onNewCategory} color={s.primary} style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
        border: `1.5px dashed ${s.outline}`, borderRadius: cr(12), padding: "13px 16px",
        color: s.primary, ...type("labelLarge"), marginBottom: 8,
      }}>
        <Icon name="plus" size={20} stroke={2.3} /> New category
      </Pressable>

      {cats.length > 6 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: s.surfaceContainerHighest, borderRadius: 999, padding: "0 14px", height: 44, marginBottom: 6 }}>
          <Icon name="search" size={18} style={{ color: s.onSurfaceVariant }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a category"
            style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none", ...type("bodyMedium"), color: s.onSurface, fontFamily: "'Roboto Flex', system-ui" }} />
        </div>
      )}

      <div style={{ maxHeight: 360, overflowY: "auto", margin: "0 -4px" }}>
        {shown.map((c) => (
          <ListItem key={c} onClick={() => onPick(c)} headline={c}
            supporting={`${counts[c] || 0} item${(counts[c] || 0) === 1 ? "" : "s"}`}
            trailing={c === selected ? <Icon name="check" size={20} stroke={2.4} style={{ color: s.primary }} /> : null} />
        ))}
        {shown.length === 0 && (
          <div style={{ ...type("bodyMedium"), color: s.onSurfaceVariant, padding: "12px 16px" }}>No category matches “{q.trim()}”.</div>
        )}
      </div>
    </div>
  );
}

/* ── Add-to-catalogue sheet body: pick a category (or make one), then add items one after another ── */
function CatalogueAddBody({ cats, presetCat, startNewCat, existingNames, onAdd, onCreateCategory, inputRef }) {
  const { s, cr } = useMd3();
  const [cat, setCat] = cgU(presetCat || cats[0]);
  const [name, setName] = cgU("");
  const [added, setAdded] = cgU([]);
  const [newOpen, setNewOpen] = cgU(!!startNewCat);
  const [newName, setNewName] = cgU("");
  const newRef = cgR(null);

  cgE(() => { setCat(presetCat || cats[0]); /* re-scope when opened for a new category */ }, [presetCat]);
  cgE(() => { if (newOpen) { const id = setTimeout(() => newRef.current?.focus(), 80); return () => clearTimeout(id); } }, [newOpen]);

  const n = name.trim();
  const dupe = !!n && existingNames.has(n.toLowerCase());

  const field = {
    flex: 1, minWidth: 0, ...type("bodyLarge"), color: s.onSurface, background: s.surfaceContainerHighest,
    border: "none", borderBottom: `2px solid ${s.primary}`, borderRadius: `${cr(8)}px ${cr(8)}px 0 0`,
    padding: "14px 16px", outline: "none", fontFamily: "'Roboto Flex', system-ui", boxSizing: "border-box",
  };

  function commit() {
    if (!n || dupe) return;
    onAdd(n, cat);
    setAdded((a) => [{ name: n, cat }, ...a].slice(0, 12));
    setName("");
    inputRef.current?.focus();
  }
  function confirmCat() {
    const v = newName.trim();
    if (!v) return;
    onCreateCategory(v);
    setCat(v);
    setNewOpen(false);
    setNewName("");
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 4 }}>
      {/* category — chosen first, changeable */}
      <div>
        <div style={{ ...catLabel(s), margin: "0 2px 8px" }}>Category</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {cats.map((c) => <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
          {!newOpen && <Chip icon="plus" onClick={() => setNewOpen(true)}>New</Chip>}
        </div>
        {newOpen && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
            <input ref={newRef} value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmCat(); }}
              placeholder="New category name" style={field} />
            <Button variant="filled" disabled={!newName.trim()} onClick={confirmCat}>Create</Button>
            <Button variant="text" onClick={() => { setNewOpen(false); setNewName(""); }}>Cancel</Button>
          </div>
        )}
      </div>

      {/* item name — focused; enter keeps adding */}
      <div>
        <div style={{ ...catLabel(s), margin: "0 2px 8px" }}>Item</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
            placeholder={`Add to ${cat}…`} style={field} />
          <Button variant="filled" disabled={!n || dupe} onClick={commit}>Add</Button>
        </div>
        <div style={{ ...type("bodySmall"), color: dupe ? s.error : s.onSurfaceVariant, margin: "8px 2px 0" }}>
          {dupe ? `“${n}” is already in your catalogue` : "Press enter to add and keep going"}
        </div>
      </div>

      {/* what you've added this session */}
      {added.length > 0 && (
        <div>
          <div style={{ ...catLabel(s), margin: "0 2px 8px" }}>Added just now · {added.length}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {added.map((a, i) => (
              <span key={i} style={{
                ...type("labelLarge"), background: s.secondaryContainer, color: s.onSecondaryContainer,
                borderRadius: 999, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                <Icon name="check" size={14} stroke={2.5} /> {a.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { CatalogueScreen, CatalogueItemBody, CatPickerBody, CatalogueAddBody });
