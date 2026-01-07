import { useComputed, useSignal } from "@preact/signals";
import { useRef } from "preact/hooks";

export function useSearchBox<T>(
  initialItems: T[],
  onSearchChange: (searchString: string) => T[],
) {
  const items = useSignal<T[]>(initialItems || []);
  const search = useSignal("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasSearchQuery = useComputed(() => search.value.trim().length > 0);

  const filteredItems = useComputed(() => {
    if (search.value.trim() === "") return [];
    return onSearchChange(search.value);
  });



  return {
    items,
    search,
    searchInputRef,
    filteredItems,
    hasSearchQuery,
  };
}
