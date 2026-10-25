"""Offline tests: no HTTP calls, no JMeter or third-party Python packages."""

from dataclasses import replace
from contextlib import contextmanager, redirect_stderr, redirect_stdout
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import unittest
from unittest.mock import patch
import uuid

import sla_gate as gate
import run_load

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"
SLA = json.loads((HERE / "sla.json").read_text(encoding="utf-8"))
PROFILES = json.loads((HERE / "profiles.json").read_text(encoding="utf-8"))


@contextmanager
def fixture_directory():
    # Keep generated files inside the worktree, including on restricted Windows hosts.
    parent = (HERE / "results").resolve()
    directory = parent / f"gate-test-{uuid.uuid4().hex}"
    directory.mkdir(parents=True)
    try:
        yield directory
    finally:
        if directory.resolve().parent != parent:
            raise ValueError("Refusing to clean a test directory outside results")
        shutil.rmtree(directory)


def evaluate(filename="pass.jtl", profile="smoke", samples=None):
    properties = {**PROFILES["defaults"], **PROFILES["profiles"][profile]}
    return gate.evaluate(gate.read_jtl(FIXTURES / filename) if samples is None else samples,
                         profile, SLA, properties)


class PercentileTests(unittest.TestCase):
    def test_nearest_rank_unsorted_and_boundaries(self):
        values = [50, 10, 40, 20, 30]
        self.assertEqual([gate.percentile(values, p) for p in (0, 50, 90, 95, 99, 100)],
                         [10, 30, 50, 50, 50, 50])
        self.assertEqual(values, [50, 10, 40, 20, 30])
        self.assertEqual(gate.percentile(list(range(1, 101)), 95), 95)
        self.assertEqual(gate.percentile([10, 20], 50), 10)

    def test_empty_single_and_invalid_percent(self):
        self.assertIsNone(gate.percentile([], 95))
        self.assertEqual(gate.percentile([7], 99), 7)
        for percent in (-1, 101):
            with self.assertRaises(ValueError):
                gate.percentile([7], percent)


class GateTests(unittest.TestCase):
    def test_threshold_equality_and_expected_400_pass(self):
        result = evaluate()
        self.assertTrue(result["passed"])
        self.assertEqual(result["overall"]["errors"], 0)
        self.assertEqual(result["labels"]["fare: happy path"]["p95_ms"], 800)

    def test_breaches_and_assertion_failure_on_200(self):
        result = evaluate("breach.jtl")
        self.assertFalse(result["passed"])
        self.assertEqual(result["overall"]["error_pct"], 50)
        self.assertEqual(len(result["breaches"]), 3)

    def test_error_limit_is_inclusive(self):
        samples = [gate.Sample(i * 1000, 100, "health", i != 0, "200", 1) for i in range(100)]
        samples[1] = replace(samples[1], label="fare: happy path")
        samples[2] = replace(samples[2], label="fare: invalid input -> 400", response_code="400")
        self.assertTrue(evaluate(samples=samples)["passed"])
        samples[3] = replace(samples[3], success=False)
        self.assertFalse(evaluate(samples=samples)["passed"])

    def test_empty_and_missing_label_fail(self):
        self.assertFalse(evaluate("empty.jtl")["passed"])
        rows = [s for s in gate.read_jtl(FIXTURES / "pass.jtl") if s.label != "health"]
        self.assertIn("Missing required label: health", evaluate(samples=rows)["breaches"])

    def test_metrics_active_window_includes_response_end(self):
        rows = [gate.Sample(1000, 100, "x", True, "200", 1),
                gate.Sample(2000, 500, "x", False, "500", 1)]
        stats = gate.metrics(rows)
        self.assertEqual(stats["mean_ms"], 300)
        self.assertEqual(stats["active_window_s"], 1.5)
        self.assertAlmostEqual(stats["throughput_rps"], 2 / 1.5)
        self.assertEqual(stats["p95_ms"], 500)
        self.assertEqual(gate.metrics([replace(rows[0], elapsed=0)])["active_window_s"], 0.001)

    def test_timeline_boundaries_gaps_and_per_label_metrics(self):
        rows = [gate.Sample(1000, 100, "health", True, "200", 1),
                gate.Sample(10999, 200, "health", False, "500", 1),
                gate.Sample(11000, 300, "fare: happy path", True, "200", 4),
                gate.Sample(31000, 400, "health", True, "200", 1)]
        windows = gate.timeline(rows, 1000)
        self.assertEqual([w["overall"]["samples"] for w in windows], [2, 1, 0, 1])
        self.assertEqual(windows[0]["labels"]["health"]["error_pct"], 50)
        self.assertIsNone(windows[2]["overall"]["p95_ms"])
        self.assertIsNone(windows[2]["overall"]["error_pct"])
        self.assertEqual(windows[1]["max_threads"], 4)

    def test_saturation_is_first_strict_crossing_and_informational(self):
        result = evaluate("stress.jtl", "stress")
        self.assertTrue(result["passed"])
        self.assertEqual(result["saturation"]["start_s"], 10)
        self.assertEqual(result["saturation"]["max_threads"], 101)

    def test_spike_recovery_within_deadline(self):
        result = evaluate("spike-recovery.jtl", "spike")
        self.assertTrue(result["passed"])
        self.assertEqual(result["recovery"]["recovery_s"], 20)
        self.assertEqual(result["recovery"]["recovered_at_s"], 110)

    def test_spike_no_recovery_or_truncated_observation_fails(self):
        rows = gate.read_jtl(FIXTURES / "spike-recovery.jtl")
        slow = [replace(s, elapsed=301) if s.timestamp >= 1090000 else s for s in rows]
        self.assertFalse(evaluate(profile="spike", samples=slow)["passed"])
        self.assertFalse(evaluate(profile="spike", samples=rows[:-5])["passed"])

    def test_spike_recovery_must_persist_to_deadline(self):
        rows = gate.read_jtl(FIXTURES / "spike-recovery.jtl")
        rows[-1] = replace(rows[-1], elapsed=301)
        self.assertFalse(evaluate(profile="spike", samples=rows)["passed"])

    def test_sparse_probe_cannot_prove_recovery(self):
        rows = gate.read_jtl(FIXTURES / "spike-recovery.jtl")
        sparse = [s for s in rows if s.timestamp < 1090000 or s.timestamp in {1108000, 1118000}]
        self.assertFalse(evaluate(profile="spike", samples=sparse)["passed"])

    def test_malformed_csv_rejected(self):
        with self.assertRaisesRegex(ValueError, "row 2"):
            gate.read_jtl(FIXTURES / "malformed.jtl")


