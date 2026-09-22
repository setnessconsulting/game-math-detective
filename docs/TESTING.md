# Testing and verification

The repository has four complementary evidence layers.

1. Unit and deterministic contract tests run the migrated core without DOM, Phaser, storage, network, or account identity.
2. Browser E2E tests exercise the React shell, keyboard path, first evidence station, and privacy-safe foundation flow.
3. Axe coverage checks the initial and evidence states on a phone-sized viewport.
4. The real-Phaser lane starts the installed Phaser 4 package in Chromium with SwiftShader, creates a real scene, verifies the WebGL renderer and canvas, and observes advancing frames.

The real render test is not a jsdom alias, mocked Phaser object, or compile-only import. It fails if Phaser falls back away from the expected WebGL renderer or the scene never becomes active.

Run npm run verify for the aggregate pull-request check. CI installs from package-lock.json and requires no credentials.

## Math Detective playtest enhancement pass (2026-09-21)

The post-playtest shell pass is covered by the same repository gates and adds explicit checks for:

- pause / handoff, restart, and start-a-new-case flows without a browser reload;
- a plain-language independence explanation, earned case badges, and a session-only setting sticker shelf;
- setting atmosphere, transition copy, and an inspected-object callout around each evidence challenge;
- keyboard focus containment for the pause dialog;
- 320px phone layout without horizontal overflow or unintended nested play-panel scrolling;
- 200% text scaling while the pause controls remain visible and pointer-targetable.

The authoritative commands are `npm run test:a11y`, `npm run test:phaser-render`, and
`npm run test:e2e`; `npm run verify` remains the aggregate release gate.
