import type {
  CreateMemberDto,
  MemberInterface,
  UpdateMemberDto,
} from "@/models/index.ts";
import { getKv } from "./db.ts";
import { mergeDefinedPatch } from "./merge-patch.ts";

/**
 * Members are the people of a household — credential-less by design; the
 * `User` record is the login and links to its member via `memberId`.
 * Keys are household-scoped (`["members", householdId, id]`), mirroring
 * TodoRepo. See docs/adr/0006.
 */
export class MemberRepo {
  static async create(data: CreateMemberDto): Promise<MemberInterface> {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const member: MemberInterface = { ...data, id };
    await kv.set(["members", data.householdId, id], member);
    return member;
  }

  /** Name-ascending, so the picker, the members page, and the hook agree. */
  static async getAll(householdId: string): Promise<MemberInterface[]> {
    const kv = await getKv();
    const members: MemberInterface[] = [];
    for await (
      const { value } of kv.list<MemberInterface>({
        prefix: ["members", householdId],
      })
    ) members.push(value);
    return members.sort((a, b) => a.name.localeCompare(b.name));
  }

  static async getById(
    householdId: string,
    id: string,
  ): Promise<MemberInterface | null> {
    const kv = await getKv();
    const result = await kv.get<MemberInterface>(["members", householdId, id]);
    return result.value;
  }

  static async update(
    householdId: string,
    id: string,
    patch: UpdateMemberDto,
  ): Promise<MemberInterface | null> {
    const kv = await getKv();
    const existing = await this.getById(householdId, id);
    if (!existing) return null;
    const updated = mergeDefinedPatch<MemberInterface>(existing, patch);
    await kv.set(["members", householdId, id], updated);
    return updated;
  }

  static async delete(householdId: string, id: string): Promise<void> {
    const kv = await getKv();
    await kv.delete(["members", householdId, id]);
  }

  /** How many managers the household has — the last one can never go. */
  static async countManagers(householdId: string): Promise<number> {
    return (await this.getAll(householdId)).filter((m) => m.isManager).length;
  }
}
