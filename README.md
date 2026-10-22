# DHANDALSHA PREMIER LEAGUE — SEASON 1

Working application source for DHANDALSHA AGRABHAINI SANGHA. React + TypeScript frontend; Express 5 API; Prisma 6 + PostgreSQL; private image storage; manual payment approval. Default fee ₹100 and 150 **approved** players.

**Release status:** implementation is supplied, but this environment could not install dependencies (npm network access returned EACCES), and Docker's PostgreSQL daemon was unavailable. The full application has not been run or production-verified. See `VERIFICATION.md` for exact checks. Do not collect payments until the launch checklist below is complete.

## Local setup in VS Code — no Docker required

Install Node.js 22.12+ and open this directory in VS Code. The development launcher starts a real, persistent PostgreSQL database automatically using `embedded-postgres`. No Docker, Windows database service, or separate PostgreSQL installation is required. [Upstream package documentation](https://github.com/leinelissen/embedded-postgres) describes its Windows support and setup. Allow npm installation scripts so the platform-specific database binaries are configured.

```powershell
npm.cmd install
npm.cmd run dev
```

If `.env` already exists, do not overwrite it. The local launcher creates it with a random secret when missing. If you copied the example manually, replace `TOKEN_SECRET` before starting. Generate it with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Open http://localhost:5173. `npm run dev` starts local PostgreSQL on port 54329, creates the `dpl` database when needed, generates Prisma, applies migrations and starts the API/frontend. Data stays in ignored `.local-postgres/` across restarts. Keep the terminal open; Ctrl+C stops the app and database. Do not delete that directory if you want to keep registrations. The database credentials must match the values used on its first initialization.

In VS Code you can also run **Terminal → Run Task → DPL: Install dependencies**, followed by **DPL: Run locally (no Docker)**, or press Ctrl+Shift+B for the run task. The existing local `.env` is already prepared. The launcher is development-only; use a managed/native PostgreSQL service in production.

To use PostgreSQL you installed yourself instead, create the database, set `LOCAL_DATABASE_MODE=external` and your own `DATABASE_URL` in `.env`; `npm run dev` then runs migrations and the app against that existing server. Vite proxies `/api` to port 3001. The genuine QR is served by Vite in development and Express in production.

## First administrator

Set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 14 characters in `.env`, then:

```powershell
npm.cmd run admin:create
```

Remove `ADMIN_PASSWORD` from `.env` immediately afterwards. Sign in at `/admin/login`. The CLI refuses to create another administrator once an account exists. Passwords use Argon2id. No admin credentials or password hashes are sent to the frontend. To perform account recovery, use an audited operator procedure against the database to replace an Argon2id hash and delete that admin's sessions. There is no public password-reset endpoint.

For embedded local mode, leave `npm run dev` running and execute `admin:create` in a second VS Code terminal so the local database is available.

## Payment QR and WhatsApp setup

1. Obtain the organiser's **genuine** QR image. Put it at **`public/images/payment-qr.png`**. A PNG file is deliberately not included, so no fake QR can be mistaken for a payment code.
2. Confirm the payee through a real UPI scan, then set `PAYMENT_QR_READY=true`. Until then the payment screen says “Payment QR will be available soon.” `PAYMENT_QR_PATH` must remain `/images/payment-qr.png`. Replace the image through a controlled deployment, never through the admin UI. Keep the deployed public directory read-only.
3. Set `UPI_ID` and `PAYEE_NAME` only if the organiser supplies and verifies them. These values are public payment information.
4. The organiser's replacement invitation has been configured in the local server-only `.env`, with its exact supplied query parameters. It remains unverified: automated access could not open the invitation. Open the URL from the server configuration manually, confirm the intended group with the organiser, and enable it only after that check. Do not place the invitation in frontend environment variables, source code, HTML, or metadata.
5. Put the confirmed HTTPS URL in server-only `WHATSAPP_INVITE_URL`, then set `WHATSAPP_INVITE_VERIFIED=true`. Restart/redeploy. The validator rejects whitespace, credentials, non-HTTPS, nonstandard ports and hosts other than `chat.whatsapp.com`.
6. To disable or replace it, change those server variables and restart. Unapproved players never receive the URL. Approved players see an unavailable message while it is disabled. A click opens WhatsApp; it does not confirm membership.

## Workflow and concurrency

`Awaiting Payment → Under Review → Approved / Rejected`. Rejected players may upload a corrected proof and return to Under Review. Approved registrations cannot be reviewed again through the API.

Pending registrations **do not reserve places**. Many players can submit applications while places remain; only the first payments approved within capacity are accepted. Players see this before registration. Organisers should manage the queue and confirm refund rules before taking entry fees. The fee is snapshotted on each application; changing settings affects only new applications.

All registration, review and settings mutations lock the singleton settings row in a PostgreSQL transaction. Approval checks accepted count while holding that lock. SQL triggers also enforce capacity on approval and prevent lowering capacity below accepted count. The settings row must not be deleted. Unique database constraints protect mobile numbers, payment references, request keys, public references and token hashes. Default isolation is PostgreSQL Read Committed; the lock is acquired before subsequent counts. Do not change transaction isolation without re-evaluating concurrency semantics.

The browser generates a random UUID idempotency key, retained in session storage until registration succeeds. Retries with the same payload return the same registration and access token. A changed payload with that key fails. Duplicate mobiles cannot register again. Keep the key private. Its HMAC-derived 256-bit status token is stored only as a SHA-256 hash in the database. Public reference IDs provide no access. Token lookup uses an Authorization header, never URL query strings. Save/download the token on the payment page; closing the browser may clear session storage. There is no insecure “lookup by phone/reference” fallback. Rotating `TOKEN_SECRET` changes retry derivation but does not invalidate saved status tokens.

## Architecture and files

| Path | Responsibility |
|---|---|
| `src/main.tsx`, `src/ui.tsx` | App routing, tournament context and shared accessible form components |
| `src/pages/public.tsx` | Homepage, tournament details, rules, privacy and terms |
| `src/pages/player.tsx` | Registration, payment-proof and private status journey |
| `src/pages/admin.tsx` | Admin authentication, players, reviews, settings and audit screens |
| `src/api.ts`, `src/style.css` | API client, status labels and responsive league identity |
| `shared/validation.ts` | Shared strict player/settings schemas and configurable field keys |
| `server/app.ts` | HTTP contracts, middleware, authentication and transaction workflows |
| `server/db.ts` | Prisma client and tournament-row transaction lock |
| `server/security.ts`, `server/config.ts` | Tokens, invite validation, CSV formula protection, env checks |
| `server/storage.ts` | File-content validation, decode/re-encode, private disk/S3 adapters |
| `server/cli.ts` | First admin provisioning and retention purge |
| `prisma/schema.prisma`, `prisma/migrations/` | Typed models, unique indexes, constraints, capacity triggers |
| `tests/` | Unit tests, dependency-free security tests and real PostgreSQL integration tests |
| `public/images/` | Organiser-supplied public QR/logo/poster assets |

Pages: `/`, `/details`, `/register`, `/payment`, `/payment-proof`, `/confirmation`, `/status`, `/rules`, `/privacy`, `/terms`, `/closed`, `/admin/login`, `/admin`. Player management, payments, settings and audit logs are tabs within `/admin`.

The visual identity uses original decorative cricket artwork, dark green, gold, responsive cards and restrained motion. The badge is typographic and is not represented as an official organiser logo. Add genuine branding when supplied. Bengali uses system font fallbacks; self-host a licensed Noto Sans Bengali font for consistent rendering across devices.

## API contracts

All errors use `{ "error": "actionable message" }`. No public API lists players.

| Endpoint | Access and behavior |
|---|---|
| `GET /api/tournament` | Public, settings + real accepted count and availability; no contacts of players or invite |
| `POST /api/registrations` | Same-origin JSON; `Idempotency-Key` UUID; validated player; returns reference, private token, status |
| `GET /api/status` | `Authorization: Bearer <private token>`; limited status and review history; invitation only if Approved |
| `POST /api/payment` | Same bearer; multipart `proof`, `transactionId`, `declaration=true`; returns Under Review only |
| `POST /api/admin/login` | Same-origin JSON email/password; HttpOnly session cookie |
| `POST /api/admin/logout`, `GET /api/admin/me` | Authenticated session |
| `GET /api/admin/dashboard` | Status counts and tournament settings |
| `GET /api/admin/players?q=&status=&page=` | Authenticated; paginated 20 per page; search reference/name/mobile/team |
| `GET /api/admin/players/:id` | Authenticated; full details, submissions and verification history |
| `GET /api/admin/proofs/:id` | Authenticated image bytes; no public storage URLs |
| `POST /api/admin/players/:id/review` | Authenticated + same-origin; `{status:"APPROVED" or "REJECTED",reason:string}` |
| `PUT /api/admin/settings` | Authenticated + same-origin; full validated editable settings |
| `GET /api/admin/export` | Authenticated CSV export; formula-neutralized and audited |
| `GET /api/admin/audit?page=` | Authenticated, 50 logs per page |
| `GET /api/health` | Database readiness; no sensitive details |

Name, mobile, role and consent are mandatory. Additional proposed fields default to hidden. Enable optional/required fields through Settings only after organiser confirmation. Unknown/status fields are rejected. Address, village, district, state, PIN, age, WhatsApp, email, category, styles, team and experience are supported. Age (rather than date of birth) minimizes personal-data collection. Known minors require a guardian consent checkbox. Frontend and backend validate entries, with the server also applying the current field configuration.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL URL; use TLS with managed production databases |
| `LOCAL_DATABASE_MODE` | Development launcher: `embedded` (default, no Docker) or `external` (existing PostgreSQL) |
| `TOKEN_SECRET` | Random 32+ character HMAC secret; secret manager in production |
| `APP_ORIGIN` | Exact browser origin; HTTPS required in production; used for mutation origin checks |
| `PORT`, `NODE_ENV` | API listen port and production behavior |
| `TRUST_PROXY` | Number of trusted reverse-proxy hops; 0 locally; set precisely for your deployment |
| `PAYMENT_QR_PATH`, `PAYMENT_QR_READY` | Fixed path and explicit genuine-image activation |
| `UPI_ID`, `PAYEE_NAME` | Optional verified public payment instructions |
| `WHATSAPP_INVITE_URL`, `WHATSAPP_INVITE_VERIFIED` | Server-only invitation and verification gate |
| `STORAGE_DRIVER`, `UPLOAD_DIR` | Local private storage for development; `s3` required in production |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` | Private S3 or compatible bucket; endpoint optional |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Restricted storage credentials; prefer workload IAM instead |
| `RETENTION_DAYS` | Positive integer; default 180; reflected in privacy notice and purge job |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First-admin CLI only; remove password after provisioning |
| `TEST_DATABASE_CONFIRMED` | Explicit destructive integration-test opt-in, test environment only |

Never prefix secrets with `VITE_`, put them in client code, commit `.env`, or log tokens/credentials.

## Verification commands

```powershell
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
node --experimental-strip-types --test tests/security.node.mjs
npm.cmd run build
```

Integration tests are skipped unless explicitly enabled. To run them, create a **separate disposable database named `dpl_test`**. Never point test commands at real tournament data:

```powershell
# Create dpl_test on a disposable PostgreSQL server using psql/pgAdmin first.
# Substitute the actual server credentials and port here.
$env:DATABASE_URL='postgresql://dpl:YOUR_TEST_PASSWORD@localhost:5432/dpl_test?schema=public'
$env:TOKEN_SECRET='test-only-secret-012345678901234567890'
$env:TEST_DATABASE_CONFIRMED='true'
npm.cmd run db:migrate
npm.cmd test
Remove-Item Env:TEST_DATABASE_CONFIRMED
Remove-Item Env:DATABASE_URL
Remove-Item Env:TOKEN_SECRET
```

Tests cover schema rejection, duplicates, idempotent retries, concurrent approval capacity, private status lookup, invitation gating, admin auth and unauthorised approvals, rejection/resubmission, malicious/missing uploads, failed storage writes, private screenshots, date closure and errors. The integration suite deletes its disposable records and proofs. Use local proof storage during tests. For schema changes use `npm run db:dev -- --name change_description` in development and review generated SQL; preserve the custom capacity triggers. Use `db:migrate` in production.

`.github/workflows/verify.yml` supplies a network-enabled CI route with a disposable PostgreSQL service and the complete check sequence. It has not been executed here. Its bootstrap install supports the current absence of a lockfile; commit a reviewed lockfile before release so CI uses `npm ci`.

## Production deployment

1. Complete organiser confirmations below; install dependencies on a network-enabled machine. Commit the resulting `package-lock.json` after dependency/security review; subsequent deployments should use `npm ci`. No lockfile was fabricated here because install was blocked.
2. Provision PostgreSQL 17 with encrypted backups, restricted database credentials and TLS. Apply migrations once as a release step. Test restore procedures.
3. Provision a private S3-compatible bucket, block public access and restrict IAM to Get/Put/DeleteObject on this bucket. Enable encryption and TLS; this adapter requests AES256 encryption. Confirm your compatible service supports it. Use `STORAGE_DRIVER=s3` and bucket/region/env credentials or workload IAM. Filesystem uploads are rejected in production to prevent ephemeral data loss.
4. Set `NODE_ENV=production`, `APP_ORIGIN=https://your-domain`, `TOKEN_SECRET`, database/storage secrets and confirmed payment/invitation configuration. Do not ship `ADMIN_PASSWORD` in the runtime environment. Mount/copy `public/images` with the genuine QR.
5. Run `npm install`, `npm run db:generate`, `npm run db:migrate`, `npm run build`. Start using `npm start` under a service manager. The single Express service serves `dist`, `/images`, and `/api` on PORT. Runtime requires `dist`, `dist-server`, `public`, production node modules and the generated Prisma client.
6. Terminate TLS at a trusted reverse proxy; forward requests to this one app process, set body limit around 6 MB and suitable upload timeouts. Set `TRUST_PROXY` to the exact trusted hop count. Deny direct access to private upload directories, secrets and database ports. Avoid logging Authorization, cookies, request bodies or tokens.
7. Run one app instance with the supplied in-process rate limiters. Add a shared rate-limit store or edge-wide login/registration throttling before multi-instance deployment; database capacity and sessions already support shared access. Configure monitoring for health, errors, storage failures, disk use and backup success.
8. Schedule `npm run data:purge` daily using the same database/storage environment. It removes old proofs, registrations, expired sessions and audit logs. Apply a documented backup expiry policy as well. Interrupted uploads can leave orphan objects; periodically reconcile storage keys against Payment records, deleting only unreferenced objects older than 24 hours after review. Do not put a blanket 180-day bucket lifecycle on all proofs since resubmissions may be recent.
9. Perform the entire real-device flow on Android and desktop, invalid/error cases, manual review and the test suite against staging. Verify the genuine payment payee and private invitation with the organiser. This delivery does not claim a real payment or deployment succeeded.

Sessions are database-backed, fixed 8-hour expiry, HttpOnly, SameSite Strict, Secure in production, with fresh random tokens at login. Mutations require the configured Origin to mitigate CSRF. Helmet applies a restrictive same-origin CSP, framing protection and security headers. Image magic bytes plus full decoding enforce PNG/JPEG/WebP, 4 MB and 20-megapixel limits; images are re-encoded to JPEG with metadata removed and random safe filenames. Storage objects are never exposed publicly. Audit records record login, views, exports, settings changes and payment decisions. Rejection history records the deciding admin, time and reason. The platform does not automate bank verification, send unsolicited messages or mark a WhatsApp join as complete.

## Organiser confirmations and release blockers

- Original Google Form could not be fetched via the web tool; no questions are represented as extracted from it. Confirm which configurable fields to enable.
- Supply the original poster and use **Admin → Rules** to review the paired Bengali/English wording. Rules 1, 4, 6, 7 and 9 remain drafts pending organiser confirmation. The locality/group in rule 9 must be resolved in both languages before publication. No identity-document collection has been added.
- Supply genuine logo/poster imagery and fixed payment QR. Current badge and artwork are decorative.
- Confirm dates, venue, eligibility, contact/privacy contact, fee collection timing, cancellation/refund policy and retention policy. Dates, venue, phone and UPI were not invented.
- Validate the supplied invitation and configure the verified value privately.
- Install dependencies, review/pin the lockfile, run migrations, all test suites, lint/typecheck/build and browser/mobile QA. Configure production storage, backups, retention scheduling and monitoring.

No hosting was deployed. No payment was verified. No tournament date or venue is implied by the design.
