# Preview demo AI policy

`lib/demo/policy.ts` exports `isPreviewDemo()` for shared server-side deployment
policy (including follow-up #139). It reads only `VERCEL_ENV === 'preview'` at
request time, regardless of authenticated identity, provider keys or paid consent.
It follows the repository's server-trusted `lib/` convention: dependency-cruiser
rejects client imports by default. The `server-only` package is not installed.

All current AI route methods authenticate first (preserving 401), then return the
same Spanish JSON 403 (`code: PREVIEW_AI_DISABLED`) before rate limiting, input
parsing, receipt duplicate lookups, tool creation, consent access or provider work:
chat POST, parse-entry POST, parse-for-form POST, parse-receipt POST, confirm-paid
GET/POST and costs GET. Production, Vercel Development and local development are
unaffected. New AI methods must call the same guard immediately after auth.

Quick entry and receipt upload already display server errors and retain manual
entry in the surrounding add-entry UI. Chat decodes the disabled error and links
to `/new`. Manual entry and manually transcribing a receipt remain available.

## Non-Vercel demos

Non-Vercel demos are **not covered** when `VERCEL_ENV` is unset. To opt into this
exact policy, the server operator must explicitly set `VERCEL_ENV=preview`; the
app does not infer demo status from a hostname, user ID, `NODE_ENV`, or client
flags. A future dedicated server-only demo flag would need an explicit policy
change and tests.

## Deployment verification

After an authorized Preview redeployment, smoke-check each method above with an
authenticated session: expect JSON 403, the same Spanish message, and no provider
usage. Repeat with paid confirmation present and a previously uploaded receipt;
both must still reject. Signed-out requests must remain 401. This smoke check
requires a deployment and has not been performed as part of the local change.
