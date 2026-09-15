# Selenium UI tests

Browser tests for the GoRide frontend, run with Selenium WebDriver and pytest in
Chrome.

Two files, two different trust levels: `test_ui_smoke.py` needs no signed in
session, so no test account or cookie is required. `test_ride_planning.py`
covers screens behind RoleGuard/proxy.ts's session check, so it signs in as a
real Rider first (see "Signed-in tests" below) — allow it more time to run.

## `test_ui_smoke.py` — anonymous checks

| Test | Story | Checks |
| --- | --- | --- |
| `test_landing_page_loads` | Smoke | The app serves and names the product |
| `test_sign_in_link_targets_the_identity_server` | SCRUM-30 | Sign in points at the API `/login` with a `returnUrl` |
| `test_no_password_field_on_the_landing_page` | SCRUM-30 | The app never collects a password itself |
| `test_sign_in_reaches_asgardeo` | SCRUM-30 | Clicking Sign in lands on the Asgardeo hosted login |
| `test_dashboard_is_not_readable_without_a_session` | SCRUM-36 | An anonymous visit to `/dashboard` is sent to sign in |
| `test_landing_page_does_not_scroll_sideways` | UI | No horizontal overflow at phone, tablet and desktop widths |
| `test_sign_in_stays_reachable_at_every_size` | UI | The Sign in control stays visible at every width |
| `test_page_has_no_console_errors` | UI | No uncaught JavaScript on the landing page |

The overflow test was written when the landing page scrolled sideways at every
width (SCRUM-874): a decorative element sat past the right edge of a container
that did not clip its overflow. Commit 48bcc98 added `overflow-hidden` to that
container, so the test now guards against the defect returning. If it fails, the
message names the element that sticks out and how far it reaches.

## `test_ride_planning.py` — signed-in Rider checks (Sprint 2)

| Test | Story | Checks |
| --- | --- | --- |
| `test_open_ride_page_from_home` | SCRUM-46 | A recent destination on the rider home page opens `/rider/ride` with it pre-filled |
| `test_use_current_location_as_pickup` | SCRUM-47 | Pickup auto-locates on arrival, and "Use current location" re-locates it on demand |
| `test_search_pickup_location_by_address` | SCRUM-48 | Typing an address surfaces it as a pickable suggestion |
| `test_fare_and_vehicle_selection` | SCRUM-53/54/56 | Every vehicle type shows a real calculated fare; only Tuk Tuk is genuinely enabled (real `disabled` attribute, not just styling) and selecting it does not navigate anywhere, since trip booking isn't implemented yet |
| `test_rider_home_does_not_scroll_sideways` | UI | No horizontal overflow on the signed-in rider home page at phone, tablet and desktop widths |
| `test_ride_planning_page_does_not_scroll_sideways` | UI | Same, for the pickup/destination planning screen (map + panel side by side on desktop, stacked on phone) |
| `test_choose_a_ride_does_not_scroll_sideways` | UI | Same, for the vehicle-selection cards after Search - the densest layout in the flow, and the one most likely to overflow on a phone |

The remaining implemented Sprint 2 stories (SCRUM-127/128/129/130/132) are
notification-service triggers with no UI to click through — they stay covered
by the Postman collection in `../../postman-qa/` (trip-matching) and the
notification repo's own collection, not by Selenium.

### Signed-in tests

`test_ride_planning.py` signs in through the real "Sign in" → Asgardeo → back
round trip, the same flow `test_sign_in_reaches_asgardeo` already proves
works, rather than reusing a `grab_session_cookie.py` cookie — that cookie is
captured on the identity API's own origin (`https://localhost:7136`) and
won't authenticate the frontend at `http://localhost:3000`, which checks its
own same-origin `app_session` cookie instead.

Needs `identity-auth` and `trip-matching` running too, not just the frontend:

```powershell
.\goride-dev.ps1 start identity
.\goride-dev.ps1 start trip
.\goride-dev.ps1 start frontend
```

Credentials come from `GORIDE_USER` / `GORIDE_PASS` — same variables
`grab_session_cookie.py` reads — and default to the seeded Rider demo account
(`DEMO_ACCOUNTS` / `DEMO_PASSWORD` in `src/lib/constants.ts`) if unset. If
that account's password has changed or picked up MFA, set both env vars to a
working Rider account first.

Sign-in handles both a combined username+password Asgardeo form and a split
username-then-Continue-then-password one, and waits for each field to be
*visible* before typing into it rather than just present in the DOM — an
earlier version assumed a combined form and typing into it failed with
`ElementNotInteractableException` on a real run. If sign-in still can't get
through, it now saves a screenshot and the page HTML of wherever it got
stuck to `evidence/sign-in-stuck.png` / `.html` before failing, so a report
of a new failure can include those two files.

The three responsive tests reuse `VIEWPORTS` from `conftest.py` (the same
phone/tablet/desktop sizes `test_ui_smoke.py` checks) via an `any_size`
fixture, not `fresh_ride` directly - `rider_driver` is one Chrome session
shared by every test in this file, so a viewport test that left it resized
would corrupt every test that runs after it; `any_size` restores the
desktop 1440x900 size once each parametrized test finishes.

## Prerequisites

- Python 3.11 or newer and Google Chrome. Selenium Manager downloads the matching
  chromedriver on the first run.
- The frontend running: `npm run dev` at the repository root.
- The identity API running at `https://localhost:7136`.

```bash
pip install -r tests/selenium/requirements.txt
```

## Running

From `tests/selenium`:

```bash
python -m pytest -v
```

Watch the browser drive itself:

```bash
set HEADLESS=0 && python -m pytest -v
```

Run the suite and open a self contained HTML report with the screenshots embedded:

```bash
python make_report.py
```

Screenshots, `junit.xml` and `report.html` are written to `tests/selenium/evidence/`,
which is ignored by git. Point elsewhere with the `GORIDE_EVIDENCE` environment variable.

## Capturing a session cookie

`grab_session_cookie.py` signs in through the real Asgardeo flow and prints the full
`Cookie` header that Postman and JMeter need. The session cookie is HttpOnly, so it
cannot be read from page JavaScript; WebDriver can.

```bash
python grab_session_cookie.py --role driver
```

The header is written to `tests/selenium/.sessions/<role>.txt`. That folder is ignored
by git because it holds a live session.

## Configuration

| Variable | Default |
| --- | --- |
| `GORIDE_APP` | `http://localhost:3000` |
| `GORIDE_API` | `https://localhost:7136` |
| `HEADLESS` | `1` |
| `GORIDE_EVIDENCE` | `tests/selenium/evidence` |
