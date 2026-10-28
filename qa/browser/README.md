# Browser acceptance

This test-only harness accepts the existing `dist/` and standalone `index.html`.
It does not rebuild or modify either application. Use Node 24 and a disposable
Linux runner with Chromium and Xvfb. No VPS access, real accounts or secrets.

## Plan and boundaries

1. Install the exact locked Playwright dependency and its Chromium.
2. Prove that loopback binding and headed Chromium launch/close work before
   attempting application tests. Headed Chromium under Xvfb is required to test
   real `document.hidden` transitions when another tab comes to the foreground.
   The preflight must also prove a native hidden/visible round trip. Playwright
   normally pins every page visible through its original CDP session. A guarded
   test-environment adjustment in `prepare-focus.mjs` disables that default at
   the initialization site of the pinned, disposable Playwright dependency.
   A separate CDP session cannot release the original session's visibility
   capturer. The adjustment changes no application assets or visibility APIs;
   it fails closed if the dependency version or source pattern changes.
3. Before navigation, intercept every page request. Serve only local assets;
   fulfil sessions/capabilities from in-memory fixtures and reject any other
   external request. No request is forwarded to the configured production API.
4. Run the same acceptance matrix against both entry points. A test-only
   pre-navigation timer gate holds explicit zero-delay callbacks, including the
   existing opponent's cooperative yield. It does not replace the opponent,
   change its result or bypass cancellation checks. Every race must first prove
   that a callback is held and the saved game has a pending black turn.
5. Check automatic legal replies, manual black-piece blocking, cancellation by
   menu/pause/visibility/home/profile change, stale callback release, pending and
   completed restoration, profile/mode isolation, and unchanged existing rewards
   and learning facts. Report errors and blocked requests. Never merge or deploy.

This follows the already approved acceptance scope (BookStack 173 and 169).
GitHub Actions is preferred over retrying a sandbox that prohibits sockets or
cannot install Chromium. Application defects need independent reproduction;
test harness/environment failures do not establish an application defect.

## Commands

```sh
cd qa/browser
npm ci
npx playwright install --with-deps chromium
xvfb-run -a npm run preflight
xvfb-run -a npm test
```

The workflow uses a read-only GitHub token and no repository secrets, has a
timeout, uploads only fixture-based test reports, and has no deployment step.
The root `npm test` remains independent of browser installation.
