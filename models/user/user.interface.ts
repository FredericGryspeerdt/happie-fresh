export interface UserInterface {
  id: string;
  username: string;
  passwordHash: string;
  householdId: string;
  /**
   * The member this login belongs to. A user is only a credential; the member
   * is the person (see docs/adr/0006). Optional because records created
   * before members existed lack it — UserRepo.ensureMember backfills lazily.
   */
  memberId?: string;
}
