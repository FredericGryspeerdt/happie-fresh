import { useModal } from "@/components/md3/useModal.ts";
import { useEffect, useMemo, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import type { HomeData } from "@/services/home.ts";
import { useHome as createHome } from "@/hooks/useHome.ts";
import { useSnack } from "@/hooks/useSnack.ts";
import { EXIT_MS } from "@/hooks/useTodos.ts";
import { homeDueLabel, homeTodos } from "@/utils/home.ts";
import {
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
} from "@/models/menu/weekly-menu.interface.ts";
import { Button } from "@/components/md3/Button.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { RoundCheck } from "@/components/md3/RoundCheck.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { PullToRefresh } from "@/components/md3/PullToRefresh.tsx";
import AddItems from "@/islands/add-items.tsx";

function Link(
  { href, children }: { href: string; children: ComponentChildren },
) {
  return (
    <a
      href={href}
      class="inline-flex items-center gap-1 min-h-11 text-primary md-label-large shrink-0"
    >
      {children}
      <Icon name="chevron" size={18} />
    </a>
  );
}

export default function Home({ initial }: { initial: HomeData }) {
  const home = useMemo(() => createHome(initial), []);
  const { snack, showSnack } = useSnack();
  // Defer local-day content until mounted: server and browser may have different zones.
  const now = useSignal<Date | null>(null);
  const choosing = useSignal(false);
  const addingId = useSignal<string | null>(null);
  const handoff = useSignal(false);
  const primer = useRef<HTMLInputElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const addTrigger = useRef<HTMLElement>(null);
  const refresh = async () => {
    if (!await home.refresh()) {
      showSnack("Vernieuwen is niet gelukt. Probeer opnieuw.");
    }
  };
  useEffect(() => {
    const clock = () => {
      now.value = new Date();
    };
    const resume = () => {
      clock();
      if (!document.hidden && !addingId.value && !choosing.value) {
        void refresh();
      }
    };
    clock();
    const timer = setInterval(clock, 30_000);
    document.addEventListener("visibilitychange", resume);
    globalThis.addEventListener("online", resume);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      globalThis.removeEventListener("online", resume);
    };
  }, []);
  const closeAdd = () => {
    addingId.value = null;
    handoff.value = false;
    void refresh().then(() => {
      if (!addingId.value && document.activeElement === document.body) {
        addTrigger.current?.focus();
      }
    });
  };
  useModal(addingId.value !== null, closeAdd, overlay, false, {
    preserveInitialFocus: true,
    returnFocus: addTrigger,
  });
  const data = home.data.value;
  const relevant = now.value
    ? homeTodos(home.todos.openTodos.value, now.value)
    : [];
  const selected = data.lists.filter((l) => l.showOnHome === true);
  const adding = data.lists.find((l) => l.id === addingId.value);
  const dishes = new Map(data.dishes.map((d) => [d.id, d]));
  const entries = data.menu.entries.filter((e) => dishes.has(e.dishId))
    .toSorted((a, b) =>
      (a.day ? WEEKDAY_ORDER.indexOf(a.day) : 7) -
      (b.day ? WEEKDAY_ORDER.indexOf(b.day) : 7)
    ).slice(0, 7);
  return (
    <PullToRefresh
      onRefresh={refresh}
      disabled={!!adding || choosing.value || home.saving.value}
    >
      <div class="px-4 pb-8" inert={!!adding}>
        <p
          class="md-body-large text-on-surface-variant min-h-6 mb-2 first-letter:uppercase"
          aria-live="off"
        >
          {now.value?.toLocaleDateString("nl-BE", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }) ?? "Overzicht voor je huishouden"}
        </p>
        <section aria-labelledby="home-todos" class="mb-5">
          <div class="flex items-center justify-between gap-2 mb-2">
            <h2
              id="home-todos"
              class="md-title-large"
              style={{ fontWeight: 650 }}
            >
              Te doen
            </h2>
            {relevant.length > 0 && (
              <Link href="/todos?view=home">Bekijk alle {relevant.length}</Link>
            )}
          </div>
          {!now.value
            ? (
              <p class="md-body-medium text-on-surface-variant py-3">
                Geplande to-do’s laden…
              </p>
            )
            : relevant.length === 0
            ? (
              <div class="md-body-medium text-on-surface-variant">
                <p>Niets gepland voor vandaag of eerder.</p>
                <Link href="/todos">Bekijk te doen</Link>
              </div>
            )
            : (
              <div>
                {relevant.slice(0, 5).map((todo) => {
                  const member = data.members.find((m) =>
                    m.id === todo.assignedTo
                  );
                  const exiting = home.todos.exitingIds.value.includes(todo.id);
                  return (
                    <div
                      key={todo.id}
                      class="flex items-center gap-2 border-b border-outline-variant/50 py-2"
                      style={{
                        opacity: exiting ? 0 : 1,
                        transform: exiting ? "translateX(12px)" : "none",
                        transition:
                          `opacity ${EXIT_MS}ms, transform ${EXIT_MS}ms`,
                      }}
                    >
                      <button
                        type="button"
                        disabled={home.saving.value}
                        class="min-w-11 min-h-11 grid place-items-center shrink-0 disabled:opacity-50"
                        aria-label={`Afvinken: ${todo.title}`}
                        onClick={async () => {
                          if (!await home.complete(todo.id)) {
                            showSnack(
                              "Opslaan is niet gelukt. Probeer opnieuw.",
                            );
                          } else {try {
                              if ("serviceWorker" in navigator) {
                                const reg = await navigator.serviceWorker
                                  .getRegistration("/push-sw.js");
                                for (
                                  const note of await reg?.getNotifications({
                                    tag: `todo-${todo.id}`,
                                  }) ?? []
                                ) note.close();
                              }
                            } catch {
                              /* Notification cleanup is best effort. */
                            }}
                        }}
                      >
                        <RoundCheck checked={exiting} />
                      </button>
                      <a
                        href={`/todos?todo=${encodeURIComponent(todo.id)}`}
                        class="flex items-center gap-2 flex-1 min-w-0 min-h-11"
                      >
                        <div class="flex-1 min-w-0">
                          <p class="md-body-large font-medium break-words">
                            {todo.title}
                          </p>
                          <p class="md-body-small text-on-surface-variant mt-0.5">
                            {homeDueLabel(todo.dueAt!, now.value!)}
                            {member ? ` · ${member.name}` : ""}
                          </p>
                        </div>
                        <Icon name="chevron" size={20} />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
        </section>
        <section aria-labelledby="home-shopping" class="mb-5">
          <div class="flex items-center justify-between gap-2 mb-2">
            <h2
              id="home-shopping"
              class="md-title-large"
              style={{ fontWeight: 650 }}
            >
              Boodschappen
            </h2>
            <Button
              variant="text"
              class="min-h-11 shrink-0"
              style={{ padding: "0 4px" }}
              onClick={() => choosing.value = true}
            >
              Kies lijsten<Icon name="chevron" size={18} />
            </Button>
          </div>
          {selected.length === 0 && (
            <p class="md-body-medium text-on-surface-variant py-2">
              Welke boodschappenlijsten wil je op Start zien?
            </p>
          )}
          {selected.map((list) => {
            const remaining = list.entries.filter((e) => !e.checked).length;
            return (
              <div
                key={list.id}
                class="flex gap-4 py-3 border-b border-outline-variant/50"
              >
                <span class="pt-1 text-on-surface-variant">
                  <Icon name="cart" size={28} />
                </span>
                <div class="flex-1 min-w-0">
                  <a
                    href={`/shopping/${list.id}`}
                    class="flex gap-2 items-center min-h-11"
                  >
                    <div class="flex-1 min-w-0">
                      <p class="md-body-large font-medium break-words">
                        {list.name}
                      </p>
                      <p class="md-body-medium text-on-surface-variant">
                        {remaining === 0
                          ? "Alles gekocht"
                          : `${remaining} ${
                            remaining === 1 ? "product" : "producten"
                          } te kopen`}
                      </p>
                    </div>
                    <Icon name="chevron" size={20} />
                  </a>
                  <Button
                    variant="tonal"
                    icon="plus"
                    class="mt-2 min-h-11"
                    style={{
                      background: "var(--md-primary-container)",
                      color: "var(--md-on-primary-container)",
                    }}
                    aria-label={`Product toevoegen aan ${list.name}`}
                    disabled={home.refreshing.value}
                    onClick={(event) => {
                      addTrigger.current = event.currentTarget as HTMLElement;
                      handoff.value = false;
                      primer.current?.focus();
                      addingId.value = list.id;
                    }}
                  >
                    Product toevoegen
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
        <section aria-labelledby="home-menu">
          <div class="flex items-center justify-between gap-2 mb-2">
            <h2
              id="home-menu"
              class="md-title-large"
              style={{ fontWeight: 650 }}
            >
              Weekmenu
            </h2>
            <Link href="/menu">Bekijk weekmenu</Link>
          </div>
          {entries.length === 0 && (
            <p class="md-body-medium text-on-surface-variant py-2">
              Er staan nog geen gerechten in het weekmenu.
            </p>
          )}
          {entries.map((entry) => (
            <a
              key={entry.id}
              href={`/menu/${entry.dishId}`}
              class="grid grid-cols-[100px_1fr] gap-4 py-3 min-h-12 border-b border-outline-variant/50 md-body-large"
            >
              <span class="text-on-surface-variant md-body-medium">
                {entry.day ? WEEKDAY_LABELS[entry.day] : "Nog te plannen"}
              </span>
              <span class="border-l border-outline-variant/50 pl-4 break-words">
                {dishes.get(entry.dishId)!.name}
              </span>
            </a>
          ))}
        </section>
      </div>
      {choosing.value && (
        <Sheet
          title="Kies lijsten"
          open={choosing.value}
          onClose={() => choosing.value = false}
        >
          <p class="md-body-medium text-on-surface-variant mb-3">
            Deze keuze geldt voor het hele huishouden.
          </p>
          {data.lists.length === 0 && (
            <Link href="/shopping">Maak een boodschappenlijst</Link>
          )}
          {data.lists.map((list) => (
            <button
              key={list.id}
              type="button"
              role="switch"
              aria-checked={list.showOnHome === true}
              disabled={home.saving.value}
              class="flex items-center gap-3 py-3 min-h-12 w-full text-left disabled:opacity-60"
              onClick={async () => {
                if (!await home.selectList(list.id, !list.showOnHome)) {
                  showSnack(
                    "Opslaan is niet gelukt. Probeer opnieuw.",
                  );
                }
              }}
            >
              <RoundCheck checked={list.showOnHome === true} />
              <span class="md-body-large break-words">{list.name}</span>
            </button>
          ))}
          <Button variant="text" full onClick={() => choosing.value = false}>
            Klaar
          </Button>
        </Sheet>
      )}
      {(!adding || !handoff.value) && (
        <input
          ref={primer}
          type="text"
          aria-hidden="true"
          tabIndex={-1}
          class="fixed top-0 left-0 opacity-0 pointer-events-none"
          style={{ width: 1, height: 1, fontSize: 16 }}
        />
      )}
      {adding && (
        <div
          ref={overlay}
          role="dialog"
          aria-modal="true"
          aria-label={`Product toevoegen aan ${adding.name}`}
          class="fixed inset-0 z-50 bg-surface overflow-y-auto"
        >
          <div class="max-w-md mx-auto">
            <AddItems
              key={adding.id}
              listId={adding.id}
              listName={adding.name}
              targetList={adding}
              items={data.items}
              shoppingList={adding.entries}
              categories={data.categories}
              initialQuery=""
              initialMenu={data.menu}
              initialDishes={data.dishes}
              onClose={closeAdd}
              onChanged={() => void refresh()}
              onSearchFocus={() => handoff.value = true}
            />
          </div>
        </div>
      )}
      <Snackbar data={snack.value} />
    </PullToRefresh>
  );
}
