import { useSignal } from "@preact/signals";
import { CategoryInterface } from "../models/index.ts";

export function useCategoryManagement(initialCategories: Required<CategoryInterface>[] = []) {
  const editingId = useSignal<string | null>(null);
  const editingLabel = useSignal("");
  const newCategoryLabel = useSignal("");
  const categories = useSignal<Required<CategoryInterface>[]>(initialCategories);

  return {
    editingId,
    editingLabel,
    newCategoryLabel,
    categories,
  };
}
