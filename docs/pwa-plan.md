# Minimal PWA installation

## Goal and accepted scope

Install FinanzApp from the website and launch it in a standalone window.
The user accepted manual installation instructions for this first release.
The app requires internet. Installation is delivered through the existing
HTTPS website deployment.

## Engineering review

- **Architecture:** use Next.js manifest and icon metadata conventions. Keep
  `id`, `scope`, and `start_url` at `/`, retaining existing dashboard routing.
  Public installation assets do not depend on a session or database.
- **Code quality:** reuse settings components and one mask-safe icon artwork
  component. Generated PNGs replace manually maintained binary icon copies.
  Manual instructions avoid browser detection and install-event state.
- **Tests:** exercise actual HTTP responses, PNG dimensions, generated metadata,
  and mobile profile guidance. Profile tests mock its unrelated data APIs;
  real OAuth and operating-system installation require device verification.
- **Performance:** manifest and icon routes are statically generated and cached
  by Next.js. Icon generation stays outside the browser bundle. No new
  dependencies, background workers, or polling are introduced.

## Implementation

1. `app/manifest.ts`: FinanzApp identity, Spanish language, standalone display,
   black default launch colors, and 192px/512px mask-safe PNG icons.
2. `components/ui/app-icon.tsx`, `app/icon.tsx`, `app/apple-icon.tsx`: shared
   black/lime wallet artwork; Next.js generates app and 180px Apple touch icons.
3. `app/layout.tsx`: align the Apple installed-app title to FinanzApp.
   Default browser chrome to dark; `components/theme-provider.tsx` keeps its
   color aligned with the selected theme rather than the OS preference.
4. `app/user/page.tsx`: Spanish Safari/Chrome installation steps, a browser
   fallback, and an explicit internet requirement.
5. `e2e/pwa.spec.ts`: public assets, metadata, and mobile guidance checks.
6. `components/context/AuthProvider.tsx`, `e2e/auth-redirect.spec.ts`: wait for
   the server redirect from `/` before starting sign-in, preventing an aborted
   providers fetch during a signed-out home-screen launch.

## Flow and verification coverage

```text
HTTPS website
  +-- manifest --> identity, scope, standalone launch  [Playwright]
  +-- icon routes --> correct PNG dimensions          [Playwright]
  +-- page metadata --> manifest and Apple icon links [Playwright]
  +-- theme preference --> matching browser chrome    [Playwright]
  +-- /user --> manual instructions, readable layout  [Playwright]
                |
                v
       browser installation and relaunch             [Real phone]
                |
                v
       / --> /dashboard --> existing auth/data       [Real phone]
```

## Test plan

- Run `pnpm check`, `pnpm build`, and focused PWA Playwright tests.
- Check `/manifest.webmanifest` and icons without login; validate image MIME
  types, PNG signatures/dimensions, and generated HTML metadata. Check visible,
  opaque artwork stays inside the maskable safe circle and unknown icon IDs
  return 404.
- Check `/` still reaches sign-in without a session, retaining app metadata.
  The auth regression test confirms the providers request starts on
  `/dashboard`, after the server redirect, rather than racing it on `/`.
- Check browser chrome follows the selected theme even with an opposite OS
  preference, including reloads and navigation.
- Check `/user` at mobile width for both platforms' instructions and no
  horizontal overflow. No financial writes are needed for these tests.
- On an HTTPS deployment, install and relaunch on iPhone Safari and Android
  Chrome. Verify icon masking, standalone launch, GitHub login return,
  session persistence, logout, quick-add, camera capture, and keyboard layout.
- Confirm users can use the website when installation is unavailable.
- Without connectivity, confirm the product makes no offline-save promise.
  There is no custom offline screen in this release.

## Deferred capabilities

Service workers, offline caching/drafts/synchronization, push notifications,
and custom install buttons are separate follow-ups if users need them.

## Release readiness

Automated browser checks cannot establish operating-system installation or
OAuth behavior in standalone mode. Report device verification separately;
do not label it complete based on browser emulation.
