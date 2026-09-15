"""
Rider ride-planning flow: SCRUM-46, SCRUM-47, SCRUM-48, SCRUM-53, SCRUM-54, SCRUM-56.

These are the mid-Sprint-2 stories that are actually reachable through the
frontend right now (SCRUM-127/128/129/130/132 are notification-service
stories with no UI to click through - those stay covered by the Postman
collection instead). Unlike test_ui_smoke.py, every screen here sits behind
RoleGuard/proxy.ts's session check, so these tests need a signed-in Rider,
not just a running frontend.

Needs everything up:

    .\\goride-dev.ps1 start identity
    .\\goride-dev.ps1 start trip
    .\\goride-dev.ps1 start frontend

Sign-in drives the real "Sign in" link on the landing page through to
Asgardeo and back - the same round trip test_sign_in_reaches_asgardeo
already proves works - rather than reusing grab_session_cookie.py's saved
cookie. That cookie is captured while sitting directly on the identity API's
own origin (https://localhost:7136), so it is scoped there; the frontend at
http://localhost:3000 checks a same-origin app_session cookie instead (see
proxy.ts), which only gets set when login happens through the frontend's own
/login rewrite. Signing in from APP is what makes the cookie land in the
right place.

Credentials come from GORIDE_USER / GORIDE_PASS if set - the same variables
grab_session_cookie.py reads - and default to the seeded Rider demo account
in src/lib/constants.ts (DEMO_ACCOUNTS / DEMO_PASSWORD) otherwise. If that
account's password has changed or picked up MFA, set the env vars to a
working Rider account before running this file.

Run just this file with:

    python -m pytest -v test_ride_planning.py

Sign-in defensive notes (read this if _sign_in starts failing again):

The first version of this file assumed Asgardeo's hosted login is one
combined form - both input[name='username'] and input[name='password']
present and interactable at the same time - copied from
grab_session_cookie.py's try_scripted_login. A live run proved that wrong:
every test errored inside the sign-in fixture with
ElementNotInteractableException on input[name='username']. That exception
means the element was FOUND in the DOM but could not be typed into right
then - typically because it belongs to a step that hasn't finished
transitioning in, or because Asgardeo actually splits sign-in into a
username step and a separate password step (a "Continue" button between
them), so the password field either does not exist yet or the username
field is mid-transition when a single find-and-fill pass reaches it.

_sign_in below no longer assumes either shape. It waits for each field to be
*visible* (not just present) before typing into it, advances through
whatever "Continue"/"Sign in" control is on screen after each field, and
tolerates both a one-step and a two-step form. If it still cannot get past
sign-in, it now saves a screenshot and the page source of whatever screen it
got stuck on to evidence/sign-in-stuck.png / .html before raising, so the
next failure comes with a picture of the actual login screen instead of
another guess.
"""

from __future__ import annotations

import os
import time

import pytest
from selenium import webdriver
from selenium.common.exceptions import (
    ElementNotInteractableException,
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException,
)
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import (VIEWPORTS, APP, EVIDENCE, has_horizontal_overflow,
                      overflow_detail, set_viewport, wait_settled)

RIDER_EMAIL = os.environ.get("GORIDE_USER", "rider@goride.lk")
RIDER_PASSWORD = os.environ.get("GORIDE_PASS", "goride123")
LOGIN_TIMEOUT = 300  # matches grab_session_cookie.py - real IdP round trip, MFA included

# From src/components/rider/location-search.tsx's RECENT_PLACES - used here
# because clicking one is the fastest reliable way to get both a pickup and a
# destination set without fighting the debounced address-search box.
RECENT_DESTINATION = "SLIIT Malabe Campus"
SEARCH_LANDMARK = "One Galle Face Mall"

PICKUP_SELECTOR = "input[placeholder='Add a pick-up location'], input[placeholder='Locating you…']"


