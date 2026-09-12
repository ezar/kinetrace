/** Moving an item in a list, which is all reordering a routine really is. */

/**
 * A copy of `items` with the entry at `from` moved to `to`. Out of range
 * positions leave the list alone, so a drag that ends over nothing is a no-op
 * rather than a surprise.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to) return [...items];
  if (from < 0 || from >= items.length) return [...items];
  if (to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}
