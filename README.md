# DHANDALSHA PREMIER LEAGUE

Cricket registration and manual payment review built with MongoDB, Express, React and Node.js (MERN), using TypeScript and Prisma's MongoDB connector. Default entry fee: INR 100; capacity: 150 approved players.

## Run locally

Install Node.js 22.12+ and run:

~~~sh
npm ci
npm run dev
~~~

Open http://localhost:5173. The launcher starts a persistent local MongoDB replica set, generates the database client, syncs indexes, and starts Express and Vite. The first run downloads the MongoDB binary. Local database files persist in ignored .local-mongodb/; Ctrl+C stops the processes.

When .env is missing, the launcher creates it from .env.example with a random token secret. Preserve existing environment files. Set the server-only DATABASE_URL with a database name. The launcher automatically uses Atlas/remote connections externally, including when an older .env still requests embedded mode. LOCAL_DATABASE_MODE=external explicitly uses an existing database. See [MongoDB setup](MONGODB_SETUP.md).

VS Code includes install, MongoDB index synchronization, and local run tasks.

## Administrator and payments

While the development database is running, set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 14 characters in the private environment, then run npm run admin:create. Remove the password afterwards. Sign in at /admin/login. The command refuses additional first-admin creation once an administrator exists. For an existing account, set ADMIN_EMAIL and a new ADMIN_PASSWORD and run npm run admin:reset from a trusted machine connected to the same database. Reset revokes that admin's sessions; remove the password from the environment afterwards. Merely setting these variables in Vercel does not create or update an admin account.

Supply the organiser's genuine QR at public/images/payment-qr.png, verify the payee, then set PAYMENT_QR_READY=true. No payment QR is bundled. Set UPI_ID and PAYEE_NAME only from verified organiser information.

Keep WHATSAPP_INVITE_URL server-only and set WHATSAPP_INVITE_VERIFIED=true only after checking the intended group. Only approved players receive the invitation.

## Registration workflow

Awaiting Payment -> Under Review -> Approved / Rejected. Rejected players may submit corrected payment proof. Pending applications do not reserve places. Payments are reviewed manually; the app does not verify bank transfers.

MongoDB transactions update a singleton settings document to serialize capacity checks and mutations. Write conflicts retry the whole transaction. Unique indexes protect mobile numbers, references, idempotency keys, and payment references. A replica set is required, including for local development.

Players use private bearer tokens for status access. Tokens are stored as hashes; public references and phone numbers do not grant access. Preserve TOKEN_SECRET when moving an existing database so idempotent registration retries continue to work.

Screenshots are decoded, stripped of metadata, re-encoded, and stored in a private filesystem directory. Only authenticated administrators can retrieve them. The upload directory is never served as static content.

## Project layout

| Path | Purpose |
|---|---|
| src/ | React pages, bilingual rules, forms and styling |
| shared/ | Shared validation and tournament rules |
| server/ | Express API, authentication, MongoDB transactions and private uploads |
| prisma/schema.prisma | MongoDB models and indexes |
| scripts/mongo-local.mjs | Persistent local development launcher |
| scripts/mongo-server.mjs | Replica-set lifecycle for development and tests |
| scripts/test-mongodb.mjs | Isolated database integration runner |
| scripts/test-ui.mjs | UI checks |
| tests/ | Unit, security and API integration tests |
| public/images/ | Organiser-supplied public assets |

## Environment

Use .env.example for supported names. Never commit real environment files or prefix credentials with VITE_.

| Variable | Purpose |
|---|---|
| DATABASE_URL | MongoDB replica-set connection string with database name |
| LOCAL_DATABASE_MODE | auto detects the connection; external uses an existing database |
| TOKEN_SECRET | Random secret of at least 32 characters |
| APP_ORIGIN | Exact browser origin; HTTPS in production |
| PORT, NODE_ENV, TRUST_PROXY | Listen port, runtime mode and trusted proxy hop count |
| UPLOAD_DIR | Private uploads; absolute persistent-volume path in production |
| PAYMENT_QR_PATH, PAYMENT_QR_READY | Fixed image path and genuine-image activation |
| UPI_ID, PAYEE_NAME | Optional verified public payment information |
| WHATSAPP_INVITE_URL, WHATSAPP_INVITE_VERIFIED | Private invitation and verification gate |
| RETENTION_DAYS | Positive retention period, default 180 days |
| ADMIN_EMAIL, ADMIN_PASSWORD | Initial administrator provisioning only |

## Checks

~~~sh
npm run db:generate
npm run typecheck
npm run lint
npm run test:security
npm run test:integration
npm run test:ui
npm run build
~~~

npm test runs unit tests and skips database integration by default. test:integration starts its own disposable replica set and executes the full Vitest suite with private test uploads. Never manually enable destructive integration tests against tournament data. CI runs these checks without container services.

## Production

For Vercel, use [the Vercel + Atlas setup guide](VERCEL_SETUP.md). The app has an
API function entry point and supports private MongoDB image storage there. The
persistent-host instructions below apply when using `STORAGE_DRIVER=local`.

1. Provision a MongoDB replica set with restricted credentials, TLS, backups and tested restores. Configure the database connection privately.
2. Use a persistent Node.js host with a private persistent upload volume. Set UPLOAD_DIR to its absolute path outside public/ and dist/. Back up uploads together with the database. Ephemeral/serverless filesystems cannot retain payment screenshots.
3. Set NODE_ENV=production, an HTTPS APP_ORIGIN, a random TOKEN_SECRET, and the correct TRUST_PROXY hop count. Configure the genuine QR and verified invitation. Remove provisioning passwords from runtime configuration.
4. Run npm ci, npm run db:generate, npm run db:push, and npm run build. Review index/schema changes first; do not use reset or data-loss flags.
5. Run npm start under a service manager. Express serves the built React application, public images, and /api on the configured port. Terminate HTTPS at your trusted reverse proxy.
6. Use one app host with its upload volume. Multiple hosts require the same private shared filesystem; production rate limits and sessions already use MongoDB. Do not expose upload paths, database ports, tokens, request bodies or credentials in logs.
7. Monitor health at /api/health, storage capacity, errors and backups. Schedule npm run data:purge under the same private environment after reviewing retention; it deletes expired registrations and proofs.
8. Verify registration, duplicate retries, uploads, administrator sign-in, rejection/resubmission, concurrent capacity enforcement and private status access in staging before accepting payments.

Existing database folders, private uploads and environment files are intentionally preserved. Removing legacy infrastructure does not migrate existing records or external screenshot objects. Any existing deployment must have its data and proofs copied and verified before cutover.

## Organiser checks

Confirm tournament dates, venue, eligibility, refund/cancellation policy, privacy contact, retention and configurable fields. Review Bengali/English rules and resolve draft wording before publication. Supply genuine branding and payment information. No payment, live deployment or data migration is implied by this source repository.
