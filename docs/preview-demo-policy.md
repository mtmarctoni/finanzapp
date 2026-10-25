# Preview demo policy

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

## Preview mutation budgets (#139)

`lib/demo/mutations.ts` applies only when `VERCEL_ENV === 'preview'`, at request
time. Authentication runs first. It reserves weighted work atomically in PostgreSQL
before any domain write; routes return JSON with `code`, `error`, `retryAfter`
and HTTP 429 / `Retry-After`. Actions return a serializable `{ ok: false, code,
status, error, retryAfter }` instead of throwing a message Next.js might hide in
production. Finance form, quick-add and finance-table consumers preserve inputs
or restore optimistic rows and display the Spanish retry guidance. HTTP-based
recurring, crypto, merchant and API-key consumers also display the guidance.

| Policy            | Write units | Window     |
| ----------------- | ----------: | ---------- |
| Per visitor       |          60 | 60 seconds |
| Per visitor       |       1,000 | 24 hours   |
| All demo visitors |         300 | 60 seconds |
| All demo visitors |       5,000 | 24 hours   |

These are independent, **first-accepted-write-anchored fixed windows**, not
sliding windows or calendar days. Each bucket expires at its own window end;
requests do not extend its expiry. A burst can straddle a window boundary. Retry time
is the longest remaining window among policies that cannot accept the requested weight.
The PostgreSQL function checks all four counters before incrementing any: a denied request
does not consume other budgets. Concurrent reservations across processes are
atomic. Successful reservations are not refunded for DB errors, missing-owned
rows, receipt dedupe, or ancillary best-effort failures. This conservative
accounting caps admitted work even when a response is lost or the DB fails.

The `preview_mutation_budgets` table is shared across routes, actions, session
users, API keys, and Preview deployments using the same PostgreSQL database.
Visitor/window and aggregate/window buckets are distinct. Rotating API keys
or switching accounts/endpoints does not create a new visitor budget.
Production and local/Vercel Development bypass all these guards and batch bounds.

### Visitor identity and hosting assumption

Verified against the current official [Vercel request headers documentation](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for)
on 2026-10-12: Vercel documents overwriting `x-forwarded-for` to prevent spoofing,
and defines `x-vercel-forwarded-for` as the corresponding Vercel IP header,
distinguishing it from forwarding headers a proxy on top of Vercel could overwrite.
The implementation trusts **only `x-vercel-forwarded-for`**, only with server
environment `VERCEL=1`. It never falls back to `x-forwarded-for`, `x-real-ip`, a
client cookie, user ID, API-key ID, or a client-supplied deployment hostname.
It accepts exactly one valid IPv4/IPv6 address, trims whitespace, canonicalizes
IPv6 spellings and IPv4-mapped IPv6, rejects lists, ports and scoped addresses,
then hashes the canonical IP before using it in keys. Hashing avoids raw IP keys;
it is not anonymization against enumeration.

The trust guarantee assumes requests reach the function through Vercel's edge
and the application/proxy does not replace the edge-owned header downstream.
The environment check alone is not proof of a trusted edge: setting `VERCEL=1`
on a directly exposed non-Vercel server would make its caller headers unsafe.
Non-Vercel hosts opting into Preview need a separately audited edge/identity
policy; without the expected Vercel environment/header, writes fail closed with
retryable 503 `PREVIEW_IDENTITY_REQUIRED`. Reads remain available.

Two people on different IPs sharing the demo login have independent visitor
buckets. People behind the same NAT/proxy share one bucket. A reverse proxy in
front of Vercel may collapse visitors onto its IP; VPN/IP changes and IPv6 privacy
addresses can change visitor identity. The aggregate budget is the backstop.
This is abuse-cost containment, not a guarantee of one bucket per human.

### PostgreSQL storage and outages

Uses the application's existing PostgreSQL pool and connection settings, not
Upstash/Vercel KV. An archived Redis database cannot block manual demo writes.
Apply `db/migrations/20261012_create_preview_mutation_budgets.sql` to the Preview
database before deploying the new guard. The idempotent migration adds a counter
table, an expiry index, and `reserve_preview_mutation(visitor, weight)`; it does
not change ledger data. Fresh databases also need this migration after their schema.

