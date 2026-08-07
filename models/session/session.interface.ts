export interface SessionInterface {
  id: string;
  userId: string;
  // Sliding idle expiry: renewed to now + 30d on activity, capped at
  // absoluteExpiresAt.
  expiresAt: Date;
  // Hard ceiling fixed at login (login + 90d). Optional: sessions created
  // before sliding expiry lack it and are never renewed.
  absoluteExpiresAt?: Date;
}
