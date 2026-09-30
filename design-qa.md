# Start — design QA

final result: passed

## Evidence and comparison

- Source visual truth:
  `docs/superpowers/specs/assets/2026-09-30-home-selected.png` (853 × 1844
  pixels, the approved refined third option).
- Browser-rendered implementation:
  `docs/superpowers/specs/assets/2026-09-30-home-implemented.png` (390 × 844
  pixels, 390 × 844 CSS viewport, density 1).
- Source and implementation were opened together in a single comparison input.
  The source represents approximately 2.19 pixels per CSS pixel; proportions
  were compared at its intended 390 × 844 viewport, not at the raw pixel
  dimensions.
- State: signed-in demo household, 30 September 2026, two relevant open to-dos,
  two selected lists (one empty), two menu dishes. The tested add operation
  changes the grocery count from 8 to 9. The real backlog link correctly says 2
  rather than the mock's illustrative 6. These data differences are not design
  drift.
- Also inspected at 320 × 740 and 1440 × 1024. No horizontal document overflow.
- The full mobile comparison makes all labels and controls readable; separate
  cropped-region images were not necessary.

## Findings and iteration history

1. Initial mobile rendering placed the second menu row beneath the persistent
   navigation and weakened heading hierarchy (P2). Reduced section gaps and row
   padding, and explicitly applied the heading weight over the MD3 type rule.
   The final implementation capture shows both menu rows above navigation.
2. Product-picker keyboard focus could escape through closed nested dialogs
   (P2). Reused the modal focus loop, excluded inert descendants, preserved the
   keyboard primer and restored the originating add button after refresh.
   Browser testing confirmed Tab wraps to the back button and Escape restores
   the add button.
3. Creating an undated to-do from the filtered backlog could hide the new result
   (P2). Successful creation now leaves that filter. Browser testing confirmed
   “Test zonder datum” appears immediately after creation.
4. No remaining actionable P0/P1/P2 findings.

## Required fidelity surfaces

- **Typography:** existing Roboto Flex/MD3 type scale, readable 16px row titles,
  smaller supporting copy and stronger section headings. The existing Happie
  branded app-bar title is retained instead of replacing the shared shell.
- **Spacing/layout:** flat divided rows, no nested cards, compact add buttons,
  fixed section order and persistent navigation. Long titles wrap at 320px;
  smaller viewports scroll naturally above the navigation.
- **Colors/tokens:** existing warm surface, primary-container gold actions,
  primary-colored links and subdued separators. No new palette or gradients.
- **Assets/icons:** existing MD3 icon components and real acting-member chip.
  Shopping lists do not model per-list icons, so both use the existing cart icon
  rather than inventing a wrench assignment from the mock. No raster
  placeholders.
- **Copy/content:** Dutch interface, assignment names without redundant avatars,
  “Alles gekocht”, “Product toevoegen”, “Kies lijsten” and “Nog te plannen”. No
  claim that an undated weekly menu is guaranteed current.

## Interaction verification

- Login lands on Start; existing module navigation works.
- Marking a to-do done removes it and updates the total; the record can be
  reopened through the backlog.
- “Bekijk alle” opens the matching today-and-earlier backlog; creating an
  undated to-do makes the new record visible.
- Existing product picker opens without route navigation. Adding Bananen changes
  the grocery count from 8 to 9 and returns to Start.
- Tab stays in the picker; Escape closes it and restores focus.
- List selection survives reload; clearing it shows the invitation to choose
  lists.
- List detail exposes the same shared “Toon op Start” preference.
- Empty selected lists remain visible and usable.
- Browser error log checked: no errors observed.

## Verification and limits

- 811 tests pass using `deno task test --ignore=.worktrees,.claude`.
- Production build passes.
- `deno task check` passes formatting and lint, but its broad typecheck also
  discovers unrelated nested worktrees and fails with 57 existing cross-worktree
  dependency/type errors. Checking the root source files explicitly passes.
- Real-device iOS keyboard behavior is not proven by the desktop browser; the
  established keyboard-primer interaction is retained.
- No publication or production deployment performed.

## Implementation checklist

- [x] Shared Start data, actions and list preference implemented.
- [x] Interaction, mobile and desktop browser checks completed.
- [x] Approved visual target and final browser capture retained in the
      repository.
- [x] Review findings addressed and focused concurrency regression tested.
