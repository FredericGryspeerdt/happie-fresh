# Happie

Happie is a household manager: a shared platform for the daily ins and outs of
living together. Its language is deliberately domestic rather than
productivity-tool — the people using it are a family, including children, not
knowledge workers.

## Language

### Household

**Household**: The group of people who live together and share everything in
Happie. Every piece of data in the app belongs to exactly one household.
_Avoid_: family, account, group, tenant

### To-dos

**To-do**: Something the household needs to get done **once** — "book the
venue", "renew the passport", "return the library books". It carries its own
freely typed title; there is nothing to pick it from. Its purpose is
remembering: a to-do exists because a one-off would otherwise be forgotten.
Something that comes back on a schedule is a **Chore**, not a to-do. _Avoid_:
task, item, action item, ticket

**Chore**: Routine household work that recurs on a schedule — the bins, the
monthly bills, the yearly dentist appointment. A chore is **not** a to-do that
happens to repeat: it is driven by its schedule rather than by someone
remembering it, and it never really finishes. Happie does not model chores yet;
the word is defined here so the two are never conflated when it does. _Avoid_:
recurring to-do, routine, task

**Backlog**: The single collection of every to-do a household has. A household
has exactly one, and it is never divided into sub-lists — a to-do is found by
filtering the backlog, not by opening the container it was filed in. _Avoid_:
to-do list, list, inbox

**Done**: A to-do the household actually carried out. Being done is a point in
time, not a flag: a done to-do knows the moment it happened. It stays in the
backlog once done — finishing something is worth seeing. _Avoid_: checked,
completed, closed, finished, archived

**Due**: The moment a to-do should be done by. It is always a moment, never just
a day — a to-do due "on the 1st" is due at a particular time on the 1st, because
that is when the household will be reminded of it. Read in the viewer's own
timezone. _Avoid_: deadline, due by, target date, due date (as a day)

**Overdue**: A to-do whose due moment has passed while it is still open. Being
overdue is not a failure to be scolded for — it is the module doing its job,
surfacing something the household meant to do and hasn't. _Avoid_: late, missed,
expired, failed

**Not needed**: The other way a to-do leaves the backlog: the household decided
it never had to happen at all. Unlike being done, this is not a state a to-do
can be in — the to-do is simply gone, leaving no trace. Never conflate the two;
"we did it" and "we dropped it" are opposite outcomes. _Avoid_: cancelled,
dropped, dismissed, abandoned, archived
