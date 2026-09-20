import type {
  MemberInput,
  MemberInterface,
  UpdateMemberDto,
} from "@/models/index.ts";
import { deleteResource } from "./delete-resource.ts";

export const members = {
  getAll: async (): Promise<MemberInterface[]> => {
    const res = await fetch("/api/members");
    if (!res.ok) return [];
    return res.json();
  },
  create: async (input: MemberInput): Promise<MemberInterface | null> => {
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    return res.json();
  },
  update: async (
    id: string,
    patch: UpdateMemberDto,
  ): Promise<MemberInterface | null> => {
    const res = await fetch(`/api/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    return res.json();
  },
  remove: async (id: string): Promise<boolean> =>
    await deleteResource(`/api/members/${id}`),
  claim: async (id: string): Promise<boolean> => {
    const res = await fetch("/api/members/acting", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: id }),
    });
    return res.ok;
  },
};
