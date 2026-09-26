# Happie — functional inventory

What a household member can **do** in Happie, and the **rules** that hold
throughout. Organised by module. It describes capabilities and domain rules, not
how the interface presents them; for presentation conventions see
[`ui-ux-patterns.md`](ui-ux-patterns.md), and for the domain language see
[`../CONTEXT.md`](../CONTEXT.md).

Snapshot as of 2026-09-09. Keep it updated when a module gains or loses a
capability.

---

## 0. Household rules (apply everywhere)

- Everything belongs to exactly one **household**. A signed-in account belongs to one household and sees only its data.
- A **member** is a person, not a login. Most members (children) never sign in.
- Each device acts **as one member**. Everything created or completed is attributed to that member. The choice persists on the device until changed.
- **Managers** may do the destructive things: delete lists, categories, dishes, cards and to-dos, clear collections, and manage members. Everyone else may not. The server enforces this; the interface hides what the member cannot do.
- Destructive actions ask for confirmation before changing household data.
- A household always has at least one manager.
- Changes made by one member are visible to the others on their next load or refresh. Every collection screen can be refreshed on demand.
- Failed saves are reported to the user and never leave the screen showing something the server does not have.
- User-facing copy is English; the login page is Dutch.

---

## 1. Signing in and acting as a member

A user can:

- Sign in with a username and password. Wrong or missing credentials show an error.
- Stay signed in. A session stays valid for 30 days of inactivity, at most 90 days, and renews on use.
- Sign out, stopping reminders on this device. Signing back in silently restores
  previously granted reminders unless they were explicitly turned off.
- Choose **which member they are** on this device from the household's members. If the household has one member, that member is chosen automatically. If several and none is chosen, the app asks on first use.
- Change the acting member at any time.
- If the chosen member was removed from the household, the app asks again.

---

## 2. Household home

- Home is a placeholder ("coming soon"). The app opens on Shopping.
- Settings and switching household are placeholders.

---

## 3. Shopping lists

A user can:

- See all the household's shopping lists with name, how many items are checked off out of the total, and when the list was created (relative time).
- Create a list with a name. Blank names are not accepted.
- Rename a list.
- Delete a list (manager only), after confirmation.
- Open a list.
- Refresh the overview.
- "Share list" is a placeholder.

### Inside a list

A user can:

- See the items on the list grouped by category, in the household's **aisle order** (uncategorised last), alphabetical within a category.
- Add items from the household's catalogue by searching (substring, case-insensitive).
- Add ingredients from selected dishes on this week's menu, reviewing amounts before adding them to the current shopping list. Compatible saved dish amounts are summed, with missing amounts identified and incompatible or unrepresentable totals requiring an explicit shopping amount or a skipped ingredient.
- Create a new catalogue item on the spot when the search finds no exact match, choosing its category, and have it land on the list immediately.
- See what they added during this adding session, and adjust or remove those.
- Set an item's quantity.
- Add a free-text note to an item on the list (e.g. "the red ones, big pack").
- Change an item's category (this changes the catalogue item, so it applies to every list).
- Remove an item from the list, after confirmation.
- Switch to a **shopping mode** that shows what is still to be picked up, grouped by aisle with a "N left" count per aisle, and a running "N of M in cart" progress.
- Check an item off. Checked items move to an "in cart" group that can be shown or hidden.
- Un-check an item.
- See a celebration when everything is in the cart.
- Open the household's loyalty cards directly from shopping mode; one card opens immediately, while several open a recent-first picker.
- When everything is in the cart, use the prominent loyalty-card action without the card opening automatically.
- Clear all checked items from the list at once, after confirmation.
- Have the screen stay awake while in shopping mode with items remaining, where the device allows it.

---

## 4. Catalogue and categories

The catalogue is the household's reusable set of things it buys. A user can:

- Browse catalogue items by category, and see how many items each category has.
- Search the whole catalogue; results grouped by category.
- Add an item to the catalogue with a category, and keep adding several in a row quickly.
- Rename a catalogue item. Two items cannot share a name (case-insensitive).
- Move an item to another category.
- Remove an item from the catalogue (manager only), after confirmation.
- Create a category.
- Rename a category.
- Delete a category (manager only), after confirmation. Its items become uncategorised.
- Set the **aisle order** of categories: the order the household walks the store. This drives grouping in shopping mode.

---

## 5. To-dos

Domain rules from `CONTEXT.md` and ADRs 0001–0004, 0007:

- One **backlog** per household. No sub-lists.
- A to-do is one-off. Recurring chores are a future, separate module.
- **Done** is a timestamp, not a flag. Done to-dos stay visible; who did it is recorded.
- **Due** is a moment (date and time), stored as a UTC instant, shown in the viewer's time zone.
- **Assigned** to at most one member, or unassigned ("up for grabs"). Anyone may assign or claim.
- "Not needed" means deletion. It leaves no trace and is distinct from done.

