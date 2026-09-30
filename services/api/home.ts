import type { HomeData } from "@/services/home.ts";
export const home = {
  async get(): Promise<HomeData | null> {
    try {
      const res = await fetch("/api/home", { cache: "no-store" });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  },
};
