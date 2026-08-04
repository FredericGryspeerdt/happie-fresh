import { useEffect, useMemo, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { TodoInterface } from "@/models/index.ts";
import { EXIT_MS, useTodos } from "@/hooks/useTodos.ts";
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { RoundCheck } from "@/components/md3/RoundCheck.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import Fab from "@/islands/shell/Fab.tsx";

interface Props {
  initialTodos: TodoInterface[];
}

export default function TodoBacklog({ initialTodos }: Props) {
  // useMemo([]) so the hook's signals are created once from SSR props.
  const {
    openTodos,
    doneTodos,
    exitingIds,
    addTodo,
    editTodo,
    flushTodo,
    tickOff,
    unTick,
    removeTodo,
    refresh,
  } = useMemo(() => useTodos(initialTodos), []);

  const createOpen = useSignal(false);
  const newTitle = useSignal("");
  const newNotes = useSignal("");
  const editingId = useSignal<string | null>(null);
  const confirmingId = useSignal<string | null>(null);
  const snack = useSignal<{ msg: string } | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const created = await addTodo({ title, notes: notes || undefined });
    if (!created) {
      say("Couldn't add that to-do. Try again?");
      return;
    }
    // Keep the sheet open and the field focused so several to-dos can be
    // captured in a row without the mobile keyboard dismissing. Clearing the
    // fields doesn't restore focus by itself — the Enter-key path never lost
    // it, but a pointer tap on the "Add" button below moves focus to the
    // button, so it must be reclaimed explicitly (mirrors handleCreate in
    // islands/add-items.tsx).
    newTitle.value = "";
    newNotes.value = "";
    titleRef.current?.focus();
  };

  const closeEditor = () => {
    const id = editingId.value;
    if (id) flushTodo(id);
    editingId.value = null;
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
        }}
        aria-label={isDone ? `Reopen ${t.title}` : `Tick off ${t.title}`}
        class="pt-0.5"
      >
        <RoundCheck checked={isDone} />
      </Pressable>
      <Pressable
        onClick={() => (editingId.value = t.id)}
        class="flex-1 min-w-0 text-left"
      >
        <div
          class={`md-body-large ${
            isDone ? "text-on-surface-variant line-through" : "text-on-surface"
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
    </div>
  );

  return (
    <PullToRefresh
      onRefresh={refresh}
      disabled={createOpen.value || editingId.value !== null ||
        confirmingId.value !== null}
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
              {open.length > 0 && (
                <div class="flex flex-col">
                  {open.map((t) => row(t, false))}
                </div>
              )}

              {done.length > 0 && (
                <div class="flex flex-col gap-1">
                  <div class="md-label-medium uppercase text-on-surface-variant px-1 pt-2">
                    Done
                  </div>
                  {done.map((t) => row(t, true))}
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
        /* Create sheet — stays open between saves for rapid capture.
          Body gated on createOpen: <Sheet> renders its children even when
          closed (see islands/items.tsx:442), so an ungated title input would
          stay mounted (and stealing focus, see below) while the sheet is
          closed. Gating also means the title input mounts fresh each time the
          sheet opens, which is exactly when the focus effect above should run. */
      }
      <Sheet
        open={createOpen.value}
        onClose={closeCreate}
        title="New to-do"
      >
        {createOpen.value && (
          <div class="flex flex-col gap-3 pb-1">
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
            <Button variant="filled" full onClick={submitNew}>Add</Button>
            {
              /* "Close", not "Done" — "Done" beside "Add" reads as a second
                save, and the Done *section* heading must stay unambiguous. */
            }
            <Button
              variant="text"
              full
              onClick={closeCreate}
            >
              Close
            </Button>
          </div>
        )}
      </Sheet>

      {/* Edit sheet */}
      <Sheet
        open={editingId.value !== null}
        onClose={closeEditor}
        title="Edit to-do"
      >
        {(() => {
          const t = editing();
          if (!t) return null;
          return (
            <div class="flex flex-col gap-3 pb-1">
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
              <Button variant="filled" full onClick={closeEditor}>Done</Button>
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
            </div>
          );
        })()}
      </Sheet>

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

      <Snackbar data={snack.value} />
    </PullToRefresh>
  );
}
