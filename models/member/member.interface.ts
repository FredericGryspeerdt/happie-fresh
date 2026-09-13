export interface MemberInterface {
  id: string;
  householdId: string;
  /** What the household calls them — a first name or nickname ("Mama", "Bo"). */
  name: string;
  /** Preset avatar colour key — one of AVATAR_COLORS (see ./avatar.ts). */
  color: string;
  /** Preset avatar emoji glyph. */
  emoji: string;
  /**
   * A manager is a member the household trusts with the sharp knives:
   * managing members and destroying household data. A household always has
   * at least one. Deliberately a boolean, not a role enum — and deliberately
   * no age or birthdate (data minimisation for minors). See docs/adr/0006.
   */
  isManager: boolean;
}

// Derived type for creation (no ID — the server mints it).
export type CreateMemberDto = Omit<MemberInterface, "id">;

// Patch/update: never the id or householdId, everything else optional.
export type UpdateMemberDto = Partial<
  Omit<MemberInterface, "id" | "householdId">
>;

/**
 * What the client sends to create a member. The server fills in `householdId`
 * and `id` — the client never sends (and cannot spoof) the household.
 */
export type MemberInput = Pick<MemberInterface, "name" | "color" | "emoji"> & {
  isManager?: boolean;
};
