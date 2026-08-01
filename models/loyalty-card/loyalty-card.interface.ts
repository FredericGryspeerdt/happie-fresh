/**
 * The barcode symbologies we support for loyalty cards. Values map directly to
 * bwip-js `bcid` names (see `utils/barcode.ts`). Linear numeric formats cover
 * the overwhelming majority of retail loyalty cards; `qrcode` covers app-style
 * cards; `code128` is the flexible alphanumeric fallback.
 */
export type BarcodeFormat = "ean13" | "ean8" | "upca" | "code128" | "qrcode";

export interface LoyaltyCardInterface {
  id: string;
  householdId: string;
  /** Human label for identification, e.g. "Delhaize", "Air Miles". */
  label: string;
  /** The card number / barcode payload that gets encoded. */
  value: string;
  format: BarcodeFormat;
  /** Optional accent colour for the wallet tile (a preset token key). */
  color?: string;
  createdAt?: string;
  createdBy?: string;
}

// Derived type for creation (no ID — the server mints it).
export type CreateLoyaltyCardDto = Omit<LoyaltyCardInterface, "id">;

/**
 * What the client sends to create a card. The server fills in `householdId`,
 * `createdBy`, `createdAt` and `id` from the session — the client never sends
 * (and cannot spoof) the household.
 */
export type LoyaltyCardInput = Pick<
  LoyaltyCardInterface,
  "label" | "value" | "format" | "color"
>;

// Derived type for patch/update: never the id or householdId, everything else optional.
export type UpdateLoyaltyCardDto = Partial<
  Omit<LoyaltyCardInterface, "id" | "householdId">
>;
