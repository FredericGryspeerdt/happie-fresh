import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { useSearchInput } from "@/hooks/useSearchInput.ts";
import { useSnack } from "@/hooks/useSnack.ts";
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
import { DestructiveConfirmationDialog } from "@/components/md3/DestructiveConfirmationDialog.tsx";
import { navigateTo } from "@/utils/loading.ts";
import { ShoppingAmountDialog } from "@/components/shopping/ShoppingAmountDialog.tsx";
import { formatDishIngredientAmount } from "@/utils/dish-ingredient-amount.ts";
import type { ShoppingAmount } from "@/models/index.ts";

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
  const ingredientAmounts = useSignal(dish?.ingredientAmounts ?? {});
  const amountEditing = useSignal<string | null>(null);
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
  const { snack, showSnack, hideSnack } = useSnack(5000);
  const showIngredientCreateError = () => {
    const message = "Couldn't add ingredient — try again";
    showSnack(message);
    ingredientStatus.value = message;
  };

  const openPicker = (event: Event) => {
    pickerTrigger.current = event.currentTarget as HTMLElement;
    ingredientQuery.value = "";
    ingredientStatus.value = "";
    hideSnack();
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
  const deleting = useSignal(false);
  const deleteOpen = useSignal(false);
  const ingredientToRemove = useSignal<string | null>(null);

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
    ingredientToRemove.value = itemId;
  };
  const confirmIngredientRemoval = () => {
    const itemId = ingredientToRemove.value;
    if (!itemId) return;
    ingredientIds.value = ingredientIds.value.filter((i) => i !== itemId);
    const nextAmounts = { ...ingredientAmounts.value };
    delete nextAmounts[itemId];
    ingredientAmounts.value = nextAmounts;
    ingredientStatus.value = `${
      itemById(itemId)?.name ?? "Ingredient"
    } removed`;
    if (pickerOpen.value) inputRef.current?.focus();
    ingredientToRemove.value = null;
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
    hideSnack();
    // Keep the keyboard attached to the search field across the async create.
    inputRef.current?.focus();
    try {
      const created = await api.items.create({ name: label });
      if (created?.id) {
        localItems.value = [...localItems.value, created];
        addIngredient(created.id);
      } else {
        showIngredientCreateError();
      }
    } catch {
      // The current API can still throw on transport/JSON failures.
      showIngredientCreateError();
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
      ingredientAmounts: ingredientAmounts.value,
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
        showSnack("Couldn't save this dish — try again");
      }
    } catch (_) {
      saving.value = false; // network error — re-enable
      showSnack("Couldn't save this dish — try again");
    }
  };
  const remove = async () => {
    if (!dish || deleting.value || saving.value) return;
    deleting.value = true;
    try {
      if (await api.dishes.delete(dish.id)) {
        navigateTo("/menu");
      } else {
        showSnack("Couldn't delete this dish — try again");
      }
    } finally {
      deleting.value = false;
    }
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
        <div class="flex flex-col gap-2">
          {ingredientIds.value.map((id) => (
            <div
              key={id}
              class="w-full flex items-center gap-2 bg-secondary-container text-on-secondary-container rounded-[var(--md-shape-md)] px-3 py-1"
            >
              <span class="flex-1 min-w-0 md-label-large">
                {itemById(id)?.name ?? "Unknown"}
              </span>
              <Button
                variant="text"
                aria-label={ingredientAmounts.value[id]
                  ? `Edit amount for ${itemById(id)?.name ?? "ingredient"}`
                  : `Add amount for ${itemById(id)?.name ?? "ingredient"}`}
                onClick={() => amountEditing.value = id}
              >
                {ingredientAmounts.value[id]
                  ? formatDishIngredientAmount(ingredientAmounts.value[id])
                  : "Add amount"}
              </Button>
              <IconButton
                name="x"
                size={44}
                iconSize={18}
                aria-label={`Remove ${
                  itemById(id)?.name ?? "Unknown ingredient"
                }`}
                onClick={() => removeIngredient(id)}
              />
            </div>
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
          disabled={!name.value.trim() || saving.value || deleting.value}
          loading={saving.value}
          onClick={save}
        >
          {dish ? "Save changes" : "Create dish"}
        </Button>
        {dish && canDelete && (
          <Button
            variant="error"
            icon="trash"
            onClick={() => (deleteOpen.value = true)}
            loading={deleting.value}
            disabled={saving.value}
          >
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
      <DestructiveConfirmationDialog
        open={ingredientToRemove.value !== null}
        headline="Remove this ingredient?"
        supportingText={`${
          itemById(ingredientToRemove.value ?? "")?.name ?? "This ingredient"
        } will be removed from the dish draft.`}
        confirmLabel="Remove ingredient"
        onClose={() => (ingredientToRemove.value = null)}
        onConfirm={confirmIngredientRemoval}
      />
      {amountEditing.value && (
        <ShoppingAmountDialog
          key={amountEditing.value}
          name={itemById(amountEditing.value)?.name ?? "Ingredient"}
          amount={ingredientAmounts.value[amountEditing.value] ?? {
            quantity: 1,
            unit: "pieces",
          }}
          onClose={() => amountEditing.value = null}
          onSave={(amount: ShoppingAmount) => {
            ingredientAmounts.value = {
              ...ingredientAmounts.value,
              [amountEditing.value!]: amount,
            };
            amountEditing.value = null;
          }}
          onClear={ingredientAmounts.value[amountEditing.value]
            ? () => {
              const nextAmounts = { ...ingredientAmounts.value };
              delete nextAmounts[amountEditing.value!];
              ingredientAmounts.value = nextAmounts;
              amountEditing.value = null;
            }
            : undefined}
        />
      )}
      {dish && canDelete && (
        <DestructiveConfirmationDialog
          open={deleteOpen.value}
          headline="Delete this dish?"
          supportingText={`“${dish.name}” will be removed for everyone.`}
          confirmLabel="Delete dish"
          pending={deleting.value}
          onClose={() => (deleteOpen.value = false)}
          onConfirm={remove}
        />
      )}
      <Snackbar data={snack.value} />
    </div>
  );
}
