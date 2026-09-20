import { MemberRepo } from "@/database/member.repo.ts";

export async function resolveAssignee(
  householdId: string,
  raw: unknown,
): Promise<string | null | undefined> {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return undefined;
  return await MemberRepo.getById(householdId, raw) ? raw : undefined;
}
