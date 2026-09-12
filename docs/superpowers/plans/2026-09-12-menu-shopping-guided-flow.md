# Menu shopping guided flow implementation plan

> Execute in the existing isolated worktree. Use Superpowers execution and Matt Pocock TDD/review at the established public interfaces.

**Goal:** Choose dishes, review category-grouped ingredients, edit quantities in dialogs, and add once atomically.

**Architecture:** Extend the existing memoized shopping controller and bulk endpoint. Amounts are list-entry choices, never invented recipe totals. Keep shared ingredients once and preserve existing unchecked entries.

**Tech stack:** Fresh 2, Preact signals, existing MD3 components, Deno KV.

**Spec:** Approved conversation and cupboard-review prototype; quantity editor is a dialog. Draft changes remain local until confirmation. Existing remembered destination selection continues.

## Constraints

- Worktree: `.claude/worktrees/menu-shopping-guided-flow`; branch `codex/menu-shopping-guided-flow`.
- No new runtime dependencies, migrations, production writes, push, or merge.
- Unit is optional for legacy entries; supported choices are pieces, g, kg, ml, L, packs.
- Positive quantities up to 99999 with at most three decimals; decimal comma accepted.
- No automatic conversion between unit dimensions. User edits amount and unit together.
- API failures retain the draft; loading prevents competing actions.
- Public test interfaces agreed in conversation: ingredient collection, draft controller, final bulk submission.

## Task 1: Persist shopping amounts

Files: `models/shopping-list/*`, `utils/shopping-amount.ts`, bulk/items routes, `database/shopping-list-item.repo.ts` and tests.

- [x] Red: bulk add 0.5 kg, restore bought entry with explicit amount, skip existing unchecked amount.
- [x] Implement optional `unit`, optional bulk `quantity`, shared parse/format/validation helpers.
- [x] Validate route input and preserve atomic conflict checks and legacy callers.
- [x] Run amount, route and repository tests.

## Task 2: Guided draft controller

Files: `hooks/useMenuShopping.ts`, its tests, `services/api.ts`.

- [x] Red: starting selects planned dishes and opens choose-dishes; continuing resolves destination and ingredients.
- [x] Add selected dish ids and amount overrides. Back retains draft; new start clears it.
- [x] Load list entries with nullable error result; stale requests never change a closed flow.
- [x] Confirm selected rows with optional overrides in one request; guard empty and duplicate submission.
- [x] Run controller tests covering destination changes, failures and shared ingredients.

## Task 3: Approved UI and shopping-list display

Files: `components/menu/*`, `components/md3/useModal.ts`, `FullScreenDialog.tsx`, `islands/menu/WeeklyMenu.tsx`, `routes/menu/index.tsx`, `islands/items.tsx`.

- [x] Replace review sheet with full-screen guided dialog, categories, source dish labels, selected/skipped counts and sticky footer.
- [x] Add focused amount dialog with decimal input and native unit radio group.
- [x] Preserve focus and background state when an amount dialog opens above the flow.
- [x] Pass household categories from menu route; show real amount/unit on shopping entries.
- [ ] Finish interactive mobile/desktop checks for cancel/save, back, duplicates, loading and keyboard/focus. Browser automation unavailable; native Chrome was in active use.

## Task 4: Review and verification

- [x] Update UI patterns for the guided dialog.
- [x] Run `deno task check`, `deno task test`, and production build.
- [x] Independent code review; fix material findings.
- [x] Report verified results and remaining device-testing limitations.


## Verification results

- `deno task check`: passed.
- `deno task test`: 611 passed, 0 failed.
- `deno task build`: passed.
- Independent specification and standards reviews completed; identified amount,
  failure-handling, and keyboard-trap issues fixed and re-reviewed.
- Preview: http://127.0.0.1:5185/menu, isolated sample database
  `/tmp/happie-menu-guided-qa-20260912.sqlite`, demo/password.
- Sample login verified through native Chrome. Full browser flow and physical
  mobile keyboard verification remain outstanding because browser automation
  was unavailable and Chrome was being used interactively.
- Changes remain uncommitted in the requested worktree; no push or merge.
