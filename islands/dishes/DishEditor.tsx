import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { useSearchInput } from "@/hooks/useSearchInput.ts";
import { IngredientPicker } from "@/components/dishes/IngredientPicker.tsx";
import type {
  DishInterface,
  DishTagGroupInterface,
  ItemInterface,
} from "@/models/index.ts";
import { api } from "@/services/api.ts";
import { Chip } from "@/components/md3/Chip.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { IconButton } from "@/components/md3/IconButton.tsx";
import { FullScreenDialog } from "@/components/md3/FullScreenDialog.tsx";
import { Snackbar } from "@/components/md3/Snackbar.tsx";
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
  const { query: ingredientQuery, inputRef, reset } = useSearchInput();
  const creatingIngredient = useSignal(false);
  const ingredientStatus = useSignal("");
  const primerRef = useRef<HTMLInputElement>(null);
  const pickerTrigger = useRef<HTMLElement | null>(null);
  const handoff = useSignal(false);
  const ingredientError = useSignal<{ msg: string } | null>(null);
  useEffect(() => {
    if (!ingredientError.value) return;
    const timer = setTimeout(() => (ingredientError.value = null), 5000);
    return () => clearTimeout(timer);
  }, [ingredientError.value]);

  const openPicker = (event: Event) => {
    pickerTrigger.current = event.currentTarget as HTMLElement;
    ingredientQuery.value = "";
    ingredientStatus.value = "";
    ingredientError.value = null;
    handoff.value = false;
    primerRef.current?.focus();
    pickerOpen.value = true;
  };
  const closePicker = () => {
    if (creatingIngredient.value) return;
    pickerOpen.value = false;
    handoff.value = false;
  };
  useEffect(() => {
    if (pickerOpen.value) {
      inputRef.current?.focus();
      handoff.value = document.activeElement === inputRef.current;
    } else {
      pickerTrigger.current?.focus();
    }
  }, [pickerOpen.value]);
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
      ingredientStatus.value = `${
        itemById(itemId)?.name ?? "Ingredient"
      } added`;
    }
    reset();
  };
  const removeIngredient = (itemId: string) => {
    ingredientIds.value = ingredientIds.value.filter((i) => i !== itemId);
    ingredientStatus.value = `${
      itemById(itemId)?.name ?? "Ingredient"
    } removed`;
    if (pickerOpen.value) inputRef.current?.focus();
  };
  const createCatalogueItem = async () => {
    const label = ingredientQuery.value.trim();
    if (!label || creatingIngredient.value) return;
    const existing = localItems.value.find((item) =>
      item.name.trim().toLowerCase() === label.toLowerCase()
    );
    if (existing) {
      addIngredient(existing.id);
      return;
    }
    creatingIngredient.value = true;
    ingredientError.value = null;
    // Keep the keyboard attached to the search field across the async create.
    inputRef.current?.focus();
    try {
      const created = await api.items.create({ name: label });
      if (created?.id) {
        localItems.value = [...localItems.value, created];
        addIngredient(created.id);
      } else {
        ingredientError.value = { msg: "Couldn't add ingredient — try again" };
        ingredientStatus.value = ingredientError.value.msg;
      }
    } catch {
      // The current API can still throw on transport/JSON failures.
      ingredientError.value = { msg: "Couldn't add ingredient — try again" };
      ingredientStatus.value = ingredientError.value.msg;
    } finally {
      creatingIngredient.value = false;
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
                size={44}
                iconSize={18}
                aria-label={`Remove ${
                  itemById(id)?.name ?? "Unknown ingredient"
                }`}
                onClick={() => removeIngredient(id)}
              />
            </span>
          ))}
          <Chip
            icon="plus"
            leadingCheck={false}
            onClick={openPicker}
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

      {/* Keep mobile keyboard activation inside the opening tap (§12). */}
      {(!pickerOpen.value || !handoff.value) && (
        <input
          ref={primerRef}
          type="text"
          aria-hidden="true"
          tabIndex={-1}
          class="fixed top-0 left-0 opacity-0 pointer-events-none"
          style={{ width: 1, height: 1, fontSize: 16 }}
        />
      )}
      <FullScreenDialog
        open={pickerOpen.value}
        onClose={closePicker}
        title="Ingredients"
        action={
          <Button
            variant="text"
            onClick={closePicker}
            disabled={creatingIngredient.value}
          >
            Done
          </Button>
        }
      >
        {pickerOpen.value && (
          <>
            <IngredientPicker
              items={localItems.value}
              selectedIds={ingredientIds.value}
              dishName={name.value}
              query={ingredientQuery.value}
              inputRef={inputRef}
              creating={creatingIngredient.value}
              onQuery={(value) => (ingredientQuery.value = value)}
              onReset={reset}
              onAdd={addIngredient}
              onRemove={removeIngredient}
              onCreate={createCatalogueItem}
            />
            <p role="status" aria-live="polite" class="sr-only">
              {ingredientStatus.value}
            </p>
          </>
        )}
      </FullScreenDialog>
      <Snackbar data={ingredientError.value} />
    </div>
  );
}
