import type { RefObject } from "preact";
import type { ItemInterface } from "@/models/index.ts";
import { Button } from "@/components/md3/Button.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";

interface Props {
  items: ItemInterface[];
  selectedIds: string[];
  dishName: string;
  query: string;
  inputRef: RefObject<HTMLInputElement>;
  creating: boolean;
  onQuery: (value: string) => void;
  onReset: () => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onCreate: () => void;
}

/** Search and review share one surface; selections belong to the dish draft. */
export function IngredientPicker({
  items,
  selectedIds,
  dishName,
  query,
  inputRef,
  creating,
  onQuery,
  onReset,
  onAdd,
  onRemove,
  onCreate,
}: Props) {
  const q = query.trim().toLowerCase();
  const selected = new Set(selectedIds);
  const matches = items.filter((item) => item.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  const exactMatch = items.some((item) => item.name.trim().toLowerCase() === q);

  return (
    <div class="flex flex-col gap-5 pt-1">
      {dishName.trim() && (
        <p class="md-body-medium text-on-surface-variant break-words">
          For {dishName.trim()}
        </p>
      )}
      <section aria-label="Selected ingredients">
        <h3 class="md-label-medium uppercase text-on-surface-variant mb-2">
          In this dish · {selectedIds.length}
        </h3>
        {selectedIds.length === 0
          ? (
            <p class="md-body-medium text-on-surface-variant">
              No ingredients yet.
            </p>
          )
          : (
            <div class="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
              {selectedIds.map((id) => {
                const label = items.find((item) => item.id === id)?.name ??
                  "Unknown ingredient";
                return (
                  <Pressable
                    key={id}
                    disabled={creating}
                    aria-label={`Remove ${label}`}
                    onClick={() => onRemove(id)}
                    class="inline-flex items-center gap-3 min-h-11 max-w-full px-3 md-label-large rounded-[var(--md-shape-full)] bg-secondary-container text-on-secondary-container text-left"
                  >
                    <span class="break-words min-w-0">{label}</span>
                    <Icon name="x" size={18} class="shrink-0" />
                  </Pressable>
                );
              })}
            </div>
          )}
      </section>
      <div class="flex items-center gap-2 bg-surface-chighest rounded-[var(--md-shape-full)] h-12 pl-4 pr-1 shrink-0 focus-within:outline-2 focus-within:outline-primary">
        <Icon
          name="search"
          size={22}
          class="text-on-surface-variant shrink-0"
        />
        <input
          ref={inputRef}
          value={query}
          onInput={(e) => onQuery(e.currentTarget.value)}
          aria-label="Search ingredients"
          placeholder="Search or add an ingredient"
          readOnly={creating}
          enterKeyHint="search"
          onKeyDown={(e) => {
            // Enter must never create a partial query when a match exists.
            if (e.key === "Enter") e.preventDefault();
          }}
          class="flex-1 min-w-0 bg-transparent border-0 outline-none md-body-large text-on-surface"
        />
        {query && !creating && (
          <IconButton
            name="x"
            aria-label="Clear ingredient search"
            onClick={onReset}
          />
        )}
      </div>
      <section aria-label="Ingredient results">
        <h3 class="md-label-medium uppercase text-on-surface-variant mb-2">
          {q ? "Matches" : "Ingredients"}
        </h3>
        {matches.map((item) =>
          selected.has(item.id)
            ? (
              <div
                key={item.id}
                class="flex items-center gap-3 min-h-14 py-2 border-b border-outline-variant"
              >
                <span class="md-body-large flex-1 min-w-0 break-words">
                  {item.name}
                </span>
                <span class="md-label-medium text-on-surface-variant">
                  Already added
                </span>
                <Icon name="check" size={20} class="text-primary shrink-0" />
              </div>
            )
            : (
              <Pressable
                key={item.id}
                disabled={creating}
                aria-label={`Add ${item.name}`}
                onClick={() => onAdd(item.id)}
                class="flex items-center gap-3 w-full text-left min-h-14 py-2 border-b border-outline-variant"
              >
                <span class="md-body-large flex-1 min-w-0 break-words">
                  {item.name}
                </span>
                <span class="grid place-items-center w-11 h-11 rounded-[var(--md-shape-full)] bg-secondary-container text-primary shrink-0">
                  <Icon name="plus" size={22} />
                </span>
              </Pressable>
            )
        )}
        {matches.length === 0 && (
          <p class="md-body-medium text-on-surface-variant py-3">
            {q
              ? "No matching ingredients. Add it below."
              : "Type an ingredient name to get started."}
          </p>
        )}
        {q && !exactMatch && (
          <Button
            variant="text"
            icon="plus"
            loading={creating}
            onClick={onCreate}
            class="mt-2 min-h-11 h-auto py-3 px-0 whitespace-normal text-left justify-start max-w-full"
          >
            <span class="min-w-0 break-words">
              Add new ingredient “{query.trim()}”
            </span>
          </Button>
        )}
      </section>
    </div>
  );
}
