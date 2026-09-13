import { signal } from "@preact/signals";
import type {
  MemberInput,
  MemberInterface,
  UpdateMemberDto,
} from "@/models/index.ts";
import { api } from "@/services/api.ts";

const byName = (a: MemberInterface, b: MemberInterface) =>
  a.name.localeCompare(b.name);

/**
 * Household members CRUD for islands. Same conventions as useLoyaltyCards:
 * pessimistic create (the server mints the id), optimistic update/remove with
 * snapshot rollback — callers surface failures via a snackbar (ui-ux-patterns
 * §1–§3). Instantiate once per island: `useMemo(() => useMembers(initial), [])`.
 */
export function useMembers(initial: MemberInterface[]) {
  const members = signal<MemberInterface[]>([...initial].sort(byName));

  const addMember = async (
    input: MemberInput,
  ): Promise<MemberInterface | null> => {
    const created = await api.members.create(input);
    if (created) {
      members.value = [...members.value, created].sort(byName);
    }
    return created;
  };

  const updateMember = async (
    id: string,
    patch: UpdateMemberDto,
  ): Promise<MemberInterface | null> => {
    const snapshot = members.value;
    members.value = members.value
      .map((m) => (m.id === id ? { ...m, ...patch } : m))
      .sort(byName);
    const saved = await api.members.update(id, patch);
    if (!saved) members.value = snapshot; // rollback — caller shows a snackbar
    return saved;
  };

  const removeMember = async (id: string): Promise<boolean> => {
    const snapshot = members.value;
    members.value = members.value.filter((m) => m.id !== id);
    const ok = await api.members.remove(id);
    if (!ok) members.value = snapshot; // rollback — caller shows a snackbar
    return ok;
  };

  return { members, addMember, updateMember, removeMember };
}
