# Selenium UI tests

Browser tests for the GoRide frontend, run with Selenium WebDriver and pytest in
Chrome. They need no signed in session, so no test account or cookie is required.

## What they cover

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
