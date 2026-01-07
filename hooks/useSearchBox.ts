import { useComputed, useSignal } from "@preact/signals";
import { useRef } from "preact/hooks";

export function useSearchBox<T>(
  initialItems: T[],
  filterFn: (query: string, item: T) => boolean,
) {
  const items = useSignal<T[]>(initialItems || []);
  const query = useSignal("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSearchQuery = useComputed(() => query.value.trim().length > 0);

  const results = useComputed(() => {
    const q = query.value.trim();
    if (q === "") return [];
    return items.value?.filter((item) => filterFn(q, item)) || [];
  });

  const reset = () => {
    query.value = "";
    inputRef.current?.focus();
  };

  return {
    items,
    query,
    inputRef,
    results,
    hasSearchQuery,
    reset,
  };
}
