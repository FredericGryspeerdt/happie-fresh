import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { activateOnKey, Pressable } from "./Pressable.tsx";

Deno.test("Pressable — renders md-press host and a state-layer span", () => {
  const html = render(h(Pressable, { class: "x" }, "Tap"));
  assertStringIncludes(html, "md-press");
  assertStringIncludes(html, "md-state");
  assertStringIncludes(html, "Tap");
});

Deno.test("Pressable — non-button with onClick is keyboard-reachable", () => {
  const html = render(h(Pressable, { as: "div", onClick: () => {} }, "Tap"));
  assertStringIncludes(html, 'role="button"');
  assertStringIncludes(html, 'tabindex="0"');
});

Deno.test("Pressable — native button keeps native semantics (no role/tabindex)", () => {
  const html = render(h(Pressable, { onClick: () => {} }, "Tap"));
  assert(!html.includes('role="button"'));
  assert(!html.includes("tabindex"));
});

Deno.test("Pressable — non-button without onClick stays non-interactive", () => {
  const html = render(h(Pressable, { as: "div" }, "Static"));
  assert(!html.includes('role="button"'));
  assert(!html.includes("tabindex"));
});

Deno.test("Pressable — disabled non-button is announced but not tab-focusable", () => {
  const html = render(
    h(Pressable, { as: "div", onClick: () => {}, disabled: true }, "Tap"),
  );
  assertStringIncludes(html, 'role="button"');
  assertStringIncludes(html, 'tabindex="-1"');
  assertStringIncludes(html, 'aria-disabled="true"');
  assert(!html.includes('tabindex="0"'));
});

Deno.test("Pressable — caller can override role/tabindex via rest props", () => {
  const html = render(
    h(
      Pressable,
      { as: "div", onClick: () => {}, role: "menuitem", tabIndex: -1 },
      "x",
    ),
  );
  assertStringIncludes(html, 'role="menuitem"');
  assertStringIncludes(html, 'tabindex="-1"');
  assert(!html.includes('role="button"'));
});

Deno.test("activateOnKey — Enter and Space activate and prevent default", () => {
  let clicks = 0;
  let prevented = 0;
  const activate = () => clicks++;
  const key = (k: string) => ({ key: k, preventDefault: () => prevented++ });

  activateOnKey(key("Enter"), activate);
  activateOnKey(key(" "), activate);

  assertEquals(clicks, 2);
  assertEquals(prevented, 2); // Space (and Enter) must preventDefault — Space would scroll
});

Deno.test("activateOnKey — non-activation keys are ignored", () => {
  let clicks = 0;
  let prevented = 0;
  const activate = () => clicks++;

  activateOnKey({ key: "a", preventDefault: () => prevented++ }, activate);
  activateOnKey({ key: "Tab", preventDefault: () => prevented++ }, activate);

  assertEquals(clicks, 0);
  assertEquals(prevented, 0);
});
