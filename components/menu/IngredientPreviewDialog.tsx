import { useSignal } from "@preact/signals";
import type {
  CategoryInterface,
  DishInterface,
  ItemInterface,
} from "@/models/index.ts";
import type { IngredientRow } from "@/utils/menu-ingredients.ts";
import {
  addShoppingAmounts,
  formatShoppingAmount,
  type ShoppingAmount,
} from "@/utils/shopping-amount.ts";
import { FullScreenDialog } from "@/components/md3/FullScreenDialog.tsx";
import { RoundCheck } from "@/components/md3/RoundCheck.tsx";
import { Icon } from "@/components/md3/Icon.tsx";
import { Button } from "@/components/md3/Button.tsx";
import { ShoppingAmountDialog } from "@/components/shopping/ShoppingAmountDialog.tsx";

interface Props {
  open: boolean;
  listName: string;
  canChangeList: boolean;
  onChangeList: () => void;
  rows: IngredientRow[];
  isSelected: (row: IngredientRow) => boolean;
  emptyDishes: DishInterface[];
  selectedCount: number;
  dishCount: number;
  adding: boolean;
  draftLocked?: boolean;
  retrying?: boolean;
  message?: string | null;
  invalidAmount?: boolean;
  onToggle: (id: string) => void;
  onConfirm: () => void;
  onOpenDish: (dish: DishInterface) => void;
  onClose: () => void;
  onBack: () => void;
  categories: CategoryInterface[];
  items: ItemInterface[];
  amounts: Record<string, ShoppingAmount>;
  onAmount: (id: string, amount: ShoppingAmount) => void;
}

