import { ShoppingListMoveRepo } from "@/database/shopping-list-move.repo.ts";
import { badRequest, define } from "@/utils/index.ts";
import { authorizeList } from "@/utils/authorize-list.ts";
import type { MoveItemsInput } from "@/models/shopping-list/move.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const { householdId, actingMember } = ctx.state;
    if (!householdId || !actingMember) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (!await authorizeList(ctx, ctx.params.id)) {
      return new Response("Forbidden", { status: 403 });
    }
    let body;
    try {
      body = await ctx.req.json();
    } catch {
      return badRequest("Invalid JSON");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest("Invalid request");
    }
    if ("undoRequestId" in body) {
      if (
        typeof body.undoRequestId !== "string" ||
        !/^[\w-]{1,64}$/.test(body.undoRequestId)
      ) return badRequest("Invalid undo request");
      const result = await ShoppingListMoveRepo.undo(
        householdId,
        ctx.params.id,
        body.undoRequestId,
      );
      return Response.json(result, { status: result.ok ? 200 : 409 });
    }
    if (
      body.destinationListId && typeof body.destinationListId === "string" &&
      !await authorizeList(ctx, body.destinationListId)
    ) return new Response("Forbidden", { status: 403 });
    const input: MoveItemsInput = {
      requestId: body.requestId,
      itemIds: body.itemIds,
      destinationListId: body.destinationListId,
      newListName: body.newListName,
    };
    const result = await ShoppingListMoveRepo.move(
      householdId,
      actingMember.id,
      ctx.params.id,
      input,
    );
    return Response.json(result, { status: result.ok ? 200 : 400 });
  },
});
