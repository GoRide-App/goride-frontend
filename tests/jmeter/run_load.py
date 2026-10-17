#!/usr/bin/env python3
"""Shared, dependency-free implementation for the PowerShell and Bash runners."""

import argparse
from datetime import datetime
import ipaddress
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
LIVE_HOST = "goride-trip-matching.lemonwave-a9e91265.indonesiacentral.azurecontainerapps.io"


def target_properties(base_url):
    parsed = urlsplit(base_url)
    if (parsed.scheme not in {"http", "https"} or not parsed.hostname
            or parsed.username is not None or parsed.password is not None
            or parsed.path not in {"", "/"} or parsed.query or parsed.fragment):
        raise ValueError("BaseUrl must be an http(s) origin without credentials, path, query, or fragment")
    host = parsed.hostname
    if ":" in host:
        ipaddress.IPv6Address(host)
        host = f"[{host}]"
    elif not re.fullmatch(r"[A-Za-z0-9.-]+", host):
        raise ValueError("BaseUrl has an invalid hostname")
    return {"protocol": parsed.scheme, "host": host,
            "port": parsed.port or (443 if parsed.scheme == "https" else 80)}


def resolve_profile(profile, base_url=None):
    config = json.loads((HERE / "profiles.json").read_text(encoding="utf-8"))
    properties = {**config["defaults"], **config["profiles"][profile]}
    if base_url:
        properties.update(target_properties(base_url))
    else:
        # Validate configured targets using the same rules as command-line targets.
        target_properties(f"{properties['protocol']}://{properties['host']}:{properties['port']}")
    if profile != "smoke" and properties["host"].lower() == LIVE_HOST:
        raise ValueError("Only smoke is allowed against the shared live Azure target. Use an isolated local/staging service for heavy profiles.")
    properties.setdefault("probeDuration", properties["duration"])
    numeric = ("port", "users", "rampUp", "duration", "stepUsers", "stepEvery", "stepDuration",
               "spikeUsers", "spikeDelay", "spikeDuration", "probeUsers", "probeDuration",
               "thinkMin", "thinkMax", "connectTimeout", "responseTimeout")
    for key in numeric:
        if type(properties[key]) is not int or properties[key] < 0:
            raise ValueError(f"{key} must be a nonnegative integer in profiles.json")
    if not 1 <= properties["port"] <= 65535:
        raise ValueError("port must be between 1 and 65535")
    if properties["probeUsers"] != 1 or properties["probeDuration"] <= 0:
        raise ValueError("Profiles require one health probe and a positive probeDuration")
    if type(properties["driversEnabled"]) is not bool:
        raise ValueError("driversEnabled must be a JSON boolean")
    if not re.fullmatch(r"[A-Za-z0-9_-]*", properties["vehicleType"]):
        raise ValueError("vehicleType must be empty or a vehicle type code")
    if properties["thinkMax"] < properties["thinkMin"]:
        raise ValueError("thinkMax must be >= thinkMin")
    if min(properties["connectTimeout"], properties["responseTimeout"]) <= 0:
        raise ValueError("HTTP timeouts must be positive")
    ends = []
    if properties["users"]:
        if not 0 < properties["duration"] or properties["rampUp"] > properties["duration"]:
            raise ValueError("Steady duration must be positive and at least rampUp")
        ends.append(properties["duration"])
    if properties["stepUsers"]:
        if properties["stepEvery"] < 1 or properties["stepDuration"] <= 3 * properties["stepEvery"]:
            raise ValueError("stepDuration must exceed 3 * stepEvery, and stepEvery must be positive")
        ends.append(properties["stepDuration"])
    if properties["spikeUsers"]:
        if properties["spikeDuration"] < 1:
            raise ValueError("spikeDuration must be positive")
        ends.append(properties["spikeDelay"] + properties["spikeDuration"])
    if not ends:
        raise ValueError("Profile must enable at least one traffic group")
    if properties["probeDuration"] < max(ends):
        raise ValueError("probeDuration must cover every traffic group")
    if profile == "spike":
        sla = json.loads((HERE / "sla.json").read_text(encoding="utf-8"))
        deadline = properties["spikeDelay"] + properties["spikeDuration"] + sla["profiles"][profile]["recovery"]["within_s"]
        if not properties["spikeUsers"] or properties["probeDuration"] < deadline:
            raise ValueError("Spike profile must enable a burst and probe through its recovery deadline")
    properties["routesFile"] = (HERE / "data" / "routes.csv").as_posix()
    return properties