export function IngredientPreviewDialog(p: Props) {
  const editing = useSignal<IngredientRow | null>(null);
  const eligible = p.rows;
  const locked = p.adding || p.draftLocked;
  const categoryByItem = new Map(p.items.map((i) => [i.id, i.categoryId]));
  const known = new Set(p.categories.map((c) => c.id));
  const groups = [...p.categories, { id: "", label: "Other items" }].map(
    (c) => ({
      ...c,
      rows: eligible.filter((r) => {
        const id = categoryByItem.get(r.itemId);
        return (id && known.has(id) ? id : "") === c.id;
      }),
    }),
  ).filter((c) => c.rows.length);
  const amountFor = (id: string): ShoppingAmount =>
    p.amounts[id] ?? eligible.find((row) =>
      row.itemId === id
    )?.requirements?.find(
      (r) => r.amount,
    )?.amount ?? { quantity: 1, unit: "pieces" };
  const hasAmountConflict = (row: IngredientRow): boolean =>
    !!row.amountIssue || (row.missingDishNames?.length ?? 0) > 0 ||
    (!!row.existingAmount && !!row.suggestedAmount &&
      !addShoppingAmounts(row.existingAmount, row.suggestedAmount));
  return (
    <>
      <FullScreenDialog
        open={p.open}
        title="Check your cupboards"
        onClose={p.onClose}
        onBack={locked ? undefined : p.onBack}
        backLabel="Back to shopping dishes"
        footer={
          <>
            <p
              class="md-body-medium text-on-surface-variant mb-2"
              aria-live="polite"
            >
              {p.selectedCount} selected · {eligible.length - p.selectedCount}
              {" "}
              skipped
            </p>
            {p.message && (
              <p role="alert" class="md-body-small text-error mb-2">
                {p.message}
              </p>
            )}
            <Button
              full
              loading={p.adding}
              disabled={!p.selectedCount || (!p.retrying && p.invalidAmount)}
              onClick={p.onConfirm}
            >
              {p.retrying
                ? "Retry addition"
                : `Add ${p.selectedCount} ${
                  p.selectedCount === 1 ? "item" : "items"
                }`}
            </Button>
          </>
        }
      >
        <p class="md-title-medium mt-3">
          For {p.dishCount} {p.dishCount === 1 ? "dish" : "dishes"} this week
        </p>
        <p class="md-body-medium text-on-surface-variant mt-1">
          Choose what to add for these dishes. Amounts here are added to
          anything already on your list.
        </p>
        <div class="my-5 p-4 bg-surface-clow rounded-[var(--md-shape-xl)] flex items-center gap-3">
          <Icon name="cart" size={28} />
          <div class="flex-1 min-w-0">
            <p class="md-body-small text-on-surface-variant">Adding to</p>
            <p class="md-title-medium break-words">{p.listName}</p>
          </div>
          {p.canChangeList && (
            <Button variant="text" disabled={locked} onClick={p.onChangeList}>
              Change
            </Button>
          )}
        </div>
        {!p.rows.length && !p.emptyDishes.length && (
          <p class="md-body-medium py-6">
            Nothing to add — choose dishes with ingredients.
          </p>
        )}
        {groups.map((g) => (
          <section key={g.id} class="mb-5">
            <h3 class="md-label-large uppercase tracking-wide text-primary py-2">
              {g.label}
            </h3>
            {g.rows.map((row) => (
              <div
                key={row.itemId}
                class="flex items-center gap-2 border-b border-outline-variant min-h-18"
              >
                <label class="relative flex-1 min-w-0 flex items-center gap-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    class="absolute opacity-0 peer"
                    checked={p.isSelected(row)}
                    disabled={locked}
                    onChange={() => p.onToggle(row.itemId)}
                  />
                  <span class="peer-focus-visible:outline-2 peer-focus-visible:outline-primary rounded-full">
                    <RoundCheck checked={p.isSelected(row)} />
                  </span>
                  <span class="min-w-0">
                    <span class="md-title-medium block break-words">
                      {row.name}
                    </span>
                    <span class="md-body-small text-on-surface-variant block">
                      {!p.isSelected(row)
                        ? "Skipping this time"
                        : `${row.state === "bought" ? "Buy again · " : ""}${
                          row.dishNames.join(" · ")
                        }`}
                    </span>
                    {hasAmountConflict(row) && (
                      <span class="md-body-small text-on-surface-variant block mt-1">
                        Dish requirements: {(row.requirements ?? []).map((r) =>
                          `${r.dishName}: ${
                            r.amount
                              ? formatShoppingAmount(
                                r.amount.quantity,
                                r.amount.unit,
                              )
                              : "amount not set"
                          }`
                        ).join(" · ")}
                        {!!row.missingDishNames?.length && (
                          <span class="block" role="status">
                            Amount not set for {row.missingDishNames.join(", ")}
                          </span>
                        )}
                        {row.amountIssue &&
                          p.amounts[row.itemId] === undefined && (
                          <span class="block" role="alert">
                            {row.amountIssue === "incompatible"
                              ? "Choose one amount for these dishes"
                              : "The combined amount is too large or too precise; choose an amount"}
                          </span>
                        )}
                      </span>
                    )}
                    {row.existingAmount && (
                      <span class="md-body-small text-on-surface-variant block mt-1">
                        Already on your list: {formatShoppingAmount(
                          row.existingAmount.quantity,
                          row.existingAmount.unit,
                        )}
                        <span class="block">
                          {!p.isSelected(row)
                            ? "Existing amount stays unchanged"
                            : (() => {
                              const total = addShoppingAmounts(
                                row.existingAmount,
                                amountFor(row.itemId),
                              );
                              return total
                                ? `Total after adding: ${
                                  formatShoppingAmount(
                                    total.quantity,
                                    total.unit,
                                  )
                                }`
                                : "Choose a compatible amount";
                            })()}
                        </span>
                      </span>
                    )}
                  </span>
                </label>
                <button
                  type="button"
                  disabled={locked}
                  aria-label={`Edit amount for ${row.name}`}
                  onClick={() => editing.value = row}
                  class="shrink-0 min-h-12 px-3 rounded-full bg-surface-chigh text-primary md-label-large focus-visible:outline-2"
                >
                  {row.amountIssue && p.amounts[row.itemId] === undefined
                    ? "Choose amount"
                    : `Add ${
                      formatShoppingAmount(
                        amountFor(row.itemId).quantity,
                        amountFor(row.itemId).unit,
                      )
                    }`}
                </button>
              </div>
            ))}
          </section>
        ))}
        {!!p.emptyDishes.length && (
          <section>
            <h3 class="md-title-small">No ingredients yet</h3>
            {p.emptyDishes.map((d) => (
              <Button
                key={d.id}
                variant="text"
                disabled={locked}
                onClick={() => p.onOpenDish(d)}
              >
                {d.name} — add ingredients
              </Button>
            ))}
          </section>
        )}
      </FullScreenDialog>
      {p.open && editing.value && (
        <ShoppingAmountDialog
          key={editing.value.itemId}
          name={editing.value.name}
          amount={amountFor(editing.value.itemId)}
          additional
          existingAmount={editing.value.existingAmount}
          onClose={() => editing.value = null}
          onSave={(amount) => {
            p.onAmount(editing.value!.itemId, amount);
            editing.value = null;
          }}
        />
      )}
    </>
  );
}
