import { define, requireManager } from "@/utils/index.ts";
import { LoyaltyCardRepo } from "@/database/index.ts";
import type { BarcodeFormat } from "@/models/index.ts";
import { validateBarcode } from "@/utils/barcode.ts";

const FORMATS = new Set<BarcodeFormat>([
  "ean13",
  "ean8",
  "upca",
  "code128",
  "qrcode",
]);

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const cards = await LoyaltyCardRepo.getAll(householdId);
    return json(cards, 200);
  },

  async POST(ctx) {
    const { userId, householdId } = ctx.state;
    if (!userId || !householdId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await ctx.req.json();
    const label = String(body.label ?? "").trim();
    const value = String(body.value ?? "").trim();
    const format = body.format as BarcodeFormat;
    const color = body.color ? String(body.color) : undefined;

    if (!label) return new Response("label required", { status: 400 });
    if (!FORMATS.has(format)) {
      return new Response("invalid format", { status: 400 });
    }
    const check = validateBarcode(value, format);
    if (!check.ok) return new Response(check.message, { status: 400 });

    const card = await LoyaltyCardRepo.create({
      householdId,
      label,
      value,
      format,
      color,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    });
    return json(card, 201);
  },

  async PATCH(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const body = await ctx.req.json();
    const id = body.id ? String(body.id) : "";
    if (!id) return new Response("ID is required", { status: 400 });

    const label = String(body.label ?? "").trim();
    const value = String(body.value ?? "").trim();
    const format = body.format as BarcodeFormat;
    const color = body.color ? String(body.color) : undefined;

    if (!label) return new Response("label required", { status: 400 });
    if (!FORMATS.has(format)) {
      return new Response("invalid format", { status: 400 });
    }
    const check = validateBarcode(value, format);
    if (!check.ok) return new Response(check.message, { status: 400 });

    const updated = await LoyaltyCardRepo.update(householdId, id, {
      label,
      value,
      format,
      color,
    });
    if (!updated) return new Response("Card not found", { status: 404 });
    return json(updated, 200);
  },

  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    // Deleting a loyalty card is manager-only (ADR 0006).
    const forbidden = requireManager(ctx);
    if (forbidden) return forbidden;
    const { id } = await ctx.req.json();
    if (!id) return new Response("ID is required", { status: 400 });
    await LoyaltyCardRepo.delete(householdId, id);
    return new Response(null, { status: 204 });
  },
});
