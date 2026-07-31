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

  // Read-modify-write so a single racing action loses at most itself, never the
  // whole menu. Stamps updatedAt on every persisted change.
  private static async save(
    menu: WeeklyMenuInterface,
  ): Promise<WeeklyMenuInterface> {
    const kv = await getKv();
    const next: WeeklyMenuInterface = {
      ...menu,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(this.key(menu.householdId), next);
    return next;
  }

  static async addDish(
    householdId: string,
    dishId: string,
  ): Promise<WeeklyMenuInterface> {
    const menu = await this.get(householdId);
    if (menu.entries.some((e) => e.dishId === dishId)) return menu; // dedup
    const entry: MenuEntryInterface = {
      id: crypto.randomUUID(),
      dishId,
      day: null,
    };
    return await this.save({ ...menu, entries: [...menu.entries, entry] });
  }

  static async setDay(
    householdId: string,
    entryId: string,
    day: Weekday | null,
  ): Promise<WeeklyMenuInterface> {
    const menu = await this.get(householdId);
    if (!menu.entries.some((e) => e.id === entryId)) return menu;
    return await this.save({
      ...menu,
      entries: menu.entries.map((e) => (e.id === entryId ? { ...e, day } : e)),
    });
  }

  static async removeEntry(
    householdId: string,
    entryId: string,
  ): Promise<WeeklyMenuInterface> {
    const menu = await this.get(householdId);
    return await this.save({
      ...menu,
      entries: menu.entries.filter((e) => e.id !== entryId),
    });
  }

  static async clear(householdId: string): Promise<WeeklyMenuInterface> {
    const menu = await this.get(householdId);
    return await this.save({ ...menu, entries: [] });
  }
}
