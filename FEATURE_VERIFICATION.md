# Official rules and approved-player WhatsApp access

The existing architecture, registrations, payment uploads, administrator sessions,
capacity limit and ₹100 fee are preserved. No schema migration is required.

## Rules

- `/rules` uses the existing language selector and persistent `dpl-language` choice.
- Nine numbered rule slots render from paired English/Bengali records through the
  existing `t` translator. Language changes do not remount registration forms.
- The initial transcription is in `server/tournament-rules.ts`, not in public
  frontend assets. Rules 2, 3, 5 and 8 are publishable from the supplied wording.
- Rules 1, 4, 6, 7 and 9 remain unconfirmed. Public responses omit both translations
  for those entries and show a translated confirmation notice instead.
- No poster image was supplied in this session; source comparison is pending.
- Authenticated **Admin → Rules** shows all nine editable pairs, review notes,
  publication checkboxes, and a preview using the existing language selector.
  Editing either translation clears that rule's publication confirmation.
- Save persists a versioned JSON document in the existing `Settings.rules` text
  column. Previous plain-text content is retained in `legacyText` and displayed in
  an expandable archive. Existing registration records are not modified.
- `/api/admin/rules` GET/PUT requires the existing admin session; PUT also requires
  the configured Origin. Saves create `UPDATE_RULES` audit entries. General
  settings cannot bypass rule review by overwriting the old text field.
- Rule 9 cannot be published with its unresolved source phrase or placeholder
  English eligibility draft. The organiser must enter the actual locality/group.
- Review notes about liability and ID verification are admin guidance, not extra
  tournament rules. There is no Aadhaar/Voter ID upload or storage feature.

## Invitation and payment review

The exact supplied invitation is configured only in the local `.env`.
`WHATSAPP_INVITE_VERIFIED=false` remains intentional. Before production:

1. Open that server-configured URL manually and confirm the intended group.
2. Set the same server-only URL on the production host.
3. Set `WHATSAPP_INVITE_VERIFIED=true` only after verification, then restart/deploy.

No invitation is returned for `AWAITING_PAYMENT`, `UNDER_REVIEW`, or `REJECTED`,
even when query parameters claim approval. `/api/status` requires a 64-character
private token whose hash matches a registration. Approved status alone also does
not bypass the manual verification flag. Responses use `Cache-Control: no-store`.

The existing dashboard already supports filtering pending reviews, reading the
transaction ID, opening an authenticated private screenshot, approving/rejecting,
and recording the deciding administrator and audit history. Proof upload only
sets `UNDER_REVIEW`. Rejection reasons and resubmission remain supported. The
approved player's existing button opens WhatsApp; it does not record membership.

## Verification commands

- `npm test`: unit/rendering tests; database tests skip without explicit opt-in.
- `npm run test:integration`: creates an isolated, disposable PostgreSQL cluster
  and runs the full suite; never targets the existing application database.
- `npm run test:ui`: launches a separate Vite server and headless Chrome, with
  fixture API responses. Set `CHROME_PATH` if Chrome is installed elsewhere.
  Checks all nine pairs, live switching, language persistence, registration input
  values, request key, private token, routing, one selector and 390/768/1440px
  layouts. Fixture eligibility wording is test-only, not an official correction.
- `npm run lint`, `npm run typecheck`, `npm run build`.

The integration suite covers all unapproved statuses, forged approval parameters,
private token protection, unauthenticated approval attempts, proof access,
approval/rejection audits, the verification gate, rules publication protection,
legacy text preservation and existing registration/payment/capacity workflows.

## Files changed

Final verification on 23 October 2026:

- Full disposable PostgreSQL suite: **46/46 passed** (20 API integration,
  7 rules/rendering, 19 existing validation/upload/security tests).
- Headless browser regression checks: **passed**.
- Full ESLint, TypeScript check and production build: **passed**.
- Production frontend asset scan: **passed**; the configured private invitation
  and uncertain draft phrases are absent.
- Build retains non-blocking dependency annotation and bundle-size warnings.
- An initial parallel check hit Windows resource limits; final checks were rerun
  sequentially and passed. No application database was used by the test runner.

- Rules data, validation and API: `shared/rules.ts`, `shared/validation.ts`,
  `server/tournament-rules.ts`, `server/app.ts`.
- Existing language/UI integration: `src/language.tsx`, `src/rules.tsx`,
  `src/pages/public.tsx`, `src/pages/rules-editor.tsx`, `src/pages/admin.tsx`,
  `src/style.css`.
- Tests and checks: `tests/rules.test.tsx`, `tests/integration.test.ts`,
  `scripts/test-ui.mjs`, `scripts/test-integration.mjs`, `package.json`.
- Rate-store metadata: `server/rate-store.ts` exposes its existing namespace to
  express-rate-limit validation; actual counter keys and limits are unchanged.
- Configuration and notes: local ignored `.env` (invitation only), `.env.example`,
  `README.md`, `FEATURE_VERIFICATION.md`.
