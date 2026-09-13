# Dish picker design QA

final result: passed

## Source and evidence

- Source visual:
  `/Users/frederic.gryspeerdt/.codex/generated_images/01a094f6-d9c3-7260-abd4-8f095a724b35/exec-7d7f9087-b244-42f6-b0e8-8dcf93afe639.png`
- Implementation: `http://localhost:5186/menu`, using a separate disposable KV
  database.
- Evidence directory:
  `/Users/frederic.gryspeerdt/.codex/visualizations/2026/09/12/01a094f6-d9c3-7260-abd4-8f095a724b35/picker-qa/`
- Source is 853 × 1844 pixels, normalized to 390 × 844 in `reference-390.png`.
- Mobile viewport and screenshot: 390 × 844 CSS/image pixels, density 1.
- Full-view comparison: `reference-390.png` and `mobile-filtered.png` opened
  together. Both show search “roast”, one unchecked Roast chicken result, and
  four planned dishes in the footer.
- Desktop evidence: `desktop.png`, 1280 × 900.
- Short viewport evidence: `short-viewport.png`, 390 × 500, scrolled checklist
  with summary and completion action still visible.
- Error evidence: `mobile-failed-save.png`, deliberate server outage; checkbox
  and count roll back, with error feedback.
- A separate focused crop was unnecessary: title, row, checkbox, summary and
  completion action are readable in the normalized full-size comparison.

## Fidelity review

- Typography: existing Roboto/system MD3 styles retained. The title is lighter
  than the generated reference; accepted house-style adaptation. Names wrap and
  checkbox labels include each dish name.
- Layout: header and search above a scrolling checklist; footer stays outside
  the scroll region. Phone dialog fits exactly within 844 CSS pixels. Desktop
  uses the existing centered dialog convention.
- Color: existing surface, primary, secondary-container and outline tokens
  preserve theme support. The generated reference's subtle tonal variation is
  represented by existing flat MD3 surfaces.
- Assets: no raster assets required. Existing Icon components supply back,
  search, clear and check icons; native checkboxes provide semantics.
- Content: approved wording retained. Summary uses alphabetical order to match
  the checklist, previews at most four names over two lines, and offers a
  remaining count and View all. The full plan is independent of search.

## Interaction verification

- Add dishes works from a populated week; the existing empty-state action opens
  the same picker.
- Search filters results while all four planned names remain in the summary.
- View all shows every planned dish; Back to results restores the original
  search.
- Selecting Roast chicken updates the plan to five and shows +1 more;
  deselecting restores four. Persistence survives page reload.
- A failed save rolls back the selection and count and displays an error;
  failure status remains until retry, while the snackbar dismisses after four
  seconds.
- Clear search restores all results and returns focus to the search field.
- Back to this week closes the picker and restores focus to Add dishes.
- Checkboxes retain focus while saves are pending; other toggles are guarded
  until the whole-plan response settles.
- Short viewport scrolling keeps the summary and return action visible.
- No console errors observed in the final connected preview.

## Comparison and review history

1. Fixed mobile footer overflow by sizing the dialog to the dynamic viewport and
   allowing its body to shrink. Verified dialog bounds: top 0, bottom 844.
2. Disabled the ancestor pull-to-refresh while the picker is open after code
   review found a touch gesture conflict.
3. Replaced disabled checkboxes with guarded aria-disabled controls so saving
   does not drop keyboard focus.
4. Limited summary width to keep it brief and readable over two lines.
5. Clipped dialog children to its rounded surface so the persistent footer
   respects desktop corners; verified in desktop.png.

## Combined menu and shopping flow

- Integrated the existing guided shopping implementation from
  `codex/menu-shopping-guided-flow`, preserving the weekly checklist picker.
- The outlined Add dishes action sits beside the weekly planning content. The
  filled Add ingredients to a shopping list action stays above bottom
  navigation.
- Verified at 390 × 844: picker opens, returns to the week and restores focus;
  shopping opens Shop for dishes with the five currently planned dishes
  selected.
- Review combines shared ingredients into three rows and flags the dish without
  ingredients. Changing the destination opens a stacked chooser; Escape returns
  to the intact review and restores focus to Change.
- Added three ingredients to the disposable QA shopping list. Open list showed
  all three with dish provenance and quantity one. The week retained five
  dishes.
