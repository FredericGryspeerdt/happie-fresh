import { useComputed, useSignal } from "@preact/signals";
interface EntityInterface {
  id: string;
}

interface DictionaryInterface<T extends EntityInterface> {
  [key: string]: T;
}
// Constrain T to have an 'id' so we can reliably find/update items
export function useCollection<T extends EntityInterface>(initialItems: T[]) {
  const collection = useSignal<T[]>(initialItems || []);
  const dictionary = useComputed(() => {
    return collection.value.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {} as DictionaryInterface<T>);
  });

  function get(id: string): T | undefined {
    return dictionary.value[id];
  }

  function addOne(item: T) {
    collection.value = [...collection.value, item];
  }

  function removeOne(id: string) {
    collection.value = collection.value.filter((i) => i.id !== id);
  }

  function updateOne(id: string, patch: Partial<T>) {
    collection.value = collection.value.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    );
  }

  return {
    collection,
    dictionary,
    get,
    addOne,
    removeOne,
    updateOne,
  };
}
