# Angular-idiomatic strategies for Happie's front-end patterns

Checked 14 October 2026 for
[#154](https://github.com/FredericGryspeerdt/happie-fresh/issues/154) (map
[#142](https://github.com/FredericGryspeerdt/happie-fresh/issues/142)). Sources
are primary: angular.dev, the `angular/angular` repo (source tags and
CHANGELOG), the npm registry, and official library docs. Nothing was built or
measured.

Already decided: Angular with Angular Material plus about six custom CDK
components, zoneless and signals-first, MD3, a mobile-first PWA. Patterns are
numbered as in [`docs/ui-ux-patterns.md`](../ui-ux-patterns.md).

## First: target Angular 22, not 21

- Angular 22.0 shipped on 2026-06-03 and is **Active**. Angular 21 is in
  **LTS until 2027-06**
  ([release table](https://github.com/angular/angular/blob/main/adev/src/content/reference/releases.md)).
  The npm `latest` tag for `@angular/core` is `22.2.2`. A cutover in February
  2027 on v21 would leave about four months of support.
- In v21, `resource()`/`httpResource()` are tagged `@experimental 19.2`. On
  `main` and v22 they are `@publicApi 22.0`
  (source:
  [`packages/common/http/src/resource.ts`](https://github.com/angular/angular/blob/main/packages/common/http/src/resource.ts)
  on `21.2.x` and on `main`; the v21 and v22 API pages carry the matching
  "experimental" and "stable" badges). The
  [roadmap](https://angular.dev/roadmap) lists Signal Forms and the
  asynchronous reactivity APIs as completed and stable in 2026, and zoneless as
  stable and the default.
- Signal Forms' `debounce()` rule is `@publicApi 22.0`
  ([source](https://github.com/angular/angular/blob/main/packages/forms/signals/src/api/rules/debounce.ts)).

The comparisons below assume v22. On v21 they hold, but the resource APIs would
be experimental.

## Candidate data and state layers

| Option | Status (Oct 2026) | Fit |
|---|---|---|
| Plain signals + `resource`/`httpResource` in root services, mutations via `HttpClient` | Core, stable in v22 | Best fit (see below) |
| NgRx SignalStore (`@ngrx/signals` 22.0.1) | Stable; peer `@angular/core ^22` | Workable, but it adds structure Happie doesn't need |
| TanStack Query Angular (`@tanstack/angular-query-experimental` 5.104.2) | Docs: "currently in an experimental stage", and "breaking changes will happen in minor AND patch releases" ([overview](https://tanstack.com/query/latest/docs/framework/angular/overview)) | Rejected for a long-lived app |

Why plain signals win. Happie's state is small, has one owner per screen, and
is already shaped as "a hook that owns signals plus imperative mutations"
(`hooks/useShoppingList.ts`). A `providedIn: 'root'` (or route-provided)
service exposing `signal`/`computed` plus methods maps one-to-one onto that,
with no library.

- SignalStore is a store-shaped wrapper (`withState`/`withComputed`/
  `withMethods`) that "must be included in a providers array at the component,
  route, or root level"
  ([guide](https://github.com/ngrx/platform/blob/main/projects/www/src/app/pages/guide/signals/signal-store/index.md)).
  It gives the same signals with more ceremony. Its resource helpers
  (`@ngrx/signals/resource`) are still experimental
  ([doc](https://github.com/ngrx/platform/blob/main/projects/www/src/app/pages/guide/signals/resource-extensions.md)).
- TanStack's optimistic-update recipe (`onMutate` snapshot, `onError` rollback,
  `onSettled` invalidate;
  [guide](https://tanstack.com/query/latest/docs/framework/angular/guides/optimistic-updates))
  is the best off-the-shelf match for pattern 1. That doesn't outweigh the
  experimental, break-on-patch status for a stack chosen for the long term.

## Per pattern

### 1. Optimistic updates and deletes, pessimistic creates

**Recommendation:** a feature service holds the collection in a
`WritableSignal` (or uses `httpResource` for the initial load and calls its
`.set()`/`.update()` for local changes). Mutations call `HttpClient` directly.
Rollback stays explicit: snapshot, `set`, restore on failure, as today.

- `httpResource` is for reads. The docs advise avoiding it for mutations like
  POST or PUT and using `HttpClient` instead
  ([guide](https://angular.dev/guide/http/http-resource)).
- `resource.set()`/`update()` put the resource into status `local`, and
  `reload()` keeps the previous value while `reloading`
  ([resource guide](https://angular.dev/guide/signals/resource)). That is
  enough for optimistic edits on a loaded list. Angular has no mutation
  primitive and no automatic rollback.
- Caveat: if params change or `reload()` runs during an optimistic edit, the
  server value overwrites the local one. Either avoid reloading while writes
  are pending, or keep the list in a plain `signal` seeded from the resource
  (for example with `linkedSignal`).

### 2. The `api` service as error boundary

**Recommendation:** keep the "never throws, failure is a value" contract in a
thin typed `ApiService` over `HttpClient` that maps errors to `null`, `[]` or
`false`, through `catchError` or a `firstValueFrom` wrapper. Feature services
call only this service.

- Reading a resource's `value()` in the error state **throws**, so callers must
  guard with `hasValue()`
  ([httpResource guide](https://angular.dev/guide/http/http-resource),
  [resource guide](https://angular.dev/guide/signals/resource)). For reads
  through `httpResource`, the boundary becomes "check `hasValue()`/`error()`",
  not "check for `null`". Write that down as the rule for reads. NgRx's
  `withValueOnError` is an option, but it is experimental.
- Cross-cutting concerns (auth 401 redirect, the busy counter) belong in
  functional `HttpInterceptorFn`s, which `httpResource` also passes through
  because it is built on `HttpClient` ([guide](https://angular.dev/guide/http/http-resource)).

### 3. Surface failures with a snackbar

**Recommendation:** use `MatSnackBar` behind a small `SnackService` that keeps
today's duration policy (default 3 s, 10 s when there is an action, `null`
pinned). That is one place for durations and Dutch copy. Coverage was already
settled in #146; this only centralises the policy that `useSnack` holds today.

### 4. Loading feedback

**Recommendation:** one root `LoadingService` holding `busyCount` as a signal,
fed by:

- an `HttpInterceptorFn` that wraps non-GET requests (opt out per request
  through an `HttpContextToken`);
- `Router.currentNavigation`, a signal that replaces the deprecated
  `getCurrentNavigation()` (deprecated 20.2;
  [router.ts](https://github.com/angular/angular/blob/main/packages/router/src/router.ts)).
  This replaces `navigateTo()` and `<a>` interception, because navigation is
  client-side in an SPA.

The 200 ms show delay and 400 ms minimum visible time stay as logic in the bar
component. `MatProgressBar` renders it. Per-item "Saving…/Saved" is derived
from the write scheduler's in-flight set, as today.

### 5. Search and filtering

**Recommendation:** client-side `computed(() => items().filter(...))` over a
query `signal`, in a reusable `SearchBox` directive or service (trim,
empty-means-all, reset that refocuses through a `viewChild`).

- For server-side search later, the experimental `debounced(source, ms)` in
  core (`@experimental 22.0`) returns a `Resource` and pairs with `resource`
  ([guide](https://github.com/angular/angular/blob/main/adev/src/content/guide/signals/debounced.md),
  [source](https://github.com/angular/angular/blob/main/packages/core/src/resource/debounce.ts)).
  The stable Signal Forms `debounce()` rule does the same on a form field
  ([form logic](https://github.com/angular/angular/blob/main/adev/src/content/guide/forms/signals/form-logic.md)).
  Today's filtering is in-memory, so neither is needed yet.

### 6. Exit animations

**Recommendation:** native `animate.leave` (and `animate.enter`) with CSS
classes. Do not use `@angular/animations`.

- `@angular/animations` "is deprecated as of v20.2", the same release that
  added `animate.enter`/`animate.leave`. Removing it "can significantly reduce
  the size of your JavaScript bundle"
  ([migration guide](https://angular.dev/guide/animations/migration)). Its API
  pages mark the functions for removal in v23.
- Angular Material no longer needs the animations module (angular/components
  [#30459](https://github.com/angular/components/pull/30459)).
- Angular removes a leaving element only after its longest animation or
  transition finishes, with a 4 s fallback (`MAX_ANIMATION_TIMEOUT`). Items in
  `@for` are removed and re-added correctly, and enter transitions pair with
  `@starting-style` ([animations guide](https://angular.dev/guide/animations),
  [migration](https://angular.dev/guide/animations/migration)).
- This removes the hand-synced `exitingItems` + `setTimeout(300)` dance. Remove
  the item from the signal and the row animates out. The ordering rule is
  unchanged: flush pending writes, then remove, then DELETE. The animation no
  longer needs to happen before the removal.
- Mixing legacy animations and `animate.*` in one component is not supported
  ([guide](https://angular.dev/guide/animations)). Avoiding the legacy package
  from day one sidesteps this.

### 7. Debounced, merged background writes

**Recommendation:** port `createDebouncedMergeScheduler` almost verbatim as a
framework-free TypeScript utility. It already has no Preact dependency. A
feature service owns one instance and cleans up with `DestroyRef`. Expose
`pendingIds` as a signal for "Saving…".

- No Angular or library primitive covers per-id patch merging, a per-id
  in-flight order chain, `flush(id)` on editor close, and drain before DELETE.
  `debounced()` debounces one signal's value, and the Signal Forms `debounce()`
  delays model sync. Neither merges patches or orders writes.
- RxJS (`groupBy` + `debounceTime` + `concatMap`) can express it, but less
  clearly than the existing tested code. Keep the existing tests as the spec.

### 8. Cross-island shared state

**Recommendation:** the problem goes away. An Angular SPA has one injector
tree, so shared state (app-bar action, busy count, acting member) lives in
`providedIn: 'root'` services exposing signals. The `signal()` vs `useSignal()`
footgun has no Angular equivalent: field initialisers run once per instance.

- One-shot events that fire before bootstrap (`beforeinstallprompt`, §16) still
  need capturing. Do it in `index.html` or at the top of `main.ts` before
  `bootstrapApplication`, then read it from a root service. This is simpler
  than today because there is no SSR escaping problem.
- Sheet portalling (§17) is handled by the CDK overlay, which renders into its
  own container on `body`.

### 10. Mobile-first and PWA details

These are mostly CSS and platform, not framework: safe-area `env()` padding,
bottom navigation and FAB (custom CDK components per #146), 16 px input floor,
the keyboard primer (§12, still needed, now with `viewChild` and a synchronous
`.focus()` in the click handler), and capability detection (§11) in
`afterNextRender` or the constructor. There is no SSR, so there is no
hydration-mismatch reason to defer.

Service worker, offline and badge strategy is a separate open item on #142 and
is out of scope here.

## Choices to make once, app-wide

1. **Angular 22** (stable resource APIs and Signal Forms; v21 support ends
   2027-06).
2. **State:** plain signals in root or route-provided services. **No NgRx, no
   TanStack Query.** `httpResource` for reads, `HttpClient` for writes.
3. **Error boundary:** one `ApiService` that never throws for writes. For
   reads, guard with `hasValue()`. Interceptors handle auth and busy state.
4. **Feedback:** a root `SnackService` over `MatSnackBar` and a root
   `LoadingService` fed by an interceptor plus `Router.currentNavigation`.
5. **Animations:** `animate.enter`/`animate.leave` + CSS only. Never add
   `@angular/animations`.
6. **Writes:** keep the debounced merge scheduler as a plain TS utility.

## Open questions

- Whether to allow the experimental `debounced()` before it is stable. Not
  needed for current features.
- Whether `linkedSignal` or a plain signal should own lists that also reload
  through pull-to-refresh, so a reload can't overwrite pending optimistic
  edits. Settle this in the spec with one worked example (shopping list).
