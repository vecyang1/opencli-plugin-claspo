#!/usr/bin/env python3
"""
Production Claspo multi-frame diagnostic runner.
Inspects target URL and embedded child iframes for Claspo scripts,
active popups/modals, floating teaser boxes, and countdown timer badges.
"""

import sys
import json
import asyncio
from urllib.parse import urlparse
from playwright.async_api import async_playwright

async def diagnose_url(target_url: str, wait_sec: int = 5):
    results = []
    parsed_target = urlparse(target_url)
    root_domain = ".".join(parsed_target.hostname.split(".")[-2:]) if parsed_target.hostname else ""

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            await page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(wait_sec * 1000)
        except Exception as e:
            await browser.close()
            return [{
                "Scope": "Main Window",
                "Url": target_url,
                "ClaspoScript": "Error",
                "ClaspoWidgetDom": "Error",
                "ActiveModals": 0,
                "FloatingTeasers": 0,
                "Countdowns": 0,
                "GuardActive": "N/A",
                "Status": f"NAVIGATION_FAILED: {str(e)[:60]}"
            }]

        # 1. Inspect Main Page
        main_claspo_scripts = await page.locator("script[src*='claspo']").count()
        main_has_widget = (await page.locator("#claspo-widget").count()) > 0
        
        # Count visible modals
        modals = page.locator(".cl-dialog, .cl-modal, [class*='cl-dialog'], [class*='cl-modal']")
        main_modals_count = 0
        modal_total = await modals.count()
        for i in range(modal_total):
            try:
                if await modals.nth(i).is_visible():
                    main_modals_count += 1
            except Exception:
                pass

        # Count visible floating teasers
        teasers = page.locator(".cl-floating-box, [class*='cl-floating-box']")
        main_teasers_count = 0
        teaser_total = await teasers.count()
        for i in range(teaser_total):
            try:
                if await teasers.nth(i).is_visible():
                    main_teasers_count += 1
            except Exception:
                pass

        # Count visible countdown badges
        countdowns = page.locator("[class*='countdown'], [class*='timer'], [data-claspo-countdown]")
        main_countdowns_count = 0
        cd_total = await countdowns.count()
        for i in range(cd_total):
            try:
                loc = countdowns.nth(i)
                if await loc.is_visible():
                    text = await loc.inner_text()
                    if any(c.isdigit() for c in text) or ":" in text:
                        main_countdowns_count += 1
            except Exception:
                pass

        main_row = {
            "Scope": "Main Window",
            "Url": page.url,
            "ClaspoScript": f"Yes ({main_claspo_scripts})" if main_claspo_scripts > 0 else "No",
            "ClaspoWidgetDom": "Yes" if main_has_widget else "No",
            "ActiveModals": main_modals_count,
            "FloatingTeasers": main_teasers_count,
            "Countdowns": main_countdowns_count,
            "GuardActive": "N/A",
            "Status": "DUPLICATE_COUNTDOWN" if main_countdowns_count > 1 else "OK"
        }
        results.append(main_row)

        # 2. Inspect Child Iframes
        frames = [f for f in page.frames if f != page.main_frame]
        iframe_index = 0
        for frame in frames:
            f_url = frame.url or ""
            f_parsed = urlparse(f_url)
            # Filter to same root domain or embedded app
            if not root_domain or not f_parsed.hostname or not f_parsed.hostname.endswith(root_domain):
                continue

            iframe_index += 1
            f_scripts = await frame.locator("script[src*='claspo']").count()
            f_has_widget = (await frame.locator("#claspo-widget").count()) > 0
            
            f_modals_count = 0
            f_modals = frame.locator(".cl-dialog, .cl-modal, [class*='cl-dialog']")
            for i in range(await f_modals.count()):
                try:
                    if await f_modals.nth(i).is_visible():
                        f_modals_count += 1
                except Exception:
                    pass

            f_teasers_count = 0
            f_teasers = frame.locator(".cl-floating-box, [class*='cl-floating-box']")
            for i in range(await f_teasers.count()):
                try:
                    if await f_teasers.nth(i).is_visible():
                        f_teasers_count += 1
                except Exception:
                    pass

            f_cd_count = 0
            f_countdowns = frame.locator("[class*='countdown'], [class*='timer'], [data-claspo-countdown]")
            for i in range(await f_countdowns.count()):
                try:
                    loc = f_countdowns.nth(i)
                    if await loc.is_visible():
                        text = await loc.inner_text()
                        if any(c.isdigit() for c in text) or ":" in text:
                            f_cd_count += 1
                except Exception:
                    pass

            guard_active = False
            try:
                guard_active = await frame.evaluate("() => Boolean(window.claspo?.__inited && !window._clConfig)")
            except Exception:
                pass

            is_clean = (f_modals_count == 0 and f_teasers_count == 0 and f_cd_count == 0)
            results.append({
                "Scope": f"Iframe [{iframe_index}]",
                "Url": f_url,
                "ClaspoScript": f"Injected ({f_scripts})" if f_scripts > 0 else "Blocked",
                "ClaspoWidgetDom": "Yes" if f_has_widget else "No",
                "ActiveModals": f_modals_count,
                "FloatingTeasers": f_teasers_count,
                "Countdowns": f_cd_count,
                "GuardActive": "Protected" if guard_active else "None",
                "Status": "CLEAN_GUARDED" if is_clean else "DUPLICATE_LEAK"
            })

        await browser.close()

    # Aggregate status check
    total_countdowns = sum(int(r.get("Countdowns", 0)) for r in results)
    if total_countdowns > 1:
        for r in results:
            if r["Status"] == "OK":
                r["Status"] = "ALERT: MULTIPLE_COUNTDOWNS"

    return results

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 diagnose_runner.py <url> [wait_sec]", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]
    wait_sec = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    res = asyncio.run(diagnose_url(url, wait_sec))
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    main()