def _react_clear(field) -> None:
    """
    Empty a React-controlled text field in a way React actually notices.

    Selenium's element.clear() can reset the input's on-screen value without
    dispatching a genuine input event - fine for a plain HTML form, but the
    pickup/destination boxes here are React-controlled (SearchInput in
    location-search.tsx), so their own state only updates from a real event.
    ride-phases.tsx's SuggestionList decides whether to show "Use current
    location" from that React state (query.trim().length < 2), not from
    the DOM value, so a clear() that isn't observed leaves the field looking
    empty while the quick-action button never appears - which is exactly
    what made test_use_current_location_as_pickup time out: it clears and
    then only waits, with no keystroke afterwards to resync React's state.
    Select-all + Backspace are real key events, so React sees them either way.
    """
    field.send_keys(Keys.CONTROL, "a")
    field.send_keys(Keys.BACKSPACE)

# Exceptions that just mean "this step of the login isn't the one on screen
# right now" - not a real failure, keep polling.
_STEP_NOT_READY = (
    TimeoutException,
    NoSuchElementException,
    StaleElementReferenceException,
    ElementNotInteractableException,
)


def _advance(driver) -> None:
    """Click whatever moves the current Asgardeo step forward.

    Covers a combined form's 'Sign in' submit and a split form's 'Continue'
    button with the same selector - Asgardeo's own submit control is a
    button[type='submit'] (occasionally input[type='submit']) either way.
    """
    try:
        driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit']").click()
    except _STEP_NOT_READY:
        pass


def _visible(driver, css: str, timeout: float = 2.5):
    """WebDriverWait for *visible*, not just present - the bug in the first
    version was find_element (presence only) followed immediately by
    send_keys, which races Asgardeo's step transition/animation and throws
    ElementNotInteractableException when it loses."""
    return WebDriverWait(driver, timeout).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, css))
    )


def _dump_stuck_state(driver, reason: str) -> None:
    """Best-effort screenshot + page source of wherever sign-in got stuck,
    so a failure here comes with evidence instead of just a timeout message."""
    try:
        EVIDENCE.mkdir(parents=True, exist_ok=True)
        driver.save_screenshot(str(EVIDENCE / "sign-in-stuck.png"))
        (EVIDENCE / "sign-in-stuck.html").write_text(driver.page_source, encoding="utf-8")
        (EVIDENCE / "sign-in-stuck.txt").write_text(
            f"{reason}\nstuck at: {driver.current_url}\n", encoding="utf-8"
        )
    except Exception:
        pass  # evidence-gathering must never mask the real failure


def _sign_in(driver) -> None:
    """Drive Sign in -> Asgardeo -> back on localhost:3000, the same way a real rider would.

    Handles both a combined username+password form and a split
    username-then-Continue-then-password form, since the real shape was not
    confirmed live before the first version shipped and turned out to be
    wrong (see module docstring).
    """
    driver.get(APP)
    links = driver.find_elements(By.PARTIAL_LINK_TEXT, "Sign in")
    assert links, "no 'Sign in' link on the landing page - can't authenticate"
    links[0].click()

    stage = "username"  # -> "password" -> "waiting"
    deadline = time.time() + LOGIN_TIMEOUT

    while time.time() < deadline:
        url = driver.current_url
        if url.startswith(("http://localhost:3000", "https://localhost:3000")) and "/login" not in url:
            return

        if stage == "username":
            try:
                username_box = _visible(driver, "input[name='username']")
                username_box.clear()
                username_box.send_keys(RIDER_EMAIL)
                # A combined form has the password field already on screen
                # too - fill it now and submit once, rather than advancing
                # to a "password" stage that will never see a fresh step.
                try:
                    password_box = driver.find_element(By.CSS_SELECTOR, "input[name='password']")
                    if password_box.is_displayed():
                        password_box.clear()
                        password_box.send_keys(RIDER_PASSWORD)
                        _advance(driver)
                        stage = "waiting"
                        time.sleep(1)
                        continue
                except _STEP_NOT_READY:
                    pass
                # Split form: username-only step, advance to the password step.
                _advance(driver)
                stage = "password"
            except _STEP_NOT_READY:
                pass  # username step not on screen yet (or already past it)

        elif stage == "password":
            try:
                password_box = _visible(driver, "input[name='password']")
                password_box.clear()
                password_box.send_keys(RIDER_PASSWORD)
                _advance(driver)
                stage = "waiting"
            except _STEP_NOT_READY:
                pass  # password step still transitioning in

        # stage == "waiting": nothing to do but keep polling for the app URL.
        time.sleep(1)

    _dump_stuck_state(
        driver,
        f"still not signed in as {RIDER_EMAIL} after {LOGIN_TIMEOUT}s, last stage={stage!r}",
    )
    raise TimeoutError(
        f"still not signed in as {RIDER_EMAIL} after {LOGIN_TIMEOUT}s (stuck at stage {stage!r}, "
        f"last url {driver.current_url}) - if this account needs MFA or its password changed, "
        "set GORIDE_USER / GORIDE_PASS to a working Rider account before running this file. "
        "A screenshot and the page source of the stuck screen were saved to "
        "evidence/sign-in-stuck.png / .html"
    )


