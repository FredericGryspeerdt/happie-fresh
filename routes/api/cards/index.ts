import {
  badRequest,
  define,
  json,
  noContent,
  notFound,
  requireManager,
} from "@/utils/index.ts";
import { LoyaltyCardRepo } from "@/database/index.ts";
import type { BarcodeFormat } from "@/models/index.ts";
import { validateBarcode } from "@/utils/barcode.ts";

const FORMATS = new Set<BarcodeFormat>([
  "ean13",
  "ean8",
  "upca",
  "code128",
  "code39",
  "qrcode",
]);

export const handler = define.handlers({
  async GET(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const cards = await LoyaltyCardRepo.getAll(householdId);
    return json(cards, 200);
  },

  async POST(ctx) {
    const { householdId, actingMember } = ctx.state;
    if (!householdId || !actingMember) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await ctx.req.json();
    const label = String(body.label ?? "").trim();
    let value = String(body.value ?? "").trim();
    const format = body.format as BarcodeFormat;
    const color = body.color ? String(body.color) : undefined;

    if (!label) return badRequest("label required");
    if (!FORMATS.has(format)) {
      return badRequest("invalid format");
    }
    if (format === "code39") value = value.toUpperCase();
    const check = validateBarcode(value, format);
    if (!check.ok) return badRequest(check.message);

    const card = await LoyaltyCardRepo.create({
      householdId,
      label,
      value,
      format,
      color,
      createdBy: actingMember.id,
      createdAt: new Date().toISOString(),
    });
    return json(card, 201);
  },

  async PATCH(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    const body = await ctx.req.json();
    const id = body.id ? String(body.id) : "";
    if (!id) return badRequest("ID is required");

    const label = String(body.label ?? "").trim();
    let value = String(body.value ?? "").trim();
    const format = body.format as BarcodeFormat;
    const color = body.color ? String(body.color) : undefined;

    if (!label) return badRequest("label required");
    if (!FORMATS.has(format)) {
      return badRequest("invalid format");
    }
    if (format === "code39") value = value.toUpperCase();
    const check = validateBarcode(value, format);
    if (!check.ok) return badRequest(check.message);

    const updated = await LoyaltyCardRepo.update(householdId, id, {
      label,
      value,
      format,
      color,
    });
    if (!updated) return notFound("Card not found");
    return json(updated, 200);
  },

  async DELETE(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });
    // Deleting a loyalty card is manager-only (ADR 0006).
    const forbidden = requireManager(ctx);
    if (forbidden) return forbidden;
    const { id } = await ctx.req.json();
    if (!id) return badRequest("ID is required");
    await LoyaltyCardRepo.delete(householdId, id);
    return noContent();
  },
});
