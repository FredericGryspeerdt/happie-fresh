import { Context } from "fresh";
import { CategoryRepo } from "../../database/category.repo.ts";

interface State {
  userId?: string;
}

export const handler = {
  async GET(_ctx: Context<State>) {
    const categories = await CategoryRepo.getAll();
    return new Response(
      JSON.stringify(categories),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  },

  async POST(_ctx: Context<State>) {
    const userId = _ctx.state.userId;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const req = _ctx.req;
    const { label } = await req.json();
    
    if (!label || typeof label !== "string" || label.trim() === "") {
      return new Response("Label is required", { status: 400 });
    }

    const category = await CategoryRepo.create(label.trim(), userId);
    return new Response(JSON.stringify(category), { status: 201 });
  },

  async PATCH(_ctx: Context<State>) {
    const userId = _ctx.state.userId;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const req = _ctx.req;
    const body = await req.json();

    // Handle bulk reorder operation
    if (Array.isArray(body)) {
      try {
        await CategoryRepo.reorder(body);
        return new Response(null, { status: 204 });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Reorder failed";
        return new Response(message, { status: 500 });
      }
    }

    // Handle single category update
    const { id, label, order } = body;
    if (!id) {
      return new Response("ID is required", { status: 400 });
    }

    const patch: Partial<{ label: string; order: number }> = {};
    if (label !== undefined) patch.label = label;
    if (order !== undefined) patch.order = order;

    const updated = await CategoryRepo.update(id, patch);
    if (!updated) {
      return new Response("Category not found", { status: 404 });
    }

    return new Response(JSON.stringify(updated), { status: 200 });
  },

  async DELETE(_ctx: Context<State>) {
    const userId = _ctx.state.userId;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const req = _ctx.req;
    const { id } = await req.json();
    
    if (!id) {
      return new Response("ID is required", { status: 400 });
    }

    await CategoryRepo.delete(id);
    return new Response(null, { status: 204 });
  },
};