A user can:

- See the backlog grouped by urgency: Overdue, Today, This week, Later, No date. Empty groups are hidden. "This week" runs to the end of the coming Sunday; on a Sunday it extends through the following week.
- Within a group: open before done, dated before undated, dated soonest first, undated newest first.
- Filter to **Mine** (assigned to the acting member) or All.
- Create a to-do with a title (required), optional notes, optional due moment, optional assignee.
- Edit title, notes, due moment and assignee.
- Set a due moment. Default suggestion when none is set: tomorrow at 09:00. Remove a due moment.
- Assign to a member or to no one.
- Mark a to-do done. The acting member is recorded as the one who did it.
- Un-do a done to-do (back to open).
- See who a to-do is assigned to (open) or who did it (done).
- See recently done to-dos (last 7 days) and reveal older ones on request.
- Delete a to-do (manager only) after a confirmation that explains this is for "never needed doing", not for "done".
- Be prompted, once, to turn on reminders when they have due to-dos and have not decided about notifications yet.

Display rule for due moments: weekday, day and month, and time, in the device locale. Year only when it is not the current year. Overdue is shown distinctly but not alarmingly.

---

## 6. Reminders (notifications)

A user can:

- Turn reminders on for this device (asked only when the user taps to do so, never on launch). On iOS this requires the app to be installed to the home screen first; the app explains how.
- Turn reminders off for this device.
- Send a test reminder to the household.
- Receive a notification when a to-do becomes due: title is the to-do's title, body "Due now". One notification per to-do; a re-send replaces the previous one. Notifications older than one hour are not sent.
- Tap a notification to open the to-dos screen.
- When a to-do is marked done, its pending notification is removed from the device.

Every registered device in the household receives every reminder, not only the assignee's.

Delivery is a 5-minute server sweep with exactly-once claiming (ADR 0005).

---

## 7. Weekly menu

A user can:

- See this week's planned dishes, ordered by weekday Monday to Sunday, with unpinned ("any day") dishes last.
- Add a dish to the week from the dish catalogue. Adding the same dish twice does nothing.
- Pin a planned dish to a weekday, or leave it as "any day".
- Remove a dish from the week, after confirmation.
- Clear the whole week after confirmation, with the ability to undo immediately after.
- See how many dishes are planned.

### Dishes

A user can:

- Browse and search the household's dishes, seeing each dish's ingredient count and whether it is on this week's menu.
- Add a dish to this week directly from the dish overview, or remove it after confirmation.
- Create a dish with a name (required), ingredients picked from the shopping catalogue (creating new catalogue items on the spot when needed), an optional amount and unit for each ingredient, and tags per tag group (e.g. cuisine, type). New tag values can be created inline.
- Edit a dish's name, ingredients, optional ingredient amounts and tags. Clear an amount without removing its ingredient. Removing an ingredient from the draft requires confirmation and removes its amount.
- Delete a dish (manager only), after confirmation.

Tag-based filtering of dishes exists in the data model but has no interface.

---

## 8. Loyalty cards

A user can:

- See the household's loyalty cards, sorted by name, each with a colour and a masked number.
- Add a card: name (required), barcode number, barcode type, colour.
  - Types: EAN-13, EAN-8, UPC-A, Code 128, Code 39, QR. Type is auto-detected from the number until the user picks one.
  - Validation: numeric types require digits, the exact length and a valid check digit. Code 128 is printable ASCII. Code 39 is uppercase alphanumerics plus `- . $ / + %` and space. QR is any non-empty text.
- Scan a physical card's barcode with the camera to fill in number and type, on browsers that support barcode detection (Chromium today; not iOS Safari).
- Preview the barcode while entering it.
- Edit a card.
- Present a card: full-screen, high-contrast barcode large enough to scan at a till, with the number shown for QR codes.
- Remove a card (manager only) after confirmation.

---

## 9. Members

A user can:

- See the household's members, sorted by name, with avatar (colour + emoji) and whether they are a manager.
- Edit their own member (name, colour from 8 presets, emoji from 16 presets).
- As a manager: add a member, edit any member, promote or demote a manager, and remove a member after confirmation.
- The last remaining manager cannot be demoted or removed; the app explains why.
- Removing a member unassigns their open to-dos; done to-dos keep recording them as the doer.

---

## 10. Installing

A user can:

- Install Happie to the home screen as a Progressive Web App. The app offers a one-tap install where the browser supports it, step-by-step instructions on iOS Safari, and a generic hint elsewhere.
- Use home-screen shortcuts to jump straight to Shopping, To-dos or Menu.

Happie has no offline mode: reading and writing both require a connection.

---

## 11. Not yet built

Placeholders visible in the interface, tracked as future modules:

- Household home dashboard
- Settings
- Switching household
- Sharing a shopping list
- Chores (recurring to-dos), see ADR 0003
