// @ts-types="preact"
import { RefObject } from "preact";
import { For, Show } from "@preact/signals/utils";
import { Signal, useComputed } from "@preact/signals";

export interface SearchBoxProps<T> {
  query: Signal<string>;
  results?: Signal<T[]>;
  inputRef?: RefObject<HTMLInputElement>;
  renderItem?: (item: T) => preact.JSX.Element;
  renderEmpty?: (query: string) => preact.JSX.Element;
  placeholder?: string;
}

export default function SearchBox<T>({
  query,
  results,
  inputRef,
  renderItem,
  renderEmpty,
  placeholder = "Search items...",
}: SearchBoxProps<T>) {
  const hasSearchQuery = useComputed(() => query.value.trim().length > 0 && !!renderItem && !!results);

  const onInput = (val: string) => {
    query.value = val.trim();
  };

  return (
    <div>
      <div class="relative">
        <input
          id="search-input"
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onInput={(e) => onInput(e.currentTarget.value)}
          class="w-full p-4 pl-12 bg-white border border-gray-200 rounded-2xl shadow-sm text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
        />
        <div class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
        </div>
      </div>
      <Show when={hasSearchQuery}>
          <ul class="space-y-2 mt-4 absolute left-0 right-0 px-4 bg-white/95 backdrop-blur-sm pb-4 shadow-lg rounded-b-2xl border-b border-gray-100 z-10">
            <For each={results!}>
              {(item) => renderItem!(item)}
            </For>
            <Show when={() => results!.value.length === 0}>
              {renderEmpty
                ? renderEmpty(query.value)
                : <div class="p-4 text-center text-gray-500">No results found</div>}
            </Show>
          </ul>
      </Show>
    </div>
  );
}
