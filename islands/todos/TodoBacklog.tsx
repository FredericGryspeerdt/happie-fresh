import { useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { TodoInterface } from "@/models/index.ts";
import { useTodos } from "@/hooks/useTodos.ts";
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

  const open = openTodos.value;
  const done = doneTodos.value;
  const exiting = exitingIds.value;

  const editing = () =>
    open.find((t) => t.id === editingId.value) ??
      done.find((t) => t.id === editingId.value);

  const say = (msg: string) => {
    snack.value = { msg };
    setTimeout(() => (snack.value = null), 4000);
  };

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
    // captured in a row without the mobile keyboard dismissing.
    newTitle.value = "";
    newNotes.value = "";
  };

  const closeEditor = () => {
    const id = editingId.value;
    if (id) flushTodo(id);
    editingId.value = null;
  };

  // The 300ms here must match EXIT_MS in useTodos (patterns doc §6).
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
          "opacity .3s var(--md-emphasized), transform .3s var(--md-emphasized)",
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
    <PullToRefresh onRefresh={refresh}>
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
          onClick={() => {
            newTitle.value = "";
            newNotes.value = "";
            createOpen.value = true;
          }}
        />
      </div>

      {
        /* Create sheet — stays open between saves for rapid capture.
          Body gated on createOpen: <Sheet> renders its children even when
          closed (see islands/items.tsx:442), so an ungated `autofocus` would
          steal focus and raise the mobile keyboard on page load. Gating also
          means `autofocus` fires on mount, i.e. exactly when the sheet opens. */
      }
      <Sheet
        open={createOpen.value}
        onClose={() => (createOpen.value = false)}
        title="New to-do"
      >
        {createOpen.value && (
          <div class="flex flex-col gap-3 pb-1">
            <input
              autofocus
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
              onClick={() => (createOpen.value = false)}
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
