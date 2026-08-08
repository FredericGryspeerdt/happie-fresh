# Members are people; users are credentials; acting is claimed, not proven

A household is made of **members** — people with a name and an avatar, most of
whom (children) never sign in. A `User` is only a login credential, linked to
the member it belongs to; it is not a person. Every request acts *as* a member
that the device has claimed through the member picker, and the server enforces
permissions against that claim without authenticating it. Attribution fields
(`createdBy`, and `assignedTo` when assignment arrives) hold member ids, never
user ids.

## Why

The alternative was giving every person a `User` with credentials, with parents
setting passwords or PINs for children. A six-year-old with a password is a
fiction: the parent would type it, the child would forget it, and the login
wall would sit exactly where Happie wants the least friction — a kid grabbing
the kitchen tablet to tick off their to-do. The Netflix-style split keeps
authentication (rare, adult, per device) apart from identity (constant,
everyone, per action), which is what assignment and attribution actually need.

The honor system is the deliberate half of this decision, and the surprising
one — issue #17's acceptance criteria say "Security:". With one shared login
per household there is nothing to authenticate a member switch *against*; any
member claim is only as trustworthy as the person holding the unlocked device,
which is already true of the shared login itself. The threat model is a curious
eight-year-old tapping a shiny delete button, not an adversary. Hiding
destructive actions from non-managers and enforcing the manager rules
server-side against the claimed member fully solves the accidental case, which
is the real one. `Member` is shaped so an optional PIN (hashed, checked when
switching *to* a manager) can be added later without migration if malicious
switching ever becomes a real problem.

Rewriting `createdBy` from user ids to member ids in the same migration —
rather than dual-reading both id spaces forever — is cheap precisely now,
because nothing displays attribution yet. ADR 0002 anticipated this by leaving
`completedBy` out of to-dos until members existed.

## Consequences

Permissions are guardrails, not locks. Any rule of the form "children cannot
X" is honest UX, not a security boundary, and must never be sold as one.

A member claim lives on the device (picked once, switchable any time via the
avatar chip), so a wrong avatar in the top bar is the household's signal to
switch — visible identity is what keeps honor-system attribution accurate.

"Join by invite" later means creating a second `User` linked to an existing
member; the model does not change. Likewise PINs, richer roles, and per-member
notification targeting are additive fields or modules, not remodels.

Removing a member hard-deletes it; attribution ids may dangle and renderers
must fall back gracefully ("someone") rather than assume resolution.
