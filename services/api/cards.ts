import type { LoyaltyCardInput, LoyaltyCardInterface } from "@/models/index.ts";
import { deleteResource } from "./delete-resource.ts";

export const cards = {
  getAll: async (): Promise<LoyaltyCardInterface[]> => {
    const res = await fetch("/api/cards");
    if (!res.ok) return [];
    return res.json();
  },
  create: async (
    card: LoyaltyCardInput,
  ): Promise<LoyaltyCardInterface | null> => {
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    if (!res.ok) return null;
    return res.json();
  },
  update: async (
    id: string,
    card: LoyaltyCardInput,
  ): Promise<LoyaltyCardInterface | null> => {
    const res = await fetch("/api/cards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...card }),
    });
    if (!res.ok) return null;
    return res.json();
  },
  delete: async (id: string): Promise<boolean> =>
    await deleteResource("/api/cards", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }),
};
