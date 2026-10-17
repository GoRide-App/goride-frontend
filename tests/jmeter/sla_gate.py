#!/usr/bin/env python3
"""CSV JTL reporting and profile SLA gate; Python 3 standard library only."""

import argparse
import csv
from dataclasses import dataclass
import json
import math
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
REQUIRED_FIELDS = {"timeStamp", "elapsed", "label", "success", "responseCode",
                   "allThreads", "Latency", "Connect"}


@dataclass(frozen=True)
class Sample:
    timestamp: int
    elapsed: int
    label: str
    success: bool
    response_code: str
    threads: int


def percentile(values, percent):
    """Nearest rank: sorted[ceil(percent / 100 * n) - 1]; p0 is the minimum."""
    if not 0 <= percent <= 100:
        raise ValueError("Percentile must be between 0 and 100")
    if not values:
        return None
    ordered = sorted(values)
    return ordered[max(0, math.ceil(percent * len(ordered) / 100) - 1)]


def read_jtl(path):
    samples = []
    with Path(path).open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        missing = REQUIRED_FIELDS - set(reader.fieldnames or [])
        if missing:
            raise ValueError("JTL missing columns: " + ", ".join(sorted(missing)))
        for line, row in enumerate(reader, 2):
            try:
                timestamp = int(row["timeStamp"])
                elapsed = int(row["elapsed"])
                threads = int(row["allThreads"])
                success = row["success"].lower()
                if (min(timestamp, elapsed, threads, int(row["Latency"]),
                        int(row["Connect"])) < 0 or success not in {"true", "false"}
                        or not row["label"] or not row["responseCode"] or None in row):
                    raise ValueError("Invalid sample values")
                samples.append(Sample(timestamp, elapsed, row["label"],
                                      success == "true", row["responseCode"], threads))
            except (TypeError, ValueError, AttributeError) as exc:
                raise ValueError(f"Invalid JTL row {line}: {exc}") from exc
    return samples


def metrics(samples):
    if not samples:
        return {"samples": 0, "errors": 0, "error_pct": None, "mean_ms": None,
                "p50_ms": None, "p90_ms": None, "p95_ms": None, "p99_ms": None,
                "max_ms": None, "active_window_s": 0, "throughput_rps": None}
    elapsed = [s.elapsed for s in samples]
    errors = sum(not s.success for s in samples)
    # Include the last response's time; a zero-length window uses a 1 ms floor.
    active = max(0.001, (max(s.timestamp + s.elapsed for s in samples)
                         - min(s.timestamp for s in samples)) / 1000)
    return {"samples": len(samples), "errors": errors,
            "error_pct": 100 * errors / len(samples),
            "mean_ms": sum(elapsed) / len(samples),
            **{f"p{p}_ms": percentile(elapsed, p) for p in (50, 90, 95, 99)},
            "max_ms": max(elapsed), "active_window_s": active,
            "throughput_rps": len(samples) / active}


def grouped_metrics(samples):
    groups = {}
    for sample in samples:
        groups.setdefault(sample.label, []).append(sample)
    return {label: metrics(rows) for label, rows in sorted(groups.items())}


def timeline(samples, origin, window_s=10):
    """Half-open windows [start, end), assigned by request start timestamp."""
    if not samples:
        return []
    buckets = {}
    for sample in samples:
        index = (sample.timestamp - origin) // (window_s * 1000)
        buckets.setdefault(index, []).append(sample)
    return [{"start_s": i * window_s, "end_s": (i + 1) * window_s,
             "overall": metrics(buckets.get(i, [])),
             "labels": grouped_metrics(buckets.get(i, [])),
             "max_threads": max((s.threads for s in buckets.get(i, [])), default=0)}
            for i in range(max(buckets) + 1)]


