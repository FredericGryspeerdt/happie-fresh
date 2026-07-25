/** Merge a partial patch onto `current`, ignoring keys whose value is undefined,
 *  so a partial update never clobbers omitted fields. Defined falsy values
 *  (false, 0, "") still apply.
 *
 *  Repositories persist whole records to KV, so a naive `{ ...current, ...patch }`
 *  spread would write `undefined` over any field the caller left out of `patch`
 *  (JS spread copies keys whose value is undefined). Routing every repo `update`
 *  through this helper keeps partial updates non-destructive regardless of what
 *  the caller forwards. */
export function mergeDefinedPatch<T extends object>(
  current: T,
  patch: Partial<T>,
): T {
  const next = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) (next as Record<string, unknown>)[k] = v;
  }
  return next;
}
