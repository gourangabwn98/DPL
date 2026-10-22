# Verification record

Environment: Windows, Node.js v22.22.1, 22 October 2026.

| Check | Actual result |
|---|---|
| Folder inspection | Empty project; application created from scratch |
| Original Google Form | Web fetch returned inaccessible; questions not extracted |
| npm install | Blocked: registry requests EACCES; no dependencies installed |
| Offline install | Blocked: required AWS SDK package not cached (ENOTCACHED) |
| PostgreSQL via Docker | Blocked: Docker daemon pipe unavailable |
| Type check | Attempted; `tsc` unavailable because install failed |
| ESLint | Attempted; `eslint` unavailable because install failed |
| Vitest unit/integration suite | Attempted; `vitest` unavailable because install failed |
| Production build | Attempted; stops at unavailable `tsc` |
| Dependency-free security tests | **7 passed**, `node --experimental-strip-types --test tests/security.node.mjs` |
| TypeScript/TSX syntax and relative imports | **16 source files passed**, using an available Babel parser after fixing a backend bracket error. This is not a type check. |
| CSS syntax | Passed using an available PostCSS parser |
| Browser/mobile verification | Not run; dependency/database prerequisites unavailable |
| Production deployment / real UPI payment | Not performed |

Local setup update: Docker has been removed from the VS Code run tasks. `npm run dev` now launches a persistent embedded PostgreSQL database, migrations and the app. `node --check scripts/local.mjs` passed. Attempted startup stopped with the expected missing-dependencies message; this new startup path has not been exercised with installed dependencies because npm network access is still restricted. No claim of a running local site is made.

Security checks actually run: random token generation, stable secret-bound idempotency derivation, token hashing, unverified invite suppression, malformed/unsafe invitation rejection, valid verified invitation handling, CSV escaping and formula neutralization. These do **not** substitute for the unrun database/API/build checks.
