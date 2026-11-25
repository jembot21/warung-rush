"""Real-browser loop and four 1280x800 JPEGs. Uses the existing pytools venv.

Run: ~/workspace/pytools/.venv/bin/python scripts/polish-playtest.py
Requires a host that permits a local HTTP listener and Chromium processes.
"""
import argparse
import functools
import hashlib
import http.server
import json
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "screenshots"
errors = []
requests = []
log = []


def note(message):
    log.append(message)
    print(message, flush=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser-build", choices=("1255", "1243"), default="1255")
    parser.add_argument("--file", action="store_true", help="Load game/index.html without an HTTP listener")
    options = parser.parse_args()
    server = None
    SHOTS.mkdir(exist_ok=True)
    try:
        with sync_playwright() as p:
            cached = sorted(Path.home().glob(f".cache/ms-playwright/chromium_headless_shell-{options.browser_build}/chrome-headless-shell-linux64/chrome-headless-shell"))
            assert cached, "Cached Chromium not found"
            launch_args = ["--no-sandbox", "--no-zygote", "--single-process", "--disable-setuid-sandbox", "--disable-gpu-sandbox"]
            if options.file:
                launch_args.append("--allow-file-access-from-files")
            note(f"Launching Chromium {options.browser_build}; file mode: {options.file}")
            browser = p.chromium.launch(executable_path=str(cached[-1]), args=launch_args, timeout=30000)
            note("Chromium launched")
            if options.file:
                game_url = (ROOT / "game" / "index.html").as_uri()
                request_prefix = (ROOT / "game").as_uri() + "/"
            else:
                handler = functools.partial(Handler, directory=str(ROOT / "game"))
                server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                game_url = f"http://127.0.0.1:{server.server_port}/"
                request_prefix = f"http://127.0.0.1:{server.server_port}/"
            page = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
            page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
            page.on("console", lambda m: errors.append("console-error: " + m.text) if m.type == "error" else None)
            page.on("requestfailed", lambda r: errors.append("request-failed: " + r.url))
            page.on("request", lambda r: requests.append(r.url))
            page.goto(game_url, wait_until="networkidle")
            page.click("#start-button")
            page.wait_for_function("document.querySelector('#order-slots .dish-name') !== null")
            recipes = page.evaluate("async () => (await import('./js/recipes.js')).dishes")
            first_name = page.locator("#order-slots .dish-name").first.inner_text()
            dish = next(d for d in recipes if d["name"] == first_name)
            assert first_name == "Nasi Telur Balado", first_name
            shot_data = {}

            def capture(name):
                page.wait_for_timeout(200)
                assert page.locator("#start-panel").is_hidden()
                assert page.locator("#kitchen-counter").is_visible()
                bounds = page.locator("#kitchen-counter").bounding_box()
                assert bounds["y"] + bounds["height"] <= 800, "Counter does not fit 1280x800"
                for quality in (85, 80, 75, 70, 65, 60):
                    data = page.screenshot(type="jpeg", quality=quality, full_page=False)
                    if len(data) <= 262144:
                        break
                assert len(data) <= 262144, "JPEG exceeds 256 KiB"
                (SHOTS / name).write_bytes(data)
                shot_data[name] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
                note("Captured " + name)

            def crate(raw):
                page.click(f'#ingredient-crates [data-ingredient="{raw}"]')

            def pickup(station, component):
                page.wait_for_function("([s,n]) => [...document.querySelectorAll('#'+s+'-slots button')].some(b => b.textContent.includes(n) && b.getAttribute('aria-label').includes('matang, klik'))", arg=[station, component], timeout=12000)
                page.locator(f"#{station}-slots button").filter(has_text=component).first.click()
                assert page.locator("#held-item-name").inner_text() == component

            def plate():
                page.click('#plate-1 [data-action="add-to-plate"]')

            capture("02-start.jpg")
            crate("rice")
            plate()
            crate("egg")
            page.click('#station-wok [data-action="use-station"]')
            page.wait_for_timeout(450)
            assert page.locator("#plate-1 .plate-layer").count() == 1
            assert page.locator("#station-wok").get_attribute("data-state") == "cooking"
            capture("03-rush.jpg")
            pickup("wok", "Telur ceplok")
            plate()
            crate("chili")
            page.click('#station-cut [data-action="use-station"]')
            pickup("cut", "Sambal iris")
            plate()
            assert page.locator("#serve-plate-1").is_enabled()
            assert page.locator("#plate-1-name").inner_text() == dish["name"]
            assert page.locator("#plate-1 .plate-layer").count() == 3
            page.wait_for_function("document.querySelector('#order-count').textContent === '2'", timeout=25000)
            crate("rice")
            page.click('#station-wok [data-action="use-station"]')
            page.wait_for_timeout(450)
            capture("01-cover.jpg")
            before = int("".join(c for c in page.locator("#coins").inner_text() if c.isdigit()))
            page.click("#serve-plate-1")
            after = int("".join(c for c in page.locator("#coins").inner_text() if c.isdigit()))
            assert after > before, "Serving did not increase coins"
            assert page.locator("#plate-1 .plate-payout").inner_text().startswith("+Rp ")
            assert page.locator("#plate-1 .plate-layer").count() == 0
            note(f"Served {dish['name']}: Rp {before} -> Rp {after}")
            deadline = time.monotonic() + 110
            heartbeat = time.monotonic()
            while page.locator("#day-complete-panel").is_hidden():
                assert time.monotonic() < deadline, "Day never ended"
                page.wait_for_timeout(500)
                if time.monotonic() - heartbeat >= 10:
                    note("Day running: " + page.locator("#day-time-remaining").inner_text())
                    heartbeat = time.monotonic()
            page.wait_for_timeout(800)
            assert page.locator("#day-served").inner_text() == "1"
            assert int("".join(c for c in page.locator("#day-earnings").inner_text() if c.isdigit())) == after
            capture("04-upgrades.jpg")
            page.click("#upgrade-speed")
            page.click("#next-day-button")
            assert page.locator("#day-number").inner_text() == "2"
            assert page.locator('#price-list [data-dish="nasi-ayam-geprek"]').count() == 1
            assert not any(not url.startswith(request_prefix) for url in requests), "External request"
            assert not errors, errors
            result = {"status": "passed", "served": dish["name"], "coinsBefore": before, "coinsAfter": after, "dayEnded": True, "pageAndConsoleErrors": errors, "screenshots": shot_data, "log": log}
            (ROOT / "scripts" / "polish-playtest-result.json").write_text(json.dumps(result, indent=2) + "\n")
            print(json.dumps(result, indent=2))
            browser.close()
    finally:
        if server is not None:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    main()