def recovery_result(samples, origin, properties, rule):
    spike_end = properties["spikeDelay"] + properties["spikeDuration"]
    deadline = spike_end + rule["within_s"]
    health = [s for s in samples if s.label == rule["label"]]
    last_start = max(((s.timestamp - origin) / 1000 for s in health), default=-1)
    observed = last_start >= deadline - rule["coverage_tolerance_s"]
    windows = []
    for start in range(spike_end, deadline, rule["window_s"]):
        end = min(start + rule["window_s"], deadline)
        rows = [s for s in health if start * 1000 <= s.timestamp - origin < end * 1000]
        stats = metrics(rows)
        passed = (len(rows) >= rule["min_samples"] and stats["errors"] == 0
                  and stats["p95_ms"] <= rule["p95_ms_max"])
        windows.append({"start_s": start, "end_s": end, **stats, "passed": passed})
    # A recovered window must stay healthy through the deadline, not just once.
    recovered = next((w["end_s"] for i, w in enumerate(windows)
                      if all(x["passed"] for x in windows[i:])), None)
    return {"spike_end_s": spike_end, "deadline_s": deadline,
            "observed_through_deadline": observed, "windows": windows,
            "recovered_at_s": recovered if observed else None,
            "recovery_s": recovered - spike_end if recovered is not None and observed else None,
            "passed": observed and recovered is not None}


def evaluate(samples, profile, sla, properties):
    origin = min((s.timestamp for s in samples), default=0)
    result = {"profile": profile, "origin_timestamp_ms": origin,
              "overall": metrics(samples), "labels": grouped_metrics(samples),
              "timeline": timeline(samples, origin), "breaches": [],
              "saturation": None, "recovery": None}
    breaches = result["breaches"]
    rule = sla["profiles"][profile]
    required = set(sla["required_labels"]) | set(rule.get("label_p95_ms_max", {}))
    if properties.get("driversEnabled"):
        required.add("drivers: active")
    if not samples:
        breaches.append("No samples: an empty run cannot pass.")
    for label in sorted(required - result["labels"].keys()):
        breaches.append(f"Missing required label: {label}")
    error_pct = result["overall"]["error_pct"]
    if error_pct is not None and error_pct > rule["overall_error_pct_max"]:
        breaches.append(f"Overall error {error_pct:.2f}% > {rule['overall_error_pct_max']}%")
    for label, limit in rule.get("label_p95_ms_max", {}).items():
        stats = result["labels"].get(label)
        if stats and stats["p95_ms"] > limit:
            breaches.append(f"{label}: p95 {stats['p95_ms']} ms > {limit} ms")
    if "saturation_p95_ms" in rule:
        result["saturation"] = next((w for w in result["timeline"]
                                     if w["overall"]["p95_ms"] is not None
                                     and w["overall"]["p95_ms"] > rule["saturation_p95_ms"]), None)
    if "recovery" in rule:
        result["recovery"] = recovery_result(samples, origin, properties, rule["recovery"])
        if not result["recovery"]["passed"]:
            breaches.append("Health recovery not demonstrated within "
                            f"{rule['recovery']['within_s']} s after the spike ends "
                            "(slow/failed samples, missing windows, or insufficient observation).")
    result["passed"] = not breaches
    return result


