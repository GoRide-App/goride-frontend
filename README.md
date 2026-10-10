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
