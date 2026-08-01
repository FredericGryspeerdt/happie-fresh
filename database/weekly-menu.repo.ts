import type {
  MenuEntryInterface,
  Weekday,
  WeeklyMenuInterface,
} from "@/models/index.ts";
import { getKv } from "./db.ts";

export class WeeklyMenuRepo {
  private static key(householdId: string) {
    return ["weekly_menu", householdId] as const;
  }

  static async get(householdId: string): Promise<WeeklyMenuInterface> {
    const kv = await getKv();
    const res = await kv.get<WeeklyMenuInterface>(this.key(householdId));
    return res.value ?? { householdId, entries: [] };
  }

  // Atomic compare-and-swap with a bounded retry loop, so concurrent mutations
  // on the same household never silently clobber one another. `apply` returns
  // the next value to persist, or null for a no-op (dedup / missing entry) —
  // in which case nothing is written and the current value is returned as-is.
  // Stamps updatedAt on every persisted change.
  private static async mutate(
    householdId: string,
    apply: (current: WeeklyMenuInterface) => WeeklyMenuInterface | null,
  ): Promise<WeeklyMenuInterface> {
    const kv = await getKv();
    const key = this.key(householdId);
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await kv.get<WeeklyMenuInterface>(key);
      const current = res.value ?? { householdId, entries: [] };
      const next = apply(current);
      if (next === null) return current; // no-op — no write
      const stamped: WeeklyMenuInterface = {
        ...next,
        updatedAt: new Date().toISOString(),
      };
      const ok = await kv.atomic()
        .check({ key, versionstamp: res.versionstamp })
        .set(key, stamped)
        .commit();
      if (ok.ok) return stamped;
    }
    throw new Error("WeeklyMenuRepo: concurrent update conflict after retries");
  }

  static async addDish(
    householdId: string,
    dishId: string,
  ): Promise<WeeklyMenuInterface> {
    return await this.mutate(householdId, (current) => {
      if (current.entries.some((e) => e.dishId === dishId)) return null; // dedup
      const entry: MenuEntryInterface = {
        id: crypto.randomUUID(),
        dishId,
        day: null,
      };
      return { ...current, entries: [...current.entries, entry] };
    });
  }

  static async setDay(
    householdId: string,
    entryId: string,
    day: Weekday | null,
  ): Promise<WeeklyMenuInterface> {
    return await this.mutate(householdId, (current) => {
      if (!current.entries.some((e) => e.id === entryId)) return null;
      return {
        ...current,
        entries: current.entries.map((e) =>
          e.id === entryId ? { ...e, day } : e
        ),
      };
    });
  }

  static async removeEntry(
    householdId: string,
    entryId: string,
  ): Promise<WeeklyMenuInterface> {
    return await this.mutate(householdId, (current) => ({
      ...current,
      entries: current.entries.filter((e) => e.id !== entryId),
    }));
  }

  static async clear(householdId: string): Promise<WeeklyMenuInterface> {
    return await this.mutate(householdId, (current) => ({
      ...current,
      entries: [],
    }));
  }
}
