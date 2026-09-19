# Math Detective

The canonical standalone implementation foundation for Math Detective.

GAME-298 establishes this repository as the authority for the game-owned TypeScript core, browser shell, tests, build, provenance, and release evidence. setnessconsulting/games-site is the later authority for public arcade hosting, catalog selection, immutable promotion, and rollback. LevelBest is a later consumer, not a runtime dependency or source repository.

## Foundation boundary

The migrated core under src/lib/mathDetective/ is the only authority for case generation, mathematical correctness, evidence truth and availability, suspect elimination, hints, scoring, adaptation, accusation/verdict behavior, and serializable case/session state.

React owns semantic controls and accessible overlays. Phaser consumes the projected scene model and renders a small foundation scene; it emits no case truth and is not a second reducer. The current browser shell is intentionally a qualification scaffold, not the final detective world, evidence-station art, deduction board, or verdict production experience.

## Commands

Requires Node 24.x.

    npm ci
    npm run dev
    npm run typecheck
    npm run lint
    npm test
    npm run build
    npm run test:e2e
    npm run test:a11y
    npm run test:phaser-render
    npm run verify

npm run verify is the aggregate credential-free suite used by pull-request CI. It covers the migrated deterministic contracts, browser accessibility lane, production build, and a real Chromium/WebGL Phaser render.

## Static release base

The default Vite base is relative (./) so the built directory can be mounted beneath a versioned release prefix. A host or release job can provide an absolute subpath:

    npm run build -- --base=/game-assets/math-detective/<version>/

The future games-site route is /game-assets/math-detective/<version>/; this repository does not publish or promote that release.

## Repository map

- src/lib/mathDetective/ — migrated game-owned core, scene projection, bounded intents, and Phaser adapter.
- src/app/games/MathDetective.tsx — minimal React/Phaser foundation shell.
- tests/ — migrated contract tests plus standalone browser/real-render coverage.
- docs/migration/levelbest/math-detective/ — immutable historical design and prototype inputs, clearly kept as migration evidence.
- docs/ — standalone authority, architecture, provenance, parity, release, privacy, and IP records.
- scripts/ — credential-free release/build guardrails.

Historical source identity and every migrated destination are recorded in docs/PROVENANCE.md.