class CommandLineTests(unittest.TestCase):
    def run_gate(self, fixture, profile="smoke", report_only=False, properties=None):
        with fixture_directory() as directory:
            jtl = Path(directory) / "results.jtl"
            shutil.copyfile(FIXTURES / fixture, jtl)
            command = [sys.executable, str(HERE / "sla_gate.py"), str(jtl), "--profile", profile]
            if properties is not None:
                config_path = Path(directory) / "run-config.json"
                config_path.write_text(json.dumps({"properties": properties}), encoding="utf-8")
                command += ["--run-config", str(config_path)]
            if report_only:
                command.append("--report-only")
            process = subprocess.run(command, capture_output=True, encoding="utf-8")
            summary = json.loads(jtl.with_name("summary.json").read_text(encoding="utf-8"))
            markdown = jtl.with_name("summary.md").read_text(encoding="utf-8")
            self.assertIn("| Label | Samples |", markdown)
            self.assertIn("10-second timeline", process.stdout)
            return process, summary

    def test_fixture_exit_codes_and_reports(self):
        for fixture, profile, expected in [("pass.jtl", "smoke", 0), ("pass.jtl", "load", 0),
                                           ("breach.jtl", "smoke", 1), ("stress.jtl", "stress", 0),
                                           ("spike-recovery.jtl", "spike", 0),
                                           ("empty.jtl", "smoke", 1), ("malformed.jtl", "smoke", 1)]:
            with self.subTest(fixture=fixture, profile=profile):
                process, summary = self.run_gate(fixture, profile)
                self.assertEqual(process.returncode, expected, process.stderr)
                self.assertEqual(summary["passed"], expected == 0)

    def test_report_only_preserves_failure_but_returns_zero(self):
        process, summary = self.run_gate("breach.jtl", report_only=True)
        self.assertEqual(process.returncode, 0)
        self.assertFalse(summary["passed"])
        self.assertTrue(summary["report_only"])

    def test_saved_spike_timings_override_profile_defaults(self):
        properties = {**PROFILES["defaults"], **PROFILES["profiles"]["spike"], "spikeDelay": 70}
        process, summary = self.run_gate("spike-recovery.jtl", "spike", properties=properties)
        self.assertEqual(process.returncode, 1)
        self.assertEqual(summary["recovery"]["spike_end_s"], 100)
        self.assertEqual(summary["recovery"]["deadline_s"], 130)

    def test_enabled_drivers_require_samples(self):
        properties = {**PROFILES["defaults"], **PROFILES["profiles"]["smoke"], "driversEnabled": True}
        process, summary = self.run_gate("pass.jtl", properties=properties)
        self.assertEqual(process.returncode, 1)
        self.assertIn("Missing required label: drivers: active", summary["breaches"])


