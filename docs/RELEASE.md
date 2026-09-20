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

No production host, catalog promotion, R2 binding, or rollback action was part of the original
GAME-298 extraction scope. Those downstream actions are now recorded separately below.

## Current downstream release record (2026-09-20)

The Math Detective static release was published and promoted by
[`games-site` PR #10](https://github.com/setnessconsulting/games-site/pull/10), merged as
`d596206ff8999f3575f92e950399864fe7e7efd5`. The live catalog selects:

- source SHA: `6b23e239b48871c0f4a2bf29343d9aebd0ccf9f5`;
- version: `2026.09.20-visual-pass.1`;
- immutable R2 prefix: `math-detective/2026.09.20-visual-pass.1/`;
- entry: `index.html`.

The one-tester qualitative acceptance policy is recorded in
`PLAYTEST_PROTOCOL.md`. The owner reported that one child tester played the hosted candidate and
judged it good enough for production; structured device, timing, and T0–T3 fields were not
captured. Production route verification confirmed the collection card, direct play route, exact
immutable iframe URL, and transition from briefing to the first evidence station.

Rollback remains a documented operational follow-up: the previous known-good catalog deployment
is retained by Cloudflare, and the immutable Math Detective R2 prefix must not be deleted or
overwritten.