@pytest.fixture(scope="module")
def rider_driver():
    """
    One signed-in Chrome session shared by every test below.

    Module-scoped on purpose: signing in through the real Asgardeo flow is a
    genuine network round trip to a hosted login page, not something to pay
    for in every test. Ride-planning state is still reset per test (see
    fresh_ride) so tests never see each other's pickup/destination/selection.
    """
    opts = Options()
    opts.add_argument("--ignore-certificate-errors")
    opts.add_argument("--allow-insecure-localhost")
    opts.add_argument("--window-size=1440,900")
    if os.environ.get("HEADLESS", "1") == "1":
        opts.add_argument("--headless=new")
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})

    drv = webdriver.Chrome(options=opts)
    drv.implicitly_wait(5)
    _sign_in(drv)
    yield drv
    drv.quit()


@pytest.fixture
def fresh_ride(rider_driver):
    """
    Clear only the ride-store's persisted state before each test.

    useRideStore persists pickup/destination/selection to sessionStorage
    under 'goride.ride' (see store/ride-store.ts). useAuthStore persists the
    signed-in session to the SAME sessionStorage under 'goride.session' -
    sessionStorage.clear() would silently log the rider back out for every
    test after the first one, so this removes only the ride key.
    """
    rider_driver.get(APP)
    rider_driver.execute_script("window.sessionStorage.removeItem('goride.ride');")
    return rider_driver


@pytest.fixture
def any_size(fresh_ride):
    """fresh_ride, but restores the desktop viewport afterward.

    rider_driver is module-scoped and shared by every test in this file
    (see its docstring) - unlike test_ui_smoke.py, where every test gets
    its own fresh browser. That means a viewport test that left the shared
    browser at phone size would corrupt every test that runs after it in
    this file. Only the viewport-parametrized tests below use this fixture;
    everything else relies on the desktop 1440x900 window rider_driver was
    created with.
    """
    yield fresh_ride
    set_viewport(fresh_ride, 1440, 900)


def test_open_ride_page_from_home(fresh_ride, shot):
    """SCRUM-46: picking a recent destination on the rider home page opens /rider/ride with it pre-filled."""
    driver = fresh_ride
    driver.get(f"{APP}/rider")
    wait_settled(driver)

    target = driver.find_element(By.XPATH, f"//button[.//span[text()='{RECENT_DESTINATION}']]")
    target.click()

    WebDriverWait(driver, 10).until(lambda d: "/rider/ride" in d.current_url)
    assert "/rider/ride" in driver.current_url, "clicking a recent destination did not open the ride page"
    shot(driver, "ride-page-opened")


