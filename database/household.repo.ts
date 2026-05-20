import { HouseholdInterface } from "@/models/index.ts";
import { getKv } from "./db.ts";

export class HouseholdRepo {
  static async create(name: string): Promise<HouseholdInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const household: HouseholdInterface = { id, name };
    await kv.set(["households", id], household);
    return household;
  }

  static async getById(id: string): Promise<HouseholdInterface | null> {
    const kv = await getKv();
    const result = await kv.get<HouseholdInterface>(["households", id]);
    return result.value;
  }
}
