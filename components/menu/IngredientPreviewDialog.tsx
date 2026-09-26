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
  const groups = [...p.categories, { id: "", label: "Overige artikelen" }].map(
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
        title="Kijk wat je nog in huis hebt"
        onClose={p.onClose}
        onBack={locked ? undefined : p.onBack}
        backLabel="Terug naar gerechten kiezen"
        footer={
          <>
            <p
              class="md-body-medium text-on-surface-variant mb-2"
              aria-live="polite"
            >
              {p.selectedCount} geselecteerd ·{" "}
              {eligible.length - p.selectedCount} overgeslagen
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
                ? "Opnieuw toevoegen"
                : `Toevoegen ${p.selectedCount} ${
                  p.selectedCount === 1 ? "artikel" : "artikelen"
                }`}
            </Button>
          </>
        }
      >
        <p class="md-title-medium mt-3">
          Voor {p.dishCount} {p.dishCount === 1 ? "gerecht" : "gerechten"}{" "}
          deze week
        </p>
        <p class="md-body-medium text-on-surface-variant mt-1">
          Kies wat je voor deze gerechten wilt toevoegen. Deze hoeveelheden
          komen bij wat al op je lijst staat.
        </p>
        <div class="my-5 p-4 bg-surface-clow rounded-[var(--md-shape-xl)] flex items-center gap-3">
          <Icon name="cart" size={28} />
          <div class="flex-1 min-w-0">
            <p class="md-body-small text-on-surface-variant">Toevoegen aan</p>
            <p class="md-title-medium break-words">{p.listName}</p>
          </div>
          {p.canChangeList && (
            <Button variant="text" disabled={locked} onClick={p.onChangeList}>
              Wijzigen
            </Button>
          )}
        </div>
        {!p.rows.length && !p.emptyDishes.length && (
          <p class="md-body-medium py-6">
            Niets om toe te voegen — kies gerechten met ingrediënten.
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
                        ? "Deze keer overslaan"
                        : `${row.state === "bought" ? "Opnieuw kopen · " : ""}${
                          row.dishNames.join(" · ")
                        }`}
                    </span>
                    {hasAmountConflict(row) && (
                      <span class="md-body-small text-on-surface-variant block mt-1">
                        Nodig voor de gerechten:{" "}
                        {(row.requirements ?? []).map((r) =>
                          `${r.dishName}: ${
                            r.amount
                              ? formatShoppingAmount(
                                r.amount.quantity,
                                r.amount.unit,
                              )
                              : "hoeveelheid niet ingesteld"
                          }`
                        ).join(" · ")}
                        {!!row.missingDishNames?.length && (
                          <span class="block" role="status">
                            Hoeveelheid niet ingesteld voor{" "}
                            {row.missingDishNames.join(", ")}
                          </span>
                        )}
                        {row.amountIssue &&
                          p.amounts[row.itemId] === undefined && (
                          <span class="block" role="alert">
                            {row.amountIssue === "incompatible"
                              ? "Kies één hoeveelheid voor deze gerechten"
                              : "De totale hoeveelheid is te groot of te precies; kies een hoeveelheid"}
                          </span>
                        )}
                      </span>
                    )}
                    {row.existingAmount && (
                      <span class="md-body-small text-on-surface-variant block mt-1">
                        Staat al op je lijst: {formatShoppingAmount(
                          row.existingAmount.quantity,
                          row.existingAmount.unit,
                        )}
                        <span class="block">
                          {!p.isSelected(row)
                            ? "De bestaande hoeveelheid blijft behouden"
                            : (() => {
                              const total = addShoppingAmounts(
                                row.existingAmount,
                                amountFor(row.itemId),
                              );
                              return total
                                ? `Totaal na toevoegen: ${
                                  formatShoppingAmount(
                                    total.quantity,
                                    total.unit,
                                  )
                                }`
                                : "Kies een passende hoeveelheid";
                            })()}
                        </span>
                      </span>
                    )}
                  </span>
                </label>
                <button
                  type="button"
                  disabled={locked}
                  aria-label={`Hoeveelheid wijzigen voor ${row.name}`}
                  onClick={() => editing.value = row}
                  class="shrink-0 min-h-12 px-3 rounded-full bg-surface-chigh text-primary md-label-large focus-visible:outline-2"
                >
                  {row.amountIssue && p.amounts[row.itemId] === undefined
                    ? "Hoeveelheid kiezen"
                    : `Toevoegen ${
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
            <h3 class="md-title-small">Nog geen ingrediënten</h3>
            {p.emptyDishes.map((d) => (
              <Button
                key={d.id}
                variant="text"
                disabled={locked}
                onClick={() => p.onOpenDish(d)}
              >
                {d.name} — ingrediënten toevoegen
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
