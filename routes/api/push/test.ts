import { define, json } from "@/utils/index.ts";
import { sendToHousehold } from "@/services/push-send.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const householdId = ctx.state.householdId;
    if (!householdId) return new Response("Unauthorized", { status: 401 });

    // Deliberately the same sendToHousehold the sweep uses, differing only in
    // payload. A separate test path would verify code nobody uses in anger.
    const result = await sendToHousehold(householdId, {
      title: "Happie is set up",
      body: "Notifications are working.",
      tag: "push-test",
      url: "/todos",
    });
    return json(result);
  },
});
