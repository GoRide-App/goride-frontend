# GoRide load and performance tests

This suite supports the SE3112 individual Load & Performance Testing role.
The system under test is the .NET **trip-matching service**:

- `POST /fare/estimate` reads `vehicle_types` from MySQL and asks `goride-location`
  for a road route. If location is unreachable it falls back to straight-line distance.
- `GET /drivers/active[?vehicleType=...]` proxies to identity; it is disabled by default.
- `GET /health` checks service/database health throughout the run.

Apache JMeter **5.6.3 core only** provides portable HTTP workloads, scheduled
thread groups, CSV data, assertions, CSV JTL results, and an HTML dashboard.
There are no plugins, Ultimate Thread Groups, GUI listeners, or response-storing
listeners in `goride-trip-perf.jmx`. Python **3.9+ standard library only** supplies
the runners and SLA gate. Use **Java 17 or newer** (CI uses Temurin 21). The plan uses only built-in JMeter
functions and JEXL3, no Groovy, so it does not depend on a particular JDK.

## Isolation comes first

**Run load, stress, and spike only against a local or staging service with its
own database. Never stress the shared live database or a third-party routing API.**
Local trip-matching is not isolated if it still uses the shared database or
forwards routes to a public API. Configure a private routing backend or a local
stub, or deliberately make location unavailable to measure the straight-line
fallback. Record which routing mode was used: a fast fallback does not prove
road-route performance. No capacity claim should be based on a run whose
downstream configuration is unknown.

The smoke profile limits traffic to two users with 1.5–3 s think time and leaves
identity calls disabled. It is the only profile intended for the shared live
Azure service and its routing dependency. The runner rejects the known live
Azure hostname for heavier profiles; operators must also isolate any other
hostname they supply. The health probe adds one user to every profile.

### Location stub

`stubs/location_stub.py` stands in for goride-location's `POST /rides/plan`
(straight-line distance x 1.3 at 25 km/h). Start it with
`python stubs/location_stub.py --port 18081` and run trip-matching with
`Location__BaseUrl=http://127.0.0.1:18081`.

Check it is really used before a measured run. trip-matching falls back to
straight-line pricing and still returns 200 when location fails, so assertions
cannot tell. Galle Face (6.9271, 79.8448) to SLIIT (6.9147, 79.9729) must cost
1402.34 for TUK with the seeded rates; 1097.25 means the fallback was used.
The service also logs `goride-location returned HTTP ...` for every fallback.
The stub reads chunked bodies (.NET's `PostAsJsonAsync` sends no
Content-Length), keeps connections alive and uses a listen backlog of 128.

## Profiles and properties

Edit `profiles.json` to change load shapes. Values under `defaults` are merged
with the selected profile, then `-BaseUrl` overrides protocol/host/port.
The runner passes the resolved settings as `-J` properties and saves them in
`run-config.json` alongside the results.

| Profile | Resolved load properties | What it proves |
| --- | --- | --- |
| `smoke` | `users=2`, `rampUp=2`, `duration=60`, `thinkMin=1500`, `thinkMax=3000` | Basic correctness and a small performance baseline; suitable for live checks |
| `load` | `users=50`, `rampUp=30`, `duration=180` | Whether representative sustained concurrency meets the latency/error SLAs |
| `stress` | `users=0`, `stepUsers=50`, `stepEvery=45`, `stepDuration=180`, `duration=180` | How performance degrades as concurrency rises from 50 to 200; locate saturation |
| `spike` | `users=20`, `rampUp=10`, `duration=150`, `spikeUsers=200`, `spikeDelay=60`, `spikeDuration=30` | Whether a sudden increase from 20 to 220 traffic users is tolerated and health recovers |

All profiles have `probeUsers=1` and `probeDuration=duration` unless explicitly
overridden. Unused step/spike groups have zero users. Default think time outside
smoke is 500–1500 ms. These are closed-loop concurrency workloads: request rate
falls when responses slow down; they do not enforce a fixed arrival rate.

The plan uses seven standard Thread Groups, running concurrently:

- **Steady load**: scheduled for `duration` seconds, including its ramp-up.
- **Step stress 1–4**: each adds `stepUsers` users with a 1 s ramp. Startup
  delays are `0`, `stepEvery`, `2*stepEvery`, `3*stepEvery`. Their scheduled
  durations are `stepDuration`, `stepDuration-stepEvery`, etc., so all finish
  at approximately the same total elapsed time. Defaults produce steps at
  0, 45, 90, 135 s, ending at 180 s.
