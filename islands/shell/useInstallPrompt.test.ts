import { assertEquals } from "jsr:@std/assert@^1.0.19";
import { detectInstallState, INSTALL_READY_EVENT } from "./useInstallPrompt.ts";

Deno.test("detectInstallState — standalone always wins", () => {
  assertEquals(
    detectInstallState({
      isIos: true,
      isStandalone: true,
      hasStashedPrompt: true,
    }),
    "installed",
  );
  assertEquals(
    detectInstallState({
      isIos: false,
      isStandalone: true,
      hasStashedPrompt: false,
    }),
    "installed",
  );
});

Deno.test("detectInstallState — a stashed prompt beats the iOS flag", () => {
  assertEquals(
    detectInstallState({
      isIos: false,
      isStandalone: false,
      hasStashedPrompt: true,
    }),
    "promptable",
  );
  assertEquals(
    detectInstallState({
      isIos: true,
      isStandalone: false,
      hasStashedPrompt: true,
    }),
    "promptable",
  );
});

Deno.test("detectInstallState — iOS browser without a prompt gets guidance", () => {
  assertEquals(
    detectInstallState({
      isIos: true,
      isStandalone: false,
      hasStashedPrompt: false,
    }),
    "ios-browser",
  );
});

Deno.test("detectInstallState — everything else is manual", () => {
  assertEquals(
    detectInstallState({
      isIos: false,
      isStandalone: false,
      hasStashedPrompt: false,
    }),
    "manual",
  );
});

Deno.test("install-ready event name matches the head stash script contract", () => {
  assertEquals(INSTALL_READY_EVENT, "happie:install-ready");
});