def markdown(result):
    def cell(value):
        return "—" if value is None else f"{value:.2f}"

    def escape(value):
        return str(value).replace("|", "\\|").replace("\n", " ").replace("\r", " ")

    lines = [f"## {result['profile']} — {'PASS' if result['passed'] else 'FAIL'}", "",
             "| Label | Samples | Error % | Mean ms | p50 ms | p90 ms | p95 ms | p99 ms | Max ms | req/s |",
             "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for label, stats in [("Overall", result["overall"]), *result["labels"].items()]:
        values = [str(stats["samples"])] + [cell(stats[key]) for key in
                  ("error_pct", "mean_ms", "p50_ms", "p90_ms", "p95_ms", "p99_ms", "max_ms", "throughput_rps")]
        lines.append(f"| {escape(label)} | " + " | ".join(values) + " |")
    lines += ["", "Nearest-rank percentiles include failed samples. Expected validation 400s count as success.",
              "Throughput uses each row's first request start to last response end (minimum 1 ms).",
              "Time zero is the first sample start; windows are [start, end). Empty windows are unknown.",
              "", "### 10-second timeline", "",
              "| Seconds | Samples | p95 ms | Error % | Health p95 ms | Health error % | Max threads |",
              "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for window in result["timeline"]:
        overall = window["overall"]
        health = window["labels"].get("health", {})
        lines.append(f"| {window['start_s']}–{window['end_s']} | {overall['samples']} | "
                     f"{cell(overall['p95_ms'])} | {cell(overall['error_pct'])} | "
                     f"{cell(health.get('p95_ms'))} | {cell(health.get('error_pct'))} | {window['max_threads']} |")
    if result["profile"] == "stress":
        point = result["saturation"]
        lines += ["", (f"First saturation window: {point['start_s']}–{point['end_s']} s "
                       f"(p95 {point['overall']['p95_ms']} ms; {point['max_threads']} threads, including probe)."
                       if point else "No saturation threshold crossing observed."),
                  "Saturation is a reported capacity signal, not a latency gate for stress."]
    if result["recovery"]:
        recovery = result["recovery"]
        lines += ["", f"Spike ends at {recovery['spike_end_s']} s; recovery deadline {recovery['deadline_s']} s.",
                  (f"Health recovered by {recovery['recovered_at_s']} s ({recovery['recovery_s']} s after spike)."
                   if recovery["passed"] else "Health recovery: FAIL."), "",
                  "| Recovery window | Samples | Health p95 ms | Error % | Pass |",
                  "| --- | ---: | ---: | ---: | --- |"]
        for window in recovery["windows"]:
            lines.append(f"| {window['start_s']}–{window['end_s']} s | {window['samples']} | "
                         f"{cell(window['p95_ms'])} | {cell(window['error_pct'])} | {window['passed']} |")
    if result["breaches"]:
        lines += ["", "### Breaches", ""] + [f"- {escape(b)}" for b in result["breaches"]]
    if result.get("report_only"):
        lines += ["", "Report-only mode: breaches are shown but do not change the exit code."]
    return "\n".join(lines) + "\n"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jtl", type=Path)
    parser.add_argument("--profile", choices=("smoke", "load", "stress", "spike"), required=True)
    parser.add_argument("--sla", type=Path, default=HERE / "sla.json")
    parser.add_argument("--profiles", type=Path, default=HERE / "profiles.json")
    parser.add_argument("--run-config", type=Path, help="Resolved properties saved by the runner")
    parser.add_argument("--report-only", action="store_true")
    args = parser.parse_args(argv)
    try:
        sla = json.loads(args.sla.read_text(encoding="utf-8"))
        profiles = json.loads(args.profiles.read_text(encoding="utf-8"))
        properties = {**profiles["defaults"], **profiles["profiles"][args.profile]}
        if args.run_config:
            properties = json.loads(args.run_config.read_text(encoding="utf-8"))["properties"]
        result = evaluate(read_jtl(args.jtl), args.profile, sla, properties)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        # Still leave an artifact when JMeter failed before writing a usable JTL.
        result = {"profile": args.profile, "passed": False, "overall": metrics([]),
                  "labels": {}, "timeline": [], "saturation": None, "recovery": None,
                  "breaches": [f"Cannot evaluate results: {exc}"]}
    result["report_only"] = args.report_only
    report = markdown(result)
    try:
        args.jtl.parent.mkdir(parents=True, exist_ok=True)
        args.jtl.with_name("summary.md").write_text(report, encoding="utf-8")
        args.jtl.with_name("summary.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    except OSError as exc:
        print(f"Cannot write summary: {exc}", file=sys.stderr)
        return 1
    print(report)
    return 0 if result["passed"] or args.report_only else 1


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