- **Spike burst**: 1 s ramp after `spikeDelay`, scheduled for `spikeDuration`.
- **Health probe**: one independent user with a core Constant Throughput Timer
  targeting 60 requests/minute. Slow responses can reduce that rate.

A zero user count disables execution of a group. XML `enabled` attributes stay
literal `true`: JMeter does not evaluate property expressions in that attribute.
Schedulers stop new sampling at their deadline. An in-flight HTTP request can
finish afterward, bounded by the configured timeouts; scheduler timing is not
a hard cancellation guarantee.

All direct plan properties have defaults:

| `-J` property | Default | Meaning |
| --- | --- | --- |
| `protocol`, `host`, `port` | `http`, `localhost`, `8080` | Target origin |
| `users`, `rampUp`, `duration` | `2`, `2`, `60` | Steady users and seconds |
| `stepUsers`, `stepEvery`, `stepDuration` | `0`, `45`, `180` | Users per step, interval and total seconds |
| `spikeUsers`, `spikeDelay`, `spikeDuration` | `0`, `60`, `30` | Burst users, delay and duration seconds |
| `probeUsers`, `probeDuration` | `1`, current `duration` | Probe count (use 0 only for offline checks) and seconds |
| `thinkMin`, `thinkMax` | `500`, `1500` | Uniform Random Timer range in ms |
| `driversEnabled`, `vehicleType` | `false`, empty | Include identity-backed reads; optional filter such as `TUK` |
| `routesFile` | `data/routes.csv` | CSV relative to the JMX; runners pass an absolute path |
| `connectTimeout`, `responseTimeout` | `5000`, `10000` | HTTP timeout bounds in ms, not latency SLAs |

Keep `stepDuration > 3*stepEvery`. Extend `probeDuration` to cover every active
group, plus at least 30 seconds after a spike. The runners validate these rules.

## Traffic and correctness

Each traffic user runs a deterministic, interleaved 20-slot cycle with a
thread-number offset: **14 fare estimates, 3 invalid requests, 3 driver reads**.
This produces 70% / 15% / 15% over complete cycles. With `driversEnabled=false`,
the three driver slots send fare requests instead: **17/20 (85%) fare and 3/20 (15%) validation**.
Partial cycles/ramp-up can shift the observed proportions. Health samples are
additional and are not part of these percentages.

`data/routes.csv` contains the existing trip plan's exact five routes: Galle
Face Green → SLIIT Malabe, the short hop to One Galle Face Mall, Colombo Fort →
SLIIT, zero distance, and the reversed SLIIT → Galle Face route. A CSV Data Set
cycles independently per thread, advancing on each traffic iteration.
The request is:

```json
{"startLat":6.9271,"startLng":79.8448,"endLat":6.9147,"endLng":79.9729}
```

Validation calls rotate through missing destination, `{}` (the legacy plan's
empty-body case), and `"startLat":"not-a-number"`. They share one aggregate
label. The core Test Fragment and Module Controllers reuse the same traffic
definition across all six traffic groups.

| Sampler label | Correctness assertions |
| --- | --- |
| `fare: happy path` | HTTP 200 and body contains `vehicleTypeCode` |
| `fare: invalid input -> 400` | HTTP **400**, treated as a successful expected outcome; 200/500 fail |
| `drivers: active` | HTTP 200 |
| `health` | HTTP 200 and the word `healthy` (not `unhealthy`) |

The new plan has **no Duration Assertions**. A duration assertion turns every
slow response into a functional error and confuses the error budget with a
latency distribution. Correctness stays in JMeter assertions; the gate evaluates
latency percentiles separately, including both successful and failed samples.

## Run locally

Install JMeter 5.6.3, Java 17 or newer, and Python 3.9+. Set `JAVA_HOME` to the chosen
JDK. The runners locate JMeter through `-JMeterHome`, `JMETER_HOME`, then `PATH`,
and fail clearly when Java/JMeter is unavailable. They print the exact command.
No credentials are required or stored; `BaseUrl` must be an HTTP(S) origin
without a path, query, fragment, or credentials.

From the repository root on Windows:

```powershell
.\tests\jmeter\run-load.ps1 -Profile smoke -BaseUrl http://localhost:8080 -JMeterHome C:\Users\shage\tools\apache-jmeter-5.6.3
```

