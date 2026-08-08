import { useSignal } from "@preact/signals";
import type {
  DishInterface,
  DishTagGroupInterface,
  ItemInterface,
} from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { Chip } from "@/components/md3/Chip.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { Sheet } from "@/components/md3/Sheet.tsx";
import { Pressable } from "@/components/md3/Pressable.tsx";
import { ListItem } from "@/components/md3/ListItem.tsx";
import { navigateTo } from "@/utils/loading.ts";

const fieldClass =
  "flex-1 min-w-0 md-body-large text-on-surface bg-surface-chighest rounded-t-[var(--md-shape-sm)] border-0 border-b-2 border-primary px-4 py-3 focus:outline-none";

interface Props {
  dish?: DishInterface;
  tagGroups: DishTagGroupInterface[];
  items: ItemInterface[];
  canDelete: boolean;
}

export default function DishEditor(
  { dish, tagGroups, items, canDelete }: Props,
) {
  const name = useSignal(dish?.name ?? "");
  const ingredientIds = useSignal<string[]>(dish?.ingredientIds ?? []);
  const tagValueIds = useSignal<string[]>(dish?.tagValueIds ?? []);
  const localItems = useSignal<ItemInterface[]>(items);
  const localGroups = useSignal<DishTagGroupInterface[]>(tagGroups);
  const pickerOpen = useSignal(false);
  const ingredientQuery = useSignal("");
  const newValueFor = useSignal<string | null>(null);
  const newValueLabel = useSignal("");
  const saving = useSignal(false);

  const itemById = (id: string) => localItems.value.find((i) => i.id === id);

  const toggleTag = (valueId: string) => {
    tagValueIds.value = tagValueIds.value.includes(valueId)
      ? tagValueIds.value.filter((v) => v !== valueId)
      : [...tagValueIds.value, valueId];
  };
  const addIngredient = (itemId: string) => {
    if (!ingredientIds.value.includes(itemId)) {
      ingredientIds.value = [...ingredientIds.value, itemId];
    }
  };
  const removeIngredient = (itemId: string) => {
    ingredientIds.value = ingredientIds.value.filter((i) => i !== itemId);
  };
  const createCatalogueItem = async (label: string) => {
    const created = await api.items.create({ name: label });
    if (created?.id) {
      localItems.value = [...localItems.value, created];
      addIngredient(created.id);
    }
  };
  const addValue = async (groupId: string, label: string) => {
    const created = await api.dishTagGroups.addValue(groupId, label);
    if (created) {
      localGroups.value = localGroups.value.map((g) =>
        g.id === groupId ? { ...g, values: [...g.values, created] } : g
      );
      toggleTag(created.id);
    }
  };
  const save = async () => {
    const n = name.value.trim();
    if (!n) return;
    saving.value = true;
    const payload = {
      name: n,
      ingredientIds: ingredientIds.value,
      tagValueIds: tagValueIds.value,
    };
    try {
      const result = dish
        ? await api.dishes.update(dish.id, payload)
        : await api.dishes.create(payload);
      if (result) {
        navigateTo("/menu");
      } else {
        saving.value = false; // failed — re-enable so the user can retry
      }
    } catch (_) {
      saving.value = false; // network error — re-enable
    }
  };
  const remove = async () => {
    if (!dish) return;
    await api.dishes.delete(dish.id);
    navigateTo("/menu");
  };

  const q = ingredientQuery.value.trim().toLowerCase();
  const chosen = new Set(ingredientIds.value);
  const results = localItems.value
    .filter((i) =>
      !chosen.has(i.id) && (!q || i.name.toLowerCase().includes(q))
    )
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  const exactMatch = !!q &&
    localItems.value.some((i) => i.name.trim().toLowerCase() === q);

  return (
    <div class="px-4 pt-4 pb-[calc(96px+env(safe-area-inset-bottom))] flex flex-col gap-6">
      {/* Name */}
      <div>
        <div class="md-label-medium uppercase text-on-surface-variant mb-2">
          Name
        </div>
        <input
          value={name.value}
          onInput={(e) => (name.value = e.currentTarget.value)}
          placeholder="Dish name"
          class={fieldClass}
        />
      </div>

      {/* Ingredients */}
      <div>
        <div class="md-label-medium uppercase text-on-surface-variant mb-2">
          Ingredients
        </div>
        <div class="flex flex-wrap gap-2">
          {ingredientIds.value.map((id) => (
            <span
              key={id}
              class="inline-flex items-center gap-1 md-label-large bg-secondary-container text-on-secondary-container rounded-[var(--md-shape-full)] pl-3 pr-1 py-1"
            >
              {itemById(id)?.name ?? "Unknown"}
              <IconButton
                name="x"
                size={28}
                iconSize={14}
                aria-label="Remove ingredient"
                onClick={() => removeIngredient(id)}
              />
            </span>
          ))}
          <Chip
            icon="plus"
            leadingCheck={false}
            onClick={() => {
              ingredientQuery.value = "";
              pickerOpen.value = true;
            }}
          >
            Add ingredient
          </Chip>
        </div>
      </div>

      {/* Tags — one chip group per dimension */}
      {localGroups.value.map((g) => (
        <div key={g.id}>
          <div class="md-label-medium uppercase text-on-surface-variant mb-2">
            {g.label}
          </div>
          <div class="flex flex-wrap gap-2 items-center">
            {g.values.map((v) => (
              <Chip
                key={v.id}
                selected={tagValueIds.value.includes(v.id)}
                leadingCheck={false}
                onClick={() => toggleTag(v.id)}
              >
                {v.label}
              </Chip>
            ))}
            {newValueFor.value === g.id
              ? (
                <span class="inline-flex items-center gap-2">
                  <input
                    value={newValueLabel.value}
                    onInput={(
                      e,
                    ) => (newValueLabel.value = e.currentTarget.value)}
                    placeholder="New value"
                    class="md-body-large bg-surface-chighest rounded-t-[var(--md-shape-sm)] border-0 border-b-2 border-primary px-3 py-1.5 focus:outline-none"
                  />
                  <Button
                    variant="filled"
                    disabled={!newValueLabel.value.trim()}
                    onClick={async () => {
                      await addValue(g.id, newValueLabel.value.trim());
                      newValueFor.value = null;
                      newValueLabel.value = "";
                    }}
                  >
                    Add
                  </Button>
                </span>
              )
              : (
                <Chip
                  icon="plus"
                  leadingCheck={false}
                  onClick={() => {
                    newValueFor.value = g.id;
                    newValueLabel.value = "";
                  }}
                >
                  New
                </Chip>
              )}
          </div>
        </div>
      ))}

      {/* Save / Delete */}
      <div class="flex flex-col gap-3 pt-2">
        <Button
          variant="filled"
          disabled={!name.value.trim() || saving.value}
          loading={saving.value}
          onClick={save}
        >
          {dish ? "Save changes" : "Create dish"}
        </Button>
        {dish && canDelete && (
          <Button variant="error" icon="trash" onClick={remove}>
            Delete dish
          </Button>
        )}
      </div>

      {/* Ingredient picker — search the catalogue, or create a new item inline */}
      <Sheet
        open={pickerOpen.value}
        onClose={() => (pickerOpen.value = false)}
        title="Add ingredient"
        size="large"
      >
        <div class="flex items-center gap-2 bg-surface-chighest rounded-[var(--md-shape-full)] h-12 pl-4 pr-1.5 mb-3">
          <Icon name="search" size={20} class="text-on-surface-variant" />
          <input
            value={ingredientQuery.value}
            onInput={(e) => (ingredientQuery.value = e.currentTarget.value)}
            placeholder="Search or add an item"
            class="flex-1 min-w-0 bg-transparent border-0 outline-none md-body-large text-on-surface"
          />
        </div>
        {q && !exactMatch && (
          <Pressable
            onClick={async () => {
              await createCatalogueItem(ingredientQuery.value.trim());
              ingredientQuery.value = "";
            }}
            color="var(--md-primary)"
            class="flex items-center gap-2.5 w-full text-left border-[1.5px] border-dashed border-outline rounded-[var(--md-shape-md)] px-4 py-3 text-primary md-label-large mb-2"
          >
            <Icon name="plus" size={20} stroke={2.3} /> Create “{ingredientQuery
              .value.trim()}”
          </Pressable>
        )}
        <div class="max-h-[360px] overflow-y-auto -mx-1">
          {results.map((it) => (
            <ListItem
              key={it.id}
              headline={it.name}
              onClick={() => addIngredient(it.id)}
              trailing={<Icon name="plus" size={20} class="text-primary" />}
            />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
