# goride-frontend

## CI

The `CI` workflow runs on pull requests and pushes to `dev`/`main`, and can
also be started manually. Node.js 22.x jobs run ESLint, TypeScript, unit tests
(when a `test` script exists), and a production build, including the auth-gate
verification. Each job uses npm caching and `npm ci`. Superseded runs are
cancelled; the required `CI / CI Gate` check passes only when every job succeeds.

To reproduce locally with Node.js 22.x (Bash):

```bash
npm ci
export CI=true NEXT_TELEMETRY_DISABLED=1
export NEXT_PUBLIC_FIREBASE_API_KEY=ci-placeholder
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=goride-ci.invalid
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=goride-ci
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=goride-ci.invalid
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
export NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:ci
npx eslint src
npx next typegen
npx tsc --noEmit
npm run test --if-present
npm run build
```

The Firebase values are harmless build placeholders, also defined in
`.github/workflows/ci-reusable.yml`; no `.env` file or secrets are needed.
`next typegen` supplies route types such as `LayoutProps` on a fresh checkout.

## SCRUM-107 card retry

Checkout sends `{ cardId, requestId }` to `POST /payments/{tripId}/pay`. A request ID
is kept in memory and session storage until its outcome is known, including across
reloads. After a lost response, **Check payment** reuses that ID and card token.
After a confirmed decline, **Retry payment** creates a new ID. No amount is sent:
the payment service charges its stored final fare and the receipt uses that result.

The server retries a transient processing/timeout/5xx failure once, with a short
backoff. Checkout continues polling while the POST runs and shows “Payment didn't
go through, trying once more...” when `requestState` is `Retrying`. A hard decline
does not retry automatically; its error links to Payment methods to replace the
saved card. There is no automatic cash fallback.

Status now includes `attemptCount`, `lastFailureCode`, `requestId`, `requestState`,
`requestAttempts`, `autoRetried` and `retryable`. Successful pay results add
`attempts` and `autoRetried`; decline ProblemDetails add `retryable`, `autoRetried`
and `attempts`. The adapter preserves these fields for checkout. Double taps,
stale polls, late failed responses and completion in another tab cannot reset a
Paid checkout or start another request while its result is uncertain.

For local testing, save `4000000000000341` to see an automatic retry succeed,
`4000000000000119` to see two processing failures, or `4000000000000002` to see a
hard decline. Use a future expiry and any three-digit CVC. These are GoRide demo
behaviours; no real money moves. The payment service's SCRUM-107 schema/API must
be deployed together with this checkout update.

`npm test` exercises the checkout state machine, including retry progress,
reload recovery, card replacement and stale responses. In a restricted Windows
sandbox that blocks Node test-worker spawning, run it with
`NODE_OPTIONS=--experimental-test-isolation=none`.
