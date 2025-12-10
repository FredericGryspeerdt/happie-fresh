import { useComputed, useSignal } from "@preact/signals";
import { ItemInterface } from "../models/item/index.ts";

interface ItemsProps {
  data: ItemInterface[];
}

export default function Items({ data }: ItemsProps) {
  const items = useSignal<ItemInterface[]>(data || []);
  const search = useSignal("");

  const filteredItems = useComputed(() =>
    items.value.filter((item) =>
      item?.name?.toLowerCase().includes(search.value.toLowerCase())
    )
  );

  const addItem = async () => {
    const response = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Item" }),
    });
    items.value = [...items.value, await response.json()];
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Search by name..."
        value={search}
        onInput={(e) => (search.value = e.currentTarget.value)}
        class="mb-4 p-2 border rounded w-full"
      />
      {filteredItems.value.map((item: ItemInterface) => {
        const handleChange = (values: Partial<ItemInterface>) => {
          items.value = items.value.map((i: ItemInterface) =>
            i.id === item.id ? { ...item, ...values } : i
          );
        };

        const saveItem = async () => {
          const response = await fetch("/api/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
          });
          const savedItem = await response.json();
          items.value = items.value.map((i: ItemInterface) =>
            i.id === item.id ? savedItem : i
          );
        };

        const deleteItem = async () => {
          if (!item.id) return;
          const response = await fetch("/api/items", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: item.id }),
          });

          items.value = items.value.filter((i: ItemInterface) => i !== item);
        };

        return (
          <div key={item.id}>
            {/* <input
              type="checkbox"
              checked={Item.completed}
              onClick={(e) => handleChange({ completed: !Item.completed })}
            /> */}
            <input
              value={item.name}
              onInput={(e) => handleChange({ name: e.currentTarget.value })}
            />
            <button type="button" onClick={saveItem}>
              Save
            </button>
            <button type="button" onClick={deleteItem}>
              Delete
            </button>
          </div>
        );
      })}
      <button type="button" onClick={addItem}>
        Add Item
      </button>
    </div>
  );
}