- Evidence: `combined-week.png`, `combined-shopping-dishes.png`,
  `combined-ingredient-review.png`, and `combined-shopping-result.png` in the
  evidence directory above. Week and ingredient review screenshots were
  inspected for action hierarchy, clipping, safe-area spacing and readable
  content.
- Review identified a loading-state race through the empty-week action; both Add
  dishes entry points now block while shopping data loads.

No actionable P0/P1/P2 findings remain. Real-device soft-keyboard and
screen-reader testing remain outside this desktop-browser check; the short
viewport check does not substitute for them.

---

# Dish ingredient picker — design QA

**Final result: passed for browser layout and primary interactions.**

**Preview:** http://127.0.0.1:5176/menu/new

**Source visual:**
`/Users/frederic.gryspeerdt/.codex/generated_images/01a096f5-541b-74b2-9969-2599526e34cf/exec-05d1dbcd-d00b-4a5b-91d2-7569407e6ee5.png`

**Evidence directory:**
`/Users/frederic.gryspeerdt/.codex/visualizations/2026/09/12/01a096f5-541b-74b2-9969-2599526e34cf/ingredients-qa/`

- `mobile.png`: 390 × 844, Tomato pasta draft, Tomato and Pasta selected, query
  Basi, Basil match and subordinate create action.
- `desktop.png`: 1280 × 900, same state in the centered shared dialog.
- `compact.png`: 390 × 520, saved dish with three selected ingredients, query
  Basi and Already added feedback.

**Comparison:** The source raster is 853 × 1844, approximately 2.19 pixels per
logical CSS pixel. The mobile capture is 390 × 844 at 1×. Source and rendered
capture were opened together in one comparison input, comparing corresponding
logical positions and the app-owned area. Full captures keep labels and controls
readable, so separate focused crops were unnecessary. The reference includes an
illustrative keyboard; desktop browser resizing does not reproduce a device
keyboard.

**Fidelity and consistency:** The selected summary, removable chips, search,
matching result and lower-emphasis create action follow the chosen direction.
The existing FullScreenDialog supplies the 56px header, centered desktop panel,
24px body padding and shared title style. These intentionally differ from the
illustration's heavier heading and subtitle alignment. Existing MD3 typography,
warm surfaces, primary colors, icons, focus outline and 44px chip targets remain
consistent with other Happie flows. No outstanding P0–P2 layout findings were
observed in these states. No implementation changes were needed during QA.

**Interaction evidence:**

- Opening focuses ingredient search.
- Selecting an existing ingredient keeps the picker open, clears the search,
  restores search focus, increments the count and shows Already added.
- Creating Pasta and Basil adds each to the local catalogue and current draft,
  then clears and refocuses search.
- Removing Basil changes the draft immediately while preserving other choices.
- Searching `TOMATO` retains the selected match and suppresses duplicate
  creation despite case and surrounding spaces.
- Done and Close preserve the draft; reopening clears search and retains
  choices.
- Escape closes the picker and returns focus to Add ingredient.
- Creating Tomato pasta persisted two ingredients. Reopening it, adding Basil,
  saving and reopening again persisted all three.
- Desktop and reduced-height mobile layouts keep the relevant controls visible.
- Browser error log was empty after the completed flow.

**Preview recovery:** The old server on port 5173 rendered the page but its
controls did not respond, even after reload. DOM inspection showed unresolved
`fresh-island::` module imports. A fresh Vite server on port 5176 restored
interactive behavior using the existing signed-in session. The old server was
left untouched; no source fix was inferred from that stale server state.

**Local test data:** Added Pasta and Basil catalogue items and saved a Tomato
pasta dish with Tomato, Pasta and Basil. No production data was changed.

**Remaining test gaps:** Physical iOS/Android keyboard continuity, especially
during asynchronous creation, and forced network-error behavior were not
interactively tested. The compact viewport check is layout evidence only.

**Validation:** `deno task check` passed (format, lint and typecheck);
`deno task test` passed with 568 tests and zero failures; `git diff --check`
passed. The production build passed earlier in this implementation; QA required
no source changes.

**PR preparation:** Reapplied only the ingredient-picker changes onto latest
main (`792a153`) in an isolated checkout. Format, lint, typecheck, all 653 tests
and the production build passed there. Browser captures above were taken before
this integration; the updated shared dialog was not rechecked interactively.
