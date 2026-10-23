# Verification

The verification workflow is .github/workflows/verify.yml.

- npm run typecheck: TypeScript contracts.
- npm run lint: source lint.
- npm run test:security: token, invitation and CSV protections.
- npm test: unit tests; API integration is skipped unless explicitly enabled.
- npm run test:integration: unit and API workflows against a disposable MongoDB replica set and isolated uploads.
- npm run test:ui: UI checks.
- npm run build: React assets and compiled Express backend.

Tests cover validation, authentication, private status access, payment uploads, storage failures, rejection/resubmission and concurrent approval capacity. Local checks do not prove a live deployment, real payment or production data transfer. Review organiser configuration and staging behavior before release.

## Latest local verification

- TypeScript, ESLint and production build passed.
- Vitest: 55 tests passed, including 22 real MongoDB API integration tests and 7 private-storage configuration checks.
- Dependency-free security suite: 7 tests passed.
- UI checks passed for bilingual rules, language persistence, private-token/form state and 390/768/1440 pixel layouts.
- Build warnings: upstream dependency comment annotations and a frontend chunk over 500 kB; output was generated successfully.
- AWS SDK and embedded PostgreSQL packages are absent from the lockfile.
- Existing private environment files, upload directories and local database data were preserved.
- Production deployment, real payments and existing-data migration were not performed.
