export type DebouncedMergeScheduler<TPatch extends object> = {
  schedule: (id: string, patch: Partial<TPatch>) => void;
  cancel: (id: string) => void;
  cancelAll: () => void;
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

  const schedule = (id: string, patch: Partial<TPatch>) => {
    const existing = timers.get(id);
    const nextPatch = existing ? { ...existing.patch, ...patch } : { ...patch };
    if (existing) {
      clearTimeout(existing.timer);
    }
    const timer = setTimeout(async () => {
      timers.delete(id);
      console.log("🚀 ~ schedule ~ flushing:");
      await options.flush(id, nextPatch);
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
    for (const [id, entry] of timers.entries()) {
      clearTimeout(entry.timer);
      timers.delete(id);
    }
  };

  return { schedule, cancel, cancelAll };
}