`lib/demo/budget.ts` calls the function in one parameterized statement. A shared
transaction advisory lock serializes reservations, including first-use inserts.
The function samples database time after acquiring the lock and bounds lock waits
to three seconds. All four counters commit together. Accepted requests clean up
at most 100 expired buckets through the expiry index; stale buckets reset lazily,
so no scheduler or keep-alive service is required after inactivity.

Preview has **no in-memory fallback**. Missing migrations, database failures,
lock timeouts or invalid results fail closed with 503 `PREVIEW_UNAVAILABLE`,
Spanish guidance and `Retry-After: 60`. Reservations are never retried by the
application: a lost response may already have consumed units but cannot authorize
a domain write. Counter writes are bookkeeping, not charged ledger units.
Preview API-key authentication bypasses the legacy per-key request
limiter (which can use memory); the weighted shared policy is authoritative.
The existing per-key limiter and last-used behavior remain in other environments.

### Mutation coverage inventory and charging

One unit represents an upper-bound row write, including associated writes where
applicable. No row is route-to-action double charged; routes call internal
repositories, not public recurring actions. Delete cascades reserve their additional
rows separately after the public boundary's base reservation, as described below.
No public argument permits skipping the guard.

| Public boundary                                                        | Units / Preview work bound                                                                                                                                                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/actions.ts`: createEntry                                          | 2 (entry + possible category); 3 with receipt merchant learning                                                                                                                                          |
| `lib/actions.ts`: updateEntry                                          | 2 (entry + possible category)                                                                                                                                                                            |
| `lib/actions.ts`: deleteEntry                                          | 1 + linked crypto rows whose record_id will be cleared; maximum 60 total                                                                                                                                 |
| `lib/actions.ts`: deleteManyEntries                                    | Unique submitted IDs + linked crypto rows whose record_id will be cleared; maximum 60 total; ownership predicates still apply                                                                            |
| `/api/entries/[id]/duplicate` POST                                     | 1                                                                                                                                                                                                        |
| `lib/recurringActions.ts`: create/update/delete                        | 1 each; resolves session identity, ignores supplied user ID and allow-lists update fields                                                                                                                |
| `/api/recurring` POST / PUT / DELETE                                   | 2 / 2 / 1, including possible category provisioning                                                                                                                                                      |
| Recurring generate action and `/api/recurring/generate` POST           | Planned inserted rows, minimum 1; at most 60 active records scanned, query capped at 61 to detect overflow; ledger lookup restricted to their distinct names; reject rather than truncate oversized work |
| `/api/crypto/transactions` POST                                        | 1                                                                                                                                                                                                        |
| `/api/crypto/transactions/[id]` PUT / DELETE                           | 1 each                                                                                                                                                                                                   |
| `/api/crypto/transactions/[id]/duplicate` POST                         | 1                                                                                                                                                                                                        |
| `/api/crypto/wallets` POST                                             | 1                                                                                                                                                                                                        |
| `/api/safebox/movements` POST and `/api/safebox/movements/[id]` DELETE | 1 each (single movement row; balance is derived, no finance mirror)                                                                                                                                      |
| `/api/merchants` DELETE                                                | 1 + linked finance rows whose merchant_id will be cleared; maximum 60 total                                                                                                                              |
| `/api/api-keys` POST and `/api/api-keys/[id]` DELETE                   | 1 each                                                                                                                                                                                                   |
| `/api/v1/entries` POST, single/batch/JSON-string batch                 | Inserted entries + 1 last-used metadata row; maximum 59 entries per Preview request; verifies API key read-only in Preview, updates metadata only after reservation                                      |
| `lib/actions.ts`: createUser direct RPC                                | Requires authenticated session in Preview and reserves 1; OAuth does not call this public boundary                                                                                                       |

`/api/entries` and `/api/entries/[id]` are GET-only in the current tree;
finance update/delete operate through guarded actions. Crypto bulk delete is a
client loop of guarded single-row DELETE requests; each row consumes its own unit
and the UI stops on a Preview rejection. Category provisioning and merchant
confirmation are internal side effects covered by their entry/recurring write
reservation. No separate public category write boundary exists. Generation
checks ownership via the session-scoped user and reserves after bounded reads but
before the multi-row INSERT. No-op generation still reserves one unit.

Safebox routes authenticate first and POST validates input before reserving one
unit, then call the internal `lib/safeboxActions.ts` facade. That module has no
`use server` directive and is not a public RPC boundary; it does not reserve again.
Safebox reads remain uncharged. Client helpers propagate the server's error message;
movement/count forms retain inputs and history retains rows on rejected deletes.

In Preview, finance and merchant deletes use `lib/demo/delete-budget.ts`.
The boundary reserves the submitted parent rows first. A DB transaction locks
owned parents in stable ID order (`FOR UPDATE`), reads at most 61 referencing
rows, rejects a total above 60, and reserves **only the additional cascading rows**
before DELETE. The DELETE targets only the locked, owned IDs, so a newly appearing
row cannot enter the delete set after counting. Parent locks block new FK references
between counting and deletion.
An additional reservation failure rolls back the transaction with no DELETE;
the previously accepted base reservation is not refunded. Each PostgreSQL reservation
is independently all-or-nothing across the four policies. Production/local deletes
retain their original statements. This uses the existing merchant and crypto FK
schema; it does not add a migration. SQL-level tests verify lock/count/reservation/
delete ordering and rollback, but live PostgreSQL concurrency was not smoke-tested.

### Deliberate exclusions

- OAuth user creation in the NextAuth sign-in callback calls `lib/users/repo.ts`
  directly. It must occur before a session exists and is an intentional bootstrap
  exception, not an unauthenticated mutation-budget bypass via `createUser` RPC.
  Credentials/JWT/cookie authentication is otherwise unchanged.
- Read routes/actions, exports, read-only options/analytics/summary/stats,
  session reads and auth verification queries do not spend mutation units.
- Server-maintained crypto-price cache refreshes on market-data reads are not
  user ledger mutations; their existing provider/cache policy remains separate.
- AI usage/consent/receipt ingestion/merchant observation writes are unreachable
  in Preview because #138 rejects AI endpoints after authentication, before work.
- Trusted operational seed/reset scripts and migrations are not public request
  boundaries and are excluded.

A typical manual walkthrough (10 creates, 5 edits, 5 duplicates, 5 deletes without linked rows)
reserves 40 units, below a visitor's minute budget; a 50-row API batch reserves 51.
Several simultaneous visitors can encounter the aggregate limit. Rejections keep
data intact and explain how long to wait; overlarge batches ask for smaller work.

### Local verification and deployment limitations

Unit/boundary/UI tests cover trusted-header normalization, spoof/missing identity,
independent visitors, batch weights, auth ordering, PostgreSQL failure and no writes
under rejection. A regression verifies writes with every Redis variable absent.
The optional `__tests__/lib/preview-postgres.integration.test.ts` applies the actual
migration to a uniquely named isolated schema and runs seven PostgreSQL tests,
including 70 concurrent connections, all four limits, expiration, unchanged
window ends and all-or-nothing reservations. It drops only its own schema.
Run with `PREVIEW_POSTGRES_TEST_URL=<test connection> CI=true pnpm test --runInBand
__tests__/lib/preview-postgres.integration.test.ts`; `PSQL_BIN` optionally specifies
the PostgreSQL client binary. Default CI skips these tests without a test URL.

After an authorized deployment,
verify edge overwrite with a spoofed client header, normal manual writes, a burst
across endpoints/API keys, two IPs, and PostgreSQL unavailability. Database tests
verify the algorithm, not deployed edge routing or the complete authenticated UI.

### Verified PostgreSQL rollout (2026-10-12)

Applied the budget migration to the Preview database after checking it is distinct
from Production. All seven PostgreSQL integration tests passed in an isolated
schema, which was dropped afterward. The full unit suite passed (608 tests), as
did typechecking, lint, formatting, dependency rules and unused-code checks.

Deployed `https://finanzapp-7ytxztflp-mtmarctonis-projects.vercel.app` and verified
the test account through an automated browser: manual entry creation, amount
editing, duplication, and deletion all persisted. Both temporary smoke entries
were removed through the UI. The existing Preview AI endpoint still returned 403.
This verifies normal writes through the deployed Vercel visitor identity and
PostgreSQL function; spoofed headers, multiple real visitor IPs and database
outage behavior were not exercised on that deployment.

## AI deployment verification (#138)

After an authorized Preview redeployment, smoke-check each AI method listed at the top with an
authenticated session: expect JSON 403, the same Spanish message, and no provider
usage. Repeat with paid confirmation present and a previously uploaded receipt;
both must still reject. Signed-out requests must remain 401. This smoke check
requires a deployment and has not been performed as part of the local change.
