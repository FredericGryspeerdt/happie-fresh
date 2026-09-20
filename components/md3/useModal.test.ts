import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { handleModalEscape } from "./useModal.ts";

Deno.test("modal Escape is consumed before closing the top modal", () => {
  const events: string[] = [];
  const event = {
    key: "Escape",
    preventDefault: () => events.push("preventDefault"),
    stopPropagation: () => events.push("stopPropagation"),
  } as unknown as KeyboardEvent;

  assertEquals(
    handleModalEscape(event, () => events.push("close")),
    true,
  );
  assertEquals(events, ["preventDefault", "stopPropagation", "close"]);
});
