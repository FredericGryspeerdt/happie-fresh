import { JSX } from "preact";
import { ReadonlySignal, Signal, useComputed } from "@preact/signals";
import { For, Show } from "@preact/signals/utils";

export interface ListProps<T> {
  items: Signal<T[]> | ReadonlySignal<T[]>;
  renderItem: (item: T, index: number) => JSX.Element;
  renderEmpty: () => JSX.Element;
  class?: string;
}

export function List<T extends { id: string }>({
  items,
  renderItem,
  renderEmpty,
  class: className = "space-y-4",
}: ListProps<T>) {
  const hasItems = useComputed(() => items.value.length > 0);

  return (
    <ul class={className}>
      <Show when={hasItems} fallback={renderEmpty()}>
        <For each={items} fallback={<li>Loading...</li>}>
          {(item, index) => (
            <li key={item.id}>
              {renderItem(item, index)}
            </li>
          )}
        </For>
      </Show>
    </ul>
  );
}