def test_use_current_location_as_pickup(fresh_ride):
    """SCRUM-47: pickup auto-locates on arrival, and 'Use current location' re-locates it on demand."""
    driver = fresh_ride
    driver.get(f"{APP}/rider/ride")

    pickup_input = WebDriverWait(driver, 15).until(lambda d: d.find_element(By.CSS_SELECTOR, PICKUP_SELECTOR))
    # RiderRidePage's mount effect calls locate() automatically when there is
    # no pickup yet - wait that out before touching the field ourselves.
    WebDriverWait(driver, 15).until(lambda d: pickup_input.get_attribute("value").strip() != "")
    auto_value = pickup_input.get_attribute("value")
    assert auto_value, "pickup never auto-located on page load"

    pickup_input.click()
    _react_clear(pickup_input)
    quick = WebDriverWait(driver, 5).until(
        lambda d: d.find_element(By.XPATH, "//button[contains(., 'Use current location')]")
    )
    quick.click()

    WebDriverWait(driver, 15).until(lambda d: pickup_input.get_attribute("value").strip() != "")
    assert pickup_input.get_attribute("value").strip(), "'Use current location' did not repopulate the pickup field"


def test_search_pickup_location_by_address(fresh_ride):
    """SCRUM-48: typing an address into the pickup field surfaces it as a pickable suggestion."""
    driver = fresh_ride
    driver.get(f"{APP}/rider/ride")

    pickup_input = WebDriverWait(driver, 15).until(lambda d: d.find_element(By.CSS_SELECTOR, PICKUP_SELECTOR))
    WebDriverWait(driver, 15).until(lambda d: pickup_input.get_attribute("value").strip() != "")

    pickup_input.click()
    _react_clear(pickup_input)
    pickup_input.send_keys(SEARCH_LANDMARK[:12])  # partial query, like a real user mid-type

    suggestion = WebDriverWait(driver, 10).until(
        lambda d: d.find_element(By.XPATH, f"//button[contains(., '{SEARCH_LANDMARK}')]")
    )
    suggestion.click()

    WebDriverWait(driver, 5).until(lambda d: pickup_input.get_attribute("value") == SEARCH_LANDMARK)
    assert pickup_input.get_attribute("value") == SEARCH_LANDMARK, "picking a search suggestion did not fill the pickup field"


def test_fare_and_vehicle_selection(fresh_ride, shot):
    """
    SCRUM-53/54: after Search, every vehicle type shows a real calculated fare.
    SCRUM-56: only Tuk Tuk is selectable this sprint - every other option must
    carry a genuine HTML disabled attribute (VehicleOption sets
    disabled={!isAvailable} in ride-bits.tsx), not just be styled to look
    unavailable. is_enabled() here is the automated form of hovering over the
    button to confirm it does not actually respond to a click.
    """
    driver = fresh_ride
    driver.get(f"{APP}/rider")
    wait_settled(driver)
    driver.find_element(By.XPATH, f"//button[.//span[text()='{RECENT_DESTINATION}']]").click()
    WebDriverWait(driver, 10).until(lambda d: "/rider/ride" in d.current_url)

    pickup_input = WebDriverWait(driver, 15).until(lambda d: d.find_element(By.CSS_SELECTOR, PICKUP_SELECTOR))
    WebDriverWait(driver, 15).until(lambda d: pickup_input.get_attribute("value").strip() != "")

    search_btn = WebDriverWait(driver, 5).until(
        lambda d: d.find_element(By.XPATH, "//button[normalize-space()='Search']")
    )
    search_btn.click()

    WebDriverWait(driver, 20).until(lambda d: d.find_elements(By.XPATH, "//h2[text()='Choose a ride']"))
    shot(driver, "choose-a-ride")

    tuk = driver.find_element(By.XPATH, "//button[.//span[text()='Tuk Tuk']]")
    assert tuk.is_enabled(), "Tuk Tuk should be the one bookable vehicle type, but it is disabled"
    tuk_fare = tuk.find_element(By.XPATH, ".//span[contains(@class,'font-bold')]").text
    assert tuk_fare not in ("", "—"), f"Tuk Tuk has no calculated fare (SCRUM-53/54): got {tuk_fare!r}"

    unavailable = driver.find_elements(By.XPATH, "//button[.//span[text()='Unavailable']]")
    assert unavailable, "expected at least one non-Tuk-Tuk vehicle type marked Unavailable"
    for opt in unavailable:
        assert not opt.is_enabled(), (
            "a vehicle type marked Unavailable is still clickable - SCRUM-56 only allows "
            "Tuk Tuk to be selected right now, this one should carry a real disabled attribute"
        )
        fare = opt.find_element(By.XPATH, ".//span[contains(@class,'font-bold')]").text
        assert fare not in ("", "—"), f"an unavailable vehicle type should still show its real calculated fare, got {fare!r}"

    tuk.click()
    WebDriverWait(driver, 5).until(lambda d: tuk.get_attribute("aria-pressed") == "true")
    assert tuk.get_attribute("aria-pressed") == "true", "selecting Tuk Tuk did not mark it as selected"
    assert "/rider/ride" in driver.current_url, (
        "selecting a vehicle type should not navigate anywhere yet - "
        "continuing past this screen (trip booking) is not implemented"
    )