def find_tools(jmeter_home):
    env = os.environ.copy()
    java_home = env.get("JAVA_HOME")
    java = str(Path(java_home) / "bin" / ("java.exe" if os.name == "nt" else "java")) if java_home else shutil.which("java")
    if not java or not Path(java).is_file():
        raise ValueError("Java is missing. Install Java 17 or newer (CI uses Temurin 21) and set JAVA_HOME or PATH.")
    check = subprocess.run([java, "-version"], capture_output=True, text=True)
    if check.returncode:
        raise ValueError("Java could not start. Check JAVA_HOME and PATH.")
    version = re.search(r'version "(\d+)', check.stderr + check.stdout)
    if not version or int(version.group(1)) < 17:
        raise ValueError("Use Java 17 or newer with JMeter 5.6.3 (CI uses Temurin 21). Set JAVA_HOME.")
    # jmeter.bat finds Java through PATH, not JAVA_HOME.
    env["PATH"] = str(Path(java).parent) + os.pathsep + env.get("PATH", "")
    if os.name == "nt":
        env["JM_LAUNCH"] = java
    home = jmeter_home or env.get("JMETER_HOME")
    executable = "jmeter.bat" if os.name == "nt" else "jmeter"
    jmeter = str(Path(home).expanduser().resolve() / "bin" / executable) if home else shutil.which(executable)
    if not jmeter or not Path(jmeter).is_file():
        raise ValueError("JMeter is missing. Install Apache JMeter 5.6.3 and pass -JMeterHome, set JMETER_HOME, or add bin to PATH.")
    env["JMETER_HOME"] = str(Path(jmeter).resolve().parent.parent)
    return jmeter, env


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("-Profile", "--profile", choices=("smoke", "load", "stress", "spike"), required=True)
    parser.add_argument("-BaseUrl", "--base-url")
    parser.add_argument("-JMeterHome", "--jmeter-home")
    args = parser.parse_args(argv)
    try:
        properties = resolve_profile(args.profile, args.base_url)
        jmeter, env = find_tools(args.jmeter_home)
        output = HERE / "results" / f"{args.profile}-{datetime.now():%Y%m%d-%H%M%S}"
        output.mkdir(parents=True, exist_ok=False)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"Load test cannot start: {exc}", file=sys.stderr)
        return 1
    run_config = output / "run-config.json"
    run_config.write_text(json.dumps({"profile": args.profile, "properties": properties}, indent=2) + "\n", encoding="utf-8")
    command = [jmeter, "-n", "-t", str(HERE / "goride-trip-perf.jmx"),
               "-l", str(output / "results.jtl"), "-j", str(output / "jmeter.log"),
               "-e", "-o", str(output / "report"),
               # Runs last 1-3 minutes, so plot the dashboard in 5 s steps instead of the 1 min default.
               "-Jjmeter.reportgenerator.overall_granularity=5000"]
    command += [f"-J{key}={str(value).lower() if isinstance(value, bool) else value}"
                for key, value in properties.items()]
    # Preserve dashboard defaults, including fields not used directly by the gate.
    save_defaults = {"output_format": "csv", "print_field_names": "true", "default_delimiter": ",",
                     "timestamp_format": "ms", "label": "true", "time": "true", "successful": "true",
                     "response_code": "true", "thread_counts": "true", "latency": "true", "connect_time": "true"}
    command += [f"-Jjmeter.save.saveservice.{key}={value}" for key, value in save_defaults.items()]
    command += ["-Jsampleresult.timestamp.start=true"]
    print(f"Results: {output}", flush=True)
    print("JMeter command: " + (subprocess.list2cmdline(command) if os.name == "nt" else shlex.join(command)), flush=True)
    try:
        jmeter_status = subprocess.run(command, cwd=HERE, env=env).returncode
    except OSError as exc:
        print(f"JMeter could not start: {exc}", file=sys.stderr)
        jmeter_status = 1
    if not (output / "report" / "index.html").is_file():
        print("JMeter did not produce the HTML dashboard; inspect jmeter.log.", file=sys.stderr)
        jmeter_status = 1
    # JMeter may return zero even when HTTP samples fail; always run the SLA gate.
    gate_status = subprocess.run([sys.executable, str(HERE / "sla_gate.py"),
                                  str(output / "results.jtl"), "--profile", args.profile,
                                  "--run-config", str(run_config)], cwd=HERE).returncode
    if jmeter_status:
        print(f"JMeter exited with {jmeter_status}; inspect {output / 'jmeter.log'}", file=sys.stderr)
    return 1 if jmeter_status or gate_status else 0


if __name__ == "__main__":
    sys.exit(main())
