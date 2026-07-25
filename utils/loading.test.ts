import { assert, assertEquals } from "jsr:@std/assert@^1.0.19";
import {
  beginBusy,
  busyCount,
  endBusy,
  navigateTo,
  navPending,
  shouldInterceptNav,
} from "./loading.ts";

Deno.test("beginBusy/endBusy balance busyCount and floor at zero", () => {
  busyCount.value = 0;
  beginBusy();
  beginBusy();
  assertEquals(busyCount.value, 2);
  endBusy();
  endBusy();
  endBusy(); // extra end must not go negative
  assertEquals(busyCount.value, 0);
});

Deno.test("navigateTo sets navPending (nav is a no-op without a DOM location)", () => {
  navPending.value = false;
  navigateTo("/shopping");
  assert(navPending.value);
});

Deno.test("shouldInterceptNav — internal same-origin link is intercepted", () => {
  assert(shouldInterceptNav({
    href: "/shopping/123",
    currentHref: "https://app.test/shopping",
  }));
});

Deno.test("shouldInterceptNav — external, _blank, download, modified, hash are ignored", () => {
  const cur = "https://app.test/shopping";
  assert(
    !shouldInterceptNav({ href: "https://other.test/x", currentHref: cur }),
  );
  assert(
    !shouldInterceptNav({ href: "/x", target: "_blank", currentHref: cur }),
  );
  assert(!shouldInterceptNav({ href: "/x", download: true, currentHref: cur }));
  assert(!shouldInterceptNav({ href: "/x", modified: true, currentHref: cur }));
  assert(!shouldInterceptNav({ href: null, currentHref: cur }));
  assert(
    !shouldInterceptNav({
      href: "/shopping#top",
      currentHref: cur,
    }),
  );
});
