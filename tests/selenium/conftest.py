"""Shared fixtures for the GoRide Selenium suite."""

from __future__ import annotations

import os
import socket
import time
from pathlib import Path
from urllib.parse import urlparse

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

APP = os.environ.get("GORIDE_APP", "http://localhost:3000")
API = os.environ.get("GORIDE_API", "https://localhost:7136")

EVIDENCE = Path(os.environ.get("GORIDE_EVIDENCE", Path(__file__).resolve().parent / "evidence"))

# width, height, label - the three viewports every responsive check runs at.
# Shared between test_ui_smoke.py and test_ride_planning.py so both suites
# test the same sizes rather than drifting apart.
VIEWPORTS = [
    (390, 844, "phone"),
    (768, 1024, "tablet"),
    (1440, 900, "desktop"),
]


def _listening(url: str) -> bool:
    parsed = urlparse(url)
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    with socket.socket() as sock:
        sock.settimeout(2)
        return sock.connect_ex((parsed.hostname or "localhost", port)) == 0


@pytest.fixture(scope="session", autouse=True)
def services_up():
    """Fail loudly and early rather than 30 confusing test failures."""
    missing = []
    if not _listening(APP):
        missing.append(f"frontend at {APP}  (npm run dev in goride-frontend)")
    if not _listening(API):
        missing.append(f"API at {API}  (dotnet run --launch-profile https in src)")
    if missing:
        pytest.exit("Not running:\n  - " + "\n  - ".join(missing), returncode=1)


@pytest.fixture
def driver():
    opts = Options()
    opts.add_argument("--ignore-certificate-errors")
    opts.add_argument("--allow-insecure-localhost")
    opts.add_argument("--window-size=1440,900")
    if os.environ.get("HEADLESS", "1") == "1":
        opts.add_argument("--headless=new")
    # Do NOT add excludeSwitches=["enable-automation"] here: on Chrome 152 it makes
    # the browser exit at startup in windowed mode (SessionNotCreatedException).
    # Needed for driver.get_log("browser") in the console-error test.
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})

    drv = webdriver.Chrome(options=opts)
    drv.implicitly_wait(5)
    yield drv
    drv.quit()


@pytest.fixture
def shot(request):
    """shot(driver, 'name') -> saves a screenshot named after the test."""
    EVIDENCE.mkdir(parents=True, exist_ok=True)

    def take(drv, label: str) -> Path:
        safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in label)
        path = EVIDENCE / f"{request.node.name}__{safe}.png"
        drv.save_screenshot(str(path))
        return path

    return take


def wait_settled(drv, timeout: float = 12.0) -> None:
    """
    Wait for the page to stop moving before measuring it.

    Next.js hydrates and loads images well after readyState=complete, and the
    layout keeps growing while it does. Two matching readings are not enough:
    the page sits at its correct width for a moment BEFORE the overflowing
    element mounts, so an early pair of equal reads reports a clean layout on a
    page that is actually broken. Require the width to hold steady for a full
    second before believing it.
    """
    deadline = time.time() + timeout

    while time.time() < deadline:
        if drv.execute_script("return document.readyState") == "complete":
            break
        time.sleep(0.2)

    STABLE_READS = 4      # 4 x 0.25s = 1s of no change
    last, steady = None, 0
    while time.time() < deadline:
        width = drv.execute_script("return document.documentElement.scrollWidth")
        steady = steady + 1 if width == last else 0
        last = width
        if steady >= STABLE_READS:
            return
        time.sleep(0.25)


def set_viewport(drv, width: int, height: int) -> None:
    """
    Set the exact CSS viewport.

    driver.set_window_size() sizes the OS window, not the viewport - at
    390x844 it left a 512px viewport, so the test was not measuring the width
    its own label claimed. Emulation.setDeviceMetricsOverride is exact.
    """
    drv.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
        "width": width,
        "height": height,
        "deviceScaleFactor": 1,
        "mobile": width < 768,
    })


def widest_offender(drv):
    """The element sticking out furthest past the right edge, for the bug report."""
    return drv.execute_script("""
        const de = document.documentElement;
        let worst = null;
        document.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > de.clientWidth + 1) {
                if (!worst || r.right > worst.right) {
                    worst = {tag: el.tagName.toLowerCase(),
                             cls: (el.className || '').toString().slice(0, 90),
                             right: Math.round(r.right)};
                }
            }
        });
        return worst;
    """)


def has_horizontal_overflow(drv) -> bool:
    """
    True when the page scrolls sideways - always a responsive-layout bug.

    Compare against documentElement.clientWidth, NOT window.innerWidth: under
    mobile emulation innerWidth reports the scrollable width, so an overflowing
    phone layout compares equal to itself and the check silently passes.
    """
    return drv.execute_script(
        "const e = document.documentElement;"
        "return e.scrollWidth > e.clientWidth + 1;"
    )


def overflow_detail(drv) -> str:
    """' - widest offender: <div class="..."> reaches 512px', or '' if nothing overflows.

    A ready-to-append suffix for an overflow assertion message, factored out
    so every responsive test reports the same way instead of re-deriving it.
    """
    culprit = widest_offender(drv)
    if not culprit:
        return ""
    return (f" - widest offender: <{culprit['tag']} class=\"{culprit['cls']}\"> "
            f"reaches {culprit['right']}px")
