import {
  assertEquals,
  assertFalse,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.19";
import { render } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import type { LoyaltyCardInterface } from "@/models/index.ts";
import {
  orderQuickLoyaltyCards,
  QuickLoyaltyCards,
  resetPresentedQuickLoyaltyCardWhenClosed,
} from "./QuickLoyaltyCards.tsx";

const alpha: LoyaltyCardInterface = {
  id: "alpha",
  householdId: "household-1",
  label: "Alpha",
  value: "12345678",
  format: "code128",
};

const beta: LoyaltyCardInterface = {
  id: "beta",
  householdId: "household-1",
  label: "Beta",
  value: "23456789",
  format: "code128",
};

const gamma: LoyaltyCardInterface = {
  id: "gamma",
  householdId: "household-1",
  label: "Gamma",
  value: "34567890",
  format: "code128",
};

Deno.test("orderQuickLoyaltyCards — recent cards first, remainder alphabetical", () => {
  assertEquals(
    orderQuickLoyaltyCards([gamma, alpha, beta], [beta.id, gamma.id]).map(
      (card: LoyaltyCardInterface) => card.id,
    ),
    [beta.id, gamma.id, alpha.id],
  );
});

Deno.test("QuickLoyaltyCards — no cards offers the management route", () => {
  const html = render(h(QuickLoyaltyCards, {
    cards: [],
    open: true,
    onClose: () => {},
  }));
  assertStringIncludes(html, "No loyalty cards yet");
  assertStringIncludes(html, "Add a loyalty card");
});

Deno.test("QuickLoyaltyCards — one card skips the picker", () => {
  const html = render(h(QuickLoyaltyCards, {
    cards: [alpha],
    open: true,
    onClose: () => {},
  }));
  assertStringIncludes(html, 'aria-label="Close"');
  assertFalse(html.includes('aria-label="Choose a loyalty card"'));
});

Deno.test("QuickLoyaltyCards — several cards render the picker", () => {
  const html = render(h(QuickLoyaltyCards, {
    cards: [alpha, beta],
    open: true,
    onClose: () => {},
  }));
  assertStringIncludes(html, 'aria-label="Choose a loyalty card"');
  assertStringIncludes(html, "Alpha");
  assertStringIncludes(html, "Beta");
});

Deno.test("QuickLoyaltyCards — closing clears the card before reopening", () => {
  const afterClose = resetPresentedQuickLoyaltyCardWhenClosed(false, beta);
  const afterReopen = resetPresentedQuickLoyaltyCardWhenClosed(
    true,
    afterClose,
  );

  assertEquals(afterReopen, null);
});