class RunnerConfigTests(unittest.TestCase):
    def test_target_ports_and_ipv6(self):
        self.assertEqual(run_load.target_properties("https://example.test")["port"], 443)
        self.assertEqual(run_load.target_properties("http://localhost:8080/")["port"], 8080)
        self.assertEqual(run_load.target_properties("http://[::1]:8080")["host"], "[::1]")

    def test_reject_ambiguous_targets_and_live_heavy_runs(self):
        for url in ("ftp://example.test", "http://example.test/path", "https://user:secret@example.test",
                    "http://example.test?x=1", "http://example.test:bad"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                run_load.target_properties(url)
        for profile in ("load", "stress", "spike"):
            with self.assertRaisesRegex(ValueError, "Only smoke"):
                run_load.resolve_profile(profile, "https://" + run_load.LIVE_HOST)

    def test_all_profiles_have_probe_coverage(self):
        for profile in PROFILES["profiles"]:
            properties = run_load.resolve_profile(profile)
            self.assertEqual(properties["probeDuration"], properties["duration"])
            self.assertEqual(properties["probeUsers"], 1)


class RunnerExecutionTests(unittest.TestCase):
    def test_runner_artifacts_and_failure_propagation(self):
        for jmeter_status, gate_status, dashboard, expected in (
                (0, 0, True, 0), (0, 1, True, 1), (1, 0, True, 1), (0, 0, False, 1)):
            with self.subTest(jmeter=jmeter_status, gate=gate_status, dashboard=dashboard):
                with fixture_directory() as directory:
                    properties = run_load.resolve_profile("smoke")
                    calls = []

                    def fake_run(command, **kwargs):
                        calls.append(command)
                        if "-n" in command:
                            jtl = Path(command[command.index("-l") + 1])
                            shutil.copyfile(FIXTURES / "pass.jtl", jtl)
                            if dashboard:
                                report = Path(command[command.index("-o") + 1])
                                report.mkdir()
                                (report / "index.html").write_text("offline stub", encoding="utf-8")
                            return subprocess.CompletedProcess(command, jmeter_status)
                        return subprocess.CompletedProcess(command, gate_status)

                    with (patch.object(run_load, "HERE", directory),
                          patch.object(run_load, "resolve_profile", return_value=properties),
                          patch.object(run_load, "find_tools", return_value=("jmeter", {})),
                          patch.object(run_load.subprocess, "run", side_effect=fake_run),
                          redirect_stdout(io.StringIO()) as output, redirect_stderr(io.StringIO())):
                        status = run_load.main(["-Profile", "smoke", "-BaseUrl", "http://localhost:8080"])
                    self.assertEqual(status, expected)
                    self.assertEqual(len(calls), 2)
                    self.assertIn("-Jusers=2", calls[0])
                    self.assertIn("-JthinkMin=1500", calls[0])
                    self.assertIn("-Jjmeter.save.saveservice.output_format=csv", calls[0])
                    self.assertIn("JMeter command:", output.getvalue())
                    config_path = Path(calls[1][calls[1].index("--run-config") + 1])
                    config = json.loads(config_path.read_text(encoding="utf-8"))
                    self.assertEqual(config["properties"], properties)

    def test_report_only_is_passed_to_gate_but_jmeter_failure_still_fails(self):
        for jmeter_status, expected in ((0, 0), (1, 1)):
            with self.subTest(jmeter=jmeter_status), fixture_directory() as directory:
                properties = run_load.resolve_profile("smoke")
                calls = []

                def fake_run(command, **kwargs):
                    calls.append(command)
                    if "-n" in command:
                        shutil.copyfile(FIXTURES / "breach.jtl", Path(command[command.index("-l") + 1]))
                        report = Path(command[command.index("-o") + 1])
                        report.mkdir()
                        (report / "index.html").write_text("offline stub", encoding="utf-8")
                        return subprocess.CompletedProcess(command, jmeter_status)
                    return subprocess.CompletedProcess(command, 0)  # the gate exits 0 in report-only mode

                with (patch.object(run_load, "HERE", directory),
                      patch.object(run_load, "resolve_profile", return_value=properties),
                      patch.object(run_load, "find_tools", return_value=("jmeter", {})),
                      patch.object(run_load.subprocess, "run", side_effect=fake_run),
                      redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO())):
                    status = run_load.main(["-Profile", "smoke", "-ReportOnly"])
                self.assertEqual(status, expected)
                self.assertIn("--report-only", calls[1])

    def test_missing_tool_fails_before_jmeter(self):
        with (patch.object(run_load, "find_tools", side_effect=ValueError("JMeter is missing")),
              patch.object(run_load.subprocess, "run") as execute,
              redirect_stderr(io.StringIO()) as error):
            self.assertEqual(run_load.main(["--profile", "smoke"]), 1)
        execute.assert_not_called()
        self.assertIn("JMeter is missing", error.getvalue())


if __name__ == "__main__":
    unittest.main()
