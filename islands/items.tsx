import { useState } from "preact/hooks";
import { ItemInterface } from "../models/item/index.ts";

interface ItemsProps {
  data: ItemInterface[];
}

export default function Items({ data }: ItemsProps) {
  const [items, setItems] = useState<ItemInterface[]>(data || []);
  const [search, setSearch] = useState("");

  const filteredItems = items.filter((item) =>
    item?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const addItem = async () => {
    const response = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Item" }),
    });
    setItems([...items, await response.json()]);
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Search by name..."
        value={search}
        onInput={(e) => setSearch(e.currentTarget.value)}
        class="mb-4 p-2 border rounded w-full"
      />
      {filteredItems.map((item: ItemInterface) => {
        const handleChange = (values: Partial<ItemInterface>) => {
          setItems(
            items.map((i: ItemInterface) =>
              i.id === item.id ? { ...item, ...values } : i
            )
          );
        };

        const saveItem = async () => {
          const response = await fetch("/api/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
          });
          const savedItem = await response.json();
          setItems(
            items.map((i: ItemInterface) => (i.id === item.id ? savedItem : i))
          );
        };

        const deleteItem = async () => {
          if (!item.id) return;
          const response = await fetch("/api/items", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: item.id }),
          });

          setItems(items.filter((i: ItemInterface) => i !== item));
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
