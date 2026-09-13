# To-do assignment — design

Assignment lets a household say *who a to-do is for* — a parent handing out
the bins, a kid claiming a job — and, once done, remembers *who actually did
it*. It is the first consumer of the member system (issue #17 / ADR 0006) and
was explicitly deferred until members existed (ADR 0002 parked `completedBy`
for the same reason).

Design authority: this spec, ADR 0006 (members/acting member), ADR 0002
(completion is a timestamp), and the overlay boundary rule in
`docs/ui-ux-patterns.md` ("FullScreenDialog is for multi-field create/edit
flows"). A short ADR 0007 ("assignment is intent, completion is fact") ships
with the implementation.

## Decisions (all confirmed with the product owner)

1. **Single optional assignee.** `assignedTo: memberId | null`. Multi-person
   jobs are evidence for the future Chores module, not for widening this
   field.
2. **Anyone assigns anyone**, including unassigning. Assignment is not
   destructive, so the manager gate (ADR 0006's "sharp knives") does not
   apply. The server validates only that the assignee is a member of the
   household.
3. **`completedBy` ships now**, write-side: ticking off stamps the acting
   member, un-ticking clears it. Assignment records **intent**; completion
   records **fact**; neither mutates the other ("assigned to Bo, done by
   Mom" stays visible).
4. **Assignment happens in the to-do editor**, and both the create and edit
   surfaces migrate from bottom `Sheet` to **`FullScreenDialog`** (the
   overlay boundary rule applied — the assignee row is what tips them over
   the multi-field line).
5. **Rapid capture is retired.** The create surface closes on save. The
   product owner tested the stays-open create sheet in real life and it did
   not fit the flow; ui-ux-patterns §13 is updated to record that outcome so
   the pattern is not re-added. The §12 keyboard-primer hand-off is kept.
6. **All / Mine toggle** above the backlog. *Mine* means
   `assignedTo === acting member` **everywhere, including the Done
   section** — one consistent meaning (intent), never silently switching to
   `completedBy`. Client-side predicate; urgency grouping intact.
7. **Member removal sweeps open to-dos**: removing a member clears
   `assignedTo` on that member's **open** to-dos (they return to "up for
   grabs"). Done rows keep dangling ids per the graceful-dangle contract.
   This closes the rule the #17 grilling deferred to this iteration.
8. **Assignee-aware notifications are out of scope.** Due reminders stay
   household-wide (ADR 0005). Member→device targeting is its own future
   design, entangled with issue #68.

## Model

`TodoInterface` gains two fields, additive and optional in storage,
normalised to `null` at the read boundary exactly as `dueAt` was (no
migration):

```ts
/** The member this to-do is for, or null when up for grabs. Intent. */
assignedTo: string | null;
/** The member who ticked it off, or null while open. Fact. Set and
 *  cleared together with completedAt. */
completedBy: string | null;
```

`CONTEXT.md` gains an **Assigned** entry: a to-do that is *for* a particular
member; an unassigned to-do is up for grabs. _Avoid_: owner, responsible,
delegated.

## API

No new endpoints.

- `PATCH /api/todos/[id]`:
  - `assignedTo` accepted: must be `null` or an id that resolves via
    `MemberRepo.getById(householdId, id)`, else 400. No permission check.
  - `completedAt` transitions manage `completedBy`: set → stamp
    `actingMember.id`; null → clear to `null`. Clients never send
    `completedBy`.
- `POST /api/todos`: optional `assignedTo`, same validation.

## UI

**Editor dialogs.** `islands/todos/TodoBacklog.tsx`'s create and edit
sheets become `FullScreenDialog`s (component exists,
`components/md3/FullScreenDialog.tsx`, focus-trapped via `useModal`).
Create closes on save. Delete stays inside the edit dialog behind
`canDelete`; the delete confirmation remains a `Sheet`, opened after the
dialog closes (close-then-confirm, as today — confirmations are always
Sheets).

**Assignee picker — inline, never a nested overlay.** In **both** dialogs
(create and edit), an "Assigned to" section renders **No one** plus a
wrapping row of member avatar-chips (same radio-row pattern as the members
screen's colour/emoji pickers). One tap assigns; no overlay stacks on the
dialog.

**Backlog rows.** Open rows show a small (~20 px) `MemberAvatar` beside the
due chip when assigned, nothing otherwise. Done rows show the `completedBy`
avatar the same way. Ids that no longer resolve render nothing (graceful
dangle).

**All / Mine.** A `Segmented` control above the backlog. Mine filters by
`assignedTo === acting member` across open and done groups. Warm empty
state ("Nothing on your plate").

**New island props** (SSR-provided by `routes/todos/index.tsx`): the acting
member and the household's members (avatar resolution + picker). Both are
data the route can already fetch (`ctx.state.actingMember`,
`MemberRepo.getAll`).

## Member removal

`TodoRepo.unassignMember(householdId, memberId)`: one prefix scan clearing
`assignedTo` on open to-dos (`completedAt === null`) only. Called from
`routes/api/members/[id].ts` DELETE after `MemberRepo.delete`. `completedBy`
is never swept.

## Error handling

- Assignment writes ride the existing debounced-merge PATCH path
  (optimistic, rollback + snackbar on failure per ui-ux-patterns §1–§3).
- Assigning a just-removed member: server 400 → rollback + snackbar.
- Unknown `assignedTo`/`completedBy` ids anywhere in the UI render as
  unassigned/blank, never crash.

## Testing

- Repo: `unassignMember` clears open, leaves done, scoped to household.
- Handlers: `assignedTo` validation (null / valid / foreign / garbage),
  `completedBy` stamp on tick + clear on un-tick, POST with `assignedTo`.
- Island (SSR): row avatar renders for assigned open rows and done rows
  (completedBy); All/Mine toggle renders; dialogs render; Mine filtering
  hides other members' to-dos.
- On-device: keyboard hand-off (§12) survives the dialog migration; create
  closes on save.

## Non-goals

Assignee-aware notifications (future, with #68); per-member filtering beyond
Mine; multi-assignee; anything chores-shaped (ADR 0003).

## Docs shipped with implementation

ADR 0007 (single assignee; intent vs fact; Mine-means-intent), CONTEXT.md
**Assigned** entry, ui-ux-patterns §13 update (rapid capture retired after
real-world testing) and §15-adjacent note if the assignee picker pattern
proves reusable.
