import { useEffect, useMemo, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { MemberInterface, TodoInterface } from "@/models/index.ts";
import { EXIT_MS, useTodos } from "@/hooks/useTodos.ts";
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { FullScreenDialog } from "@/components/md3/FullScreenDialog.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { RoundCheck } from "@/components/md3/RoundCheck.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Segmented } from "@/components/md3/Segmented.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { MemberAvatar } from "@/components/members/MemberAvatar.tsx";
import Fab from "@/islands/shell/Fab.tsx";
import DueChip from "@/islands/todos/DueChip.tsx";
import AssigneePicker from "@/islands/todos/AssigneePicker.tsx";
import { GROUP_LABELS, groupOpenTodos } from "@/utils/todo-due.ts";
import { usePushNotifications } from "@/islands/shell/usePushNotifications.ts";

interface Props {
  initialTodos: TodoInterface[];
  members: MemberInterface[];
  actingMemberId: string | null;
  canDelete: boolean;
}

export default function TodoBacklog(
  {
    initialTodos,
    members,
    actingMemberId,
    canDelete,
  }: Props,
) {
  // useMemo([]) so the hook's signals are created once from SSR props.
  const {
    openTodos,
    doneTodos,
    exitingIds,
    addTodo,
    editTodo,
    flushTodo,
    setDueAt,
    assign,
    tickOff,
    unTick,
    removeTodo,
    refresh,
  } = useMemo(() => useTodos(initialTodos), []);

  const {
    state: pushState,
    busy: pushBusy,
    enable: enablePush,
  } = useMemo(() => usePushNotifications(), []);
  // Session-only: the durable control lives in the More sheet, so dismissing
  // here never strands anyone.
  const nudgeDismissed = useSignal(false);

  const createOpen = useSignal(false);
  const newTitle = useSignal("");
  const newNotes = useSignal("");
  const newDue = useSignal("");
  const newAssignee = useSignal<string | null>(null);
  const editingId = useSignal<string | null>(null);
  const confirmingId = useSignal<string | null>(null);
  const dueEditingId = useSignal<string | null>(null);
  const dueDraft = useSignal("");
  const showEarlierDone = useSignal(false);
  const snack = useSignal<{ msg: string } | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filter = useSignal<"all" | "mine">("all");
  const memberById = new Map(members.map((m) => [m.id, m]));

  // ── create-sheet focus handoff ───────────────────────────────────────────
  // `autofocus` doesn't work on the title input below because it's dynamically
  // mounted (gated on createOpen.value — see the comment above the sheet), and
  // browsers only honor `autofocus` during initial document parse.
  //
  // Focusing it from an effect after the sheet opens fixes that on desktop,
  // but on mobile a programmatic .focus() called after an async signal-driven
  // re-render runs outside the tap's user-activation window, so the soft
  // keyboard won't raise (see the primer comment near the FAB in
  // islands/items.tsx — this is the same "autofocus regression" PR #45 fixed).
  // So we reuse that primer pattern here: the FAB tap focuses `primerRef`
  // synchronously (within the tap), keeping the keyboard up across the async
  // re-render that mounts the sheet body, then hands focus to the real title
  // field once it exists.
  const primerRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  // Set once the title field has taken focus, i.e. the keyboard hand-off is
  // done and the primer can safely leave the DOM.
  const handoff = useSignal(false);

  const openCreate = () => {
    newTitle.value = "";
    newNotes.value = "";
    newDue.value = "";
    newAssignee.value = null;
    handoff.value = false;
    primerRef.current?.focus();
    createOpen.value = true;
  };

  const closeCreate = () => {
    createOpen.value = false;
    handoff.value = false;
  };

  useEffect(() => {
    if (createOpen.value) {
      titleRef.current?.focus();
      // Confirm the field actually took focus before declaring the hand-off
      // done — if it didn't, the primer must stay mounted (closeCreate still
      // resets this to false, so it never wedges the primer permanently).
      handoff.value = document.activeElement === titleRef.current;
    }
  }, [createOpen.value]);

  const open = openTodos.value;
  const done = doneTodos.value;
  const exiting = exitingIds.value;

  // One clock for the whole render: a row and its section header must never
  // disagree because the render straddled a second.
  const now = new Date();

  // Mine means intent (assignedTo), never completedBy — across open AND done
  // (docs/adr/0007). A to-do someone else finished but you were assigned
  // still counts as yours; one you finished but weren't assigned does not.
  const mineOnly = filter.value === "mine";
  const mine = (t: TodoInterface) =>
    t.assignedTo !== null && t.assignedTo === actingMemberId;
  const visibleOpen = mineOnly ? open.filter(mine) : open;
  const filteredDone = mineOnly ? done.filter(mine) : done;

  const groups = groupOpenTodos(visibleOpen, now);

  // Done is windowed to a rolling 7 days (spec + ADR 0002): a done one-off is
  // finished forever, so the long tail has almost no value — but this is a
  // *render* window, not a fetch window. The loader still pulls the whole
  // backlog, because keys are ["todos", householdId, id] and filtering by
  // completion date would scan everything anyway.
  const doneCutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const recentDone = filteredDone.filter((t) =>
    new Date(t.completedAt!).getTime() >= doneCutoff
  );
  const earlierDoneCount = filteredDone.length - recentDone.length;
  const visibleDone = showEarlierDone.value ? filteredDone : recentDone;

  const editing = () =>
    open.find((t) => t.id === editingId.value) ??
      done.find((t) => t.id === editingId.value);

  const say = (msg: string) => {
    snack.value = { msg };
    if (snackTimer.current) clearTimeout(snackTimer.current);
    snackTimer.current = setTimeout(() => (snack.value = null), 4000);
  };

  useEffect(() => () => {
    if (snackTimer.current) clearTimeout(snackTimer.current);
  }, []);

  const submitNew = async () => {
    const title = newTitle.value.trim();
    if (!title) return;
    const notes = newNotes.value.trim();
    const created = await addTodo({
      title,
      notes: notes || undefined,
      dueAt: newDue.value ? new Date(newDue.value).toISOString() : null,
      assignedTo: newAssignee.value,
    });
    if (!created) {
      say("Couldn't add that to-do. Try again?");
      return;
    }
    closeCreate();
  };

  const closeEditor = () => {
    const id = editingId.value;
    if (id) flushTodo(id);
    editingId.value = null;
  };

  /**
   * `<input type="datetime-local">` speaks **local wall-clock with no zone**, so
   * both directions need converting: an existing UTC instant becomes a local
   * "YYYY-MM-DDTHH:mm" for the input, and the value the user picks becomes a UTC
   * instant via `new Date(local).toISOString()`. Never round-trip the raw value.
   */
  const toLocalInputValue = (iso: string): string => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${
      pad(d.getHours())
    }:${pad(d.getMinutes())}`;
  };

  /** 09:00 tomorrow, as the pre-filled default when no due moment is set. A
   *  household to-do wants telling at the start of a day, and midnight — the
   *  obvious alternative — is the worst possible moment to be reminded. */
  const defaultDueInputValue = (): string => {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toLocalInputValue(d.toISOString());
  };

  /**
   * Clear a to-do's notification from the shade once it's done. Only possible
   * because the sweep tags per to-do (`todo-<id>`); a shared tag would give no
   * way to address one. Best-effort: no service worker, no notifications, or an
   * unsupported browser all just mean nothing to close.
   */
  const clearNotificationFor = async (id: string) => {
    try {
      if (!("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      if (!reg) return;
      const notes = await reg.getNotifications({ tag: `todo-${id}` });
      for (const n of notes) n.close();
    } catch {
      // Never let notification housekeeping break ticking a to-do off.
    }
  };

  const openDuePicker = (id: string, current: string | null) => {
    dueDraft.value = current
      ? toLocalInputValue(current)
      : defaultDueInputValue();
    dueEditingId.value = id;
  };

  const commitDue = async () => {
    const id = dueEditingId.value;
    const local = dueDraft.value;
    dueEditingId.value = null;
    if (!id || !local) return;
    const ok = await setDueAt(id, new Date(local).toISOString());
    if (!ok) say("Couldn't save that due date. Try again?");
  };

  const clearDue = async () => {
    const id = dueEditingId.value;
    dueEditingId.value = null;
    if (!id) return;
    const ok = await setDueAt(id, null);
    if (!ok) say("Couldn't remove that due date. Try again?");
  };

  // EXIT_MS is imported from useTodos so this transition and the exit-wait it
  // must match can't drift apart (patterns doc §6).
  const row = (t: TodoInterface, isDone: boolean) => (
    <div
      key={t.id}
      class="flex items-start gap-3 px-1 py-2.5"
      style={{
        opacity: exiting.includes(t.id) ? 0 : 1,
        transform: exiting.includes(t.id)
          ? "translateX(12px)"
          : "translateX(0)",
        transition:
          `opacity ${EXIT_MS}ms var(--md-emphasized), transform ${EXIT_MS}ms var(--md-emphasized)`,
        // A row mid-exit-animation stays in the list (see useTodos.tickOff/
        // removeTodo) but must not be tappable — invisible-but-present rows
        // would otherwise accept a second tap during the fade.
        pointerEvents: exiting.includes(t.id) ? "none" : undefined,
      }}
    >
      <Pressable
        onClick={async () => {
          const ok = isDone ? await unTick(t.id) : await tickOff(t.id);
          if (!ok) say("That didn't save. Try again?");
          // Only on tick-off, not un-tick: reopening a to-do should not
          // resurrect a notification for a moment that has already passed.
          else if (!isDone) await clearNotificationFor(t.id);
        }}
        aria-label={isDone ? `Reopen ${t.title}` : `Tick off ${t.title}`}
        class="pt-0.5"
      >
        <RoundCheck checked={isDone} />
      </Pressable>
      <div class="flex-1 min-w-0 flex flex-col gap-1.5 items-start">
        <Pressable
          onClick={() => (editingId.value = t.id)}
          class="w-full text-left"
        >
          <div
            class={`md-body-large ${
              isDone
                ? "text-on-surface-variant line-through"
                : "text-on-surface"
            }`}
          >
            {t.title}
          </div>
          {t.notes && (
            <div class="md-body-small text-on-surface-variant truncate">
              📝 {t.notes}
            </div>
          )}
        </Pressable>
        <div class="flex items-center gap-2">
          <DueChip
            dueAt={t.dueAt}
            now={now}
            onClick={() => openDuePicker(t.id, t.dueAt)}
          />
          {(() => {
            const who = memberById.get(
              (isDone ? t.completedBy : t.assignedTo) ?? "",
            );
            return who
              ? <MemberAvatar color={who.color} emoji={who.emoji} size={20} />
              : null;
          })()}
        </div>
      </div>
    </div>
  );

  return (
    <PullToRefresh
      onRefresh={refresh}
      disabled={createOpen.value || editingId.value !== null ||
        confirmingId.value !== null || dueEditingId.value !== null}
    >
      <div class="px-4 pt-4 pb-[calc(96px+env(safe-area-inset-bottom))] flex flex-col gap-4">
        {open.length === 0 && done.length === 0
          ? (
            <div class="flex flex-col items-center text-center gap-4 pt-12 px-7">
              <div
                class="grid place-items-center bg-primary-container text-on-primary-container"
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: "var(--md-shape-xl)",
                }}
              >
                <Icon name="checklist" size={44} />
              </div>
              <div class="md-headline-small text-on-surface">Nothing to do</div>
              <div
                class="md-body-medium text-on-surface-variant"
                style={{ maxWidth: 280 }}
              >
                When something needs doing around the house, add it here so
                everyone can see it.
              </div>
            </div>
          )
          : (
            <>
              <Segmented
                options={[["all", "people", "All"], ["mine", "user", "Mine"]]}
                value={filter.value}
                onChange={(k) => (filter.value = k as "all" | "mine")}
              />
              {mineOnly && visibleOpen.length === 0 &&
                filteredDone.length === 0 && (
                <div class="md-body-medium text-on-surface-variant text-center pt-8">
                  Nothing on your plate.
                </div>
              )}
              {!nudgeDismissed.value && pushState.value === "default" &&
                open.some((t) => t.dueAt !== null) && (
                <div class="flex flex-col gap-2 bg-secondary-container text-on-secondary-container rounded-[var(--md-shape-lg)] px-4 py-3">
                  <div class="md-body-medium">
                    Get reminded when a to-do is due
                  </div>
                  <div class="flex gap-2">
                    <Button
                      variant="filled"
                      loading={pushBusy.value}
                      onClick={async () => {
                        const ok = await enablePush();
                        if (!ok) say("Couldn't turn reminders on. Try again?");
                        else nudgeDismissed.value = true;
                      }}
                    >
                      Turn on reminders
                    </Button>
                    <Button
                      variant="text"
                      onClick={() => (nudgeDismissed.value = true)}
                    >
                      Not now
                    </Button>
                  </div>
                </div>
              )}
              {groups.map((g) => (
                <div key={g.key} class="flex flex-col gap-1">
                  <div class="md-label-medium uppercase text-on-surface-variant px-1 pt-2">
                    {GROUP_LABELS[g.key]}
                  </div>
                  {g.todos.map((t) => row(t, false))}
                </div>
              ))}

              {filteredDone.length > 0 && (
                <div class="flex flex-col gap-1">
                  <div class="md-label-medium uppercase text-on-surface-variant px-1 pt-2">
                    Done
                  </div>
                  {visibleDone.map((t) => row(t, true))}
                  {earlierDoneCount > 0 && !showEarlierDone.value && (
                    <Pressable
                      onClick={() => (showEarlierDone.value = true)}
                      class="self-start md-label-large text-primary px-1 py-2"
                    >
                      Show earlier ({earlierDoneCount})
                    </Pressable>
                  )}
                </div>
              )}
            </>
          )}
      </div>

      {/* New-to-do FAB — shared component, fixed below the nav chrome */}
      <div
        class="fixed right-4 z-30"
        style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
      >
        <Fab
          icon="plus"
          label="New to-do"
          aria-label="New to-do"
          onClick={openCreate}
        />
      </div>

      {
        /* Primer — see the "create-sheet focus handoff" comment above. Present
          whenever the sheet is closed (so it's focusable synchronously inside
          the FAB tap) or still waiting on the hand-off; unmounts once the real
          title field takes focus. */
      }
      {(!createOpen.value || !handoff.value) && (
        <input
          ref={primerRef}
          type="text"
          aria-hidden="true"
          tabIndex={-1}
          class="fixed top-0 left-0 opacity-0 pointer-events-none"
          style={{ width: 1, height: 1, fontSize: 16 }}
        />
      )}

      {
        /* Create dialog. Body gated on createOpen: <FullScreenDialog> renders
          its children even when closed (see islands/items.tsx:442 for the
          same pattern with <Sheet>), so an ungated title input would stay
          mounted (and stealing focus, see below) while the dialog is closed.
          Gating also means the title input mounts fresh each time the dialog
          opens, which is exactly when the focus effect above should run.
          Closes on save — rapid capture (staying open between saves) was
          retired after real-world testing. */
      }
      <FullScreenDialog
        open={createOpen.value}
        onClose={closeCreate}
        title="New to-do"
        action={<Button variant="text" onClick={submitNew}>Add</Button>}
      >
        {createOpen.value && (
          <div class="flex flex-col gap-3 pt-2">
            <input
              ref={titleRef}
              value={newTitle.value}
              onInput={(e) => (newTitle.value = e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitNew();
                }
              }}
              placeholder="What needs doing?"
              aria-label="What needs doing?"
              class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none"
            />
            <textarea
              value={newNotes.value}
              onInput={(e) => (newNotes.value = e.currentTarget.value)}
              rows={2}
              placeholder="Notes (optional)"
              aria-label="Notes (optional)"
              class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none resize-none"
            />
            <input
              type="datetime-local"
              value={newDue.value}
              onChange={(e) => (newDue.value = e.currentTarget.value)}
              aria-label="Due date and time (optional)"
              class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none"
            />
            <AssigneePicker
              members={members}
              value={newAssignee.value}
              onChange={(id) => (newAssignee.value = id)}
            />
          </div>
        )}
      </FullScreenDialog>

      {/* Edit dialog */}
      <FullScreenDialog
        open={editingId.value !== null}
        onClose={closeEditor}
        title="Edit to-do"
        action={<Button variant="text" onClick={closeEditor}>Done</Button>}
      >
        {(() => {
          const t = editing();
          if (!t) return null;
          return (
            <div class="flex flex-col gap-3 pt-2">
              <input
                value={t.title}
                onInput={(e) =>
                  editTodo(t.id, { title: e.currentTarget.value })}
                aria-label="Title"
                class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none"
              />
              <textarea
                value={t.notes ?? ""}
                onInput={(e) =>
                  editTodo(t.id, { notes: e.currentTarget.value })}
                rows={2}
                placeholder="Notes (optional)"
                aria-label="Notes"
                class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none resize-none"
              />
              <input
                type="datetime-local"
                value={t.dueAt ? toLocalInputValue(t.dueAt) : ""}
                onChange={async (e) => {
                  const v = e.currentTarget.value;
                  const ok = await setDueAt(
                    t.id,
                    v ? new Date(v).toISOString() : null,
                  );
                  if (!ok) say("Couldn't save that due date. Try again?");
                }}
                aria-label="Due date and time"
                class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none"
              />
              <AssigneePicker
                members={members}
                value={t.assignedTo}
                onChange={async (id) => {
                  const ok = await assign(t.id, id);
                  if (!ok) say("Couldn't save that. Try again?");
                }}
              />
              {canDelete && (
                <Button
                  variant="error"
                  full
                  onClick={() => {
                    const id = t.id;
                    closeEditor();
                    confirmingId.value = id;
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          );
        })()}
      </FullScreenDialog>

      {/* Delete confirmation — the house pattern is a sheet, not a dialog */}
      <Sheet
        open={confirmingId.value !== null}
        onClose={() => (confirmingId.value = null)}
        title="Delete this to-do?"
      >
        <div class="flex flex-col gap-3 pb-1">
          <div class="md-body-medium text-on-surface-variant">
            This removes it for everyone. Use it when the to-do never needed
            doing — ticking it off is how you say it's done.
          </div>
          <Button
            variant="error"
            full
            onClick={async () => {
              const id = confirmingId.value;
              confirmingId.value = null;
              if (!id) return;
              const ok = await removeTodo(id);
              if (!ok) say("Couldn't delete that. Try again?");
            }}
          >
            Delete
          </Button>
          <Button
            variant="text"
            full
            onClick={() => (confirmingId.value = null)}
          >
            Keep it
          </Button>
        </div>
      </Sheet>

      {
        /* Due-date picker. Native <input type="datetime-local"> rather than a
          custom MD3 picker: on mobile it opens the platform's own control,
          which is familiar, accessible and localised for free, and resolves
          local wall-clock time natively — exactly what docs/adr/0004 needs. */
      }
      <Sheet
        open={dueEditingId.value !== null}
        onClose={() => (dueEditingId.value = null)}
        title="When is it due?"
      >
        {dueEditingId.value !== null && (
          <div class="flex flex-col gap-3 pb-1">
            <input
              type="datetime-local"
              value={dueDraft.value}
              onInput={(e) => (dueDraft.value = e.currentTarget.value)}
              aria-label="Due date and time"
              class="w-full md-body-large text-on-surface bg-surface-chigh border-0 rounded-[var(--md-shape-lg)] py-3 px-4 outline-none"
            />
            <Button variant="filled" full onClick={commitDue}>Save</Button>
            <Button variant="text" full onClick={clearDue}>
              Remove due date
            </Button>
          </div>
        )}
      </Sheet>

      <Snackbar data={snack.value} />
    </PullToRefresh>
  );
}
