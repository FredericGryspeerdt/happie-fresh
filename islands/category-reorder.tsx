import { useSignal } from "@preact/signals";
import type { CategoryInterface } from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { IconButton } from "@/components/md3/IconButton.tsx";

interface Props {
  initialCategories: CategoryInterface[];
}

export default function CategoryReorder({ initialCategories }: Props) {
  const cats = useSignal<CategoryInterface[]>(
    [...initialCategories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );

  const move = async (index: number, dir: -1 | 1) => {
    const arr = [...cats.value];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    const tmp = arr[index];
    arr[index] = arr[j];
    arr[j] = tmp;
    const reindexed = arr.map((c, i) => ({ ...c, order: i }));
    cats.value = reindexed; // optimistic
    await api.categories.reorder(
      reindexed.map((c) => ({ id: c.id, order: c.order! })),
    );
  };

  const list = cats.value;
  if (list.length === 0) {
    return (
      <div class="text-center py-12 md-body-medium text-on-surface-variant">
        No categories yet. Add one from the catalogue.
      </div>
    );
  }

  return (
    <div class="flex flex-col gap-2">
      <p class="md-body-medium text-on-surface-variant mb-1">
        Order categories the way you walk the store — this sets the aisle order
        in Shop mode.
      </p>
      {list.map((c, i) => (
        <div
          key={c.id}
          class="flex items-center gap-2 bg-surface-clow rounded-[var(--md-shape-md)] px-4 py-2"
        >
          <span class="flex-1 min-w-0 truncate md-body-large text-on-surface">
            {c.label}
          </span>
          <IconButton
            name="chevron"
            iconSize={20}
            aria-label="Move up"
            style={{ transform: "rotate(-90deg)" }}
            onClick={() => move(i, -1)}
          />
          <IconButton
            name="chevron"
            iconSize={20}
            aria-label="Move down"
            style={{ transform: "rotate(90deg)" }}
            onClick={() => move(i, 1)}
          />
        </div>
      ))}
    </div>
  );
}
