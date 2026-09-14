# JMeter load test

`goride-auth-load.jmx` drives the identity API the frontend depends on with ten
concurrent users and reports response times and error rates.

## What it runs

Two thread groups, each 10 users ramped over 10 seconds, 5 iterations per user.

| Sampler | Session | Checks |
| --- | --- | --- |
| `GET /api/me` | Driver | 200, under 2 s |
| `GET /api/driver/verification-status` | Driver | 200, under 2 s |
| `GET /api/driver/{driverSub}` | Driver | 200, under 3 s |
| `GET /api/profile` (proxied to Asgardeo over SCIM2) | Driver | 200 |
| `GET /api/me` with no cookie | None | Stays 401 under load |
| `GET /openapi/v1.json` | None | 200, used as the no auth, no database baseline |

## Prerequisites

- Apache JMeter 5.6 or newer and Java 17 or newer.
- The identity API running at `https://localhost:7136`. JMeter accepts the .NET
  developer certificate without extra setup.
- A driver session cookie. Capture one with the Selenium helper, which writes it
  to `tests/selenium/.sessions/driver.txt` where this plan reads it:

```bash
cd tests/selenium
python grab_session_cookie.py --role driver
```

- The driver's user id (the `userId` printed by that script) passed as `driverSub`.
- A driver profile for that account, otherwise the two `/api/driver/...` samplers return 404.

The session cookie is invalidated whenever the API restarts, so capture a fresh one after a restart.

## Running

Open the plan in the GUI:

```bash
jmeter -t tests/jmeter/goride-auth-load.jmx -JdriverSub=<userId>
```

Run without the GUI and generate the HTML dashboard:

```bash
jmeter -n -t tests/jmeter/goride-auth-load.jmx -JdriverSub=<userId> -l results.jtl -e -o report
```

The `report` folder must not already exist.

## Properties

| Property | Default | Purpose |
| --- | --- | --- |
| `driverSub` | empty | Driver user id for `GET /api/driver/{driverSub}` |
| `cookieFile` | `../selenium/.sessions/driver.txt` | File holding the full `Cookie` header, relative to this plan |
| `users` | `10` | Concurrent users per thread group |
| `rampUp` | `10` | Seconds to start all users |
| `loops` | `5` | Iterations per user |

Pass any of them with `-J`, for example `-Jusers=25 -Jloops=10`.

`results.jtl`, `jmeter.log` and `report/` are ignored by git.
