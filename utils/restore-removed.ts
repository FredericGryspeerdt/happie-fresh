/** Restore just the removed row, preserving unrelated in-flight changes. */
export function restoreRemoved<T extends { id?: string }>(
  current: T[],
  snapshot: T[],
  id: string,
): T[] {
  if (current.some((row) => row.id === id)) return current;
  const index = snapshot.findIndex((row) => row.id === id);
  if (index < 0) return current;
  const restored = [...current];
  restored.splice(Math.min(index, restored.length), 0, snapshot[index]);
  return restored;
}
