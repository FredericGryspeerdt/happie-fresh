import { useComputed, useSignal } from "@preact/signals";
import { useSignalRef } from "@preact/signals/utils";

export function useSearchBox<T>(
  initialItems: T[],
  filterFn: (query: string, item: T) => boolean,
) {
  const items = useSignal<T[]>(initialItems || []);
  const query = useSignal("");
  const inputRef = useSignalRef<HTMLInputElement | null>(null);
  const hasSearchQuery = useComputed(() => query.value.trim().length > 0);

  const results = useComputed(() => {
    const q = query.value.trim();
    if (q === "") return items.value;
    return items.value?.filter((item) => filterFn(q, item)) || [];
  });
  

  const reset = () => {
    query.value = "";
    inputRef.current!.value = "";
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
