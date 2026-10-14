# Angular Material vs Happie's MD3 component library

Checked 14 October 2026. Primary sources only: the
[angular/components](https://github.com/angular/components) repository on
`main` (commit `f6b4657`), its releases and issues, npm, and angular.dev.
Latest published version is **22.2.2** for `@angular/material`, `@angular/cdk`
and `@angular/aria` (`npm view`, see
[releases](https://github.com/angular/components/releases)). Nothing was
built or measured.

**Source caveat:** [material.angular.dev](https://material.angular.dev/components/categories)
is a client-rendered app. Fetching it returned only the page title, so the
component docs below are read from the Markdown and Sass files in the repo that
generate that site. `main` can be slightly ahead of 22.2.2.

## Answer

Angular Material fully covers 14 of the 24 library pieces Happie uses and
partly covers 4 more. Those components are styled to Material 3 by default. It is weakest on the
**mobile shell**: there is no navigation bar, no FAB menu (speed dial) and no
search bar. Bottom sheets and icon buttons are only partly covered. A hybrid
approach fits best: Angular Material for the standard pieces, plus about six
custom components built on the CDK and styled with the same `--mat-sys-*`
tokens. A fully custom MD3 library is feasible, because Happie already
maintains one, but it would mean porting about 2,150 lines and 19 test files
for no clear gain.

## What Happie uses today

The rule is to compose UI from `components/md3/` and the `--md-*` tokens
([`docs/ui-ux-patterns.md`](../ui-ux-patterns.md) §9). The library is
2,153 lines of non-test TSX/TS across 31 files, with 19 test files
([`components/md3/`](../../components/md3/)). Shell pieces are islands in
[`islands/shell/`](../../islands/shell/). Tokens are hand-written `oklch`
colour roles, a shape scale (4/8/12/16/28 px), four easing curves and an
`md-*` type scale in Roboto Flex, all in
[`assets/styles.css`](../../assets/styles.css). The app has **light mode only**
(no `prefers-color-scheme` or dark rules in `assets/`, `components/` or
`islands/`). It also adds a non-M3 `success` role. Icons are a custom
stroke-SVG set ([`components/md3/Icon.tsx`](../../components/md3/Icon.tsx)).

## Component coverage

Status: **Yes** = provided with M3 styling, **Partial** = exists but lacks a
variant or behaviour Happie relies on, **No** = no equivalent.

| Happie component | Angular Material / CDK | Status | Notes |
|---|---|---|---|
| `Button` (filled, tonal, elevated, outlined, text, error, `loading`) | `matButton` appearances `text/filled/tonal/outlined/elevated` ([button.md](https://github.com/angular/components/blob/main/src/material/button/button.md)); in-button progress added in v22 ([release](https://github.com/angular/components/releases/tag/v22.0.0)) | Yes | The `error` variant is not an appearance and needs token overrides |
| `IconButton` (standard, filled, tonal, outlined) | `matIconButton`, standard only | Partial | Filled/tonal variants requested in open [#33091](https://github.com/angular/components/issues/33091) |
| `Fab` | `matFab`, `matFab extended`, `matMiniFab` ([button.md](https://github.com/angular/components/blob/main/src/material/button/button.md)) | Yes | |
| `FabMenu` (speed dial) | none | No | [#860](https://github.com/angular/components/issues/860) "fab-speed-dial", open since 2016 |
| `Pressable` (ripple) | `matRipple` ([core/ripple](https://github.com/angular/components/tree/main/src/material/core/ripple)) | Yes | |
| `Card` (filled, elevated, outlined) | `mat-card` appearance `outlined/raised/filled` ([card.ts](https://github.com/angular/components/blob/main/src/material/card/card.ts)) | Yes | |
| `Sheet` (bottom sheet, drag-down dismiss, `size="large"`) | `MatBottomSheet` with M3 tokens: 28px shape, `surface-container-low` ([_m3-bottom-sheet.scss](https://github.com/angular/components/blob/main/src/material/bottom-sheet/_m3-bottom-sheet.scss)) | Partial | The [docs](https://github.com/angular/components/blob/main/src/material/bottom-sheet/bottom-sheet.md) mention no drag handle or swipe-to-dismiss, and only one sheet can be open at a time |
| `Dialog`, `DestructiveConfirmationDialog` | `MatDialog` ([dialog.md](https://github.com/angular/components/blob/main/src/material/dialog/dialog.md)) | Yes | The confirmation dialog becomes a small composed component |
| `FullScreenDialog` | `MatDialog` with width/height config | Partial | No full-screen dialog variant is documented, so it needs custom layout CSS |
| `useModal` (scroll lock, focus trap, focus restore), `Scrim` | Built into `MatDialog`; CDK `FocusTrap` ([a11y.md](https://github.com/angular/components/blob/main/src/cdk/a11y/a11y.md)) and overlay backdrop ([overlay.md](https://github.com/angular/components/blob/main/src/cdk/overlay/overlay.md)) | Yes | This would also close the known `Sheet` focus gap in ui-ux-patterns §9 |
| `TextField` | `mat-form-field` + `matInput`, `fill`/`outline` ([form-field.md](https://github.com/angular/components/blob/main/src/material/form-field/form-field.md)) | Yes | Happie's label-above style differs from both appearances |
| `SearchBar` | none | No | No M3 search component in `src/material`; compose from form-field |
| `Switch` | `mat-slide-toggle` ([slide-toggle.md](https://github.com/angular/components/blob/main/src/material/slide-toggle/slide-toggle.md)) | Yes | |
| `Snackbar` (with action) | `MatSnackBar`, action + `onAction()` ([snack-bar.md](https://github.com/angular/components/blob/main/src/material/snack-bar/snack-bar.md)) | Yes | |
| `Spinner`, `Progress`, `GlobalLoadingBar` | `mat-progress-spinner`, `mat-progress-bar` | Yes | |
| `Chip` (selectable) | `mat-chip-option` in `mat-chip-listbox` ([chips.md](https://github.com/angular/components/blob/main/src/material/chips/chips.md)) | Yes | |
| `Segmented` | `mat-button-toggle-group`; M3 tokens use `secondary-container` for the selected state ([_m3-button-toggle.scss](https://github.com/angular/components/blob/main/src/material/button-toggle/_m3-button-toggle.scss)) | Yes | Different name, same role |
| `ListItem`, `ListSubheader`, `Divider` | `mat-list`/`mat-nav-list`/`mat-action-list`, `matSubheader`, `mat-divider` ([list.md](https://github.com/angular/components/blob/main/src/material/list/list.md)) | Yes | |
| `Icon` | `mat-icon` with SVG registry ([icon.md](https://github.com/angular/components/blob/main/src/material/icon/icon.md)) | Yes | The mechanism is covered; Happie's own SVGs carry over |
| `RoundCheck` (circular check) | `mat-checkbox` is the square M3 checkbox | No | Custom element, or switch to the square checkbox |
| `Stepper` (quantity −/+) | none; `mat-stepper` is a multi-step wizard | No | Watch the name clash |
| `NavigationBar` (bottom) | none | No | [#408](https://github.com/angular/components/issues/408) "bottom-nav component", open since 2016, labelled P5 |
| `TopAppBar` | `mat-toolbar`, a generic header container ([toolbar.md](https://github.com/angular/components/blob/main/src/material/toolbar/toolbar.md)) | Partial | The docs describe no M3 small/medium/large top app bar variants |
| `PullToRefresh` | none | No | Not an M3 component; stays custom either way |
| `Barcode`, `CatalogueAddRow`, `CategoryPickerList`, `ComingSoon` | n/a | n/a | App compositions, not library components |

Tally of the 24 library rows: 14 Yes, 4 Partial, 6 No.

**M3 Expressive** (Happie's `FabMenu` comments call itself "MD3 expressive")
is not planned. A team member wrote in
[#31206](https://github.com/angular/components/issues/31206) on 28 May 2025:
"We don't have plans to support expressive at the moment", because many
styles need different markup. The issue is still open.

## How M3 theming works in Angular Material

From the [theming guide](https://github.com/angular/components/blob/main/guides/theming.md)
(the v19+ Sass API) and
[Theming your components](https://github.com/angular/components/blob/main/guides/theming-your-components.md):

- **One mixin.** `@include mat.theme((color: …, typography: …, density: …))`
  emits CSS variables only for the categories you pass. M3 is the default, and
  M2 remains for backwards compatibility
  ([prebuilt themes table](https://github.com/angular/components/blob/main/guides/theming.md#prebuilt-themes)).
- **Colour** comes from tonal palettes, either prebuilt (`mat.$violet-palette`)
  or generated from a seed colour with `ng generate @angular/material:theme-color`
  ([schematic](https://github.com/angular/components/blob/main/src/material/schematics/ng-generate/theme-color/README.md)).
  You cannot feed Happie's hand-picked `oklch` values in directly. Either
  generate palettes from Happie's hue, or pin individual roles with
  `mat.theme-overrides`.
- **System tokens** are `--mat-sys-*` CSS variables for colour roles
  (`--mat-sys-primary-container`), typography (`--mat-sys-body-large`), the
  corner scale (`--mat-sys-corner-extra-large: 28px`) and elevation. Optional
  utility classes come from `mat.system-classes()`. The guide has no motion
  or easing section, so Happie's `--md-emphasized*` curves stay custom. So
  does the extra `success` role.
- **Dark mode** uses CSS `light-dark()` and depends on the app's `color-scheme`.
  Without `color-scheme`, "the light colors will always be applied", and
  Material does not react to `prefers-color-scheme` by itself
  ([guide](https://github.com/angular/components/blob/main/guides/theming.md#supporting-light-and-dark-mode)).
  This would make a future dark mode cheap.
- **Customising:** `mat.theme-overrides(...)` for system tokens, and
  `mat.<component>-overrides(...)` (for example `mat.card-overrides`) for
  per-component tokens. Overriding component CSS or DOM classes directly is
  "strongly discourage[d]": DOM and classes are private and may change.
- **Tailwind:** the guide doesn't cover Tailwind. Mapping `--mat-sys-*` into a
  Tailwind v4 `@theme` block should work, just as Happie maps `--md-*` today,
  but no source confirms it.

## A custom MD3 library on Angular, by comparison

The building blocks exist and are unstyled:

- **CDK** (`@angular/cdk`) provides `Dialog` ("unstyled modal dialogs",
  [dialog.md](https://github.com/angular/components/blob/main/src/cdk/dialog/dialog.md)),
  `Overlay` with backdrop and scroll strategies, `FocusTrap` and key managers
  (`a11y`), `drag-drop`, `listbox`, `menu` and `stepper`
  ([src/cdk](https://github.com/angular/components/tree/main/src/cdk)).
- **Angular Aria** (`@angular/aria`, 22.2.2 on npm) is "a collection of
  headless, accessible directives": Autocomplete, Listbox, Select, Multiselect,
  Combobox, Menu, Menubar, Toolbar, Accordion, Tabs, Tree and Grid
  ([overview](https://angular.dev/guide/aria/overview)). The page doesn't say
  whether it is stable or in developer preview. None of Happie's missing
  components (nav bar, FAB menu, search bar, sheet gestures) is among them.

**Effort estimate** (my judgement, not from a source). Happie's current
library took 2,153 lines, about 70 lines per file on average, with
complex outliers: `Icon` 252, `PullToRefresh` 167, `TextField` 144, `Sheet` 140
([`components/md3/`](../../components/md3/)). Porting this to Angular
components with CDK primitives would be similar in size. The hardest parts
(focus trap, scroll lock, overlays) are free from the CDK.

| Option | What you build | Rough size |
|---|---|---|
| **Hybrid (recommended)** | `mat.theme` + overrides; custom `NavigationBar`, `FabMenu`, `SearchBar`, quantity `Stepper`, `RoundCheck`, `PullToRefresh`; sheet drag-to-dismiss and filled/tonal icon buttons as small add-ons | ~6 custom components plus 2 extensions, roughly 700–900 lines judged from the Happie equivalents |
| **Fully custom on CDK** | All ~30 components, the token CSS, a ripple, and tests | ~2,000+ lines plus 19 test suites to port; you also own a11y and visual regressions |
| **Angular Material only** | Accept the gaps: side-nav or tabs instead of a bottom nav bar, no speed dial | Least code, but breaks "same screens and flows" from the map (#142) |

The trade-off in the hybrid option is two styling systems in one app: Material
components are styled through token overrides, custom ones through
`--mat-sys-*` variables. Material treats its internals as private, so custom
pieces should not reuse Material's classes.

## What the sources don't say

- No roadmap for a navigation bar, FAB menu, search bar or M3 top app bar. The
  related issues are open feature requests with low priority labels.
- Whether `MatBottomSheet` can be made swipe-dismissable without custom
  gesture code. The docs are silent; no issue was found by search.
- Whether `@angular/aria` is stable.
- Exact rendered visuals. The live docs site wouldn't render for the fetch
  tool, so component looks were inferred from the M3 token files, not seen.