# ---------------------------------------------------------------------------
# Responsive checks, signed in - phone / tablet / desktop (SCRUM-46/47/48/53/
# 54/56's own screens, not just the anonymous landing page test_ui_smoke.py
# already covers).
#
# These three cover the whole ride-planning flow's own layouts: the rider
# home page, the pickup/destination planning screen (map + panel side by
# side on desktop, stacked on phone), and the busiest screen of all -
# vehicle-selection cards after Search, the layout most likely to overflow
# on a narrow phone. Every test here uses any_size, not fresh_ride, so the
# shared browser's viewport gets put back to desktop afterward - see
# any_size's docstring.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("width,height,label", VIEWPORTS)
def test_rider_home_does_not_scroll_sideways(any_size, shot, width, height, label):
    """The signed-in rider home page (recent destinations) must not scroll sideways."""
    driver = any_size
    set_viewport(driver, width, height)
    driver.get(f"{APP}/rider")
    wait_settled(driver)
    shot(driver, f"rider-home-{label}-{width}x{height}")

    assert not has_horizontal_overflow(driver), (
        f"the rider home page scrolls horizontally at {width}x{height} ({label})"
        f"{overflow_detail(driver)}"
    )


@pytest.mark.parametrize("width,height,label", VIEWPORTS)
def test_ride_planning_page_does_not_scroll_sideways(any_size, shot, width, height, label):
    """The pickup/destination planning screen must not scroll sideways either."""
    driver = any_size
    set_viewport(driver, width, height)
    driver.get(f"{APP}/rider/ride")
    wait_settled(driver)
    shot(driver, f"ride-planning-{label}-{width}x{height}")

    assert not has_horizontal_overflow(driver), (
        f"the ride planning page scrolls horizontally at {width}x{height} ({label})"
        f"{overflow_detail(driver)}"
    )


@pytest.mark.parametrize("width,height,label", VIEWPORTS)
def test_choose_a_ride_does_not_scroll_sideways(any_size, shot, width, height, label):
    """
    SCRUM-53/54/56's vehicle-selection cards are the densest layout in the
    flow, and so the one most likely to overflow on a phone-width screen.
    """
    driver = any_size
    set_viewport(driver, width, height)
    driver.get(f"{APP}/rider")
    wait_settled(driver)
    driver.find_element(By.XPATH, f"//button[.//span[text()='{RECENT_DESTINATION}']]").click()
    WebDriverWait(driver, 10).until(lambda d: "/rider/ride" in d.current_url)

    pickup_input = WebDriverWait(driver, 15).until(lambda d: d.find_element(By.CSS_SELECTOR, PICKUP_SELECTOR))
    WebDriverWait(driver, 15).until(lambda d: pickup_input.get_attribute("value").strip() != "")

    search_btn = WebDriverWait(driver, 5).until(
        lambda d: d.find_element(By.XPATH, "//button[normalize-space()='Search']")
    )
    search_btn.click()
    WebDriverWait(driver, 20).until(lambda d: d.find_elements(By.XPATH, "//h2[text()='Choose a ride']"))
    wait_settled(driver)
    shot(driver, f"choose-a-ride-{label}-{width}x{height}")

    assert not has_horizontal_overflow(driver), (
        f"the choose-a-ride screen scrolls horizontally at {width}x{height} ({label})"
        f"{overflow_detail(driver)}"
    )
