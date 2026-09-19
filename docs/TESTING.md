# Testing and verification

The repository has four complementary evidence layers.

1. Unit and deterministic contract tests run the migrated core without DOM, Phaser, storage, network, or account identity.
2. Browser E2E tests exercise the React shell, keyboard path, first evidence station, and privacy-safe foundation flow.
3. Axe coverage checks the initial and evidence states on a phone-sized viewport.
4. The real-Phaser lane starts the installed Phaser 4 package in Chromium with SwiftShader, creates a real scene, verifies the WebGL renderer and canvas, and observes advancing frames.

The real render test is not a jsdom alias, mocked Phaser object, or compile-only import. It fails if Phaser falls back away from the expected WebGL renderer or the scene never becomes active.

Run npm run verify for the aggregate pull-request check. CI installs from package-lock.json and requires no credentials.