Linux/CI (invoke with Bash; no executable-bit setup needed):

```bash
bash tests/jmeter/run-load.sh -Profile smoke -BaseUrl http://localhost:8080 -JMeterHome /opt/apache-jmeter-5.6.3
bash tests/jmeter/run-load.sh -Profile stress -BaseUrl http://localhost:8080
```

Both wrappers use `run_load.py` for identical configuration and gate behavior.
For driver reads, set `driversEnabled` to `true` in the desired profile, and
optionally `vehicleType` to `TUK`. Direct CLI runs can use the full `-J` interface:

```bash
cd tests/jmeter
jmeter -n -t goride-trip-perf.jmx -Jusers=2 -Jduration=60 -JthinkMin=1500 -JthinkMax=3000 -JdriversEnabled=true -JvehicleType=TUK -l results.jtl -j jmeter.log -e -o report
python sla_gate.py results.jtl --profile smoke
```

Use fresh JTL/dashboard paths for direct runs. Run actual workloads in CLI mode;
the GUI is only for inspecting/editing the plan. For local cold starts, wait for
a healthy target before measuring; CI warms it automatically.

## SLA gate and evidence

Each runner creates `results/<profile>-<yyyyMMdd-HHmmss>/` containing
`results.jtl`, `jmeter.log`, `report/index.html`, `run-config.json`, `summary.md`,
and `summary.json`. It refuses to reuse a run directory. JMeter failure,
missing dashboard, or a gate breach makes the runner exit nonzero. The gate
still runs after JMeter failure so a diagnostic summary can be uploaded.

CSV JTL keeps JMeter's normal dashboard fields. Runners explicitly ensure
`label`, `elapsed`, `success`, `responseCode`, `timeStamp` (epoch ms at sample
start), `allThreads`, `Latency`, and `Connect`, with CSV headers. They retain
the other default fields such as bytes, sentBytes, threadName, URL, and idle time.
Do not customize JMeter's save settings to remove dashboard fields.

`sla_gate.py` reports per-label and overall samples, errors, mean, p50/p90/p95/p99,
maximum elapsed time, and throughput. **Nearest rank** means sorting N elapsed
times and taking the 1-based element `ceil(p/100 * N)`; there is no interpolation.
For each label and overall, throughput is samples divided by the active interval
from its first request start to its last response end (minimum 1 ms).
Unrounded values are used for gates; Markdown displays two decimal places.

Thresholds are editable in `sla.json`:

| Profile | Gate |
| --- | --- |
| Smoke / load | Fare happy-path p95 ≤ 800 ms; health p95 ≤ 300 ms; overall errors ≤ 1% |
| Stress | Overall errors ≤ 5%; report the **first 10 s window** whose overall p95 is > 1000 ms as saturation (informational, not a latency failure) |
| Spike | Overall errors ≤ 5%; health p95 ≤ 300 ms again within 30 s of spike end |

All profiles require fare, validation, and health samples; drivers are also
required when enabled in the resolved configuration. Empty/malformed JTL or
missing required labels fails instead of passing silently.

The main timeline uses half-open 10 s intervals `[start, end)`, based on request
start time relative to the first sample. It includes overall p95/error rate,
health p95/error rate and max thread count (including the probe). JSON also has
per-label statistics for every interval. Gaps are unknown, not zero latency or
zero errors. Time zero approximates thread-group start; normal scheduling and
first-sample overhead can shift it slightly.

Spike recovery uses separate 10 s windows anchored at `spikeDelay+spikeDuration`
(90 s by default). A recovered window needs at least five health samples, no
health errors, and p95 ≤ 300 ms. Subsequent windows must stay healthy through
the 30 s deadline. Observation must reach within 2 s of that deadline; sparse
or truncated probes cannot prove recovery. The earliest qualifying window's
**end** is reported as recovery time (10 s resolution). The runner passes its
saved configuration so edited spike timings are used by the gate.

To re-evaluate or report without failing:

```bash
python tests/jmeter/sla_gate.py tests/jmeter/results/spike-YYYYMMDD-HHmmss/results.jtl --profile spike --run-config tests/jmeter/results/spike-YYYYMMDD-HHmmss/run-config.json
python tests/jmeter/sla_gate.py path/to/results.jtl --profile load --report-only
```

