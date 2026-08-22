# One household backlog, no to-do lists

The shopping module divides items across multiple named lists
(`ShoppingListInterface`, keys `["shopping_list_items", listId, id]`). To-dos
deliberately do **not** work this way: a household has exactly one backlog, and
a to-do is found by filtering it rather than by opening the container it was
filed in. Keys are `["todos", householdId, id]` — there is no `TodoList`
aggregate, and none is planned.

## Why

Slicing a to-do backlog happens along several axes at once — who it's for,
whether it's done, when it's due, what it's part of — and a single parent
hierarchy can only express one of them. "Order the cake" is legitimately part of
the birthday party *and* something to buy *and* assigned to one person. Filters
and labels compose; lists force the to-do to pick one home.

Requiring a container choice before capture is also friction on the app's most
common action. Shopping tolerates it honestly, because you genuinely do know
which trip you are shopping for; "take out the bins" has no natural home, and
list-first to-do apps reliably end up with a junk *General* list holding most of
the items — the hierarchy is paid for and a flat list is what you get.

## Considered options

- **Mirror `ShoppingListRepo`** — multiple named to-do lists. Rejected: solves
  grouping, and none of recurrence, which is what most real household examples
  (monthly bills, weekly bins, yearly appointments) actually need. A list is a
  container, not a schedule.
- **A nullable `listId` on each to-do**, to switch multiplicity on later.
  Rejected: a field that is always `null` taxes every read and still leaves the
  UI unbuilt, so the work happens twice. This codebase already carries unused
  DTOs of that kind.

## Consequences

Genuine multiple to-do lists would require a KV migration from length-3 to
length-4 keys. This is an accepted bet.

Grouping arrives as **labels**, not lists — composable with filters and with
assignment, and there is an existing pattern to follow in
`DishTagGroupInterface`.

## Update (2026-08-04): one of the rejection arguments has retired

The decision stands, but the first rejection argument above no longer applies. It
leaned on recurring examples — monthly bills, weekly bins, the yearly dentist —
to claim that lists solve grouping and not recurrence. Those are **chores**, and
a to-do is now defined as strictly one-off (see `CONTEXT.md`); recurrence has
left the to-dos roadmap for a future Chores module with its own model.

The conclusion survives on the two remaining arguments, and the capture-friction
one is now *stronger*: a to-do exists because a one-off would otherwise be
forgotten, so making someone choose a container before they can write it down is
worse here than it would have been for a routine task they were never going to
forget anyway.
