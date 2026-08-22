# Assignment is intent; completion is fact

A to-do has at most **one** assignee (`assignedTo`, a member id or null =
up for grabs), and remembers who ticked it off (`completedBy`, stamped
server-side from the acting member together with `completedAt`, cleared
together with it). The two fields never mutate each other: "assigned to Bo,
done by Mom" stays visible. "Mine" in the UI always means assignment
(intent), never completion, including in the Done section.

## Why

Multiple assignees would force answers the household doesn't ask (done when
one finishes? all?) and whatever we pick here the future Chores module
inherits — a genuinely shared job is evidence for that module (ADR 0003),
not for widening this field. `completedBy` ships now because ADR 0002
deliberately parked it until members existed: stamping it costs a few lines
in the PATCH handler today, while deferring it would leave every done row
written in the meantime permanently blank. Assignment is deliberately NOT
manager-gated (ADR 0006's gate covers destruction): a parent handing out
work and a kid claiming it are the same one-tap gesture.

## Consequences

Removing a member clears `assignedTo` on their **open** to-dos (up for
grabs again); done rows keep dangling ids under the ADR 0006 graceful-dangle
contract — renderers show nothing rather than assume resolution. Clients
never send `completedBy`; the server ignores it. Assignee-aware reminders
remain household-wide for now (member→device targeting is its own design,
entangled with issue #68).
