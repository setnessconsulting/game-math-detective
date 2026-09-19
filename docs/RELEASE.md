# Build and release assumptions

GAME-298 produces a static web build only. It does not publish, promote, or roll back a games-site release.

## Asset base

Vite defaults to a relative base (./). Release qualification can build with an exact absolute base such as:

    /game-assets/math-detective/<version>/

The build must be copied into the immutable games-site prefix without rewriting asset URLs. The future entry document is index.html; the future games-site catalog and R2 manifest own version selection.

## Release identity to record later

When GAME-300 creates a hosted preview, its evidence must bind:

- standalone source commit;
- lockfile identity and hash;
- release version;
- aggregate build hash;
- payload file hashes, sizes, and content types;
- immutable asset prefix;
- games-site preview revision and selection configuration.

No production host, catalog promotion, R2 binding, or rollback action is part of GAME-298.
