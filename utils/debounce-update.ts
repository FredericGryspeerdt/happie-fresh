export type DebouncedMergeScheduler<TPatch extends object> = {
  schedule: (id: string, patch: Partial<TPatch>) => void;
  cancel: (id: string) => void;
  cancelAll: () => void;
  /** Immediately flush the pending merged patch for `id` (if any), skipping the delay. */
  flush: (id: string) => Promise<void>;
  /** Immediately flush every pending patch. */
  flushAll: () => Promise<void>;
};

interface SchedulerOptions<TPatch extends object> {
  delayMs?: number;
  flush: (id: string, mergedPatch: Partial<TPatch>) => void | Promise<void>;
}

export function createDebouncedMergeScheduler<
  TPatch extends object,
>(
  options: SchedulerOptions<TPatch>,
): DebouncedMergeScheduler<TPatch> {
  const delay = options.delayMs ?? 500;
  const timers = new Map<
    string,
    { timer: number; patch: Partial<TPatch> }
  >();

  const inFlight = new Map<string, Promise<void>>();
  // Preserve order per entry and expose a drain barrier for bulk operations.
  const write = (id: string, patch: Partial<TPatch>): Promise<void> => {
    const previous = inFlight.get(id);
    const work = previous
      ? previous.catch(() => {}).then(() => options.flush(id, patch))
      : Promise.resolve(options.flush(id, patch));
    const done = work.finally(() => {
      if (inFlight.get(id) === done) inFlight.delete(id);
    });
    inFlight.set(id, done);
    return done;
  };

  const schedule = (id: string, patch: Partial<TPatch>) => {
    const existing = timers.get(id);
    const nextPatch = existing ? { ...existing.patch, ...patch } : { ...patch };
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      timers.delete(id);
      void write(id, nextPatch).catch(() => {});
    }, delay) as unknown as number;
    timers.set(id, { timer, patch: nextPatch });
  };

  const cancel = (id: string) => {
    const entry = timers.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    timers.delete(id);
  };
  const cancelAll = () => {
    for (const id of timers.keys()) cancel(id);
  };
  const flush = (id: string): Promise<void> => {
    const entry = timers.get(id);
    if (!entry) return inFlight.get(id) ?? Promise.resolve();
    clearTimeout(entry.timer);
    timers.delete(id);
    return write(id, entry.patch);
  };
  const flushAll = async () => {
    await Promise.all(
      [...new Set([...timers.keys(), ...inFlight.keys()])].map(flush),
    );
  };
  return { schedule, cancel, cancelAll, flush, flushAll };
}
