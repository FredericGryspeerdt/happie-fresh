import { useState } from "preact/hooks";
import { Item, ItemInterface } from "../models/item/index.ts";
import { ItemRepo } from "../database/item.repo.ts";

interface ItemsProps {
  data: ItemInterface[];
}

export default function Items({ data }: ItemsProps) {
  const [items, setItems] = useState<ItemInterface[]>(data);

  const addItem = () => {
    setItems([...items, new Item("")]);
  };

  return (
    <div>
      {items.map((item: ItemInterface) => {
        const handleChange = (values: Partial<ItemInterface>) => {
          setItems(
            items.map((i: ItemInterface) =>
              i === item ? { ...item, ...values } : i
            )
          );
        };

        const saveItem = async () => {
          await ItemRepo.create(item);
          setItems(items.map((i: ItemInterface) => (i === item ? item : i)));
        };

        const deleteItem = async () => {
          if (!item.id) return;
          await ItemRepo.delete(item.id);
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
            <button onClick={saveItem}>Save</button>
            <button onClick={deleteItem}>Delete</button>
          </div>
        );
      })}
      <button onClick={addItem}>Add Item</button>
    </div>
  );
}
