# Admin player identity cards

The **Players** tab defaults to a responsive identity-card gallery. All registered
statuses remain available, with the existing name/reference/mobile/team search,
status filter, twenty-per-page pagination, CSV export and table alternative.

Each card displays a portrait or initials, name, cricket role, payment status,
registration reference, mobile, team, entry fee and locality when supplied. Click,
tap or activate a card with the keyboard to play one full 360° turn and open the
existing full profile/payment-review panel. Repeated clicks are blocked during
the one-second turn. Reduced-motion users open the profile without rotation.

The profile shows all collected registration fields, consent flags, registration
date, fee/status, payment submissions and verification history. Existing approval,
rejection, private proof access and WhatsApp gating are unchanged.

## Photos

- Existing registrations work without a photo; cards show initials.
- Players can optionally upload a portrait on the payment page after their
  registration has been saved. This is separate from payment-proof submission.
- Admins can add or replace photos from the full profile panel for old or new
  registrations. Successful uploads update the selected profile and gallery.
- PNG, JPEG and WebP files are limited to 4 MB and decoded/re-encoded through the
  existing image validator. Files remain in the configured private upload store.
- The schema adds nullable `Registration.photoKey` and `photoUpdatedAt` fields.
  There are no required-field changes, no backfill and no destructive migration.
- Run `npm run db:generate` after updating the schema. MongoDB index provisioning
  still uses `npm run db:push`; the new photo fields do not add indexes.
- `GET/POST /api/profile-photo` requires the existing private player token and
  always resolves the token's own registration. It does not accept a player ID.
- `GET/POST /api/admin/players/:id/photo` requires the admin session. Uploads also
  require the configured Origin. Admin photo reads/updates are audited.
- Admin list/detail responses include a protected photo URL and `hasPhoto`, never
  the storage key or private status token. Public tournament responses contain no
  player details or photo URLs. Image responses use `Cache-Control: no-store`.
- Replaced photos are deleted after the metadata update commits. Failed uploads
  preserve the prior photo, and retention cleanup removes photos with registrations.
- No government identity-document upload or verification has been added.

## Verification

`npm run test:integration` covers existing records without photos, owner/admin
access, rejected invalid/oversized uploads, replacements, audit entries, cleanup,
and unchanged payment states. It uses a disposable MongoDB replica set.

`npm run test:ui` checks the actual browser rotation and profile opening, photo
upload/update, initials fallback, reduced motion, table view, existing language
and form persistence, and public/admin layouts in both languages from 320px to
1440px. Browser APIs are fixture-backed; server authorization is tested separately.

The integration runner reuses a generated Prisma client only when its schema
matches the source schema (formatting differences aside), avoiding unnecessary
Windows DLL replacement while a local development API is running.

Verification completed: **59 tests passed** (26 real MongoDB API tests and 33
existing unit/configuration/rules tests). Browser checks passed in both languages,
including the actual full turn, uploaded-photo rendering, reduced motion and
320–1440px layouts. English and Bengali mobile card previews were visually checked.
