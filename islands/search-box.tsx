// @ts-types="preact"
import { RefObject } from "preact";
import { For, Show } from "@preact/signals/utils";
import { useComputed, useSignal } from "@preact/signals";
import { useRef } from "preact/hooks";

export interface SearchBoxProps<T> {
  inputRef?: RefObject<HTMLInputElement>;
  items?: T[];
  filterFn?: (searchString: string, item: T) => boolean;
  filteredItems?: T[];
  listItemRenderer?: (item: T) => preact.JSX.Element;
  fallbackRenderer?: (searchString: string) => preact.JSX.Element;
}
export default function SearchBox<T>({
  items,
  filterFn,
  inputRef,
  listItemRenderer,
  fallbackRenderer,
}: SearchBoxProps<T>) {
  const search = useSignal(""); // search input value
  const initialItems = useSignal<T[]>(items || []);
  const hasSearchQuery = useComputed(() => search.value.trim().length > 0);
  const filteredItems = useComputed(() => {
    return filterFn
      ? initialItems?.value.filter((item) => filterFn(search.value, item))
      : [];
  });
  const onInput = (val: string) => {
    search.value = val;
  };

  return (
    <div>
      <div class="relative">
        <input
          id="search-input"
          ref={inputRef}
          type="text"
          placeholder="Search items..."
          value={search}
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
        {/* Only show results dropdown if there is a search query */}
      </div>
      <Show when={hasSearchQuery}>
        <ul class="space-y-2 mt-4 absolute left-0 right-0 px-4 bg-white/95 backdrop-blur-sm pb-4 shadow-lg rounded-b-2xl border-b border-gray-100">
          <For
            each={filteredItems}
            fallback={filteredItems.value.length === 0 && (
              fallbackRenderer
                ? (
                  fallbackRenderer(search.value)
                )
                : <>Niets gevonden</>
            )}
          >
            {(item) => (listItemRenderer
              ? (
                listItemRenderer(item)
              )
              : <p>No</p>)}
          </For>
        </ul>
      </Show>
    </div>
  );
}
