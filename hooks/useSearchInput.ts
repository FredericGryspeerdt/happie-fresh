import { useComputed, useSignal } from "@preact/signals";
import { useRef } from "preact/hooks";

export function useSearchInput() {
  const query = useSignal("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSearchQuery = useComputed(() => query.value.trim().length > 0);

  const reset = () => {
    query.value = "";
    inputRef.current?.focus();
  };

  return {
    query,
    inputRef,
    hasSearchQuery,
    reset,
  };
}