The gate exits **1** on any breach and **0** on success. `--report-only` returns
0 while preserving FAIL and breach details in both summaries (an unwritable
output directory still fails). Direct runs with edited timings should provide
`--run-config` or a matching `--profiles` JSON file.

Open the dashboard's **Statistics** and **Response Time Percentiles** first,
then correlate **Active Threads Over Time**, throughput, response times and
errors. With stress, look for rising p95/errors while throughput flattens. With
spike, compare the burst with post-burst health windows. Use `summary.md` as the
gate decision and compact evidence for the report; `summary.json` contains
unrounded data. Dashboard percentile interpolation and default graph bucket
sizes can differ from the gate, so the gate is authoritative for these SLAs.

## CI

`.github/workflows/load-test.yml` exposes **Load Test** under Actions. Manual
dispatch accepts `smoke` or `load`. Leave `base_url` blank to resolve the repository
variable `TRIP_BASE_URL`, falling back to the live Azure trip-matching URL. A
manual `load` needs an isolated target; the known live fallback is rejected.
The Monday 02:00 UTC schedule always uses smoke.

The workflow installs Temurin 21, caches/downloads JMeter 5.6.3 from the Apache
archive with SHA-512 verification, runs the Python tests, then polls `/health`
for up to 120 seconds to handle Azure scale-to-zero. It runs the Bash runner,
appends `summary.md` to the job summary, and uploads the results/dashboard even
when the test or gate fails. Setup/warm-up failures can occur before results
exist and are called out in the job summary. Workflows are serialized to avoid
overlapping scheduled/manual traffic.

## Offline verification

```bash
python -m unittest discover -s tests/jmeter -p 'test_*.py' -v
```

The tests use small committed CSV JTL fixtures for nearest-rank maths, inclusive
thresholds, expected 400s, assertion failures, active-window throughput, timeline
boundaries/gaps, saturation, recovery/insufficient evidence, and CLI exit codes.
They copy fixtures into temporary subdirectories of ignored `results/`, run the
gate, verify both summaries, and clean up. They make no network calls.

A zero-user JMeter parse check also makes no HTTP requests:

```bash
cd tests/jmeter
jmeter -n -t goride-trip-perf.jmx -Jusers=0 -JstepUsers=0 -JspikeUsers=0 -JprobeUsers=0 -j results/parse-check.log
```

Create `results/` first. Do not request a dashboard for an empty run. This checks
plan loading, not service performance; real performance results require a
separate authorized run against an appropriately isolated target.

## Existing plans (preserved)

Both original JMX files remain unchanged and independently runnable. They keep
their original iteration-based shapes, GUI listeners, and duration assertions;
use `goride-trip-perf.jmx` for this suite's profile/percentile methodology.

| Plan | Target and shape | Coverage / prerequisites |
| --- | --- | --- |
| `goride-auth-load.jmx` | `https://localhost:7136`; 2 groups, each `users=10`, `rampUp=10`, `loops=5` | Six identity/auth requests: `/api/me`, driver verification/profile, SCIM2 profile, anonymous 401, OpenAPI. Requires a driver session and profile. |
| `goride-trip-load.jmx` | `http://localhost:8080`; 4 concurrent groups, each `users=10`, `rampUp=10`, `loops=5` | Five fare routes, three validation requests, three driver directory/filter calls, health. No session required; identity must be running for driver reads. |

For auth, capture a fresh cookie with
`python tests/selenium/grab_session_cookie.py --role driver` and pass
`-JdriverSub=<userId>`. `cookieFile` defaults to
`../selenium/.sessions/driver.txt` relative to that plan. Sessions may expire or
be invalidated by a restart; never commit or paste cookies into a plan. Legacy
target host/port are defined inside each plan, not through the new runner.

```bash
jmeter -n -t tests/jmeter/goride-auth-load.jmx -JdriverSub=<userId> -Jusers=2 -Jloops=5 -l auth.jtl -j auth.log -e -o auth-report
jmeter -n -t tests/jmeter/goride-trip-load.jmx -Jusers=2 -Jloops=5 -l trip.jtl -j trip.log -e -o trip-report
```

Use unique output paths under `tests/jmeter/results/` for artifacts you want
ignored. The same isolation rule applies to these plans. Browser-side simulated
driver tracking and direct public OSRM calls remain outside this backend suite;
they are covered by the Selenium ride-planning tests.
