# Issue 18 implementation

Approved visual: refined option 3, destination sheet over selected rows with
plain quantities. Entry point: Select items in Plan mode and List options.
Stay on the source after moving; snackbar offers Undo. New list creation uses
a sibling short-input Dialog, with atomic creation and move. Checked entries
remain selectable in a separate In cart group. No copy or merging.

- [x] Add atomic move/undo repository and HTTP tests: household isolation,
      metadata preservation, separate duplicates, missing entries, replay,
      conflicting edits, new list retention, transaction bounds.
- [x] Make debounced saves awaitable and per-entry ordered; make updates use
      version checks so a late PATCH cannot recreate a moved entry.
- [x] Add selection rows, destination sheet, new-list dialog, loading and
      failure feedback; wire source list and undo state.
- [x] Verify mobile and desktop interactions, compare to the selected visual,
      run focused tests, full tests, and deno task check.

Use one atomic transaction for up to 40 entries (source and destination checks
plus list, revision, and receipt checks remain below the 100-check limit). Reject oversized
payloads before writing. Server receipts make retrying a move/undo idempotent
for ten minutes; the UI offers Undo for ten seconds. Undo never overwrites newer
edits or deletes a new list. Context7 is unavailable in this session; verified
KV APIs against https://docs.deno.com/deploy/kv/transactions/ instead.

Keep unrelated dish-editor changes and the existing design QA report intact.

Moves and Undo increment both list revisions so concurrent menu additions retry
their snapshots. Selection rows retain the quantity-and-unit display.
