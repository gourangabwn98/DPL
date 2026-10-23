# Deploy DPL on Vercel with MongoDB Atlas

The deployed site was returning HTTP 500 / FUNCTION_INVOCATION_FAILED from both
`/api/tournament` and `/api/health`. The frontend then tried to decode Vercel's
plain-text error as JSON. The precise exception in that deployment requires its
private runtime log. The current source has restored Vercel support and removes
the persistent-filesystem requirement when running on Vercel.

## 1. Deploy the updated source

Include `vercel.json`, `api/index.ts`, the updated MongoDB schema, storage adapter,
package scripts and lockfile. Deploy the repository root, not just `dist`.

Vercel project build settings:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Node.js | 22.x |
| Install command | `npm ci` |
| Build command | `npm run build:vercel` |
| Output directory | `dist` |

The build script regenerates Prisma, synchronizes MongoDB collections/indexes, and
builds the application. It does not use reset or `--accept-data-loss`. If existing
records violate a unique index, the deployment stops instead of deleting records.

## 2. Set the Vercel environment variables

In the project settings, add these to **Production**. Add suitable separate values
to Preview if you deploy previews. Set credentials as secret values.

```dotenv
DATABASE_URL=mongodb+srv://USER:ENCODED_PASSWORD@CLUSTER/dpl?retryWrites=true&w=majority
APP_ORIGIN=https://dpl-lac.vercel.app
TOKEN_SECRET=YOUR_EXISTING_SECRET_OR_A_NEW_RANDOM_VALUE_OF_AT_LEAST_32_CHARACTERS
STORAGE_DRIVER=mongodb
```

Use the exact Atlas driver URI, including a database name. URL-encode special
characters in the database username/password. Atlas must allow connections from
both the Vercel build environment and Functions. Use an appropriate network-access
configuration and a database user restricted to this database. Do not use the
local `mongodb://127.0.0.1:27018/...` URI in Vercel.

Preserve the existing `TOKEN_SECRET` when redeploying a tournament with players.
For a new tournament, generate a value locally:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not put credentials in `VITE_` variables, source files, chat messages or public
screenshots. Vercel supplies its own `VERCEL` environment indicator. The app
defaults to MongoDB upload storage there, but setting the driver explicitly avoids
stale `local` configuration. `UPLOAD_DIR` is not required on Vercel.

## 3. Create or reset the administrator

Create the first administrator from a trusted machine that can connect to this
same Atlas database. In a private local `.env`, set `DATABASE_URL`, `ADMIN_EMAIL`,
and a new `ADMIN_PASSWORD` of at least 14 characters, then run
`npm run admin:create`. If an admin already exists and the password must change,
run `npm run admin:reset` with that admin's email and a new password. The reset
revokes existing admin sessions. Remove `ADMIN_PASSWORD` from both local and
Vercel environments after setup. Environment variables alone do not provision
an admin. If the local command times out, add that machine's IP in Atlas Network
Access before retrying.

## 4. Configure the payment QR

Add the genuine organiser QR file at `public/images/payment-qr.png` in the source
repository and set `PAYMENT_QR_READY=true` after verifying the payee. Optional
`UPI_ID` and `PAYEE_NAME` are public payment instructions, not banking credentials.
QR readiness is independent of the API startup error.

## 5. Redeploy and verify

Changes to Vercel environment variables apply to new deployments. Redeploy the
updated code after saving them. Check:

- `https://dpl-lac.vercel.app/api/health` returns JSON `{ "ok": true }`.
- `/api/tournament` returns JSON settings and availability.
- `/register` loads after a direct URL navigation.
- Register a staging player, upload a screenshot/photo, and verify private admin
  access, manual approval, rejection/resubmission and invitation gating.

If the build fails, inspect its build log for Atlas authentication/network/index
errors. If the function returns 503, inspect Runtime Logs for the named invalid
setting or database startup failure. Never share complete credential values.

If Runtime Logs say `Vercel requires STORAGE_DRIVER=mongodb for persistent private
uploads`, an existing Vercel environment variable is set to `local`. Change
`STORAGE_DRIVER` to `mongodb` for Production and redeploy. The API handler uses
Node's response methods so startup errors return JSON even before Express has
initialized the response.

## Private screenshots and player portraits

With `STORAGE_DRIVER=mongodb`, image bytes are stored in the `PrivateImage`
collection, keyed by the existing opaque storage keys. API responses never expose
this collection or its binary data publicly. The existing authenticated proof and
photo routes enforce access. Replacement/retention cleanup deletes stored images.

Uploads and re-encoded image responses are capped at 4 MB, below the Vercel
Function payload limit and MongoDB's 16 MiB document limit. This is suitable for
the tournament's small capped images; it does not provide unlimited image storage.
The local filesystem adapter remains available for development/persistent hosts.

If existing registrations reference local files, switching drivers does not copy
those files automatically. Keep the originals. On a trusted machine with the
same target database and the source files, set `COPY_UPLOADS_SOURCE_DIR` and run:

```sh
npm run uploads:copy
npm run uploads:copy -- --apply
```

The first command is a read-only preview. The second copies referenced images,
skips existing MongoDB keys, and never deletes source files. Verify the images
before switching an existing deployment. This tool does not move registration
records between different databases.

## Verification

The Vercel handler is tested for JSON startup errors, retry after initialization
failure, and cached successful initialization. Real MongoDB API tests cover private
image persistence, authorised retrieval, replacements, and unchanged payment
status. The full suite currently has **69 passing tests**.

Cloud deployment and Atlas credentials are not changed merely by editing these
files. A successful local test does not confirm the live deployment is healthy.

Official references: [Vercel environment variables](https://vercel.com/docs/environment-variables),
[Vercel Function limits](https://vercel.com/docs/functions/limitations),
[Atlas network access](https://www.mongodb.com/docs/atlas/security/ip-access-list/),
[MongoDB document limits](https://www.mongodb.com/docs/manual/reference/limits/).
