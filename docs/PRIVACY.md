# Privacy and network posture

The foundation is account-free and playable without runtime network access after its release assets load.

- The core does not use DOM, storage, network, account identity, or uncontrolled clock access.
- Records, resume snapshots, and telemetry buffers are module-scope memory and die with the tab.
- Telemetry facts are primitive, bounded, and allowlisted. No free text, child identity, account identifier, exact latency, or remote sink is present.
- No analytics SDK, Sentry/browser-observability SDK, cookie, localStorage, sessionStorage, IndexedDB, or gameplay API is introduced.
- Speech is optional and local to the browser; captions and visible text remain the authoritative communication path.

The guards in tests/mathDetective.guards.test.ts and scripts/verify-boundary.mjs are fail-closed checks for this posture.
