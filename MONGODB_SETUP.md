# MongoDB setup

The application uses MongoDB through Prisma. Transactions require a replica set; a standalone instance is insufficient.

## Local development

Run npm ci and npm run dev. The launcher uses port 27018 by default and persists data under ignored .local-mongodb/. Its first launch downloads the MongoDB binary. Keep this directory to retain development registrations.

For Atlas, set a private DATABASE_URL that includes a database name. The launcher detects remote connections automatically, even if an old .env still says embedded. Set LOCAL_DATABASE_MODE=external to explicitly use an existing local or remote replica set. URL-encode reserved characters in credentials. Never put the URI in client code or VITE_ variables.

## Production setup

1. Create a database user restricted to the tournament database and configure network access for the application host.
2. Set DATABASE_URL privately using the connection string supplied by your database operator.
3. Back up existing data. Run npm run db:generate and review/run npm run db:push to synchronize indexes. MongoDB uses schema synchronization rather than SQL migration files. Never pass reset or data-loss flags to a production database.
4. Set an absolute UPLOAD_DIR on a persistent private volume outside the public frontend directories. Images remain on disk; MongoDB contains their metadata.
5. Start the built application with npm start, then verify /api/health and the full registration/review workflow.

The application initializes a missing singleton settings document during startup. Unique indexes must exist before accepting registrations. Capacity-sensitive mutations share a transaction lock and retry write conflicts.

## Existing data

Legacy local database files, ignored environment backups, and private uploads have not been deleted. This cleanup does not copy records into MongoDB or retrieve externally stored proofs. Before an existing production deployment is moved, back up both records and images, pause writes, and separately plan and verify the transfer. Preserve identifiers, relationships, storage keys and TOKEN_SECRET. An empty replacement database does not contain old registrations.

## Tests

npm run test:integration starts a separate disposable replica set and private upload directory. It does not use the application database URI. Unit-only runs use npm test; full CI also runs typecheck, lint, security checks, UI tests and build.
